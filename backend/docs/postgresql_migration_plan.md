# PostgreSQL Migration Plan

## Overview

This document outlines the migration path from in-memory stores to PostgreSQL for production scalability.

## Technology Decisions

### ORM Selection: SQLAlchemy 2.0+

**Rationale**: SQLAlchemy provides excellent async support via `asyncpg`, comprehensive ORM features, and seamless integration with FastAPI through dependency injection patterns.

### Migration Tool: Alembic

**Rationale**: Native SQLAlchemy integration, supports both autogenerate and manual migrations, and provides clear version control for database schema.

## Database Configuration

### Environment Variables

```bash
# Development (SQLite)
DATABASE_URL=sqlite+aiosqlite:///./dev.db

# Production (PostgreSQL)
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/silmari_writer
```

## Schema Design

### SQLAlchemy Models

```python
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class FileMetadataModel(Base):
    __tablename__ = "file_metadata"

    id = Column(String, primary_key=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    size = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class ConversationModel(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    messages = relationship("MessageModel", back_populates="conversation", cascade="all, delete-orphan")


class MessageModel(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    attachments = Column(JSON, default=list)

    conversation = relationship("ConversationModel", back_populates="messages")
```

## Index Strategy

| Table | Column | Index Type | Purpose |
|-------|--------|------------|---------|
| messages | conversation_id | B-tree | Fast lookup of messages by conversation |
| conversations | created_at | B-tree | Sorting conversations by date |
| file_metadata | created_at | B-tree | Sorting files by upload date |

## Repository Pattern

```python
from abc import ABC, abstractmethod
from typing import Optional, List


class FileRepository(ABC):
    @abstractmethod
    async def create(self, file_metadata: FileMetadata) -> FileMetadata:
        pass

    @abstractmethod
    async def get(self, file_id: str) -> Optional[FileMetadata]:
        pass

    @abstractmethod
    async def delete(self, file_id: str) -> bool:
        pass


class ConversationRepository(ABC):
    @abstractmethod
    async def create(self, conversation: Conversation) -> Conversation:
        pass

    @abstractmethod
    async def get(self, conversation_id: str) -> Optional[Conversation]:
        pass

    @abstractmethod
    async def list_all(self) -> List[Conversation]:
        pass

    @abstractmethod
    async def update(self, conversation: Conversation) -> Conversation:
        pass

    @abstractmethod
    async def delete(self, conversation_id: str) -> bool:
        pass
```

## Migration Steps

### Step 1: Install Dependencies

```bash
pip install sqlalchemy[asyncio] asyncpg alembic aiosqlite
```

### Step 2: Initialize Alembic

```bash
alembic init migrations
```

### Step 3: Configure Alembic

Update `alembic.ini` with async support and configure `env.py` for async migrations.

### Step 4: Create Initial Migration

```bash
alembic revision --autogenerate -m "Initial schema"
```

### Step 5: Apply Migration

```bash
alembic upgrade head
```

## Rollback Strategy

| Migration | Rollback Command | Notes |
|-----------|------------------|-------|
| Initial schema | `alembic downgrade -1` | Drops all tables |
| Any migration | `alembic downgrade <revision>` | Reverts to specific version |

**Important**: Always test rollback in development before production deployment.

## Connection Pooling (Production)

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
)

async_session = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)
```

## Testing Strategy

- Development: Use SQLite with `aiosqlite` for fast local testing
- CI/CD: Use PostgreSQL test container for integration tests
- Production: PostgreSQL with full connection pooling

## Migration Checklist

- [ ] Install SQLAlchemy, asyncpg, alembic, aiosqlite
- [ ] Create SQLAlchemy models mirroring Pydantic schemas
- [ ] Implement repository interfaces
- [ ] Create in-memory repository for tests
- [ ] Create SQLAlchemy repository for production
- [ ] Set up Alembic configuration
- [ ] Create initial migration
- [ ] Test migration and rollback in development
- [ ] Configure connection pooling for production
- [ ] Update FastAPI dependency injection
