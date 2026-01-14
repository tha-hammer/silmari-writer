"""FastAPI application with in-memory stores for TDD development."""

import os
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from fastapi import FastAPI, File, HTTPException, UploadFile, Response
from pydantic import BaseModel, Field, field_validator

# Constants
UPLOAD_DIR = "./uploads"

# Allowed content types for file uploads
ALLOWED_CONTENT_TYPES = {
    # Audio types for transcription
    "audio/webm",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
    # Document types
    "text/plain",
    "application/json",
    "application/pdf",
}


# Enums
class MessageRole(str, Enum):
    """Allowed message roles."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


# Pydantic Models
class FileMetadata(BaseModel):
    """Metadata for uploaded files."""

    id: str
    filename: str
    content_type: str
    size: int


class Message(BaseModel):
    """A message within a conversation."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: MessageRole
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    attachments: list[str] = Field(default_factory=list)


class Conversation(BaseModel):
    """A conversation containing messages."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    messages: list[Message] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if v == "":
            raise ValueError("Title cannot be empty")
        return v


class ConversationCreate(BaseModel):
    """Request body for creating a conversation."""
    title: str


class ConversationUpdate(BaseModel):
    """Request body for updating a conversation."""
    title: Optional[str] = None


class ConversationListItem(BaseModel):
    """Conversation summary for list responses."""
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


# In-memory stores for development/testing
file_store: dict[str, FileMetadata] = {}
conversation_store: dict[str, Conversation] = {}


# FastAPI Application
app = FastAPI(
    title="Silmari Writer API",
    description="A writing assistant application with AI-powered features",
    version="0.1.0",
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "Silmari Writer API"}


@app.post("/api/files/upload", status_code=201, response_model=FileMetadata)
async def upload_file(file: UploadFile = File(...)) -> FileMetadata:
    """Upload a file and store its metadata.

    Accepts multipart/form-data with a file field. Validates the file,
    stores it to the uploads directory, and returns file metadata.
    """
    # Read file content to determine actual size
    content = await file.read()
    file_size = len(content)

    # Validate empty file
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file not allowed")

    # Validate content type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid content type: {content_type}. Allowed types: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}"
        )

    # Generate unique ID
    file_id = str(uuid.uuid4())

    # Create uploads directory if it doesn't exist
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Store file to disk with UUID-based name
    file_path = os.path.join(UPLOAD_DIR, file_id)
    with open(file_path, "wb") as f:
        f.write(content)

    # Create metadata
    metadata = FileMetadata(
        id=file_id,
        filename=file.filename or "unknown",
        content_type=content_type,
        size=file_size,
    )

    # Store metadata
    file_store[file_id] = metadata

    return metadata


@app.get("/api/files/{file_id}", response_model=FileMetadata)
async def get_file_metadata(file_id: str) -> FileMetadata:
    """Retrieve file metadata by ID.

    Returns the metadata for a previously uploaded file.
    """
    if file_id not in file_store:
        raise HTTPException(status_code=404, detail="Resource not found")

    return file_store[file_id]


# Helper function for consistent 404 handling
def get_conversation_or_404(conversation_id: str) -> Conversation:
    """Get a conversation by ID or raise HTTP 404."""
    if conversation_id not in conversation_store:
        raise HTTPException(status_code=404, detail="Resource not found")
    return conversation_store[conversation_id]


def validate_uuid(value: str) -> str:
    """Validate that a string is a valid UUID format."""
    try:
        UUID(value)
        return value
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID format")


# Conversation Endpoints
@app.get("/api/conversations", response_model=list[ConversationListItem])
async def list_conversations() -> list[ConversationListItem]:
    """List all conversations.

    Returns a list of all conversations with summary information.
    """
    return [
        ConversationListItem(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=len(conv.messages),
        )
        for conv in conversation_store.values()
    ]


@app.post("/api/conversations", status_code=201, response_model=Conversation)
async def create_conversation(data: ConversationCreate) -> Conversation:
    """Create a new conversation.

    Accepts JSON body with required 'title' field.
    """
    # Validate empty title (Pydantic validator raises ValueError)
    if data.title == "":
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    conversation = Conversation(title=data.title)
    conversation_store[conversation.id] = conversation
    return conversation


@app.get("/api/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str) -> Conversation:
    """Get a single conversation by ID.

    Returns the full conversation including all messages.
    """
    validate_uuid(conversation_id)
    return get_conversation_or_404(conversation_id)


@app.put("/api/conversations/{conversation_id}", response_model=Conversation)
async def update_conversation(conversation_id: str, data: ConversationUpdate) -> Conversation:
    """Update a conversation.

    Accepts JSON body with optional 'title' field.
    """
    validate_uuid(conversation_id)
    conversation = get_conversation_or_404(conversation_id)

    # Validate empty title
    if data.title == "":
        raise HTTPException(status_code=400, detail="Title cannot be empty")

    if data.title is not None:
        conversation.title = data.title

    conversation.updated_at = datetime.utcnow()
    conversation_store[conversation_id] = conversation
    return conversation


@app.delete("/api/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: str) -> Response:
    """Delete a conversation.

    Removes the conversation and all associated data.
    """
    validate_uuid(conversation_id)
    get_conversation_or_404(conversation_id)
    del conversation_store[conversation_id]
    return Response(status_code=204)
