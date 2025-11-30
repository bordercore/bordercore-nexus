"""Template filter for checking user group membership.

This module provides a Django template filter that checks whether a user
belongs to a specific group by name.
"""

from django import template
from django.contrib.auth.models import User

register = template.Library()


@register.filter(name="is_in_group")
def is_in_group(user: User, group_name: str) -> bool:
    """Check if a user belongs to a specific group.

    Args:
        user: User instance to check group membership for.
        group_name: Name of the group to check membership against.

    Returns:
        True if the user belongs to the specified group, False otherwise.
    """
    return user.groups.filter(name=group_name).exists()
