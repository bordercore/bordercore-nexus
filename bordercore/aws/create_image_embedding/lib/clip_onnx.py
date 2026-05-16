"""ONNX runtime wrapper for CLIP-ViT-B-32 image and text encoders.

Loads the image and text ONNX models lazily on first use; subsequent calls
reuse cached InferenceSessions. All returned vectors are L2-normalised
float32 numpy arrays of length 512, suitable for cosine-similarity search.
"""
from pathlib import Path
from threading import Lock
from typing import Union

import numpy as np
import onnxruntime as ort
from PIL import Image
from tokenizers import Tokenizer

_MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
_IMAGE_PATH = _MODELS_DIR / "clip_image_encoder.onnx"
_TEXT_PATH = _MODELS_DIR / "clip_text_encoder.onnx"
_TOKENIZER_PATH = _MODELS_DIR / "tokenizer"

_CLIP_MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
_CLIP_STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
_INPUT_SIZE = 224
_MAX_TOKENS = 77  # CLIP-ViT-B-32 max_position_embeddings (matches the ONNX export fixed seq axis)

_lock = Lock()
_image_session: ort.InferenceSession | None = None
_text_session: ort.InferenceSession | None = None
_tokenizer: Tokenizer | None = None


def _get_image_session() -> ort.InferenceSession:
    global _image_session
    if _image_session is None:
        with _lock:
            if _image_session is None:
                _image_session = ort.InferenceSession(
                    str(_IMAGE_PATH), providers=["CPUExecutionProvider"]
                )
    return _image_session


def _get_text_session() -> ort.InferenceSession:
    global _text_session
    if _text_session is None:
        with _lock:
            if _text_session is None:
                _text_session = ort.InferenceSession(
                    str(_TEXT_PATH), providers=["CPUExecutionProvider"]
                )
    return _text_session


def _get_tokenizer() -> Tokenizer:
    global _tokenizer
    if _tokenizer is None:
        with _lock:
            if _tokenizer is None:
                _tokenizer = Tokenizer.from_file(str(_TOKENIZER_PATH / "tokenizer.json"))
                _tokenizer.enable_padding(length=_MAX_TOKENS)
                _tokenizer.enable_truncation(max_length=_MAX_TOKENS)
    return _tokenizer


def _preprocess_image(img: Image.Image) -> np.ndarray:
    img = img.convert("RGB")
    short = min(img.size)
    img = img.resize(
        (round(img.width * _INPUT_SIZE / short), round(img.height * _INPUT_SIZE / short)),
        Image.BICUBIC,
    )
    left = (img.width - _INPUT_SIZE) // 2
    top = (img.height - _INPUT_SIZE) // 2
    img = img.crop((left, top, left + _INPUT_SIZE, top + _INPUT_SIZE))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = (arr - _CLIP_MEAN) / _CLIP_STD
    arr = np.transpose(arr, (2, 0, 1))[None, ...]
    return arr.astype(np.float32)


def _normalize(vec: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(vec)
    return (vec / n).astype(np.float32) if n > 0 else vec.astype(np.float32)


def encode_image(image: Union[Image.Image, bytes]) -> np.ndarray:
    if isinstance(image, bytes):
        from io import BytesIO
        image = Image.open(BytesIO(image))
    pixel_values = _preprocess_image(image)
    output = _get_image_session().run(None, {"pixel_values": pixel_values})[0]
    return _normalize(output[0])


def encode_text(text: str) -> np.ndarray:
    enc = _get_tokenizer().encode(text)
    ids = np.array([enc.ids], dtype=np.int64)
    mask = np.array([enc.attention_mask], dtype=np.int64)
    output = _get_text_session().run(
        None, {"input_ids": ids, "attention_mask": mask}
    )[0]
    return _normalize(output[0])
