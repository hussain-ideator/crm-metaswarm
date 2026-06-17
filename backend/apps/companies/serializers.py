from __future__ import annotations

from rest_framework import serializers

from .models import Company


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            'id',
            'name',
            'industry',
            'website',
            'phone',
            'billing_address',
            'shipping_address',
            'annual_revenue',
            'employee_count',
            'owner',
            'created_at',
            'updated_at',
            'created_by',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def validate_annual_revenue(self, value: object) -> object:
        if value is not None and value < 0:
            raise serializers.ValidationError('Annual revenue must be non-negative.')
        return value
