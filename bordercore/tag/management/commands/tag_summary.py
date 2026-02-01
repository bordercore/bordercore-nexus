"""
Display a summary of a tag, including all models with ManyToMany relationships
and the count of objects connected to the tag.

Usage:
    python manage.py tag_summary <tag_name>
    python manage.py tag_summary <tag_name> --username=jerrell
    python manage.py tag_summary <tag_name> --verbose
"""

import sys
from argparse import ArgumentParser
from typing import Any, cast

from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand
from django.db.models import Model

from tag.models import Tag


class Command(BaseCommand):
    help = "Display a summary of a tag, including all related models and object counts"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "tag_name",
            help="The name of the tag to summarize"
        )
        parser.add_argument(
            "--username",
            help="Username to filter by (defaults to 'jerrell')",
            default="jerrell"
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Display the name of each object linked to this tag"
        )

    def handle(
        self,
        tag_name: str,
        username: str,
        verbose: bool,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        # Look up the user
        try:
            user = User.objects.get(username=username)
        except ObjectDoesNotExist:
            self.stderr.write(self.style.ERROR(f"User does not exist: {username}"))
            sys.exit(1)

        # Look up the tag
        try:
            tag = Tag.objects.get(name=tag_name, user=user)
        except ObjectDoesNotExist:
            self.stderr.write(
                self.style.ERROR(f"Tag '{tag_name}' does not exist for user '{username}'")
            )
            sys.exit(1)

        # Discover all models with ManyToMany relationships to Tag
        related_models = self._discover_related_models()

        # Count objects for each related model
        counts = self._count_related_objects(tag, related_models)

        # Get objects if verbose mode is enabled
        objects_by_model = {}
        if verbose:
            objects_by_model = self._get_related_objects(tag, related_models)

        # Display the summary
        self._display_summary(tag, counts, objects_by_model if verbose else None)

    def _discover_related_models(self) -> list[dict[str, Any]]:
        """
        Discover all models that have ManyToMany relationships to Tag
        by examining reverse relationships on the Tag model.

        Returns:
            List of dictionaries containing model info and relationship details.
        """
        related_models = []

        # Check all fields on the Tag model for reverse ManyToMany relationships
        for field in Tag._meta.get_fields():
            # Look for reverse ManyToMany relationships
            if (hasattr(field, "related_model") and
                field.related_model is not None and
                field.related_model != Tag):
                # Check if this is a ManyToMany relationship
                # Reverse ManyToMany fields have a related_model and are ManyToManyRel
                related_model = field.related_model

                # Check if this is a reverse ManyToMany relationship
                # ManyToManyRel is the class for reverse ManyToMany relationships
                # We check by class name since it may not be directly importable
                field_type_name = field.__class__.__name__
                if field_type_name != "ManyToManyRel":
                    continue

                # Get the through model if it exists
                through_model = None
                if hasattr(field, "through"):
                    through_model = field.through
                else:
                    remote_field = getattr(field, "remote_field", None)
                    if remote_field is not None and hasattr(remote_field, "through"):
                        through_model = remote_field.through

                # Get a display name for the model (related_model is a Model class here)
                related_model_cls = cast(type[Model], related_model)
                model_name = f"{related_model_cls._meta.app_label}.{related_model_cls._meta.model_name}"

                related_models.append({
                    "model": related_model_cls,
                    "reverse_accessor": field.name,
                    "through": through_model,
                    "model_name": model_name,
                })

        return related_models

    def _count_related_objects(
        self, tag: Tag, related_models: list[dict[str, Any]]
    ) -> dict[str, int]:
        """
        Count objects for each related model connected to the tag.

        Args:
            tag: The Tag instance to count relationships for.
            related_models: List of dictionaries with model and field information.

        Returns:
            Dictionary mapping model names to counts.
        """
        counts = {}

        for rel_info in related_models:
            reverse_accessor = rel_info["reverse_accessor"]
            through_model = rel_info["through"]
            model_name = rel_info["model_name"]

            try:
                # Get the related manager from the tag
                related_manager = getattr(tag, reverse_accessor, None)
                if related_manager:
                    # Use the related manager to count
                    count = related_manager.count()
                elif through_model:
                    # Fallback: if related manager doesn't exist but through model does,
                    # query the through model directly
                    count = through_model.objects.filter(tag=tag).count()
                else:
                    # Last resort: skip this relationship
                    self.stderr.write(
                        self.style.WARNING(
                            f"Warning: Could not access relationship for {model_name}"
                        )
                    )
                    count = 0
            except Exception as e:
                # If counting fails, log and continue
                self.stderr.write(
                    self.style.WARNING(
                        f"Warning: Could not count {model_name}: {e}"
                    )
                )
                count = 0

            counts[model_name] = count

        return counts

    def _get_related_objects(
        self, tag: Tag, related_models: list[dict[str, Any]]
    ) -> dict[str, list[Any]]:
        """
        Get all objects for each related model connected to the tag.

        Args:
            tag: The Tag instance to get relationships for.
            related_models: List of dictionaries with model and field information.

        Returns:
            Dictionary mapping model names to lists of objects.
        """
        objects_by_model = {}

        for rel_info in related_models:
            reverse_accessor = rel_info["reverse_accessor"]
            through_model = rel_info["through"]
            related_model = rel_info["model"]
            model_name = rel_info["model_name"]

            try:
                # Get the related manager from the tag
                related_manager = getattr(tag, reverse_accessor, None)
                if related_manager:
                    # Get all objects from the related manager
                    objects = list(related_manager.all())
                elif through_model:
                    # Fallback: if related manager doesn't exist but through model does,
                    # get objects via the through model
                    # The through model should have a ForeignKey to the related model
                    through_objects = through_model.objects.filter(tag=tag).select_related()
                    objects = []
                    # Get the model name without app label to find the field name
                    model_field_name = related_model._meta.model_name
                    for through_obj in through_objects:
                        # Try to get the related object from the through model
                        if hasattr(through_obj, model_field_name):
                            obj = getattr(through_obj, model_field_name)
                            if obj is not None:
                                objects.append(obj)
                        else:
                            # Try alternative field names (e.g., bookmark, todo)
                            for field_name in ["bookmark", "todo", "blob", "question", "album", "song", "collection"]:
                                if hasattr(through_obj, field_name):
                                    obj = getattr(through_obj, field_name)
                                    if obj is not None and isinstance(obj, related_model):
                                        objects.append(obj)
                                        break
                else:
                    objects = []
            except Exception as e:
                # If getting objects fails, log and continue
                self.stderr.write(
                    self.style.WARNING(
                        f"Warning: Could not get objects for {model_name}: {e}"
                    )
                )
                objects = []

            objects_by_model[model_name] = objects

        return objects_by_model

    def _display_summary(
        self, tag: Tag, counts: dict[str, int], objects_by_model: dict[str, list[Any]] | None = None
    ) -> None:
        """
        Display the tag summary in a user-friendly format.

        Args:
            tag: The Tag instance.
            counts: Dictionary mapping model names to counts.
            objects_by_model: Optional dictionary mapping model names to lists of objects.
        """
        # Display tag information
        self.stdout.write(self.style.SUCCESS(f"\nTag Summary: {tag.name}"))
        self.stdout.write(f"User: {tag.user.username}")
        self.stdout.write(f"Created: {tag.created.strftime('%Y-%m-%d %H:%M:%S')}")
        self.stdout.write(f"Is Meta: {'Yes' if tag.is_meta else 'No'}")

        # Filter out zero counts and sort by model name
        non_zero_counts = {
            model_name: count
            for model_name, count in counts.items()
            if count > 0
        }

        if not non_zero_counts:
            self.stdout.write(self.style.WARNING("\nNo related objects found."))
            return

        # Display related objects table
        self.stdout.write("\nRelated Objects:")
        self.stdout.write("┌" + "─" * 40 + "┬" + "─" * 12 + "┐")

        # Header
        self.stdout.write(f"│ {'Model':<38} │ {'Count':<10} │")
        self.stdout.write("├" + "─" * 40 + "┼" + "─" * 12 + "┤")

        # Sort by model name for consistent output
        sorted_counts = sorted(non_zero_counts.items())

        # Display rows
        total = 0
        for model_name, count in sorted_counts:
            # Format model name (remove app label prefix for cleaner display)
            display_name = model_name.split(".")[-1].title()
            self.stdout.write(f"│ {display_name:<38} │ {count:<10} │")
            total += count

        # Footer
        self.stdout.write("└" + "─" * 40 + "┴" + "─" * 12 + "┘")
        self.stdout.write(f"\nTotal: {total} object{'s' if total != 1 else ''}")

        # Display object names if verbose mode is enabled
        if objects_by_model:
            self.stdout.write("\n" + "=" * 60)
            self.stdout.write("Object Details:")
            self.stdout.write("=" * 60)

            for model_name, count in sorted_counts:
                if model_name in objects_by_model:
                    objects = objects_by_model[model_name]
                    if objects:
                        display_name = model_name.split(".")[-1].title()
                        self.stdout.write(f"\n{display_name}:")
                        for obj in objects:
                            # Get UUID if available
                            uuid_str = ""
                            if hasattr(obj, "uuid"):
                                uuid_str = f"{obj.uuid} "

                            # Check if the object has a 'name' attribute, otherwise use __str__
                            if hasattr(obj, "name") and obj.name:
                                self.stdout.write(f"  - {uuid_str}{obj.name}")
                            else:
                                # Use the object's __str__ method for display
                                self.stdout.write(f"  - {uuid_str}{obj}")
