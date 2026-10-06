"""Run the durable Lumen queue independently of web workers."""

import signal
from threading import Event
from typing import Any

from lumen.services import claim_job, run_job

from django.core.management.base import BaseCommand, CommandParser
from django.db import close_old_connections


class Command(BaseCommand):
    help = "Process Lumen lessons (one provider request at a time)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--once", action="store_true", help="Process at most one job and exit."
        )

    def handle(self, *args: Any, **options: Any) -> None:
        stopped = Event()
        previous = {}
        for signum in (signal.SIGTERM, signal.SIGINT):
            previous[signum] = signal.signal(signum, lambda *_: stopped.set())
        try:
            while not stopped.is_set():
                close_old_connections()
                job = claim_job()
                if job:
                    run_job(job)
                if options["once"]:
                    break
                if not job:
                    stopped.wait(2)
        finally:
            for signum, handler in previous.items():
                signal.signal(signum, handler)
            close_old_connections()
