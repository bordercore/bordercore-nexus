from __future__ import annotations

"""Management command to verify psycopg3 database connection pooling.

This module provides a Django management command that verifies whether Django
is using psycopg3 as the database driver and whether connection pooling via
psycopg_pool is active. It checks for pool attributes and displays connection
and pooling statistics.
"""

from typing import Any

from django.core.management.base import BaseCommand
from django.db import connection, connections

CANDIDATE_ATTRS = ("pool", "_pool", "_connection_pool", "_psycopg_pool")


class Command(BaseCommand):
    """Management command to verify psycopg3 and connection pooling status.

    This command checks the underlying database connection type, verifies if
    psycopg3 is being used, and determines whether connection pooling is
    enabled by inspecting the database wrapper for pool-related attributes.
    """

    help = "Print whether psycopg3 is in use and whether the psycopg pool is active."

    def handle(self, *args: Any, **opts: Any) -> None:
        """Execute the database pool verification command.

        Checks the database connection type, driver module, and searches for
        connection pool attributes. If a pool is found, displays its statistics.
        Outputs success or warning messages based on the pooling status.

        Args:
            *args: Variable length argument list (unused).
            **opts: Arbitrary keyword arguments (unused).
        """
        connection.ensure_connection()
        conn = connection.connection
        self.stdout.write(f"Underlying connection: {type(conn)}")
        self.stdout.write(f"Driver module: {type(conn).__module__}")

        dbw = connections["default"]
        pool: Any | None = None
        for attr in CANDIDATE_ATTRS:
            cand = getattr(dbw, attr, None)
            if cand and hasattr(cand, "get_stats"):
                pool = cand
                break

        if pool:
            self.stdout.write(self.style.SUCCESS("Pooling appears ENABLED."))
            try:
                self.stdout.write(f"Pool stats: {pool.get_stats()}")
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Could not read pool stats: {e}"))
        else:
            self.stdout.write(self.style.WARNING("Pooling appears DISABLED."))
