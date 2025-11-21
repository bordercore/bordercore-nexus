from __future__ import annotations

"""Verify Django is using psycopg3 and whether psycopg_pool is active."""

from typing import Any, Optional

from django.core.management.base import BaseCommand
from django.db import connection, connections

CANDIDATE_ATTRS = ("pool", "_pool", "_connection_pool", "_psycopg_pool")

class Command(BaseCommand):
    help = "Print whether psycopg3 is in use and whether the psycopg pool is active."

    def handle(self, *args, **opts) -> None:
        connection.ensure_connection()
        conn = connection.connection
        self.stdout.write(f"Underlying connection: {type(conn)}")
        self.stdout.write(f"Driver module: {type(conn).__module__}")

        dbw = connections["default"]
        pool: Optional[Any] = None
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
