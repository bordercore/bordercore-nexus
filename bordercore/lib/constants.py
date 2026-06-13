"""Constants used across the bordercore application."""

USER_AGENT: str = "Bordercore/1.0"

# Cache control for S3 objects: 30 days in seconds (2592000 = 30 * 24 * 60 * 60)
S3_CACHE_MAX_AGE_SECONDS: int = 2592000

# Feed fetching. Reddit requires a descriptive, unique User-Agent and rate
# limits aggressively; the shared USER_AGENT above is intentionally left alone
# because blob/services.py also uses it.
FEED_USER_AGENT: str = "python:com.bordercore.feedreader:v1.0 (by jerrell@bordercore.com)"

# Retry tuning for a single feed fetch that comes back 429/503.
FEED_FETCH_MAX_RETRIES: int = 3
FEED_FETCH_BACKOFF_BASE_SECONDS: float = 2.0
FEED_FETCH_BACKOFF_CAP_SECONDS: float = 30.0

# Minimum seconds between requests to the same domain when refreshing the
# whole feed list (spaces out the many reddit.com feeds).
FEED_DOMAIN_MIN_INTERVAL_SECONDS: float = 3.0

