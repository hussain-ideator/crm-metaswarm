from __future__ import annotations

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
        ('companies', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Contact',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('first_name', models.CharField(max_length=150)),
                ('last_name', models.CharField(max_length=150)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('phone', models.CharField(blank=True, default='', max_length=50)),
                ('title', models.CharField(blank=True, default='', max_length=100)),
                ('company', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='contacts',
                    to='companies.company',
                )),
                ('owner', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='owned_contacts',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('created_by', models.ForeignKey(
                    blank=True,
                    editable=False,
                    null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='created_contacts_contact_set',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['last_name', 'first_name'],
            },
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['is_deleted', 'last_name'], name='contacts_is_del_lname_idx'),
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['is_deleted', 'company'], name='contacts_is_del_co_idx'),
        ),
        migrations.AddIndex(
            model_name='contact',
            index=models.Index(fields=['is_deleted', 'owner'], name='contacts_is_del_owner_idx'),
        ),
    ]
