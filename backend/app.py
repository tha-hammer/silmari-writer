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

# Audio content types accepted for transcription
AUDIO_CONTENT_TYPES = {
    "audio/webm",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
}

# Allowed content types for file uploads (includes audio and documents)
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


class TranscriptionResponse(BaseModel):
    """Response model for audio transcription."""
    text: str
    duration: Optional[float] = None
    language: Optional[str] = None


class Theme(BaseModel):
    """A theme extracted from text with confidence score."""

    name: str
    confidence: float

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if v == "":
            raise ValueError("Name cannot be empty")
        return v

    @field_validator("confidence")
    @classmethod
    def confidence_in_range(cls, v: float) -> float:
        if v < 0.0 or v > 1.0:
            raise ValueError("Confidence must be between 0.0 and 1.0")
        return v


class ThemeExtractRequest(BaseModel):
    """Request body for theme extraction."""
    text: str

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if v == "":
            raise ValueError("Text cannot be empty")
        return v


class GenerateRequest(BaseModel):
    """Request body for content generation."""
    themes: list[Theme]
    prompt: str

    @field_validator("prompt")
    @classmethod
    def prompt_not_empty(cls, v: str) -> str:
        if v == "":
            raise ValueError("Prompt cannot be empty")
        return v

    @field_validator("themes")
    @classmethod
    def themes_not_empty(cls, v: list[Theme]) -> list[Theme]:
        if len(v) == 0:
            raise ValueError("Themes cannot be empty")
        return v


class GenerateResponse(BaseModel):
    """Response body for content generation."""
    content: str


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


# Transcription function - can be mocked in tests
async def transcribe_audio(audio_content: bytes, filename: str) -> dict:
    """Transcribe audio content using OpenAI Whisper API.

    This function is designed to be mocked in tests.
    In production, it calls the actual OpenAI Whisper API.

    Args:
        audio_content: The raw audio bytes
        filename: Original filename for the audio file

    Returns:
        Dict with 'text', 'duration', and 'language' keys
    """
    # This is the real implementation that would call OpenAI
    # In tests, this entire function is mocked
    import openai

    client = openai.AsyncOpenAI()

    # Create a file-like object for the API
    import io
    audio_file = io.BytesIO(audio_content)
    audio_file.name = filename

    response = await client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        response_format="verbose_json"
    )

    return {
        "text": response.text,
        "duration": getattr(response, "duration", None),
        "language": getattr(response, "language", None),
    }


@app.post("/api/transcribe", response_model=TranscriptionResponse)
async def transcribe(file: UploadFile = File(...)) -> TranscriptionResponse:
    """Transcribe audio file using OpenAI Whisper API.

    Accepts multipart/form-data with an audio file.
    Returns transcribed text with metadata.
    """
    # Read file content
    content = await file.read()
    file_size = len(content)

    # Validate empty file
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file not allowed")

    # Get and validate content type (case-insensitive)
    content_type = (file.content_type or "").lower()

    # Reject empty content type
    if not content_type:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid content type: . Allowed types: {', '.join(sorted(AUDIO_CONTENT_TYPES))}"
        )

    # Validate content type against allowed audio types
    if content_type not in AUDIO_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid content type: {content_type}. Allowed types: {', '.join(sorted(AUDIO_CONTENT_TYPES))}"
        )

    # Call transcription (mocked in tests)
    try:
        result = await transcribe_audio(content, file.filename or "audio.mp3")
        return TranscriptionResponse(
            text=result["text"],
            duration=result.get("duration"),
            language=result.get("language"),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Service failed: {str(e)}"
        )


# Theme extraction function - can be mocked in tests
async def extract_themes_llm(text: str) -> list[dict]:
    """Extract themes from text using OpenAI GPT-4 API.

    This function is designed to be mocked in tests.
    In production, it calls the actual OpenAI GPT-4 API.

    Args:
        text: The text to extract themes from

    Returns:
        List of dicts with 'name' and 'confidence' keys
    """
    import json
    import openai

    client = openai.AsyncOpenAI()

    system_prompt = """You are a theme extraction assistant. Analyze the provided text and extract the main themes.
For each theme, provide a confidence score between 0.0 and 1.0 indicating how strongly that theme is present.
Respond ONLY with a JSON array of objects, each with 'name' (string) and 'confidence' (float) fields.
Example: [{"name": "adventure", "confidence": 0.9}, {"name": "friendship", "confidence": 0.75}]
If no clear themes can be extracted, return an empty array: []"""

    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract themes from this text:\n\n{text}"}
        ],
        temperature=0.3,
    )

    # Parse the JSON response
    content = response.choices[0].message.content or "[]"
    try:
        themes = json.loads(content)
        return themes
    except json.JSONDecodeError:
        return []


# Content generation function - can be mocked in tests
async def generate_content_llm(themes: list[dict], prompt: str) -> dict:
    """Generate content based on themes using OpenAI GPT-4 API.

    This function is designed to be mocked in tests.
    In production, it calls the actual OpenAI GPT-4 API.

    Args:
        themes: List of theme dicts with 'name' and 'confidence' keys
        prompt: User's prompt for content generation

    Returns:
        Dict with 'content' key containing generated text
    """
    import openai

    client = openai.AsyncOpenAI()

    # Build theme context
    theme_list = ", ".join([t["name"] for t in themes])
    theme_details = "\n".join([
        f"- {t['name']} (confidence: {t['confidence']:.2f})"
        for t in themes
    ])

    system_prompt = f"""You are a creative content generator. Generate content that naturally incorporates the following themes:

{theme_details}

The content should weave these themes together in a cohesive and engaging way."""

    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
    )

    content = response.choices[0].message.content or ""
    return {"content": content}


@app.post("/api/themes/extract", response_model=list[Theme])
async def extract_themes(data: ThemeExtractRequest) -> list[Theme]:
    """Extract themes from text using LLM analysis.

    Accepts JSON body with 'text' field.
    Returns array of Theme objects with name and confidence score.
    """
    try:
        result = await extract_themes_llm(data.text)
        return [Theme(name=t["name"], confidence=t["confidence"]) for t in result]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Service failed: {str(e)}"
        )


@app.post("/api/generate", response_model=GenerateResponse)
async def generate_content(data: GenerateRequest) -> GenerateResponse:
    """Generate content based on themes and prompt using LLM.

    Accepts JSON body with 'themes' (array of Theme objects) and 'prompt' fields.
    Returns generated content as JSON with 'content' field.
    """
    try:
        themes_data = [{"name": t.name, "confidence": t.confidence} for t in data.themes]
        result = await generate_content_llm(themes_data, data.prompt)
        return GenerateResponse(content=result["content"])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Service failed: {str(e)}"
        )
