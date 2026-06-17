# Data Model: JWT Authentication

**Date**: 2026-06-14 | **Feature**: JWT Auth | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

---

## Existing Entities (no changes)

### `accounts.User` (existing)

```
User (accounts.User — extends AbstractUser)
├── id            BigAutoField (PK)
├── username      CharField (unique)
├── email         EmailField (unique)         ← primary login identifier
├── password      CharField (hashed)
├── first_name    CharField
├── last_name     CharField
├── is_active     BooleanField
└── ...           (AbstractUser standard fields)
```

No fields are added to `User` for this feature.

---

## New Entities

### `accounts.RefreshTokenFamily`

One record created per successful login. Groups all refresh tokens issued from that login event into a named family for reuse detection and bulk revocation.

```
RefreshTokenFamily
├── id            UUIDField (PK, default=uuid4, editable=False)
├── user          ForeignKey → User (on_delete=CASCADE)
├── created_at    DateTimeField (auto_now_add=True)
└── is_revoked    BooleanField (default=False, db_index=True)

Indexes:
  - (user_id, is_revoked)    — lookup during login and reuse detection
  - (created_at)             — for ordered purge queries
```

**State transitions**:

| Event | `is_revoked` |
|-------|-------------|
| Successful login | `False` (created) |
| Logout | `True` |
| Reuse detection (stale token presented) | `True` |

---

### `accounts.RefreshTokenLineage`

One record per issued refresh token. Tracks which family a token belongs to, whether it is currently the active member of its family, and when it expires (for purge eligibility).

```
RefreshTokenLineage
├── jti           CharField (PK, max_length=36)  ← UUID from JWT "jti" claim
├── family        ForeignKey → RefreshTokenFamily (on_delete=CASCADE)
├── is_active     BooleanField (default=True, db_index=True)
├── issued_at     DateTimeField (auto_now_add=True)
├── expires_at    DateTimeField                  ← issued_at + 7 days
└── revoked_at    DateTimeField (null=True, blank=True)

Indexes:
  - (family_id, is_active)   — reuse detection: "are there any active members of this family?"
  - (expires_at)             — purge query: "which records are expired?"
  - jti is PK; no extra index needed for jti lookups
```

**State transitions**:

| Event | `is_active` | `revoked_at` |
|-------|------------|-------------|
| Token issued (login or rotation) | `True` | `null` |
| Token rotated (replaced by successor) | `False` | `now()` |
| Token revoked (logout or family revocation) | `False` | `now()` |

**Lifecycle during normal use**:
```
Login → Family F created (is_revoked=False)
      → Token A issued → Lineage(jti=A, family=F, is_active=True)

Refresh → Token A validated (is_active=True) ✓
        → Token A deactivated: Lineage(jti=A, is_active=False, revoked_at=now())
        → Token B issued → Lineage(jti=B, family=F, is_active=True)

Logout  → Token B deactivated
        → Family F.is_revoked = True
```

**Reuse detection**:
```
Attacker presents stale Token A (is_active=False):
  → Lookup jti=A → is_active=False → REUSE DETECTED
  → Family F.is_revoked = True
  → All Lineage where family=F: is_active=False, revoked_at=now()
  → 401 returned; user must re-authenticate
```

---

## Validation Rules

| Entity | Field | Rule |
|--------|-------|------|
| RefreshTokenFamily | user | Required; must reference an `is_active=True` User |
| RefreshTokenLineage | jti | Required; must be unique (PK enforces); extracted from JWT "jti" claim |
| RefreshTokenLineage | expires_at | Must be in the future at creation time |
| RefreshTokenLineage | family | Required; `family.is_revoked` must be `False` at creation time |

---

## simplejwt Built-in Tables (kept, secondary role)

simplejwt's `token_blacklist` app (`rest_framework_simplejwt.token_blacklist` already in `INSTALLED_APPS`) creates:

- `token_blacklist_outstandingtoken` — one record per issued JWT (tracked by simplejwt)
- `token_blacklist_blacklistedtoken` — tokens explicitly blacklisted

These remain active. The custom `RefreshTokenLineage` check runs first on every refresh/logout; simplejwt's blacklist acts as a secondary defence. On logout, both the lineage record is deactivated and the token is added to simplejwt's blacklist.

---

## Django Settings Reference

`crm/settings.py` `SIMPLE_JWT` block is already partially configured and requires no changes for this feature:

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),     # env: JWT_ACCESS_LIFETIME_MINUTES
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),        # env: JWT_REFRESH_LIFETIME_DAYS
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
```

Cookie name, path, and security flags are set in code within the custom views (see [research.md RES-002](./research.md)).

---

## Migration Notes

- `RefreshTokenFamily` and `RefreshTokenLineage` are new tables in the `accounts` app — add to `apps/accounts/models.py` and generate a new migration (`0002_refreshtokenfamily_refreshtokenlineage.py`)
- simplejwt `token_blacklist` tables already exist from the `rest_framework_simplejwt.token_blacklist` entry in `INSTALLED_APPS` — no migration change needed
- No changes to the `User` model or its existing migration
