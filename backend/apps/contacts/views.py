from __future__ import annotations

from rest_framework import status
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from django_filters.rest_framework import DjangoFilterBackend

from .filters import ContactFilterSet, ContactSearchFilter
from .models import Contact
from .pagination import ContactPageNumberPagination
from .serializers import ContactSerializer


class ContactViewSet(ModelViewSet):
    serializer_class = ContactSerializer
    pagination_class = ContactPageNumberPagination
    filter_backends = [DjangoFilterBackend, ContactSearchFilter, OrderingFilter]
    filterset_class = ContactFilterSet
    ordering_fields = [
        'first_name', 'last_name', 'email', 'phone', 'title',
        'created_at', 'updated_at',
    ]
    ordering = ['last_name', 'first_name']

    def get_queryset(self):
        return (
            Contact.objects.alive()
            .select_related('company', 'owner', 'created_by')
        )

    def perform_create(self, serializer: ContactSerializer) -> None:
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
