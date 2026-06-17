from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.core.models import SoftDeleteMixin, TimestampedModel


class Company(TimestampedModel, SoftDeleteMixin):
    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=100, blank=True, default='')
    website = models.URLField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    billing_address = models.TextField(blank=True, default='')
    shipping_address = models.TextField(blank=True, default='')
    annual_revenue = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True
    )
    employee_count = models.PositiveIntegerField(null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_companies',
    )

    class Meta:
        verbose_name_plural = 'companies'
        ordering = ['name']
        indexes = [
            models.Index(fields=['is_deleted', 'name']),
            models.Index(fields=['is_deleted', 'industry']),
            models.Index(fields=['is_deleted', 'owner']),
        ]

    def __str__(self) -> str:
        return self.name
