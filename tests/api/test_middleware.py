import pytest

from backend.api import middleware


@pytest.fixture(autouse=True)
def _reset_middleware_state():
    """Reset module-level state so tests do not leak into each other."""
    middleware._ws_tickets.clear()
    middleware._ws_connection_count = 0
    yield
    middleware._ws_tickets.clear()
    middleware._ws_connection_count = 0


def test_auth_skip_paths_is_a_set():
    assert isinstance(middleware.auth_skip_paths(), set)


def test_auth_skip_paths_includes_unauthenticated_endpoints():
    paths = middleware.auth_skip_paths()
    assert "/api/health" in paths
    assert "/docs" in paths
    assert "/openapi.json" in paths
    assert "/api/auth/token" in paths
    assert "/api/auth/pair" in paths


def test_release_ws_connection_decrements_but_not_below_zero():
    middleware._ws_connection_count = 2
    middleware.release_ws_connection()
    assert middleware._ws_connection_count == 1
    middleware.release_ws_connection()
    middleware.release_ws_connection()
    assert middleware._ws_connection_count == 0


@pytest.mark.asyncio
async def test_ws_connection_limit_allows_up_to_max():
    middleware._ws_connection_count = 0
    granted = [
        await middleware.check_ws_connection_limit()
        for _ in range(middleware._WS_MAX_CONNECTIONS)
    ]
    assert all(granted)
    # Once at the cap, further connections are rejected.
    assert await middleware.check_ws_connection_limit() is False


@pytest.mark.asyncio
async def test_add_and_consume_ws_ticket_is_single_use():
    await middleware.add_ws_ticket("ticket-1")
    assert await middleware.consume_ws_ticket("ticket-1") is True
    assert await middleware.consume_ws_ticket("ticket-1") is False


@pytest.mark.asyncio
async def test_consume_unknown_ws_ticket_returns_false():
    assert await middleware.consume_ws_ticket("missing") is False
