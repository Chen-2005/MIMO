import asyncio
import os
import sys
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine


TEST_DB_PATH = Path(__file__).resolve().parent.parent / "test_suite.db"
TEST_STORAGE_PATH = Path(__file__).resolve().parent.parent / "storage_test"
RUN_REAL_MIMO_TESTS = os.getenv("RUN_REAL_MIMO_TESTS", "").lower() == "true"
RUNNING_REAL_MIMO_TEST_FILE = any(
    "test_mimo_integration.py" in arg for arg in sys.argv
)

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH.as_posix()}"
os.environ["LOCAL_STORAGE_PATH"] = str(TEST_STORAGE_PATH)
os.environ["CELERY_ENABLED"] = "false"

if not (RUN_REAL_MIMO_TESTS and RUNNING_REAL_MIMO_TEST_FILE):
    os.environ["PROVIDER_MODE"] = "mock"
    os.environ.setdefault("MIMO_API_BASE", "")
    os.environ.setdefault("MIMO_API_KEY", "")

from app.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    TEST_STORAGE_PATH.mkdir(parents=True, exist_ok=True)

    async def _init():
        if TEST_DB_PATH.exists():
            TEST_DB_PATH.unlink()

        engine = create_async_engine(settings.DATABASE_URL)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    asyncio.run(_init())
    yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
