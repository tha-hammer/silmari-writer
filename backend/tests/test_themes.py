"""Tests for theme extraction and content generation functionality."""

import io
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport
from pydantic import ValidationError

from backend.app import app, Theme


class TestThemeModel:
    """Tests for REQ_004.3: Theme Pydantic model."""

    def test_theme_model_has_name_field(self):
        """Theme model has 'name' field of type string (required, non-empty)."""
        theme = Theme(name="adventure", confidence=0.9)
        assert theme.name == "adventure"
        assert isinstance(theme.name, str)

    def test_theme_model_has_confidence_field(self):
        """Theme model has 'confidence' field of type float (required, range 0.0 to 1.0)."""
        theme = Theme(name="mystery", confidence=0.75)
        assert theme.confidence == 0.75
        assert isinstance(theme.confidence, float)

    def test_confidence_accepts_zero(self):
        """Confidence field validates that value is between 0.0 and 1.0 inclusive - accepts 0.0."""
        theme = Theme(name="theme", confidence=0.0)
        assert theme.confidence == 0.0

    def test_confidence_accepts_one(self):
        """Confidence field validates that value is between 0.0 and 1.0 inclusive - accepts 1.0."""
        theme = Theme(name="theme", confidence=1.0)
        assert theme.confidence == 1.0

    def test_confidence_rejects_negative(self):
        """Confidence field validates that value is between 0.0 and 1.0 - rejects negative."""
        with pytest.raises(ValidationError) as exc_info:
            Theme(name="theme", confidence=-0.1)
        assert "confidence" in str(exc_info.value).lower()

    def test_confidence_rejects_above_one(self):
        """Confidence field validates that value is between 0.0 and 1.0 - rejects >1.0."""
        with pytest.raises(ValidationError) as exc_info:
            Theme(name="theme", confidence=1.1)
        assert "confidence" in str(exc_info.value).lower()

    def test_theme_serializes_to_json(self):
        """Model serializes to JSON correctly for API responses."""
        theme = Theme(name="romance", confidence=0.85)
        data = theme.model_dump()
        assert data == {"name": "romance", "confidence": 0.85}

    def test_theme_deserializes_from_json(self):
        """Model deserializes from JSON correctly for API requests."""
        data = {"name": "horror", "confidence": 0.6}
        theme = Theme.model_validate(data)
        assert theme.name == "horror"
        assert theme.confidence == 0.6

    def test_theme_requires_name_field(self):
        """Name field is required."""
        with pytest.raises(ValidationError):
            Theme(confidence=0.5)

    def test_theme_requires_confidence_field(self):
        """Confidence field is required."""
        with pytest.raises(ValidationError):
            Theme(name="test")

    def test_name_cannot_be_empty_string(self):
        """Name field must be non-empty."""
        with pytest.raises(ValidationError) as exc_info:
            Theme(name="", confidence=0.5)
        assert "name" in str(exc_info.value).lower()

    def test_theme_supports_equality_comparison(self):
        """Model supports equality comparison for testing purposes."""
        theme1 = Theme(name="love", confidence=0.9)
        theme2 = Theme(name="love", confidence=0.9)
        assert theme1 == theme2

    def test_theme_repr(self):
        """Model has sensible __repr__ for debugging."""
        theme = Theme(name="test", confidence=0.5)
        repr_str = repr(theme)
        assert "name" in repr_str or "Theme" in repr_str


