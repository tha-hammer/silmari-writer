"""Tests for conversation CRUD operations - Phase 3."""

import uuid
from datetime import datetime
from enum import Enum

import pytest
from httpx import AsyncClient, ASGITransport
from pydantic import ValidationError

from backend.app import app, conversation_store, Conversation, Message, MessageRole


class TestConversationModel:
    """Tests for REQ_002.3: Conversation data model."""

    def test_conversation_has_id_field_as_uuid(self):
        """Conversation model has 'id' field of type UUID, auto-generated on creation."""
        conv = Conversation(title="Test Conversation")
        assert conv.id is not None
        # Validate it's a valid UUID
        uuid.UUID(conv.id)

    def test_conversation_has_title_field_required(self):
        """Conversation model has 'title' field of type str, required."""
        conv = Conversation(title="My Title")
        assert conv.title == "My Title"
        assert isinstance(conv.title, str)

    def test_conversation_title_cannot_be_empty(self):
        """Conversation model validates that title is not empty string."""
        with pytest.raises(ValidationError) as exc_info:
            Conversation(title="")
        assert "title" in str(exc_info.value).lower()

    def test_conversation_has_created_at_auto_set(self):
        """Conversation model has 'created_at' field auto-set on creation."""
        before = datetime.utcnow()
        conv = Conversation(title="Test")
        after = datetime.utcnow()
        assert before <= conv.created_at <= after

    def test_conversation_has_updated_at_auto_set(self):
        """Conversation model has 'updated_at' field auto-set on creation."""
        before = datetime.utcnow()
        conv = Conversation(title="Test")
        after = datetime.utcnow()
        assert before <= conv.updated_at <= after

    def test_conversation_has_messages_list_default_empty(self):
        """Conversation model has 'messages' field as List[Message], defaults to empty list."""
        conv = Conversation(title="Test")
        assert conv.messages == []
        assert isinstance(conv.messages, list)

    def test_conversation_serializes_to_json_with_iso8601(self):
        """Conversation model serializes to JSON with ISO 8601 formatted timestamps."""
        conv = Conversation(title="Test")
        json_data = conv.model_dump(mode='json')
        # Check timestamps are ISO 8601 strings
        assert isinstance(json_data["created_at"], str)
        assert isinstance(json_data["updated_at"], str)
        # Should be parseable as datetime
        datetime.fromisoformat(json_data["created_at"].replace("Z", "+00:00"))

    def test_conversation_supports_adding_messages(self):
        """Model supports adding messages to existing conversation."""
        conv = Conversation(title="Test")
        msg = Message(role=MessageRole.USER, content="Hello")
        conv.messages.append(msg)
        assert len(conv.messages) == 1
        assert conv.messages[0].content == "Hello"

    def test_conversation_supports_removing_messages(self):
        """Model supports removing messages from conversation."""
        conv = Conversation(title="Test")
        msg = Message(role=MessageRole.USER, content="Hello")
        conv.messages.append(msg)
        conv.messages.remove(msg)
        assert len(conv.messages) == 0

    def test_conversation_store_uses_dict_structure(self):
        """In-memory conversation_store uses dict[str, Conversation] structure."""
        assert isinstance(conversation_store, dict)

    def test_conversation_store_is_cleared_between_tests(self):
        """conversation_store is cleared between tests via conftest.py fixture."""
        # This test relies on conftest.py clearing the store
        assert len(conversation_store) == 0
        conversation_store["test-id"] = Conversation(title="Test")
        assert len(conversation_store) == 1
        # After this test, conftest should clear it

    def test_conversation_can_be_instantiated_from_dict(self):
        """Model can be instantiated from dict/JSON for deserialization."""
        data = {
            "id": str(uuid.uuid4()),
            "title": "Test",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "messages": []
        }
        conv = Conversation(**data)
        assert conv.title == "Test"


