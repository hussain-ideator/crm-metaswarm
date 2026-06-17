from __future__ import annotations

from django.contrib import admin

from .models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'industry', 'owner', 'is_deleted', 'created_at')
    list_filter = ('is_deleted', 'industry')
    search_fields = ('name', 'website', 'phone')
    readonly_fields = ('created_at', 'updated_at', 'created_by')
