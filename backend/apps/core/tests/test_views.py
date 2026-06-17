from __future__ import annotations

import pytest
from django.urls import reverse


@pytest.mark.django_db
async def test_health_check_returns_ok(async_client):
    response = await async_client.get(reverse('health'))
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}
