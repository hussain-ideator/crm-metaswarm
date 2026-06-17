from __future__ import annotations

import pytest


@pytest.mark.django_db
def test_create_user_uses_email(django_user_model):
    user = django_user_model.objects.create_user(email='a@b.com', password='pass')
    assert user.email == 'a@b.com'
    assert user.USERNAME_FIELD == 'email'


@pytest.mark.django_db
def test_create_user_requires_email(django_user_model):
    with pytest.raises(ValueError, match='Email is required'):
        django_user_model.objects.create_user(email='', password='pass')


@pytest.mark.django_db
def test_create_superuser(django_user_model):
    user = django_user_model.objects.create_superuser(email='su@b.com', password='pass')
    assert user.is_staff is True
    assert user.is_superuser is True


@pytest.mark.django_db
def test_str_returns_email(django_user_model):
    user = django_user_model.objects.create_user(email='str@b.com', password='pass')
    assert str(user) == 'str@b.com'
