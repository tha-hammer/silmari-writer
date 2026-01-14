"""FastAPI application with in-memory stores for TDD development."""

from datetime import datetime
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

# Pydantic Models


class FileMetadata(BaseModel):
    """Metadata for uploaded files."""

    id: str
    filename: str
    content_type: str
    size: int


class Message(BaseModel):
    """A message within a conversation."""

    id: str
    role: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    attachments: list[str] = Field(default_factory=list)


class Conversation(BaseModel):
    """A conversation containing messages."""

    id: str
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    messages: list[Message] = Field(default_factory=list)


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
