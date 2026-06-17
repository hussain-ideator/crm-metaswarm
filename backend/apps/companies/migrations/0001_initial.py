from __future__ import annotations

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Company',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('name', models.CharField(max_length=255)),
                ('industry', models.CharField(blank=True, default='', max_length=100)),
                ('website', models.URLField(blank=True, default='', max_length=255)),
                ('phone', models.CharField(blank=True, default='', max_length=50)),
                ('billing_address', models.TextField(blank=True, default='')),
                ('shipping_address', models.TextField(blank=True, default='')),
                ('annual_revenue', models.DecimalField(blank=True, decimal_places=2, max_digits=15, null=True)),
                ('employee_count', models.PositiveIntegerField(blank=True, null=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    editable=False,
                    null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='created_companies_company_set',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('owner', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='owned_companies',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name_plural': 'companies',
                'ordering': ['name'],
            },
        ),
        migrations.AddIndex(
            model_name='company',
            index=models.Index(fields=['is_deleted', 'name'], name='companies_is_del_name_idx'),
        ),
        migrations.AddIndex(
            model_name='company',
            index=models.Index(fields=['is_deleted', 'industry'], name='companies_is_del_ind_idx'),
        ),
        migrations.AddIndex(
            model_name='company',
            index=models.Index(fields=['is_deleted', 'owner'], name='companies_is_del_owner_idx'),
        ),
    ]
