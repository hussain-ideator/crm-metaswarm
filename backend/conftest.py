from __future__ import annotations

import pytest
from asgiref.sync import sync_to_async


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='test@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
    )


@pytest.fixture
async def auser(django_user_model):
    return await sync_to_async(django_user_model.objects.create_user)(
        email='test@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User',
    )
