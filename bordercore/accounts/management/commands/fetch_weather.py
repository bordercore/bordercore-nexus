"""
Management command to fetch weather data from WeatherAPI and store it in user profile.

This command fetches weather information from the WeatherAPI service and stores
it (excluding the forecast field) in the UserProfile.weather JSONField.

Usage:
    python manage.py fetch_weather <username>
    
Environment Variables:
    WEATHER_API_KEY: API key for WeatherAPI service
"""

import os
from argparse import ArgumentParser
from typing import Any

import requests
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User

from accounts.models import UserProfile


class Command(BaseCommand):
    """Django management command to fetch and store weather data.

    This command retrieves current weather information from WeatherAPI for a
    hardcoded location (02138) and stores the response data in the specified
    user's profile. The forecast field is excluded from the stored data.
    """

    help = "Fetch weather data from WeatherAPI and store it in user profile"

    def add_arguments(self, parser: ArgumentParser) -> None:
        """Add command-line arguments to the parser.

        Args:
            parser: The argument parser instance to add arguments to.
        """
        parser.add_argument(
            "username",
            type=str,
            help="Username of the user whose profile will be updated"
        )
        parser.add_argument(
            "--debug",
            action="store_true",
            help="Enable debug mode to print success messages"
        )

    def handle(self, *args: Any, **options: Any) -> None:
        """Execute the weather fetch command.

        This method retrieves weather data from WeatherAPI, validates the user
        exists, and stores the weather data (excluding forecast) in the user's
        profile. Raises CommandError if the API key is missing, the user doesn't
        exist, or the API request fails.

        Args:
            *args: Variable length argument list (unused).
            **options: Keyword arguments containing:
                username: The username of the user whose profile will be updated.
                debug: If True, print success messages to stdout.

        Raises:
            CommandError: If WEATHER_API_KEY is not set, the user doesn't exist,
                or the API request fails.
        """
        username = options["username"]
        
        # Get API key from environment
        api_key = os.environ.get("WEATHER_API_KEY")
        if not api_key:
            raise CommandError("WEATHER_API_KEY environment variable is not set")
        
        # Get user
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f"User '{username}' does not exist")
        
        # Get or create user profile
        user_profile, created = UserProfile.objects.get_or_create(user=user)
        
        # Build API URL
        url = f"http://api.weatherapi.com/v1/forecast.json?key={api_key}&q=02138&days=1&aqi=yes&alerts=yes"
        
        # Make API request
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            weather_data = response.json()
        except requests.exceptions.RequestException as e:
            raise CommandError(f"Failed to fetch weather data: {e}")
        except ValueError as e:
            raise CommandError(f"Failed to parse weather data: {e}")
        
        # Remove forecast field
        if "forecast" in weather_data:
            del weather_data["forecast"]
        
        # Store in user profile
        user_profile.weather = weather_data
        user_profile.save()
        
        if options.get("debug"):
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully updated weather data for user '{username}'"
                )
            )

