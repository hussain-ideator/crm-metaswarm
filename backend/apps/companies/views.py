from __future__ import annotations

from rest_framework import status
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend

from .filters import CompanyFilterSet, CompanySearchFilter
from .models import Company
from .pagination import CompanyPageNumberPagination
from .serializers import CompanySerializer


class CompanyViewSet(ModelViewSet):
    serializer_class = CompanySerializer
    pagination_class = CompanyPageNumberPagination
    filter_backends = [DjangoFilterBackend, CompanySearchFilter, OrderingFilter]
    filterset_class = CompanyFilterSet
    ordering_fields = [
        'name', 'industry', 'website', 'phone',
        'annual_revenue', 'employee_count', 'created_at', 'updated_at',
    ]
    ordering = ['name']

    def get_queryset(self):
        return (
            Company.objects.alive()
            .select_related('owner', 'created_by')
        )

    def perform_create(self, serializer: CompanySerializer) -> None:
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
