"""Constants used across the bordercore application."""

USER_AGENT: str = "Bordercore/1.0"

# Cache control for S3 objects: 30 days in seconds (2592000 = 30 * 24 * 60 * 60)
S3_CACHE_MAX_AGE_SECONDS: int = 2592000

