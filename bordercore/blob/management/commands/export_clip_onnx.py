"""Export sentence-transformers CLIP-ViT-B-32 image and text encoders to ONNX.

Run on a machine with sentence-transformers + torch installed
(e.g. the dashboard's pytorch env on wumpus). Writes the artefacts under
bordercore/aws/create_image_embedding/models/ so the Lambda container build
picks them up.
"""
from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    """Export the CLIP-ViT-B-32 image and text encoders to ONNX artefacts."""

    help = "Export CLIP-ViT-B-32 image and text encoders to ONNX."

    def handle(self, *args, **options):
        """Load the CLIP model, export both encoders and the tokenizer to disk."""
        import torch
        from sentence_transformers import SentenceTransformer

        out_dir = Path(__file__).resolve().parents[3] / "aws/create_image_embedding/models"
        out_dir.mkdir(parents=True, exist_ok=True)

        model = SentenceTransformer("clip-ViT-B-32")
        # Move to CPU before export so dummy tensors and weights are on the same device,
        # regardless of whether a GPU was used to load the model.
        model = model.cpu()
        vision = model[0].model.vision_model
        visual_proj = model[0].model.visual_projection
        text_model = model[0].model.text_model
        text_proj = model[0].model.text_projection

        class ImageEncoder(torch.nn.Module):
            """Thin wrapper combining the CLIP vision model and visual projection head."""

            def __init__(self):
                super().__init__()
                self.vision_model = vision
                self.visual_projection = visual_proj

            def forward(self, pixel_values):
                """Run the vision backbone and projection to produce an image embedding."""
                pooled = self.vision_model(pixel_values=pixel_values).pooler_output
                return self.visual_projection(pooled)

        class TextEncoder(torch.nn.Module):
            """Thin wrapper combining the CLIP text model and text projection head."""

            def __init__(self):
                super().__init__()
                self.text_model = text_model
                self.text_projection = text_proj

            def forward(self, input_ids, attention_mask):
                """Run the text backbone and projection to produce a text embedding."""
                pooled = self.text_model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                ).pooler_output
                return self.text_projection(pooled)

        img_encoder = ImageEncoder()
        img_encoder.train(False)
        img = torch.randn(1, 3, 224, 224)
        torch.onnx.export(
            img_encoder,
            (img,),
            out_dir / "clip_image_encoder.onnx",
            input_names=["pixel_values"],
            output_names=["embedding"],
            dynamic_axes={"pixel_values": {0: "batch"}, "embedding": {0: "batch"}},
            opset_version=17,
        )

        txt_encoder = TextEncoder()
        txt_encoder.train(False)
        # CLIP's max_position_embeddings is 77 — this is also the fixed sequence
        # length the runtime always pads to (see clip_onnx.py in the Lambda).
        ids = torch.zeros(1, 77, dtype=torch.long)
        mask = torch.ones(1, 77, dtype=torch.long)
        # Sequence axis is intentionally fixed at 77 — the Lambda runtime pads/
        # truncates every input to that length before calling the model.
        torch.onnx.export(
            txt_encoder,
            (ids, mask),
            out_dir / "clip_text_encoder.onnx",
            input_names=["input_ids", "attention_mask"],
            output_names=["embedding"],
            dynamic_axes={
                "input_ids": {0: "batch"},
                "attention_mask": {0: "batch"},
                "embedding": {0: "batch"},
            },
            opset_version=17,
        )

        tok_dir = out_dir / "tokenizer"
        tok_dir.mkdir(exist_ok=True)
        model[0].processor.tokenizer.save_pretrained(tok_dir)

        self.stdout.write(self.style.SUCCESS(f"Exported ONNX models to {out_dir}"))
