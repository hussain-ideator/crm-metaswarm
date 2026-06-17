from __future__ import annotations

from django_filters import FilterSet, NumberFilter
from rest_framework.filters import SearchFilter

from .models import Contact


class ContactFilterSet(FilterSet):
    company = NumberFilter(field_name='company__id')
    owner = NumberFilter(field_name='owner__id')

    class Meta:
        model = Contact
        fields = ['company', 'owner']


class ContactSearchFilter(SearchFilter):
    search_param = 'q'
    search_fields = ['first_name', 'last_name', 'email', 'phone']
