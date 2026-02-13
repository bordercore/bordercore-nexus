"""Create a copy of a blob, including its metadata.

Does not include the file, if present. Optionally adds the clone to the
same collections as the original.
"""

from django.core.management.base import BaseCommand
from django.db.transaction import atomic

from blob.models import Blob


class Command(BaseCommand):
    """Management command to clone a blob by UUID."""

    help = "Clone a blob"

    def add_arguments(self, parser):
        """Add --uuid and --include-collections arguments.

        Args:
            parser: The argument parser for the management command.
        """
        parser.add_argument(
            "--uuid",
            help="The UUID of the blob to clone",
            required=True
        )
        parser.add_argument(
            "--include-collections",
            action="store_true",
            help="Add the cloned blob to the same collections as the original",
        )

    @atomic
    def handle(self, *args, uuid, collection_uuid, **kwargs):
        """Clone the specified blob.

        Args:
            *args: Variable length argument list.
            uuid: UUID of the blob to clone.
            collection_uuid: Unused (collections handled via --include-collections).
            **kwargs: Additional keyword arguments.
        """
        original_blob = Blob.objects.get(uuid=uuid)
        self.stdout.write(f"Cloning blob named '{original_blob.name}'")

        original_blob.clone(include_collections)
