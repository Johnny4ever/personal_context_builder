import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login_success(async_client: AsyncClient, test_user):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "test@vault.local", "password": "testpass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(async_client: AsyncClient, test_user):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "test@vault.local", "password": "wrongpass"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(async_client: AsyncClient):
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@vault.local", "password": "anypass"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me(async_client: AsyncClient, auth_headers):
    response = await async_client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == "test@vault.local"


@pytest.mark.asyncio
async def test_me_no_token(async_client: AsyncClient):
    response = await async_client.get("/api/v1/auth/me")
    assert response.status_code == 403  # HTTPBearer returns 403 when no token


@pytest.mark.asyncio
async def test_refresh(async_client: AsyncClient, test_user):
    login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "test@vault.local", "password": "testpass123"},
    )
    refresh_token = login.json()["refresh_token"]
    response = await async_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.asyncio
async def test_health(async_client: AsyncClient):
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
