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

# Reddit-specific pacing: wider than the shared interval above because Reddit
# rate-limits unauthenticated .rss requests from datacenter IPs aggressively.
FEED_REDDIT_MIN_INTERVAL_SECONDS: float = 30.0

# Per run, refresh only the N stalest reddit feeds (the rest wait for a later
# run). Caps the reddit request rate under Reddit's per-IP ceiling; trades
# freshness for a higher success rate. Tune from the observed 200-vs-429 mix.
FEED_REDDIT_MAX_PER_RUN: int = 6

# Reddit application-only OAuth: the token endpoint lives on www.reddit.com,
# authenticated API calls go to oauth.reddit.com (which raises the per-IP rate
# ceiling that throttles the unauthenticated .rss endpoint).
REDDIT_OAUTH_TOKEN_URL: str = "https://www.reddit.com/api/v1/access_token"
REDDIT_OAUTH_API_BASE: str = "https://oauth.reddit.com"
REDDIT_LISTING_LIMIT: int = 25