class TestMessageModel:
    """Tests for REQ_002.4: Message data model."""

    def test_message_has_id_field_as_uuid(self):
        """Message model has 'id' field of type UUID, auto-generated on creation."""
        msg = Message(role=MessageRole.USER, content="Hello")
        assert msg.id is not None
        uuid.UUID(msg.id)

    def test_message_has_role_field_enum_user(self):
        """Message model has 'role' field as enum with value 'user'."""
        msg = Message(role=MessageRole.USER, content="Hello")
        assert msg.role == MessageRole.USER

    def test_message_has_role_field_enum_assistant(self):
        """Message model has 'role' field as enum with value 'assistant'."""
        msg = Message(role=MessageRole.ASSISTANT, content="Hi there")
        assert msg.role == MessageRole.ASSISTANT

    def test_message_has_role_field_enum_system(self):
        """Message model has 'role' field as enum with value 'system'."""
        msg = Message(role=MessageRole.SYSTEM, content="System message")
        assert msg.role == MessageRole.SYSTEM

    def test_message_has_content_field_required(self):
        """Message model has 'content' field of type str, required."""
        msg = Message(role=MessageRole.USER, content="Test content")
        assert msg.content == "Test content"
        assert isinstance(msg.content, str)

    def test_message_has_created_at_auto_set(self):
        """Message model has 'created_at' field auto-set on creation."""
        before = datetime.utcnow()
        msg = Message(role=MessageRole.USER, content="Hello")
        after = datetime.utcnow()
        assert before <= msg.created_at <= after

    def test_message_has_attachments_list_default_empty(self):
        """Message model has 'attachments' field as List[str], defaults to empty list."""
        msg = Message(role=MessageRole.USER, content="Hello")
        assert msg.attachments == []
        assert isinstance(msg.attachments, list)

    def test_message_validates_role_enum(self):
        """Message model validates role is one of the allowed enum values."""
        with pytest.raises(ValidationError):
            Message(role="invalid_role", content="Hello")

    def test_message_allows_empty_content(self):
        """Message model allows empty content string for attachment-only messages."""
        msg = Message(role=MessageRole.USER, content="", attachments=["file-id-1"])
        assert msg.content == ""
        assert len(msg.attachments) == 1

    def test_message_serializes_attachments_as_array(self):
        """Message model serializes attachments as array of file ID strings."""
        msg = Message(role=MessageRole.USER, content="See files", attachments=["id1", "id2"])
        json_data = msg.model_dump(mode='json')
        assert json_data["attachments"] == ["id1", "id2"]

    def test_message_ordering_preserved(self):
        """Message ordering is preserved in insertion order within conversation."""
        conv = Conversation(title="Test")
        msg1 = Message(role=MessageRole.USER, content="First")
        msg2 = Message(role=MessageRole.ASSISTANT, content="Second")
        msg3 = Message(role=MessageRole.USER, content="Third")
        conv.messages.extend([msg1, msg2, msg3])
        assert conv.messages[0].content == "First"
        assert conv.messages[1].content == "Second"
        assert conv.messages[2].content == "Third"

    def test_message_serializes_with_proper_datetime(self):
        """Model supports JSON serialization with proper datetime formatting."""
        msg = Message(role=MessageRole.USER, content="Hello")
        json_data = msg.model_dump(mode='json')
        assert isinstance(json_data["created_at"], str)
        datetime.fromisoformat(json_data["created_at"].replace("Z", "+00:00"))


class TestGetConversationsEndpoint:
    """Tests for REQ_002.1: GET /api/conversations endpoint."""

    async def test_returns_http_200_with_json_array(self):
        """GET /api/conversations returns HTTP 200 with JSON array of all conversations."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/api/conversations")

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_returns_empty_array_when_no_conversations(self):
        """GET /api/conversations returns empty array [] when no conversations exist."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/api/conversations")

        assert response.json() == []

    async def test_returns_conversations_with_required_fields(self):
        """Each conversation in list includes id, title, created_at, updated_at, and message_count fields."""
        # Create a conversation in store
        conv = Conversation(title="Test Conversation")
        conversation_store[conv.id] = conv

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/api/conversations")

        data = response.json()
        assert len(data) == 1
        conv_data = data[0]
        assert "id" in conv_data
        assert "title" in conv_data
        assert "created_at" in conv_data
        assert "updated_at" in conv_data
        assert "message_count" in conv_data

    async def test_response_content_type_is_json(self):
        """Response Content-Type is application/json."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/api/conversations")

        assert "application/json" in response.headers["content-type"]


class TestPostConversationsEndpoint:
    """Tests for REQ_002.1: POST /api/conversations endpoint."""

    async def test_accepts_json_body_with_title(self):
        """POST /api/conversations accepts JSON body with required 'title' field."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/conversations",
                json={"title": "New Conversation"}
            )

        assert response.status_code == 201

    async def test_returns_http_201_with_created_conversation(self):
        """POST /api/conversations returns HTTP 201 with created conversation including generated UUID."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/conversations",
                json={"title": "New Conversation"}
            )

        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        # Validate UUID format
        uuid.UUID(data["id"])

    async def test_automatically_sets_timestamps(self):
        """POST /api/conversations automatically sets created_at and updated_at to current timestamp."""
        before = datetime.utcnow()

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/conversations",
                json={"title": "New Conversation"}
            )

        after = datetime.utcnow()
        data = response.json()
        created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00")).replace(tzinfo=None)
        updated_at = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00")).replace(tzinfo=None)
        assert before <= created_at <= after
        assert before <= updated_at <= after

    async def test_missing_title_returns_http_422(self):
        """POST /api/conversations with missing title returns HTTP 422 validation error."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/conversations",
                json={}
            )

        assert response.status_code == 422

    async def test_empty_title_returns_http_400(self):
        """POST /api/conversations with empty string title returns HTTP 400 with 'Title cannot be empty'."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/conversations",
                json={"title": ""}
            )

        assert response.status_code == 400
        assert response.json()["detail"] == "Title cannot be empty"

    async def test_initializes_messages_as_empty_list(self):
        """POST /api/conversations initializes messages array as empty list."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/conversations",
                json={"title": "New Conversation"}
            )

        data = response.json()
        assert data["messages"] == []

    async def test_stores_conversation_in_store(self):
        """Created conversation is stored in conversation_store."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/conversations",
                json={"title": "New Conversation"}
            )

        data = response.json()
        assert data["id"] in conversation_store

    async def test_response_content_type_is_json(self):
        """Response Content-Type is application/json."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/conversations",
                json={"title": "New Conversation"}
            )

        assert "application/json" in response.headers["content-type"]


