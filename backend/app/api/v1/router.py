from fastapi import APIRouter

from app.api.v1 import auth, context, drafts, memories, profile, tokens

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(drafts.router)
router.include_router(memories.router)
router.include_router(profile.router)
router.include_router(context.router)
router.include_router(tokens.router)
