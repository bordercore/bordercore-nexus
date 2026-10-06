"""Provider requests and pure lesson assembly, ported from the Lumen dashboard."""

import json
import os
import re
import uuid
from html import escape
from typing import Any, TypedDict

import requests

from django.core.cache import cache

from .prompts import SYSTEM, ACCURACY_SYSTEM
from .themes import DEFAULT_STYLE, style_prompt


class Provider(TypedDict):
    label: str
    models: list[str]


PROVIDERS: dict[str, Provider] = {
    "anthropic": {
        "label": "Anthropic",
        "models": [
            "claude-opus-5-5",
            "claude-sonnet-5-5",
            "claude-sonnet-5",
            "claude-sonnet-4-6",
            "claude-haiku-4-5",
            "claude-fable-5-1",
            "claude-fable-5",
        ],
    },
    "openai": {
        "label": "OpenAI",
        "models": ["gpt-6-astra", "gpt-6-sol", "gpt-6-luna", "gpt-4o"],
    },
    "openrouter": {"label": "OpenRouter", "models": []},
}

CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"


class UserError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


class APIAuth(requests.auth.AuthBase):
    """Keep explicit API credentials authoritative over requests' implicit .netrc auth."""

    def __init__(self, headers: dict[str, str]) -> None:
        self.headers = headers

    def __call__(self, prepared: requests.PreparedRequest) -> requests.PreparedRequest:
        prepared.headers.update(self.headers)
        return prepared


def api_key(provider: str) -> str:
    names = {
        "anthropic": ("ANTHROPIC_API_KEY",),
        "openai": ("OPENAI_API_KEY",),
        "openrouter": ("OPENROUTER_API_KEY", "OPENROUTER_KEY"),
    }[provider]
    return next((value for name in names if (value := os.environ.get(name, ""))), "")


def canonical_uuid(value: Any) -> str:
    if not isinstance(value, str) or not re.fullmatch(
        r"[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", value.strip()
    ):
        raise UserError("Enter a complete UUID: 8-4-4-4-12 hexadecimal characters.")
    return str(uuid.UUID(value.strip()))


def checked_response(response: requests.Response, service: str) -> Any:
    if not response.ok:
        # Never expose upstream HTML, request headers, or credentials in errors.
        messages = {
            401: "authentication failed",
            403: "access denied",
            404: "not found",
            429: "rate limit or quota reached",
        }
        raise UserError(
            f"{service}: HTTP {response.status_code} ({messages.get(response.status_code, 'request failed')}). Check the selected model and server credentials.",
            502,
        )
    try:
        return response.json()
    except ValueError:
        raise UserError(f"{service} returned an invalid JSON response.", 502)


def generate(
    source: dict[str, str], selected: dict[str, str], *, accuracy_only: bool = False
) -> str:
    provider, model = selected["provider"], selected["model"]
    key = api_key(provider)
    if not key:
        raise UserError(
            f"{PROVIDERS[provider]['label']} API key is missing from the server environment.",
            503,
        )
    system_prompt = (
        ACCURACY_SYSTEM
        if accuracy_only
        else SYSTEM + style_prompt(selected.get("style", DEFAULT_STYLE))
    )
    prompt = "Source JSON:\n" + json.dumps(source, ensure_ascii=False)
    if provider == "anthropic":
        result = checked_response(
            requests.post(
                "https://api.anthropic.com/v1/messages",
                auth=APIAuth({"x-api-key": key, "anthropic-version": "2023-06-01"}),
                json={
                    "model": model,
                    "max_tokens": 4000 if accuracy_only else 16000,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=(15, 600),
                allow_redirects=False,
            ),
            "Anthropic",
        )
        if result.get("stop_reason") == "max_tokens":
            raise UserError(
                "The model ran out of output space. Try another model or regenerate.",
                502,
            )
        return "\n".join(
            b.get("text", "")
            for b in result.get("content", [])
            if b.get("type") == "text"
        )
    base = (
        "https://api.openai.com/v1"
        if provider == "openai"
        else "https://openrouter.ai/api/v1"
    )
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
    }
    payload["max_completion_tokens" if provider == "openai" else "max_tokens"] = (
        4000 if accuracy_only else 20000
    )
    if provider == "openai":
        payload["response_format"] = {"type": "json_object"}
    result = checked_response(
        requests.post(
            base + "/chat/completions",
            auth=APIAuth({"Authorization": f"Bearer {key}"}),
            json=payload,
            timeout=(15, 600),
            allow_redirects=False,
        ),
        PROVIDERS[provider]["label"],
    )
    choices = result.get("choices", [])
    if not choices or choices[0].get("finish_reason") not in ("stop", None):
        raise UserError(
            "The model did not finish the lesson. Try another model or regenerate.", 502
        )
    return choices[0].get("message", {}).get("content") or ""


