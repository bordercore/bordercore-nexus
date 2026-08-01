"""Tests for the Sentry event filtering configured in config.settings.base."""
import socket

from redis.exceptions import ConnectionError as RedisConnectionError

from config.settings.base import filter_channel_layer_redis_errors


def _exc_info(exc):
    """Raise and catch exc so it carries a traceback, then return its exc_info."""
    try:
        raise exc
    except type(exc):
        import sys
        return sys.exc_info()


def test_drops_daphne_redis_connection_error():
    """The burst Daphne logs while redis-server restarts is discarded."""
    exc = RedisConnectionError(
        "Error 111 connecting to 127.0.0.1:6379. Connect call failed "
        "('127.0.0.1', 6379)."
    )
    event = {"logger": "daphne.server"}

    assert filter_channel_layer_redis_errors(event, {"exc_info": _exc_info(exc)}) is None


def test_drops_redis_error_wrapping_socket_error():
    """A Redis error chained onto the underlying ECONNREFUSED is still dropped."""
    try:
        raise ConnectionRefusedError(111, "Connect call failed ('127.0.0.1', 6379)")
    except ConnectionRefusedError as refused:
        exc_info = _exc_info(RedisConnectionError("Error 111 connecting").with_traceback(None))
        # Rebuild the chain the way redis-py raises it.
        exc_info[1].__cause__ = refused

    event = {"logger": "daphne.server"}
    assert filter_channel_layer_redis_errors(event, {"exc_info": exc_info}) is None


def test_keeps_redis_error_from_other_loggers():
    """Redis failures outside the websocket layer still reach Sentry."""
    exc = RedisConnectionError("Error 111 connecting to 127.0.0.1:6379.")
    event = {"logger": "bordercore"}

    result = filter_channel_layer_redis_errors(event, {"exc_info": _exc_info(exc)})
    assert result is event


def test_keeps_other_daphne_errors():
    """Unrelated Daphne exceptions are not swallowed by the filter."""
    exc = ValueError("something else broke")
    event = {"logger": "daphne.server"}

    result = filter_channel_layer_redis_errors(event, {"exc_info": _exc_info(exc)})
    assert result is event


def test_keeps_daphne_event_without_exception():
    """A Daphne event carrying no exc_info passes through untouched."""
    event = {"logger": "daphne.server"}

    assert filter_channel_layer_redis_errors(event, {}) is event


def test_tolerates_self_referential_exception_chain():
    """A cycle in the exception chain terminates instead of hanging."""
    first = ValueError("first")
    second = socket.timeout("second")
    first.__cause__ = second
    second.__cause__ = first
    event = {"logger": "daphne.server"}

    result = filter_channel_layer_redis_errors(event, {"exc_info": (type(first), first, None)})
    assert result is event