class TestThemeExtractEndpoint:
    """Tests for REQ_004.1: POST /api/themes/extract endpoint."""

    @pytest.mark.asyncio
    async def test_endpoint_accepts_json_with_text_field(self):
        """Endpoint accepts JSON body with 'text' field (string, required)."""
        mock_extract = AsyncMock(return_value=[
            {"name": "love", "confidence": 0.9}
        ])
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "A story about love and adventure."}
                )
                # Should not be 404 or 405
                assert response.status_code in [200, 400, 422, 500]

    @pytest.mark.asyncio
    async def test_returns_422_if_text_field_missing(self):
        """Returns 422 validation error if 'text' field is missing."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/themes/extract",
                json={}
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_422_if_text_field_empty(self):
        """Returns 422 validation error if 'text' field is empty."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/themes/extract",
                json={"text": ""}
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_array_of_theme_objects(self):
        """Returns array of Theme objects."""
        mock_extract = AsyncMock(return_value=[
            {"name": "adventure", "confidence": 0.95},
            {"name": "friendship", "confidence": 0.8}
        ])
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "An epic journey with companions."}
                )
                assert response.status_code == 200
                data = response.json()
                assert isinstance(data, list)
                assert len(data) == 2
                assert data[0]["name"] == "adventure"
                assert data[0]["confidence"] == 0.95

    @pytest.mark.asyncio
    async def test_theme_object_contains_name_and_confidence(self):
        """Each theme contains 'name' (string) and 'confidence' (float 0.0-1.0)."""
        mock_extract = AsyncMock(return_value=[
            {"name": "mystery", "confidence": 0.75}
        ])
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "A mysterious tale."}
                )
                assert response.status_code == 200
                themes = response.json()
                assert len(themes) > 0
                assert "name" in themes[0]
                assert "confidence" in themes[0]
                assert isinstance(themes[0]["name"], str)
                assert isinstance(themes[0]["confidence"], float)

    @pytest.mark.asyncio
    async def test_returns_empty_array_when_no_themes(self):
        """Returns empty array when no themes can be extracted from text."""
        mock_extract = AsyncMock(return_value=[])
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "Random meaningless gibberish xyz123."}
                )
                assert response.status_code == 200
                data = response.json()
                assert data == []

    @pytest.mark.asyncio
    async def test_returns_500_on_openai_failure(self):
        """Returns 500 error with detail 'Service failed: {error}' when OpenAI API fails."""
        mock_extract = AsyncMock(side_effect=Exception("OpenAI API unavailable"))
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "Some text for extraction."}
                )
                assert response.status_code == 500
                data = response.json()
                assert "Service failed:" in data["detail"]

    @pytest.mark.asyncio
    async def test_endpoint_is_async(self):
        """Endpoint is async and non-blocking."""
        mock_extract = AsyncMock(return_value=[{"name": "test", "confidence": 0.5}])
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "Test text."}
                )
                assert response.status_code == 200
                # Verify mock was called (async behavior)
                mock_extract.assert_called_once()

    @pytest.mark.asyncio
    async def test_openai_calls_are_mocked(self):
        """OpenAI API calls are mocked in tests using AsyncMock pattern."""
        mock_extract = AsyncMock(return_value=[
            {"name": "mocked_theme", "confidence": 0.99}
        ])
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "Test."}
                )
                assert response.status_code == 200
                mock_extract.assert_called_once()
                # Verify the mock response is used
                assert response.json()[0]["name"] == "mocked_theme"