class TestGetConversationByIdEndpoint:
    """Tests for REQ_002.2: GET /api/conversations/{id} endpoint."""

    async def test_returns_http_200_with_full_conversation(self):
        """GET /api/conversations/{id} returns HTTP 200 with full conversation including messages array."""
        conv = Conversation(title="Test Conversation")
        msg = Message(role=MessageRole.USER, content="Hello")
        conv.messages.append(msg)
        conversation_store[conv.id] = conv

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get(f"/api/conversations/{conv.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == conv.id
        assert data["title"] == "Test Conversation"
        assert len(data["messages"]) == 1
        assert data["messages"][0]["content"] == "Hello"

    async def test_returns_http_404_for_non_existent_id(self):
        """GET /api/conversations/{id} for non-existent ID returns HTTP 404 with detail 'Resource not found'."""
        non_existent_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get(f"/api/conversations/{non_existent_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Resource not found"

    async def test_invalid_uuid_returns_http_422(self):
        """Invalid UUID format in path returns HTTP 422 validation error."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/api/conversations/invalid-uuid")

        assert response.status_code == 422


class TestPutConversationEndpoint:
    """Tests for REQ_002.2: PUT /api/conversations/{id} endpoint."""

    async def test_accepts_json_body_with_title(self):
        """PUT /api/conversations/{id} accepts JSON body with optional 'title' field."""
        conv = Conversation(title="Original Title")
        conversation_store[conv.id] = conv

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.put(
                f"/api/conversations/{conv.id}",
                json={"title": "Updated Title"}
            )

        assert response.status_code == 200

    async def test_returns_http_200_with_updated_conversation(self):
        """PUT /api/conversations/{id} returns HTTP 200 with updated conversation."""
        conv = Conversation(title="Original Title")
        conversation_store[conv.id] = conv

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.put(
                f"/api/conversations/{conv.id}",
                json={"title": "Updated Title"}
            )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"

    async def test_updates_updated_at_timestamp(self):
        """PUT /api/conversations/{id} automatically updates the updated_at timestamp."""
        conv = Conversation(title="Original Title")
        original_updated_at = conv.updated_at
        conversation_store[conv.id] = conv

        # Small delay to ensure timestamp difference
        import time
        time.sleep(0.01)

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.put(
                f"/api/conversations/{conv.id}",
                json={"title": "Updated Title"}
            )

        data = response.json()
        new_updated_at = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00")).replace(tzinfo=None)
        assert new_updated_at > original_updated_at

    async def test_returns_http_404_for_non_existent_id(self):
        """PUT /api/conversations/{id} for non-existent ID returns HTTP 404 with detail 'Resource not found'."""
        non_existent_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.put(
                f"/api/conversations/{non_existent_id}",
                json={"title": "Updated Title"}
            )

        assert response.status_code == 404
        assert response.json()["detail"] == "Resource not found"

    async def test_empty_title_returns_http_400(self):
        """PUT /api/conversations/{id} with empty title returns HTTP 400 with 'Title cannot be empty'."""
        conv = Conversation(title="Original Title")
        conversation_store[conv.id] = conv

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.put(
                f"/api/conversations/{conv.id}",
                json={"title": ""}
            )

        assert response.status_code == 400
        assert response.json()["detail"] == "Title cannot be empty"

    async def test_invalid_uuid_returns_http_422(self):
        """Invalid UUID format in path returns HTTP 422 validation error."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.put(
                "/api/conversations/invalid-uuid",
                json={"title": "Updated"}
            )

        assert response.status_code == 422


class TestDeleteConversationEndpoint:
    """Tests for REQ_002.2: DELETE /api/conversations/{id} endpoint."""

    async def test_returns_http_204_on_success(self):
        """DELETE /api/conversations/{id} returns HTTP 204 with no content on success."""
        conv = Conversation(title="To Delete")
        conversation_store[conv.id] = conv

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.delete(f"/api/conversations/{conv.id}")

        assert response.status_code == 204
        assert response.text == ""

    async def test_removes_conversation_from_store(self):
        """DELETE /api/conversations/{id} removes conversation from conversation_store."""
        conv = Conversation(title="To Delete")
        conversation_store[conv.id] = conv
        conv_id = conv.id

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            await client.delete(f"/api/conversations/{conv_id}")

        assert conv_id not in conversation_store

    async def test_returns_http_404_for_non_existent_id(self):
        """DELETE /api/conversations/{id} for non-existent ID returns HTTP 404 with detail 'Resource not found'."""
        non_existent_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.delete(f"/api/conversations/{non_existent_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Resource not found"

    async def test_invalid_uuid_returns_http_422(self):
        """Invalid UUID format in path returns HTTP 422 validation error."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.delete("/api/conversations/invalid-uuid")

        assert response.status_code == 422


class TestConversation404ErrorHandling:
    """Tests for REQ_002.5: Consistent HTTP 404 error handling."""

    async def test_get_returns_404_when_not_in_store(self):
        """GET /api/conversations/{id} returns HTTP 404 when conversation not in store."""
        non_existent_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get(f"/api/conversations/{non_existent_id}")

        assert response.status_code == 404

    async def test_put_returns_404_when_not_in_store(self):
        """PUT /api/conversations/{id} returns HTTP 404 when conversation not in store."""
        non_existent_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.put(
                f"/api/conversations/{non_existent_id}",
                json={"title": "Updated"}
            )

        assert response.status_code == 404

    async def test_delete_returns_404_when_not_in_store(self):
        """DELETE /api/conversations/{id} returns HTTP 404 when conversation not in store."""
        non_existent_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.delete(f"/api/conversations/{non_existent_id}")

        assert response.status_code == 404

    async def test_all_404_responses_have_json_content_type(self):
        """All 404 responses have Content-Type: application/json."""
        non_existent_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            get_response = await client.get(f"/api/conversations/{non_existent_id}")
            put_response = await client.put(
                f"/api/conversations/{non_existent_id}",
                json={"title": "Updated"}
            )
            delete_response = await client.delete(f"/api/conversations/{non_existent_id}")

        assert "application/json" in get_response.headers["content-type"]
        assert "application/json" in put_response.headers["content-type"]
        assert "application/json" in delete_response.headers["content-type"]

    async def test_all_404_responses_have_detail_field(self):
        """All 404 responses include JSON body with 'detail' field."""
        non_existent_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            get_response = await client.get(f"/api/conversations/{non_existent_id}")
            put_response = await client.put(
                f"/api/conversations/{non_existent_id}",
                json={"title": "Updated"}
            )
            delete_response = await client.delete(f"/api/conversations/{non_existent_id}")

        assert "detail" in get_response.json()
        assert "detail" in put_response.json()
        assert "detail" in delete_response.json()

    async def test_error_detail_is_resource_not_found(self):
        """Error detail message is exactly 'Resource not found' for consistency."""
        non_existent_id = str(uuid.uuid4())

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            get_response = await client.get(f"/api/conversations/{non_existent_id}")
            put_response = await client.put(
                f"/api/conversations/{non_existent_id}",
                json={"title": "Updated"}
            )
            delete_response = await client.delete(f"/api/conversations/{non_existent_id}")

        assert get_response.json()["detail"] == "Resource not found"
        assert put_response.json()["detail"] == "Resource not found"
        assert delete_response.json()["detail"] == "Resource not found"

    async def test_404_raised_before_update_logic(self):
        """404 is raised before any update/delete logic executes."""
        non_existent_id = str(uuid.uuid4())
        original_store_size = len(conversation_store)

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            await client.put(
                f"/api/conversations/{non_existent_id}",
                json={"title": "Updated"}
            )

        # Store should not be modified
        assert len(conversation_store) == original_store_size

    async def test_uuid_format_errors_return_422_not_404(self):
        """UUID format errors return 422, not 404 (distinct error cases)."""
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/api/conversations/not-a-uuid")

        assert response.status_code == 422
        assert response.status_code != 404