def parse_lesson(raw: str) -> dict[str, Any]:
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > 2_000_000:
        raise UserError("The model returned an oversized or invalid lesson.", 502)
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    try:
        result = json.loads(raw)
    except ValueError:
        raise UserError(
            "The model returned malformed lesson JSON. Try regenerating or select another model.",
            502,
        )
    if not isinstance(result, dict) or not all(
        isinstance(result.get(k), str) and result[k].strip()
        for k in ("title", "summary", "html")
    ):
        raise UserError("The model returned an incomplete lesson.", 502)
    followups = result.get("followups")
    if (
        not isinstance(followups, list)
        or not 5 <= len(followups) <= 8
        or not all(
            isinstance(item, dict)
            and all(
                isinstance(item.get(k), str) and item[k].strip()
                for k in ("question", "answer")
            )
            for item in followups
        )
    ):
        raise UserError(
            "The lesson needs 5–8 complete follow-up questions and answers. Please regenerate.",
            502,
        )
    html = result["html"]
    if not all(
        re.search(pattern, html, re.I)
        for pattern in (
            r"<!doctype html",
            r"<head[\s>]",
            r"</head>",
            r"<body[\s>]",
            r"</body>",
            r"</html>",
            r"<script[\s>]",
            r"</script>",
            r"<(?:button|input|select)[\s>]",
        )
    ):
        raise UserError(
            "The model did not produce a complete interactive HTML page. Please regenerate.",
            502,
        )
    result["accuracy"] = validate_accuracy(result.get("accuracy"))
    return result


def assemble_html(lesson: dict[str, Any], source: dict[str, str]) -> str:
    qa = "".join(
        f"<details><summary>{escape(item['question'])}</summary><p>{escape(item['answer'])}</p></details>"
        for item in lesson["followups"]
    )
    appendix = (
        """<section id="lumen-review" aria-label="Follow-up questions">
<style>#lumen-review{box-sizing:border-box;max-width:1050px;margin:64px auto;padding:36px;color:#eef0fa;background:#171b30;border:1px solid #444761;border-radius:24px;font:17px/1.7 system-ui}#lumen-review h2{font-size:30px;color:#ece2be}#lumen-review details{padding:18px 0;border-bottom:1px solid #444761}#lumen-review summary{cursor:pointer;font-weight:650}#lumen-review summary:focus-visible{outline:2px solid #ddc78d}#lumen-review p{white-space:pre-wrap;color:#d3d7e8}#lumen-review small{color:#b9bdd1}</style>
<h2>Keep the curiosity going.</h2><p>Think through each question before revealing its answer.</p>"""
        + qa
        + "<h2>The original drill</h2><small>Retrieved from Bordercore. The explanation and follow-up questions above are AI-generated.</small><h3>Question</h3><p>"
        + escape(source["question"])
        + "</p><details><summary>Original answer</summary><p>"
        + escape(source["answer"])
        + "</p></details></section>"
    )
    html = re.sub(
        r"(<head\b[^>]*>)",
        lambda m: (
            m[0]
            + '<meta http-equiv="Content-Security-Policy" content="'
            + escape(CSP, quote=True)
            + '">'
        ),
        lesson["html"],
        count=1,
        flags=re.I,
    )
    return re.sub(r"</body>", lambda _: appendix + "</body>", html, count=1, flags=re.I)


