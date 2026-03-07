import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Personal AI Context Vault",
    version="0.1.0",
    description="Self-hosted AI memory and context vault API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


# API routers — imported here to avoid circular imports during startup
from app.api.v1.router import router as api_v1_router  # noqa: E402

app.include_router(api_v1_router)
