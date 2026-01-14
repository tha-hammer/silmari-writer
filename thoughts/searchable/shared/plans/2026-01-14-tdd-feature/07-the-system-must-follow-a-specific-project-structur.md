# Phase 07: The system must follow a specific project structur...

## Requirements

### REQ_006: The system must follow a specific project structure with iso

The system must follow a specific project structure with isolated test suites and proper dependency management

#### REQ_006.1: Organize code in backend/ directory with app.py containing a

Organize code in backend/ directory with app.py containing all endpoints initially. This establishes the foundational project structure following FastAPI conventions with a single-file approach for initial development simplicity.

##### Testable Behaviors

1. backend/ directory exists at project root level
2. backend/__init__.py exists to make it a Python package
3. backend/app.py contains FastAPI application instance named 'app'
4. app.py imports and configures all endpoint routes (/health, /api/files/upload, /api/files/{id}, /api/conversations, /api/conversations/{id}, /api/transcribe, /api/themes/extract, /api/generate)
5. In-memory stores (file_store, conversation_store) are defined as module-level dictionaries in app.py
6. Pydantic models (FileMetadata, Message, Conversation, Theme) are defined in app.py
7. AUDIO_CONTENT_TYPES list is defined with values: audio/webm, audio/mpeg, audio/mp3, audio/wav, audio/ogg, audio/flac
8. Application can be started with 'uvicorn backend.app:app --reload'
9. OpenAPI documentation is accessible at /docs endpoint
10. All endpoint handlers are async functions

#### REQ_006.2: Create separate test files for each functional domain: test_

Create separate test files for each functional domain: test_health.py, test_files.py, test_conversations.py, test_transcription.py, test_themes.py, test_generation.py. This follows test isolation best practices and enables parallel test execution.

##### Testable Behaviors

1. backend/tests/ directory exists
2. backend/tests/__init__.py exists to make it a Python package
3. test_health.py exists and contains async test for GET /health endpoint
4. test_files.py exists and contains tests for file upload (POST /api/files/upload) and retrieval (GET /api/files/{id})
5. test_conversations.py exists and contains tests for all conversation CRUD operations
6. test_transcription.py exists and contains tests for POST /api/transcribe with mocked OpenAI calls
7. test_themes.py exists and contains tests for POST /api/themes/extract
8. test_generation.py exists and contains tests for POST /api/generate with mocked LLM calls
9. All test files use pytest-asyncio with 'async def test_*' function naming
10. All test files use httpx.AsyncClient with ASGITransport for testing
11. Each test file imports the app from backend.app
12. Tests cover happy path, error cases (400, 404, 422), and edge cases
13. Running 'pytest backend/tests/' executes all tests successfully

#### REQ_006.3: Implement conftest.py fixture with autouse=True to clear in-

Implement conftest.py fixture with autouse=True to clear in-memory stores before and after each test. This ensures complete test isolation and prevents state leakage between test runs.

##### Testable Behaviors

1. backend/tests/conftest.py exists
2. conftest.py imports file_store and conversation_store from backend.app
3. conftest.py defines clear_stores fixture with @pytest.fixture(autouse=True) decorator
4. clear_stores fixture calls file_store.clear() before yield
5. clear_stores fixture calls conversation_store.clear() before yield
6. clear_stores fixture calls file_store.clear() after yield (cleanup)
7. clear_stores fixture calls conversation_store.clear() after yield (cleanup)
8. Fixture automatically runs for every test without explicit reference
9. Each test starts with empty file_store dictionary
10. Each test starts with empty conversation_store dictionary
11. Tests can be run in any order without affecting each other
12. Running tests in parallel (pytest -n auto) maintains isolation

#### REQ_006.4: Install dependencies: fastapi>=0.109.0, uvicorn>=0.27.0, pyd

Install dependencies: fastapi>=0.109.0, uvicorn>=0.27.0, pydantic>=2.0.0, openai>=1.0.0, httpx>=0.26.0, pytest>=7.4.0, pytest-asyncio>=0.23.0. Proper dependency management ensures reproducible builds and compatible package versions.

##### Testable Behaviors

1. backend/requirements.txt exists with all dependencies listed
2. fastapi>=0.109.0 is listed in requirements.txt
3. uvicorn[standard]>=0.27.0 is listed in requirements.txt (with standard extras for performance)
4. pydantic>=2.0.0 is listed in requirements.txt
5. pydantic-settings>=2.0.0 is listed in requirements.txt
6. openai>=1.0.0 is listed in requirements.txt
7. httpx>=0.26.0 is listed in requirements.txt
8. pytest>=7.4.0 is listed in requirements.txt
9. pytest-asyncio>=0.23.0 is listed in requirements.txt
10. backend/pyproject.toml exists with proper project metadata
11. pyproject.toml defines [project] section with name, version, dependencies
12. pyproject.toml defines [project.optional-dependencies] section for dev/test dependencies
13. pyproject.toml configures pytest-asyncio mode in [tool.pytest.ini_options]
14. 'pip install -r backend/requirements.txt' completes without errors
15. All imports in app.py and test files resolve correctly after installation
16. Virtual environment is documented in README or setup instructions


## Success Criteria

- [ ] All tests pass
- [ ] All behaviors implemented
- [ ] Code reviewed