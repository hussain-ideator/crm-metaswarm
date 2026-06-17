from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.tests.factories import UserFactory
from apps.companies.tests.factories import CompanyFactory
from apps.contacts.tests.factories import ContactFactory


LIST_URL = '/api/contacts/'


def detail_url(pk: int) -> str:
    return f'/api/contacts/{pk}/'


@pytest.fixture
def api_user():
    return UserFactory()


@pytest.fixture
def auth_client(api_user):
    client = APIClient()
    refresh = RefreshToken.for_user(api_user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')
    return client


# ---------- auth ----------

@pytest.mark.django_db
def test_list_requires_auth():
    assert APIClient().get(LIST_URL).status_code == 401


@pytest.mark.django_db
def test_create_requires_auth():
    assert APIClient().post(LIST_URL, {'first_name': 'A', 'last_name': 'B'}).status_code == 401


# ---------- list ----------

@pytest.mark.django_db
def test_list_returns_paginated_shape(auth_client):
    ContactFactory.create_batch(3)
    data = auth_client.get(LIST_URL).json()
    assert data['count'] == 3
    assert 'results' in data
    assert 'next' in data


@pytest.mark.django_db
def test_list_excludes_soft_deleted(auth_client):
    ContactFactory(first_name='Active', last_name='One')
    dead = ContactFactory(first_name='Dead', last_name='Two')
    dead.delete()
    data = auth_client.get(LIST_URL).json()
    assert data['count'] == 1
    assert data['results'][0]['last_name'] == 'One'


@pytest.mark.django_db
def test_search_by_first_name(auth_client):
    ContactFactory(first_name='Alice', last_name='Smith')
    ContactFactory(first_name='Bob', last_name='Jones')
    data = auth_client.get(LIST_URL, {'q': 'Alice'}).json()
    assert data['count'] == 1
    assert data['results'][0]['first_name'] == 'Alice'


@pytest.mark.django_db
def test_search_by_email(auth_client):
    ContactFactory(email='alice@example.com')
    ContactFactory(email='bob@other.com')
    data = auth_client.get(LIST_URL, {'q': 'alice'}).json()
    assert data['count'] == 1


@pytest.mark.django_db
def test_filter_by_company(auth_client):
    c1 = CompanyFactory()
    c2 = CompanyFactory()
    ContactFactory(company=c1)
    ContactFactory(company=c2)
    data = auth_client.get(LIST_URL, {'company': c1.pk}).json()
    assert data['count'] == 1


@pytest.mark.django_db
def test_filter_by_owner(auth_client, api_user):
    ContactFactory(owner=api_user)
    ContactFactory(owner=UserFactory())
    data = auth_client.get(LIST_URL, {'owner': api_user.pk}).json()
    assert data['count'] == 1


@pytest.mark.django_db
def test_ordering_by_last_name(auth_client):
    ContactFactory(last_name='Zebra')
    ContactFactory(last_name='Alpha')
    data = auth_client.get(LIST_URL, {'ordering': 'last_name'}).json()
    names = [r['last_name'] for r in data['results']]
    assert names == sorted(names)


@pytest.mark.django_db
def test_pagination_page_size(auth_client):
    ContactFactory.create_batch(5)
    data = auth_client.get(LIST_URL, {'page_size': 2}).json()
    assert data['count'] == 5
    assert len(data['results']) == 2
    assert data['next'] is not None


# ---------- serializer shape ----------

@pytest.mark.django_db
def test_list_includes_nested_company(auth_client):
    company = CompanyFactory(name='Nested Corp')
    ContactFactory(company=company)
    result = auth_client.get(LIST_URL).json()['results'][0]
    assert result['company']['name'] == 'Nested Corp'
    assert 'company_id' in result


@pytest.mark.django_db
def test_list_contact_with_no_company(auth_client):
    ContactFactory(company=None)
    result = auth_client.get(LIST_URL).json()['results'][0]
    assert result['company'] is None


# ---------- create ----------

@pytest.mark.django_db
def test_create_contact(auth_client, api_user):
    payload = {'first_name': 'Jane', 'last_name': 'Doe'}
    resp = auth_client.post(LIST_URL, payload, format='json')
    assert resp.status_code == 201
    data = resp.json()
    assert data['first_name'] == 'Jane'
    assert data['created_by'] == api_user.pk


@pytest.mark.django_db
def test_create_contact_with_company(auth_client):
    company = CompanyFactory()
    payload = {'first_name': 'Bob', 'last_name': 'Smith', 'company_id': company.pk}
    resp = auth_client.post(LIST_URL, payload, format='json')
    assert resp.status_code == 201
    assert resp.json()['company']['id'] == company.pk


@pytest.mark.django_db
def test_create_requires_first_name(auth_client):
    resp = auth_client.post(LIST_URL, {'last_name': 'Doe'}, format='json')
    assert resp.status_code == 400
    assert 'first_name' in resp.json()


@pytest.mark.django_db
def test_create_requires_last_name(auth_client):
    resp = auth_client.post(LIST_URL, {'first_name': 'Jane'}, format='json')
    assert resp.status_code == 400
    assert 'last_name' in resp.json()


@pytest.mark.django_db
def test_create_without_company_is_valid(auth_client):
    resp = auth_client.post(LIST_URL, {'first_name': 'No', 'last_name': 'Company'}, format='json')
    assert resp.status_code == 201
    assert resp.json()['company'] is None


# ---------- retrieve ----------

@pytest.mark.django_db
def test_retrieve_contact(auth_client):
    contact = ContactFactory(first_name='Alice', last_name='Smith')
    resp = auth_client.get(detail_url(contact.pk))
    assert resp.status_code == 200
    assert resp.json()['last_name'] == 'Smith'


@pytest.mark.django_db
def test_retrieve_deleted_returns_404(auth_client):
    contact = ContactFactory()
    contact.delete()
    assert auth_client.get(detail_url(contact.pk)).status_code == 404


# ---------- update ----------

@pytest.mark.django_db
def test_partial_update(auth_client):
    contact = ContactFactory(first_name='Old', last_name='Name')
    resp = auth_client.patch(detail_url(contact.pk), {'last_name': 'New'}, format='json')
    assert resp.status_code == 200
    assert resp.json()['last_name'] == 'New'
    assert resp.json()['first_name'] == 'Old'


@pytest.mark.django_db
def test_update_clears_company(auth_client):
    company = CompanyFactory()
    contact = ContactFactory(company=company)
    resp = auth_client.patch(detail_url(contact.pk), {'company_id': None}, format='json')
    assert resp.status_code == 200
    assert resp.json()['company'] is None


@pytest.mark.django_db
def test_update_blank_first_name_rejected(auth_client):
    contact = ContactFactory()
    resp = auth_client.patch(detail_url(contact.pk), {'first_name': ''}, format='json')
    assert resp.status_code == 400


# ---------- destroy ----------

@pytest.mark.django_db
def test_destroy_soft_deletes(auth_client):
    contact = ContactFactory()
    pk = contact.pk
    resp = auth_client.delete(detail_url(pk))
    assert resp.status_code == 204

    assert auth_client.get(detail_url(pk)).status_code == 404

    from apps.contacts.models import Contact
    assert Contact.objects.filter(pk=pk, is_deleted=True).exists()


# ---------- company soft-delete cascade ----------

@pytest.mark.django_db
def test_contact_visible_after_company_soft_deleted(auth_client):
    company = CompanyFactory()
    ContactFactory(company=company)

    company.delete()

    data = auth_client.get(LIST_URL).json()
    assert data['count'] == 1
    assert data['results'][0]['company'] is None
