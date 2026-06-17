from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.companies.tests.factories import CompanyFactory
from apps.accounts.tests.factories import UserFactory


@pytest.fixture
def api_user():
    return UserFactory()


@pytest.fixture
def auth_client(api_user):
    client = APIClient()
    refresh = RefreshToken.for_user(api_user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return client


LIST_URL = '/api/companies/'


def detail_url(pk: int) -> str:
    return f'/api/companies/{pk}/'


# ---------- auth ----------

@pytest.mark.django_db
def test_list_requires_auth():
    response = APIClient().get(LIST_URL)
    assert response.status_code == 401


@pytest.mark.django_db
def test_create_requires_auth():
    response = APIClient().post(LIST_URL, {'name': 'Test'}, format='json')
    assert response.status_code == 401


# ---------- list ----------

@pytest.mark.django_db
def test_list_returns_paginated_response(auth_client):
    CompanyFactory.create_batch(3)
    response = auth_client.get(LIST_URL)
    assert response.status_code == 200
    data = response.json()
    assert data['count'] == 3
    assert 'results' in data
    assert 'next' in data
    assert 'previous' in data


@pytest.mark.django_db
def test_list_excludes_soft_deleted(auth_client):
    CompanyFactory(name='Active')
    dead = CompanyFactory(name='Deleted')
    dead.delete()
    response = auth_client.get(LIST_URL)
    assert response.json()['count'] == 1
    assert response.json()['results'][0]['name'] == 'Active'


@pytest.mark.django_db
def test_search_by_name(auth_client):
    CompanyFactory(name='Acme Corp')
    CompanyFactory(name='Beta Inc')
    response = auth_client.get(LIST_URL, {'q': 'Acme'})
    assert response.json()['count'] == 1
    assert response.json()['results'][0]['name'] == 'Acme Corp'


@pytest.mark.django_db
def test_search_by_phone(auth_client):
    CompanyFactory(name='Found', phone='555-0100')
    CompanyFactory(name='NotFound', phone='999-0000')
    response = auth_client.get(LIST_URL, {'q': '555-0100'})
    assert response.json()['count'] == 1


@pytest.mark.django_db
def test_filter_by_industry(auth_client):
    CompanyFactory(industry='Tech')
    CompanyFactory(industry='Finance')
    response = auth_client.get(LIST_URL, {'industry': 'Tech'})
    assert response.json()['count'] == 1


@pytest.mark.django_db
def test_filter_by_owner(auth_client, api_user):
    CompanyFactory(owner=api_user)
    CompanyFactory(owner=UserFactory())
    response = auth_client.get(LIST_URL, {'owner': api_user.pk})
    assert response.json()['count'] == 1


@pytest.mark.django_db
def test_ordering_by_name_ascending(auth_client):
    CompanyFactory(name='Zebra')
    CompanyFactory(name='Alpha')
    response = auth_client.get(LIST_URL, {'ordering': 'name'})
    names = [r['name'] for r in response.json()['results']]
    assert names == sorted(names)


@pytest.mark.django_db
def test_pagination_page_size(auth_client):
    CompanyFactory.create_batch(5)
    response = auth_client.get(LIST_URL, {'page_size': 2})
    data = response.json()
    assert data['count'] == 5
    assert len(data['results']) == 2
    assert data['next'] is not None


# ---------- create ----------

@pytest.mark.django_db
def test_create_company(auth_client, api_user):
    payload = {'name': 'New Corp', 'industry': 'Tech'}
    response = auth_client.post(LIST_URL, payload, format='json')
    assert response.status_code == 201
    data = response.json()
    assert data['name'] == 'New Corp'
    assert data['created_by'] == api_user.pk


@pytest.mark.django_db
def test_create_company_name_required(auth_client):
    response = auth_client.post(LIST_URL, {'industry': 'Tech'}, format='json')
    assert response.status_code == 400
    assert 'name' in response.json()


@pytest.mark.django_db
def test_create_company_negative_revenue_rejected(auth_client):
    payload = {'name': 'Corp', 'annual_revenue': '-100.00'}
    response = auth_client.post(LIST_URL, payload, format='json')
    assert response.status_code == 400


# ---------- retrieve ----------

@pytest.mark.django_db
def test_retrieve_company(auth_client):
    company = CompanyFactory(name='Detail Corp')
    response = auth_client.get(detail_url(company.pk))
    assert response.status_code == 200
    assert response.json()['name'] == 'Detail Corp'


@pytest.mark.django_db
def test_retrieve_deleted_returns_404(auth_client):
    company = CompanyFactory()
    company.delete()
    response = auth_client.get(detail_url(company.pk))
    assert response.status_code == 404


# ---------- update ----------

@pytest.mark.django_db
def test_partial_update(auth_client):
    company = CompanyFactory(name='Old Name', industry='Tech')
    response = auth_client.patch(
        detail_url(company.pk), {'name': 'New Name'}, format='json'
    )
    assert response.status_code == 200
    assert response.json()['name'] == 'New Name'
    assert response.json()['industry'] == 'Tech'


@pytest.mark.django_db
def test_update_blank_name_rejected(auth_client):
    company = CompanyFactory(name='Valid Name')
    response = auth_client.patch(detail_url(company.pk), {'name': ''}, format='json')
    assert response.status_code == 400


# ---------- destroy (soft delete) ----------

@pytest.mark.django_db
def test_destroy_soft_deletes(auth_client):
    company = CompanyFactory()
    pk = company.pk
    response = auth_client.delete(detail_url(pk))
    assert response.status_code == 204

    # No longer in list
    list_response = auth_client.get(LIST_URL)
    pks = [r['id'] for r in list_response.json()['results']]
    assert pk not in pks

    # Detail returns 404
    detail_response = auth_client.get(detail_url(pk))
    assert detail_response.status_code == 404

    # Row still in DB
    from apps.companies.models import Company
    assert Company.objects.filter(pk=pk, is_deleted=True).exists()
