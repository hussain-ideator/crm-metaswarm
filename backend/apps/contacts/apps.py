from __future__ import annotations

from django.apps import AppConfig


class ContactsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.contacts'

    def ready(self) -> None:
        from django.db.models.signals import post_save
        from django.apps import apps

        def _nullify_company_on_soft_delete(
            sender: object, instance: object, **kwargs: object
        ) -> None:
            if getattr(instance, 'is_deleted', False):
                from apps.contacts.models import Contact
                Contact.objects.filter(company=instance).update(company=None)

        Company = apps.get_model('companies', 'Company')
        post_save.connect(_nullify_company_on_soft_delete, sender=Company, weak=False)
