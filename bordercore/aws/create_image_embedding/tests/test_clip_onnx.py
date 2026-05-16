"""Smoke tests for the ONNX CLIP wrapper.

These tests require the ONNX models to be present under
aws/create_image_embedding/models/. They are skipped otherwise so CI can
still run when the artefacts aren't bundled.
"""
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

MODELS_DIR = Path(__file__).resolve().parents[1] / "models"
pytestmark = pytest.mark.skipif(
    not (MODELS_DIR / "clip_image_encoder.onnx").exists(),
    reason="ONNX models not exported",
)


def test_encode_image_returns_512_dim_unit_vector():
    from lib.clip_onnx import encode_image

    img = Image.new("RGB", (640, 480), (128, 64, 200))
    vec = encode_image(img)

    assert vec.shape == (512,)
    assert vec.dtype == np.float32
    np.testing.assert_allclose(np.linalg.norm(vec), 1.0, atol=1e-5)


def test_encode_text_returns_512_dim_unit_vector():
    from lib.clip_onnx import encode_text

    vec = encode_text("a photo of a cat")

    assert vec.shape == (512,)
    assert vec.dtype == np.float32
    np.testing.assert_allclose(np.linalg.norm(vec), 1.0, atol=1e-5)


def test_image_and_text_vectors_have_aligned_space():
    """Image and text encoders share the CLIP embedding space.

    A solid red square should sit closer to "a red square" than to a
    semantically unrelated phrase. We use a generous margin because the
    purpose is to catch transposed encoders / wrong output nodes / silent
    embedding-space mismatches, not to benchmark CLIP retrieval quality.
    """
    from lib.clip_onnx import encode_image, encode_text

    img = Image.new("RGB", (224, 224), (220, 30, 30))
    img_vec = encode_image(img)
    matching = encode_text("a red square")
    unrelated = encode_text("a photo of a chocolate cake")

    matching_sim = float(np.dot(img_vec, matching))
    unrelated_sim = float(np.dot(img_vec, unrelated))

    assert matching_sim > unrelated_sim
    assert matching_sim > 0  # positive cosine = the two encoders are in the same space
