"""Shared pytest fixtures for backend tests."""

import pytest

from backend.app import file_store, conversation_store


@pytest.fixture(autouse=True)
def clear_stores():
    """Clear in-memory stores before and after each test for isolation."""
    # Clear before test
    file_store.clear()
    conversation_store.clear()

    yield

    # Clear after test
    file_store.clear()
    conversation_store.clear()
