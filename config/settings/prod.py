"""Production settings and globals."""
from .base import *
from .base import require_setting

# Fail fast if SECRET_KEY is unset rather than booting prod with an empty
# signing key (which silently weakens sessions, CSRF, and signed cookies).
SECRET_KEY = require_setting(SECRET_KEY, "SECRET_KEY")

CSRF_TRUSTED_ORIGINS = ["https://www.bordercore.com"]

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": "/var/tmp/django_cache",
    }
}

LOGGING["handlers"]["bordercore"] = {
    "level": "DEBUG",
    "class": "logging.handlers.RotatingFileHandler",
    "maxBytes": 1024 * 1024 * 10,  # 10MB
    "backupCount": 5,
    "formatter": "standard",
    "filename": "/var/log/django/bordercore.log"
}

LOGGING["handlers"]["disallowed_host"] = {
    "level": "ERROR",
    "class": "logging.handlers.RotatingFileHandler",
    "maxBytes": 1024 * 1024 * 10,  # 10MB
    "backupCount": 5,
    "formatter": "standard",
    "filename": "/var/log/django/disallowed_host.log",
}

LOGGING["loggers"]["django.request"] = {
    "handlers": ["file", "mail_admins"],
    "level": "ERROR",
    "propagate": False,
}

LOGGING["loggers"]["django.security.DisallowedHost"] = {
    "handlers": ["disallowed_host"],
    "level": "ERROR",
    "propagate": False,
}
