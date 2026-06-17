from __future__ import annotations

import django_filters
from rest_framework.filters import SearchFilter

from .models import Company


class CompanyFilterSet(django_filters.FilterSet):
    industry = django_filters.CharFilter(lookup_expr='iexact')
    owner = django_filters.NumberFilter(field_name='owner__id')

    class Meta:
        model = Company
        fields = ['industry', 'owner']


class CompanySearchFilter(SearchFilter):
    search_param = 'q'
    search_fields = ['name', 'website', 'phone']
