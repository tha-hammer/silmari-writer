"""Tests for audio transcription functionality."""

import io
from unittest.mock import AsyncMock, patch, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

from backend.app import app, AUDIO_CONTENT_TYPES


class TestAudioContentTypes:
    """Tests for REQ_003.2: Audio content type validation."""

    def test_audio_content_types_constant_exists(self):
        """AUDIO_CONTENT_TYPES constant is defined and exported for reuse."""
        assert AUDIO_CONTENT_TYPES is not None
        assert isinstance(AUDIO_CONTENT_TYPES, set)

    def test_audio_webm_in_allowed_types(self):
        """Accept audio/webm content type."""
        assert "audio/webm" in AUDIO_CONTENT_TYPES

    def test_audio_mpeg_in_allowed_types(self):
        """Accept audio/mpeg content type."""
        assert "audio/mpeg" in AUDIO_CONTENT_TYPES

    def test_audio_mp3_in_allowed_types(self):
        """Accept audio/mp3 content type."""
        assert "audio/mp3" in AUDIO_CONTENT_TYPES

    def test_audio_wav_in_allowed_types(self):
        """Accept audio/wav content type."""
        assert "audio/wav" in AUDIO_CONTENT_TYPES

    def test_audio_ogg_in_allowed_types(self):
        """Accept audio/ogg content type."""
        assert "audio/ogg" in AUDIO_CONTENT_TYPES

    def test_audio_flac_in_allowed_types(self):
        """Accept audio/flac content type."""
        assert "audio/flac" in AUDIO_CONTENT_TYPES

    def test_only_six_audio_types_allowed(self):
        """Only the six specified audio types are allowed for transcription."""
        expected_types = {
            "audio/webm",
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/ogg",
            "audio/flac",
        }
        assert AUDIO_CONTENT_TYPES == expected_types


