"""Unit tests for the per-domain request throttle."""
from feed.throttle import DomainThrottle


def make_clock(times):
    """Return a monotonic() stub that yields the given values in order."""
    it = iter(times)
    return lambda: next(it)


def test_same_domain_is_spaced():
    """A second request to the same domain too soon sleeps the remaining time."""
    slept = []
    # One monotonic() read per wait(): t=100 for url1, t=101 for url2.
    throttle = DomainThrottle(
        3.0,
        sleep=slept.append,
        monotonic=make_clock([100.0, 101.0]),
    )

    throttle.wait("https://www.reddit.com/r/a/.rss")  # records t=100
    throttle.wait("https://www.reddit.com/r/b/.rss")  # at t=101, elapsed 1s -> sleep 2s

    assert slept == [2.0]


def test_distinct_domains_are_not_spaced():
    """Requests to different domains never sleep."""
    slept = []
    throttle = DomainThrottle(
        3.0,
        sleep=slept.append,
        monotonic=make_clock([100.0, 100.5]),
    )

    throttle.wait("https://www.reddit.com/r/a/.rss")
    throttle.wait("https://news.ycombinator.com/rss")

    assert slept == []


def test_scheme_does_not_split_domain():
    """http:// and https:// for the same host share one throttle bucket."""
    slept = []
    throttle = DomainThrottle(
        3.0,
        sleep=slept.append,
        monotonic=make_clock([100.0, 100.0]),
    )

    throttle.wait("http://www.reddit.com/r/a/.rss")
    throttle.wait("https://www.reddit.com/r/b/.rss")  # elapsed 0 -> sleep full 3s

    assert slept == [3.0]


def test_override_buckets_subdomains_together():
    """All *.reddit.com hosts share one bucket paced at the override interval."""
    slept = []
    # www.reddit.com records t=100; old.reddit.com at t=101 -> wait 12-1=11s.
    throttle = DomainThrottle(
        3.0,
        sleep=slept.append,
        monotonic=make_clock([100.0, 101.0]),
        domain_overrides={"reddit.com": 12.0},
    )

    throttle.wait("https://www.reddit.com/r/a/.rss")
    throttle.wait("https://old.reddit.com/r/b/.rss")

    assert slept == [11.0]


def test_override_does_not_affect_other_domains():
    """A non-override host keeps the default interval and its own bucket."""
    slept = []
    throttle = DomainThrottle(
        3.0,
        sleep=slept.append,
        monotonic=make_clock([100.0, 100.5]),
        domain_overrides={"reddit.com": 12.0},
    )

    throttle.wait("https://news.ycombinator.com/rss")  # records t=100
    throttle.wait("https://news.ycombinator.com/rss")  # t=100.5 -> sleep 2.5s

    assert slept == [2.5]


def test_longest_matching_suffix_wins():
    """When two suffixes match, the more specific one sets the interval."""
    slept = []
    throttle = DomainThrottle(
        3.0,
        sleep=slept.append,
        monotonic=make_clock([100.0, 100.0]),
        domain_overrides={"reddit.com": 12.0, "old.reddit.com": 5.0},
    )

    throttle.wait("https://old.reddit.com/r/a/.rss")
    throttle.wait("https://old.reddit.com/r/b/.rss")  # elapsed 0 -> sleep 5s (specific)

    assert slept == [5.0]
