"""Tests for health check and basic API functionality."""

import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import app, file_store, conversation_store, FileMetadata


class TestHealthEndpoint:
    """Tests for the /health endpoint."""

    async def test_health_check_returns_healthy_status(self):
        """Health check endpoint should return healthy status."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    async def test_root_endpoint_returns_welcome_message(self):
        """Root endpoint should return welcome message."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/")

        assert response.status_code == 200
        assert response.json() == {"message": "Silmari Writer API"}


class TestAsyncClientSetup:
    """Tests verifying httpx AsyncClient setup with ASGITransport."""

    async def test_async_client_with_asgi_transport(self):
        """AsyncClient should work with ASGITransport for FastAPI testing."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/health")

            # Verify response object properties
            assert hasattr(response, 'status_code')
            assert hasattr(response, 'json')
            assert hasattr(response, 'text')
            assert hasattr(response, 'headers')

    async def test_multiple_requests_in_same_context(self):
        """Multiple requests should work within same client context."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response1 = await client.get("/health")
            response2 = await client.get("/")

            assert response1.status_code == 200
            assert response2.status_code == 200


class TestStoreIsolation:
    """Tests verifying in-memory store isolation between tests."""

    async def test_stores_are_empty_at_test_start(self):
        """Stores should be empty when test starts."""
        assert len(file_store) == 0
        assert len(conversation_store) == 0

    async def test_stores_can_be_manipulated_in_tests(self):
        """Tests should be able to directly manipulate stores."""
        # Add item to file_store
        file_store["test-id"] = FileMetadata(
            id="test-id",
            filename="test.txt",
            content_type="text/plain",
            size=100
        )

        assert "test-id" in file_store
        assert file_store["test-id"].filename == "test.txt"

    async def test_stores_are_isolated_between_tests(self):
        """This test verifies previous test's data is not present."""
        # This should pass because autouse fixture clears stores
        assert "test-id" not in file_store
        assert len(file_store) == 0