class TestTranscribeEndpointAcceptance:
    """Tests for REQ_003.1: POST /api/transcribe endpoint acceptance."""

    @pytest.mark.asyncio
    async def test_endpoint_accepts_post_at_api_transcribe(self):
        """Endpoint accepts POST requests at /api/transcribe with multipart/form-data."""
        mock_transcription = AsyncMock(return_value={"text": "Hello world"})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                audio_content = b"fake audio content for testing"
                files = {"file": ("test.mp3", io.BytesIO(audio_content), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                # Should not be 404 or 405
                assert response.status_code in [200, 400, 500]

    @pytest.mark.asyncio
    async def test_request_must_include_file_field(self):
        """Request must include 'file' field containing the audio binary data."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # POST without file field should fail with 422 (validation error)
            response = await client.post("/api/transcribe")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_successful_transcription_returns_200(self):
        """Successful transcription returns HTTP 200 with JSON body containing 'text' field."""
        mock_transcription = AsyncMock(
            return_value={"text": "This is the transcribed text", "duration": 5.0}
        )
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                audio_content = b"fake audio content for testing"
                files = {"file": ("test.mp3", io.BytesIO(audio_content), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200
                data = response.json()
                assert "text" in data
                assert data["text"] == "This is the transcribed text"

    @pytest.mark.asyncio
    async def test_response_includes_duration_metadata(self):
        """Response includes transcription metadata: duration."""
        mock_transcription = AsyncMock(
            return_value={"text": "Hello world", "duration": 3.5, "language": "en"}
        )
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                audio_content = b"fake audio content"
                files = {"file": ("test.wav", io.BytesIO(audio_content), "audio/wav")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200
                data = response.json()
                assert "duration" in data

    @pytest.mark.asyncio
    async def test_response_includes_language_metadata(self):
        """Response includes transcription metadata: language detected (if available)."""
        mock_transcription = AsyncMock(
            return_value={"text": "Bonjour", "duration": 1.5, "language": "fr"}
        )
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                audio_content = b"fake audio content"
                files = {"file": ("test.ogg", io.BytesIO(audio_content), "audio/ogg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200
                data = response.json()
                # Language may be None if not detected
                assert "language" in data


class TestTranscribeContentTypeValidation:
    """Tests for REQ_003.2: Content type validation on transcription."""

    @pytest.mark.asyncio
    async def test_rejects_text_plain_content_type(self):
        """Return HTTP 400 for invalid content type: text/plain."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            content = b"This is text not audio"
            files = {"file": ("test.txt", io.BytesIO(content), "text/plain")}
            response = await client.post("/api/transcribe", files=files)
            assert response.status_code == 400
            data = response.json()
            assert "Invalid content type" in data["detail"]
            assert "text/plain" in data["detail"]

    @pytest.mark.asyncio
    async def test_rejects_image_png_content_type(self):
        """Return HTTP 400 for invalid content type: image/png."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            content = b"\x89PNG\r\n\x1a\n"  # PNG header
            files = {"file": ("image.png", io.BytesIO(content), "image/png")}
            response = await client.post("/api/transcribe", files=files)
            assert response.status_code == 400
            assert "Invalid content type" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_rejects_video_mp4_content_type(self):
        """Return HTTP 400 for invalid content type: video/mp4."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            content = b"fake video content"
            files = {"file": ("video.mp4", io.BytesIO(content), "video/mp4")}
            response = await client.post("/api/transcribe", files=files)
            assert response.status_code == 400
            assert "Invalid content type" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_error_message_lists_allowed_types(self):
        """Error message includes list of allowed audio types."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            content = b"not audio"
            files = {"file": ("test.txt", io.BytesIO(content), "text/plain")}
            response = await client.post("/api/transcribe", files=files)
            assert response.status_code == 400
            detail = response.json()["detail"]
            assert "audio/webm" in detail
            assert "audio/mpeg" in detail
            assert "audio/mp3" in detail
            assert "audio/wav" in detail
            assert "audio/ogg" in detail
            assert "audio/flac" in detail

    @pytest.mark.asyncio
    async def test_accepts_audio_webm(self):
        """Accept audio/webm content type."""
        mock_transcription = AsyncMock(return_value={"text": "test", "duration": 1.0})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                content = b"webm audio content"
                files = {"file": ("test.webm", io.BytesIO(content), "audio/webm")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_accepts_audio_mpeg(self):
        """Accept audio/mpeg content type."""
        mock_transcription = AsyncMock(return_value={"text": "test", "duration": 1.0})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                content = b"mpeg audio content"
                files = {"file": ("test.mp3", io.BytesIO(content), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_accepts_audio_mp3(self):
        """Accept audio/mp3 content type."""
        mock_transcription = AsyncMock(return_value={"text": "test", "duration": 1.0})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                content = b"mp3 audio content"
                files = {"file": ("test.mp3", io.BytesIO(content), "audio/mp3")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_accepts_audio_wav(self):
        """Accept audio/wav content type."""
        mock_transcription = AsyncMock(return_value={"text": "test", "duration": 1.0})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                content = b"wav audio content"
                files = {"file": ("test.wav", io.BytesIO(content), "audio/wav")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_accepts_audio_ogg(self):
        """Accept audio/ogg content type."""
        mock_transcription = AsyncMock(return_value={"text": "test", "duration": 1.0})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                content = b"ogg audio content"
                files = {"file": ("test.ogg", io.BytesIO(content), "audio/ogg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_accepts_audio_flac(self):
        """Accept audio/flac content type."""
        mock_transcription = AsyncMock(return_value={"text": "test", "duration": 1.0})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                content = b"flac audio content"
                files = {"file": ("test.flac", io.BytesIO(content), "audio/flac")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_validation_is_case_insensitive(self):
        """Validation is case-insensitive for content type matching."""
        mock_transcription = AsyncMock(return_value={"text": "test", "duration": 1.0})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                content = b"audio content"
                # Try uppercase content type
                files = {"file": ("test.mp3", io.BytesIO(content), "AUDIO/MPEG")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_rejects_empty_content_type(self):
        """Empty content type treated as invalid and rejected."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            content = b"audio content"
            files = {"file": ("test.mp3", io.BytesIO(content), "")}
            response = await client.post("/api/transcribe", files=files)
            # Empty or missing content type should be rejected
            assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_validation_occurs_before_processing(self):
        """Validation occurs before any processing or API calls to fail fast."""
        # If validation works, the mock should NOT be called for invalid types
        mock_transcription = AsyncMock(return_value={"text": "test"})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                content = b"not audio"
                files = {"file": ("test.txt", io.BytesIO(content), "text/plain")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 400
                # Mock should NOT have been called
                mock_transcription.assert_not_called()


class TestTranscribeMockingArchitecture:
    """Tests for REQ_003.3: Testable architecture with mocks."""

    @pytest.mark.asyncio
    async def test_mock_transcription_no_real_api_calls(self):
        """All transcription tests use mocked OpenAI client - no real API calls in test suite."""
        mock_transcription = AsyncMock(
            return_value={"text": "Mocked transcription", "duration": 2.0}
        )
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                content = b"audio content"
                files = {"file": ("test.mp3", io.BytesIO(content), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 200
                # Verify mock was called
                mock_transcription.assert_called_once()

    @pytest.mark.asyncio
    async def test_mock_can_return_different_responses(self):
        """Mock can be configured to return different responses for different test scenarios."""
        # First scenario
        mock_transcription = AsyncMock(
            return_value={"text": "First response", "duration": 1.0, "language": "en"}
        )
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = {"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.json()["text"] == "First response"

        # Second scenario with different response
        mock_transcription = AsyncMock(
            return_value={
                "text": "Second response different",
                "duration": 5.0,
                "language": "es",
            }
        )
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = {"file": ("test.wav", io.BytesIO(b"audio"), "audio/wav")}
                response = await client.post("/api/transcribe", files=files)
                assert response.json()["text"] == "Second response different"

    @pytest.mark.asyncio
    async def test_mock_called_exactly_once_per_request(self):
        """Tests verify mock was called exactly once per transcription request."""
        mock_transcription = AsyncMock(return_value={"text": "test", "duration": 1.0})
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = {"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")}
                await client.post("/api/transcribe", files=files)
                mock_transcription.assert_called_once()

    @pytest.mark.asyncio
    async def test_mock_can_raise_exceptions_for_error_testing(self):
        """Mock can be configured to raise exceptions for error scenario testing."""
        mock_transcription = AsyncMock(side_effect=Exception("API unavailable"))
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = {"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 500


class TestTranscribeErrorHandling:
    """Tests for REQ_003.4: Error handling for OpenAI API failures."""

    @pytest.mark.asyncio
    async def test_api_failure_returns_500(self):
        """OpenAI API failures caught and converted to HTTP 500 response."""
        mock_transcription = AsyncMock(side_effect=Exception("API error occurred"))
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = {"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 500

    @pytest.mark.asyncio
    async def test_error_response_format(self):
        """Error response body format: {'detail': 'Service failed: {original_error_message}'}."""
        mock_transcription = AsyncMock(side_effect=Exception("Connection timeout"))
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = {"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 500
                data = response.json()
                assert "detail" in data
                assert "Service failed:" in data["detail"]
                assert "Connection timeout" in data["detail"]

    @pytest.mark.asyncio
    async def test_timeout_error_handled(self):
        """Timeout errors from OpenAI handled gracefully."""
        mock_transcription = AsyncMock(side_effect=TimeoutError("Request timed out"))
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = {"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                assert response.status_code == 500
                assert "Service failed:" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_empty_file_returns_400(self):
        """Empty file returns HTTP 400."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            files = {"file": ("test.mp3", io.BytesIO(b""), "audio/mpeg")}
            response = await client.post("/api/transcribe", files=files)
            assert response.status_code == 400
            assert "Empty file" in response.json()["detail"]


class TestTranscriptionResponseModel:
    """Tests for transcription response model structure."""

    @pytest.mark.asyncio
    async def test_response_is_valid_json(self):
        """Response is valid JSON."""
        mock_transcription = AsyncMock(
            return_value={"text": "Hello", "duration": 1.0, "language": "en"}
        )
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = {"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                # Should not raise JSONDecodeError
                data = response.json()
                assert isinstance(data, dict)

    @pytest.mark.asyncio
    async def test_response_text_field_is_string(self):
        """Response 'text' field is a string."""
        mock_transcription = AsyncMock(
            return_value={"text": "The transcribed text", "duration": 2.5}
        )
        with patch("backend.app.transcribe_audio", mock_transcription):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                files = {"file": ("test.mp3", io.BytesIO(b"audio"), "audio/mpeg")}
                response = await client.post("/api/transcribe", files=files)
                data = response.json()
                assert isinstance(data["text"], str)
