from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import metrics, tts, voice_profile
from app.services.voice_service import recover_processing_voice_jobs

# Ensure storage directory exists before mounting StaticFiles
Path(settings.LOCAL_STORAGE_PATH).mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure storage directory exists
    Path(settings.LOCAL_STORAGE_PATH).mkdir(parents=True, exist_ok=True)
    recovered = recover_processing_voice_jobs()
    if recovered:
        print(f"[voice-recovery] redispatched processing voice jobs: {recovered}")
    yield
    from app.db import engine
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tts.router, prefix="/api/v1")
app.include_router(voice_profile.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")

# Serve locally stored audio files
app.mount("/static", StaticFiles(directory=settings.LOCAL_STORAGE_PATH), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}