def model_catalog(provider: str) -> dict[str, Any]:
    """Cache provider catalogs; keep custom model IDs usable during outages."""
    if provider not in PROVIDERS:
        raise UserError("Unknown provider.")
    cache_key = f"lumen:models:{provider}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    key = api_key(provider)
    fallback = [{"id": model, "name": model} for model in PROVIDERS[provider]["models"]]
    if not key and provider != "openrouter":
        return {
            "models": fallback,
            "warning": "No API key configured. Custom model IDs are supported.",
        }
    urls = {
        "anthropic": "https://api.anthropic.com/v1/models",
        "openai": "https://api.openai.com/v1/models",
        "openrouter": "https://openrouter.ai/api/v1/models",
    }
    headers = (
        {"x-api-key": key, "anthropic-version": "2023-06-01"}
        if provider == "anthropic"
        else ({"Authorization": f"Bearer {key}"} if key else {})
    )
    try:
        data = checked_response(
            requests.get(
                urls[provider],
                auth=APIAuth(headers),
                timeout=(10, 20),
                allow_redirects=False,
            ),
            PROVIDERS[provider]["label"],
        )
        models = [
            {
                "id": item["id"],
                "name": item.get("name") or item.get("display_name") or item["id"],
            }
            for item in data["data"]
        ]
        if provider == "openai":
            models = [
                m
                for m in models
                if re.match(r"^(gpt-|chatgpt-|o[1-9])", m["id"])
                and not any(
                    w in m["id"]
                    for w in ("audio", "realtime", "transcribe", "image", "tts")
                )
            ]
        result = {"models": sorted(models, key=lambda item: item["id"])}
        cache.set(cache_key, result, 1800)
        return result
    except (UserError, requests.RequestException, KeyError, TypeError, ValueError):
        return {
            "models": fallback,
            "warning": "Live model catalog unavailable. Custom model IDs are still supported.",
        }


def validate_accuracy(value: Any) -> dict[str, Any]:
    """Accept complete correction proposals only; prose/HTML is never a write payload."""
    if not isinstance(value, dict) or value.get("status") not in (
        "accurate",
        "issues",
        "uncertain",
    ):
        raise UserError(
            "The model returned an invalid accuracy assessment. Please retry.", 502
        )
    if (
        not isinstance(value.get("explanation"), str)
        or not value["explanation"].strip()
    ):
        raise UserError("The accuracy assessment is missing an explanation.", 502)
    if value["status"] == "issues":
        if not all(
            isinstance(value.get(k), str)
            and value[k].strip()
            and len(value[k]) <= 100_000
            for k in ("question", "answer")
        ):
            raise UserError(
                "The model did not supply a complete corrected question and answer.",
                502,
            )
    elif any(value.get(k) is not None for k in ("question", "answer")):
        raise UserError(
            "An uncertain or accurate assessment must not propose changes.", 502
        )
    return {
        key: value.get(key) for key in ("status", "explanation", "question", "answer")
    }


def generate_accuracy(
    source: dict[str, str], selected: dict[str, str]
) -> dict[str, Any]:
    raw = generate(source, selected, accuracy_only=True)
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > 2_000_000:
        raise UserError("The model returned an invalid accuracy assessment.", 502)
    try:
        data = json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip()))
    except ValueError:
        raise UserError(
            "The model returned malformed accuracy JSON. Please retry.", 502
        )
    return validate_accuracy(data.get("accuracy") if isinstance(data, dict) else None)
