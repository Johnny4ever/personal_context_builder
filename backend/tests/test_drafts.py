import pytest
from httpx import AsyncClient

DRAFT_PAYLOAD = {
    "summary_text": "User discussed transitioning into data engineering.",
    "candidate_facts_json": {"role": "product analyst", "target_role": "data engineer"},
    "suggested_tags_json": ["career", "skills"],
    "source_platform": "claude",
    "platform_conversation_id": "conv-001",
}


@pytest.mark.asyncio
async def test_create_draft(async_client: AsyncClient, auth_headers, test_user):
    response = await async_client.post(
        "/api/v1/drafts/", json=DRAFT_PAYLOAD, headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["summary_text"] == DRAFT_PAYLOAD["summary_text"]
    assert data["draft_status"] == "awaiting_review"
    assert "raw_text" not in data  # raw_text must never appear in API responses


@pytest.mark.asyncio
async def test_list_drafts(async_client: AsyncClient, auth_headers, test_user):
    await async_client.post("/api/v1/drafts/", json=DRAFT_PAYLOAD, headers=auth_headers)
    response = await async_client.get("/api/v1/drafts/", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_dismiss_draft_deletes_immediately(
    async_client: AsyncClient, auth_headers, test_user
):
    create = await async_client.post(
        "/api/v1/drafts/", json=DRAFT_PAYLOAD, headers=auth_headers
    )
    draft_id = create.json()["id"]
    response = await async_client.delete(
        f"/api/v1/drafts/{draft_id}", headers=auth_headers
    )
    assert response.status_code == 204
    # Verify it's gone
    get = await async_client.get(f"/api/v1/drafts/{draft_id}", headers=auth_headers)
    assert get.status_code == 404


@pytest.mark.asyncio
async def test_mark_private(async_client: AsyncClient, auth_headers, test_user):
    create = await async_client.post(
        "/api/v1/drafts/", json=DRAFT_PAYLOAD, headers=auth_headers
    )
    draft_id = create.json()["id"]
    response = await async_client.post(
        f"/api/v1/drafts/{draft_id}/private", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["draft_status"] == "private"


@pytest.mark.asyncio
async def test_draft_not_found(async_client: AsyncClient, auth_headers):
    response = await async_client.get("/api/v1/drafts/99999", headers=auth_headers)
    assert response.status_code == 404
