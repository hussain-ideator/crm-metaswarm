from __future__ import annotations

import pytest


@pytest.mark.django_db
def test_user_has_timestamps(django_user_model):
    user = django_user_model.objects.create_user(email='ts@example.com', password='pass')
    assert user.created_at is not None
    assert user.updated_at is not None


@pytest.mark.django_db
def test_soft_delete_sets_flag(django_user_model):
    user = django_user_model.objects.create_user(email='del@example.com', password='pass')
    user.delete()
    user.refresh_from_db()
    assert user.is_deleted is True
    assert user.deleted_at is not None


@pytest.mark.django_db
def test_soft_deleted_record_remains_in_db(django_user_model):
    user = django_user_model.objects.create_user(email='soft@example.com', password='pass')
    user.delete()
    assert django_user_model.objects.filter(email='soft@example.com').exists()
