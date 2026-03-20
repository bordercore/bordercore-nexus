"""
Send an email listing all high-priority todo items for a specified user.

This script connects to a Django backend, queries the `Todo` model for items
marked with high priority for a given user, and emails the list to a specified
recipient using a local SMTP server.

Usage:
    python send_todo_email.py --username USERNAME --recipient RECIPIENT_EMAIL
"""

import argparse
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import django
from django.core.exceptions import ObjectDoesNotExist
from django.db import connections

django.setup()

from django.contrib.auth.models import User

from todo.models import Todo


def send_email(
    receiver_email: str,
    subject: str,
    body: str,
    smtp_host: str = "localhost",
    smtp_port: int = 25
) -> None:
    """
    Send an email with the given subject and body to the receiver.

    Args:
        receiver_email: Email address of the recipient.
        subject: Email subject line.
        body: Plain text body of the email.
        smtp_host: SMTP server hostname (default is "localhost").
        smtp_port: SMTP server port (default is 25).
    """
    # Create message
    message = MIMEMultipart()
    message["From"] = "Admin <admin@bordercore.com>"
    message["To"] = receiver_email
    message["Subject"] = subject

    # Add body
    message.attach(MIMEText(body, "plain"))

    # Connect to local SMTP server
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.send_message(message)


def build_body(username: str) -> Optional[str]:
    """
    Build the plain text body of the email listing all high-priority todos
    for the specified user.

    Args:
        username: The username of the user whose todos to fetch.

    Returns:
        A string with newline-separated todo item names, or None if the user
        does not exist or has no high-priority todos.
    """
    try:
        user = User.objects.get(username=username)
    except ObjectDoesNotExist:
        return None

    priority = Todo.get_priority_value("High")
    todos = Todo.objects.filter(priority=priority, user=user)

    if not todos.exists():
        return None

    return "\n".join(f"- {todo.name}" for todo in todos)


def main() -> None:
    """
    Entry point for the CLI script.
    Parses arguments and sends the todo email.
    """
    parser = argparse.ArgumentParser(description="Send high-priority todos via email.")
    parser.add_argument("--username", required=True, help="Username to fetch todos for")
    parser.add_argument("--recipient", required=True, help="Email address to send the todos to")
    args = parser.parse_args()

    body = build_body(args.username)

    if body is None:
        print(f"No high-priority todos found for user '{args.username}' or user does not exist.")
        return

    send_email(
        args.recipient,
        "High Priority Todo Items",
        body
    )


if __name__ == "__main__":
    try:
        main()
    finally:
        for conn in connections.all():
            conn.close_pool()
        connections.close_all()
