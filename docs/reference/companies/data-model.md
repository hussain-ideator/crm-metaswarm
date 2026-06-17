# Data Model: Companies Module

**Date**: 2026-06-14 | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

---

## Entity: Company

The sole entity in this module. Represents a business organisation tracked by the CRM team.

### Backend — Django Model

```python
# backend/apps/companies/models.py

from django.conf import settings
from django.db import models

from apps.core.models import SoftDeleteMixin, TimestampedModel


class Company(TimestampedModel, SoftDeleteMixin):
    """A business organisation tracked in the CRM.

    Inherits:
      TimestampedModel → created_at, updated_at, created_by (FK, PROTECT)
      SoftDeleteMixin  → is_deleted, deleted_at; .delete() soft-deletes;
                         Company.objects is SoftDeleteQuerySet (.alive(), .dead())
    """

    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=100, blank=True, default="")
    website = models.URLField(max_length=255, blank=True, default="")
    phone = models.CharField(max_length=50, blank=True, default="")
    billing_address = models.TextField(blank=True, default="")
    shipping_address = models.TextField(blank=True, default="")
    annual_revenue = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True
    )
    employee_count = models.PositiveIntegerField(null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owned_companies",
    )

    class Meta:
        verbose_name_plural = "companies"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["is_deleted", "name"]),
            models.Index(fields=["is_deleted", "industry"]),
            models.Index(fields=["is_deleted", "owner"]),
        ]

    def __str__(self) -> str:
        return self.name
```

### Field Reference

| Field              | Django type                  | DB column           | Nullable | Blank | Notes                                              |
|--------------------|------------------------------|---------------------|----------|-------|----------------------------------------------------|
| `id`               | `BigAutoField` (inherited)   | `id` BIGINT PK      | No       | No    | Set by Django's DEFAULT_AUTO_FIELD                 |
| `name`             | `CharField(255)`             | `name`              | No       | No    | Only mandatory field (FR-001, FR-002)              |
| `industry`         | `CharField(100)`             | `industry`          | No       | Yes   | Free-text; empty string = not set                  |
| `website`          | `URLField(255)`              | `website`           | No       | Yes   | URL-format validated by Django                     |
| `phone`            | `CharField(50)`              | `phone`             | No       | Yes   | Plain text; no format enforcement in Phase 1       |
| `billing_address`  | `TextField`                  | `billing_address`   | No       | Yes   | Unstructured text (assumption)                     |
| `shipping_address` | `TextField`                  | `shipping_address`  | No       | Yes   | Unstructured text (assumption)                     |
| `annual_revenue`   | `DecimalField(15,2)`         | `annual_revenue`    | Yes      | Yes   | Non-negative enforced in serializer (FR-003)       |
| `employee_count`   | `PositiveIntegerField`       | `employee_count`    | Yes      | Yes   | Non-negative int enforced by field + serializer (FR-004) |
| `owner`            | `ForeignKey → User SET_NULL` | `owner_id`          | Yes      | Yes   | Nullable; SET_NULL on user delete (FR-015)         |
| `created_at`       | `DateTimeField auto_now_add` | `created_at`        | No       | No    | From `TimestampedModel` (FR-005)                   |
| `updated_at`       | `DateTimeField auto_now`     | `updated_at`        | No       | No    | From `TimestampedModel` (FR-005)                   |
| `created_by`       | `ForeignKey → User PROTECT`  | `created_by_id`     | Yes      | Yes   | From `TimestampedModel`; set at creation (FR-005)  |
| `is_deleted`       | `BooleanField`               | `is_deleted`        | No       | No    | From `SoftDeleteMixin`; default False (FR-013)     |
| `deleted_at`       | `DateTimeField`              | `deleted_at`        | Yes      | Yes   | From `SoftDeleteMixin`; set when soft-deleted      |

### Validation Rules

| Rule   | Field              | Constraint                                     | Enforced at          |
|--------|--------------------|------------------------------------------------|----------------------|
| FR-002 | `name`             | Must not be blank or absent                    | Serializer           |
| FR-003 | `annual_revenue`   | Must be ≥ 0 when provided                      | Serializer validator |
| FR-004 | `employee_count`   | Must be ≥ 0 integer when provided              | Field + Serializer   |

### Default List Ordering

`Company.Meta.ordering = ["name"]` — name ascending. Overridable via `?ordering=` (FR-011).

---

## Relationships

```
User (accounts.User)
  ├── owned_companies  →  Company.owner        (SET_NULL, nullable)
  └── created_by       →  Company.created_by   (PROTECT, nullable — from TimestampedModel)

Company  (this module)
  └── ← contacts (future)   company_fk         (owned by contacts module)
  └── ← deals    (future)   company_fk         (owned by deals module)
```

The `contacts` and `deals` relationships are **not** declared on Company — they are declared on the Contact and Deal models, pointing back to Company. This preserves the dependency direction: contacts/deals depend on companies, never the reverse (FR-018).

---

## State Transitions

```
ACTIVE (is_deleted=False)
   │
   │  DELETE /api/companies/{id}/
   ▼
DELETED (is_deleted=True, deleted_at=<timestamp>)
   │
   │  (no restore endpoint in Phase 1)
   ▼
  [terminal in Phase 1]
```

Deleted companies:
- Excluded from all list and search endpoints (FR-007)
- Return 404 on retrieve, update, and delete attempts (FR-014)
- Row is never physically removed from the database (FR-013)

---

## Frontend — TypeScript Types

```typescript
// frontend/src/features/companies/types.ts

export interface Company {
  id: number
  name: string
  industry: string
  website: string
  phone: string
  billing_address: string
  shipping_address: string
  annual_revenue: string | null   // Decimal serialized as string by DRF
  employee_count: number | null
  owner: number | null            // User PK; null if unset or user removed
  created_at: string              // ISO 8601
  updated_at: string
  created_by: number | null
}

export interface CompanyListResponse {
  count: number
  next: string | null
  previous: string | null
  results: Company[]
}

export interface CompanyListParams {
  q?: string
  industry?: string
  owner?: number
  ordering?: string
  page?: number
  page_size?: number
}
```

---

## Zod Schema

```typescript
// frontend/src/features/companies/schemas/company.ts
import { z } from 'zod'

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  industry: z.string().optional().default(''),
  website: z.string().url('Enter a valid URL').or(z.literal('')).optional().default(''),
  phone: z.string().optional().default(''),
  billing_address: z.string().optional().default(''),
  shipping_address: z.string().optional().default(''),
  annual_revenue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a non-negative number')
    .optional()
    .or(z.literal(''))
    .nullable(),
  employee_count: z
    .number({ invalid_type_error: 'Must be a whole number' })
    .int()
    .nonnegative()
    .nullable()
    .optional(),
  owner: z.number().nullable().optional(),
})

export type CompanyFormValues = z.infer<typeof companySchema>
```

---

## Database Indexes

Three composite indexes are declared to support the most common query patterns:

| Index                           | Supports                                              |
|---------------------------------|-------------------------------------------------------|
| `(is_deleted, name)`            | Default list query (alive companies, sorted by name)  |
| `(is_deleted, industry)`        | Industry filter on the list endpoint                  |
| `(is_deleted, owner)`           | Owner filter on the list endpoint                     |

A B-tree index on `name` alone would support ORDER BY but not the `is_deleted=False` prefix used in every list query. The composite ensures the most selective predicate (`is_deleted=False`) is in the leading position.
