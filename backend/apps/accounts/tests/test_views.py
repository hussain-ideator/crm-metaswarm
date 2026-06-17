from __future__ import annotations

import pytest
from asgiref.sync import sync_to_async
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken


@pytest.mark.django_db
def test_login_returns_access_and_cookie(client, user):
    response = client.post(
        reverse('token_obtain_pair'),
        {'email': 'test@example.com', 'password': 'testpass123'},
        content_type='application/json',
    )
    assert response.status_code == 200
    data = response.json()
    assert 'access' in data
    assert 'user' in data
    assert data['user']['email'] == 'test@example.com'
    assert 'refresh' not in data
    assert 'refresh_token' in response.cookies


@pytest.mark.django_db
def test_login_wrong_credentials(client):
    response = client.post(
        reverse('token_obtain_pair'),
        {'email': 'nobody@example.com', 'password': 'wrong'},
        content_type='application/json',
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_refresh_using_cookie(client, user):
    login = client.post(
        reverse('token_obtain_pair'),
        {'email': 'test@example.com', 'password': 'testpass123'},
        content_type='application/json',
    )
    assert login.status_code == 200

    response = client.post(
        reverse('token_refresh'),
        content_type='application/json',
    )
    assert response.status_code == 200
    assert 'access' in response.json()


@pytest.mark.django_db
async def test_logout_clears_cookie(async_client, auser):
    refresh = await sync_to_async(RefreshToken.for_user)(auser)
    access = str(refresh.access_token)

    async_client.cookies['refresh_token'] = str(refresh)
    response = await async_client.post(
        reverse('logout'),
        HTTP_AUTHORIZATION=f'Bearer {access}',
        content_type='application/json',
    )
    assert response.status_code == 204