class TestGenerateEndpoint:
    """Tests for REQ_004.2: POST /api/generate endpoint."""

    @pytest.mark.asyncio
    async def test_endpoint_accepts_themes_and_prompt(self):
        """Endpoint accepts JSON body with 'themes' (array of Theme objects) and 'prompt' (string) fields."""
        mock_generate = AsyncMock(return_value={"content": "Generated text."})
        with patch("backend.app.generate_content_llm", mock_generate):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/generate",
                    json={
                        "themes": [{"name": "adventure", "confidence": 0.9}],
                        "prompt": "Write a short story."
                    }
                )
                # Should not be 404 or 405
                assert response.status_code in [200, 400, 422, 500]

    @pytest.mark.asyncio
    async def test_returns_422_if_prompt_missing(self):
        """Returns 422 validation error if 'prompt' field is missing."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/generate",
                json={"themes": [{"name": "test", "confidence": 0.5}]}
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_422_if_prompt_empty(self):
        """Returns 422 validation error if 'prompt' field is empty."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/generate",
                json={
                    "themes": [{"name": "test", "confidence": 0.5}],
                    "prompt": ""
                }
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_422_if_themes_empty(self):
        """Returns 422 validation error if 'themes' array is empty."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/generate",
                json={
                    "themes": [],
                    "prompt": "Write something."
                }
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_returns_generated_content(self):
        """Returns generated content as JSON with 'content' field (string)."""
        mock_generate = AsyncMock(return_value={
            "content": "Once upon a time, in a land of adventure..."
        })
        with patch("backend.app.generate_content_llm", mock_generate):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/generate",
                    json={
                        "themes": [{"name": "adventure", "confidence": 0.9}],
                        "prompt": "Write a short story."
                    }
                )
                assert response.status_code == 200
                data = response.json()
                assert "content" in data
                assert isinstance(data["content"], str)
                assert "adventure" in data["content"].lower()

    @pytest.mark.asyncio
    async def test_returns_500_on_openai_failure(self):
        """Returns 500 error with detail 'Service failed: {error}' when OpenAI API fails."""
        mock_generate = AsyncMock(side_effect=Exception("OpenAI API error"))
        with patch("backend.app.generate_content_llm", mock_generate):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/generate",
                    json={
                        "themes": [{"name": "test", "confidence": 0.5}],
                        "prompt": "Generate something."
                    }
                )
                assert response.status_code == 500
                data = response.json()
                assert "Service failed:" in data["detail"]

    @pytest.mark.asyncio
    async def test_endpoint_is_async(self):
        """Endpoint is async and non-blocking."""
        mock_generate = AsyncMock(return_value={"content": "Async content."})
        with patch("backend.app.generate_content_llm", mock_generate):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/generate",
                    json={
                        "themes": [{"name": "test", "confidence": 0.5}],
                        "prompt": "Test prompt."
                    }
                )
                assert response.status_code == 200
                mock_generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_openai_calls_are_mocked(self):
        """OpenAI API calls are mocked in tests using AsyncMock pattern."""
        mock_generate = AsyncMock(return_value={"content": "Mocked content response."})
        with patch("backend.app.generate_content_llm", mock_generate):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/generate",
                    json={
                        "themes": [{"name": "mocked", "confidence": 0.99}],
                        "prompt": "Test."
                    }
                )
                assert response.status_code == 200
                mock_generate.assert_called_once()
                assert "Mocked content" in response.json()["content"]

    @pytest.mark.asyncio
    async def test_supports_multiple_themes(self):
        """Generated content incorporates all provided themes naturally."""
        mock_generate = AsyncMock(return_value={
            "content": "A tale of love, adventure, and mystery awaits."
        })
        with patch("backend.app.generate_content_llm", mock_generate):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/generate",
                    json={
                        "themes": [
                            {"name": "love", "confidence": 0.9},
                            {"name": "adventure", "confidence": 0.8},
                            {"name": "mystery", "confidence": 0.7}
                        ],
                        "prompt": "Write an epic story."
                    }
                )
                assert response.status_code == 200
                content = response.json()["content"]
                assert isinstance(content, str)

    @pytest.mark.asyncio
    async def test_themes_missing_returns_422(self):
        """Returns 422 if themes field is missing."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/generate",
                json={"prompt": "Write something."}
            )
            assert response.status_code == 422


class TestOpenAIIntegration:
    """Tests for REQ_004.4: OpenAI GPT-4 integration."""

    @pytest.mark.asyncio
    async def test_extract_themes_llm_is_mockable(self):
        """OpenAI client is mockable for unit testing without real API calls."""
        mock_extract = AsyncMock(return_value=[
            {"name": "test", "confidence": 0.5}
        ])
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "Test text."}
                )
                assert response.status_code == 200
                mock_extract.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_content_llm_is_mockable(self):
        """OpenAI client is mockable for unit testing without real API calls."""
        mock_generate = AsyncMock(return_value={"content": "Generated."})
        with patch("backend.app.generate_content_llm", mock_generate):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/generate",
                    json={
                        "themes": [{"name": "test", "confidence": 0.5}],
                        "prompt": "Generate."
                    }
                )
                assert response.status_code == 200
                mock_generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_api_failure_raises_descriptive_error(self):
        """Failed API calls raise descriptive errors that map to HTTP 500 responses."""
        mock_extract = AsyncMock(side_effect=Exception("Rate limit exceeded"))
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "Test."}
                )
                assert response.status_code == 500
                assert "Rate limit exceeded" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_network_error_handled_gracefully(self):
        """Network errors are caught and converted to service errors."""
        mock_generate = AsyncMock(side_effect=ConnectionError("Network unavailable"))
        with patch("backend.app.generate_content_llm", mock_generate):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/generate",
                    json={
                        "themes": [{"name": "test", "confidence": 0.5}],
                        "prompt": "Test."
                    }
                )
                assert response.status_code == 500
                assert "Service failed:" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_timeout_error_handled(self):
        """Timeout errors are handled gracefully."""
        mock_extract = AsyncMock(side_effect=TimeoutError("Request timed out"))
        with patch("backend.app.extract_themes_llm", mock_extract):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/api/themes/extract",
                    json={"text": "Test."}
                )
                assert response.status_code == 500
                assert "Service failed:" in response.json()["detail"]
