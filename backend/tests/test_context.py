import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient


MOCK_VECTOR = [0.1] * 1536


@pytest.mark.asyncio
async def test_context_query_requires_auth(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/context/query", json={"query": "what are my skills?"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_context_query_with_jwt(async_client: AsyncClient, auth_headers, test_user):
    with patch(
        "app.services.context_service.ContextService._embed_query",
        new_callable=AsyncMock,
        return_value=MOCK_VECTOR,
    ), patch(
        "app.services.embedding_service.EmbeddingService.search",
        new_callable=AsyncMock,
        return_value=[],
    ):
        response = await async_client.post(
            "/api/v1/context/query",
            json={"query": "what are my skills?"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert "profile_summary" in data
    assert "relevant_memories" in data


@pytest.mark.asyncio
async def test_context_query_with_api_token(
    async_client: AsyncClient, auth_headers, test_user
):
    # Create an API token
    token_response = await async_client.post(
        "/api/v1/tokens/",
        json={"token_name": "test-token"},
        headers=auth_headers,
    )
    assert token_response.status_code == 201
    plain_token = token_response.json()["plain_token"]

    with patch(
        "app.services.context_service.ContextService._embed_query",
        new_callable=AsyncMock,
        return_value=MOCK_VECTOR,
    ), patch(
        "app.services.embedding_service.EmbeddingService.search",
        new_callable=AsyncMock,
        return_value=[],
    ):
        response = await async_client.post(
            "/api/v1/context/query",
            json={"query": "what are my skills?"},
            headers={"X-API-Token": plain_token},
        )
    assert response.status_code == 200
