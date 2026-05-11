import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faGlobe,
  faPaste,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { getCsrfToken } from "../utils/reactUtils";

interface Message {
  body: string;
  variant: string;
  autoHide: boolean;
}

interface BlobImportPageProps {
  staticUrl: string;
  importUrl: string;
  messages: Message[];
  initialUrl?: string;
}

interface SupportedSite {
  brand: string; // CSS hook (also used to look up data-brand styling)
  domain: string; // bare-domain match — mirrors the server's split logic
  label: string; // display name in tooltip / recognition badge
  iconFile: string; // file under {staticUrl}img/
  caveat?: string; // appended to tooltip when present (e.g. "metadata only")
}

const SUPPORTED_SITES: SupportedSite[] = [
  { brand: "instagram", domain: "instagram.com", label: "Instagram", iconFile: "instagram.ico" },
  {
    brand: "artstation",
    domain: "artstation.com",
    label: "Artstation",
    iconFile: "artstation.ico",
  },
  {
    brand: "nytimes",
    domain: "nytimes.com",
    label: "New York Times",
    iconFile: "nytimes.ico",
    caveat: "metadata only",
  },
];

// Matches the server-side split in blob/services.py::import_blob — last two
// dotted parts of the hostname so "www.instagram.com" → "instagram.com".
const baseDomain = (hostname: string): string => {
  const parts = hostname.toLowerCase().split(".");
  return parts.length >= 2 ? parts.slice(-2).join(".") : hostname;
};

interface RecognizedSite {
  hostname: string;
  match?: SupportedSite; // undefined ⇒ falls back to the generic-article path
}

// Returns null until the field holds a parseable absolute URL — the page
// shouldn't claim recognition for a half-typed string like "https://".
const recognizeUrl = (raw: string): RecognizedSite | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const domain = baseDomain(parsed.hostname);
    const match = SUPPORTED_SITES.find(site => site.domain === domain);
    return { hostname: parsed.hostname, match };
  } catch {
    return null;
  }
};

export function BlobImportPage({
  staticUrl,
  importUrl,
  messages: initialMessages,
  initialUrl = "",
}: BlobImportPageProps) {
  const [url, setUrl] = useState(initialUrl);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pasteFailed, setPasteFailed] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  const recognized = useMemo(() => recognizeUrl(url), [url]);
  const hasUrl = url.trim().length > 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!hasUrl) {
      e.preventDefault();
      return;
    }
    // Refresh CSRF from the live cookie so a long-idle tab still posts.
    const tokenInput = e.currentTarget.querySelector<HTMLInputElement>(
      'input[name="csrfmiddlewaretoken"]'
    );
    if (tokenInput) tokenInput.value = getCsrfToken();
    setIsProcessing(true);
    // The form submits naturally; the overlay covers the hero until nav.
  };

  const handlePaste = async () => {
    if (!navigator.clipboard?.readText) {
      setPasteFailed(true);
      return;
    }
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        setUrl(text);
        urlInputRef.current?.focus();
      }
    } catch {
      // Permission denied or unsupported — fall back to letting the user paste
      // manually with the keyboard. We surface a short hint via the title attr
      // so they know why the click did nothing.
      setPasteFailed(true);
    }
  };

  const dismissMessage = (index: number) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
  };

  const overlayHost =
    recognized?.hostname ||
    (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    })();

  return (
    <div className="bi-shell">
      <div className="bi-hero">
        <header className="bi-heading">
          <h1 className="bi-title">Import a blob</h1>
          <p className="bi-subtitle">Paste a URL — we'll fetch the metadata and assets for you.</p>
        </header>

        {messages.length > 0 && (
          <div>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`bi-message ${msg.variant === "error" ? "" : "is-info"}`}
                role="alert"
              >
                <FontAwesomeIcon icon={faExclamationTriangle} className="bi-message-icon" />
                {/*
                  Render as text — server messages can include user-controlled
                  URL fragments. The literal <strong> tags from services.py
                  show up verbatim, matching the previous behavior.
                */}
                <div className="bi-message-body">{msg.body}</div>
                <button
                  type="button"
                  className="bi-message-close"
                  onClick={() => dismissMessage(index)}
                  aria-label="Dismiss message"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          id="import-blob-form"
          className="bi-form"
          method="post"
          action={importUrl}
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="csrfmiddlewaretoken" defaultValue={getCsrfToken()} />

          <div className="bi-input-pill">
            <span className={`bi-input-leader ${recognized?.match ? "is-recognized" : ""}`}>
              <span className="bi-leader-icon">
                {recognized?.match ? (
                  <img
                    src={`${staticUrl}img/${recognized.match.iconFile}`}
                    alt=""
                    aria-hidden="true"
                  />
                ) : (
                  <FontAwesomeIcon icon={faGlobe} />
                )}
              </span>
              {recognized?.match && (
                <span className="bi-leader-badge">{recognized.match.label}</span>
              )}
            </span>

            <input
              ref={urlInputRef}
              className="bi-input-field"
              name="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              type="text"
              placeholder="https://…"
              autoComplete="off"
              spellCheck={false}
            />

            {hasUrl ? (
              <button type="submit" className="bi-input-action is-import">
                Import
              </button>
            ) : (
              <button
                type="button"
                className="bi-input-action is-paste"
                onClick={handlePaste}
                title={
                  pasteFailed
                    ? "Clipboard unavailable — paste with the keyboard"
                    : "Paste from clipboard"
                }
              >
                <FontAwesomeIcon icon={faPaste} />
                Paste
              </button>
            )}
          </div>
        </form>

        <div className="bi-works-with">
          <span className="bi-works-with-label">Works with</span>
          <ul className="bi-works-with-list">
            {SUPPORTED_SITES.map(site => (
              <li key={site.brand} className="bi-works-with-chip" data-brand={site.brand}>
                <img src={`${staticUrl}img/${site.iconFile}`} alt={site.label} />
                <span className="bi-works-with-tip">
                  {site.label}
                  {site.caveat ? ` · ${site.caveat}` : ""}
                </span>
              </li>
            ))}
            <li className="bi-works-with-chip" data-brand="generic">
              <FontAwesomeIcon icon={faGlobe} />
              <span className="bi-works-with-tip">Any article · best-effort</span>
            </li>
          </ul>
        </div>

        {isProcessing && (
          <div className="bi-overlay" aria-live="polite">
            <span className="bi-overlay-icon">
              {recognized?.match ? (
                <img
                  src={`${staticUrl}img/${recognized.match.iconFile}`}
                  alt=""
                  aria-hidden="true"
                />
              ) : (
                <FontAwesomeIcon icon={faGlobe} />
              )}
            </span>
            <div className="bi-overlay-text">
              <span className="bi-overlay-pulse" aria-hidden="true" />
              <span>
                Fetching from <span className="bi-overlay-host">{overlayHost}</span>…
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BlobImportPage;
