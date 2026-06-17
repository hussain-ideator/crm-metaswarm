from __future__ import annotations

from django.contrib import admin

from .models import Contact


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'email', 'phone', 'company', 'owner', 'is_deleted']
    list_filter = ['is_deleted', 'company', 'owner']
    search_fields = ['first_name', 'last_name', 'email', 'phone']
    readonly_fields = ['created_at', 'updated_at', 'created_by', 'deleted_at']
