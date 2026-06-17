from __future__ import annotations

from rest_framework import serializers

from .models import Contact


class _CompanyBrief(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class _OwnerBrief(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj: object) -> str:
        return f'{getattr(obj, "first_name", "")} {getattr(obj, "last_name", "")}'.strip()


class ContactSerializer(serializers.ModelSerializer):
    company = _CompanyBrief(read_only=True)
    owner = _OwnerBrief(read_only=True)

    class Meta:
        model = Contact
        fields = [
            'id',
            'first_name',
            'last_name',
            'email',
            'phone',
            'title',
            'company',
            'company_id',
            'owner',
            'owner_id',
            'created_at',
            'updated_at',
            'created_by',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_fields(self) -> dict:
        fields = super().get_fields()
        from django.apps import apps
        Company = apps.get_model('companies', 'Company')
        from django.contrib.auth import get_user_model
        User = get_user_model()
        fields['company_id'] = serializers.PrimaryKeyRelatedField(
            queryset=Company.objects.alive(),
            source='company',
            allow_null=True,
            required=False,
        )
        fields['owner_id'] = serializers.PrimaryKeyRelatedField(
            queryset=User.objects.filter(is_active=True),
            source='owner',
            allow_null=True,
            required=False,
        )
        return fields
