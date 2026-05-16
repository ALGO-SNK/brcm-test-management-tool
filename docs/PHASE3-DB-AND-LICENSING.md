# Phase 3 — Shipped Database + License-Gated Features

> **Status:** Specification only. Not yet implemented. This is the agreed design
> from the brainstorming/impact-analysis sessions. Paste this file (or reference
> it) when ready to start the build.
>
> **Two changes covered:**
> 1. Ship a database with the installer (seed → copy → migrate; config + run
>    logs move into the DB; per-user feature gating backed by the DB).
> 2. A signed license key that unlocks the app and controls feature access.
>
> The two changes share one foundation (the Electron DB + migration layer) and
> are designed to compose: the signed license can carry the feature
> entitlements, making it a single tamper-proof policy artifact.

---

## 0. Decisions already locked (do not re-litigate without reason)

| Topic | Decision |
|---|---|
| Config merge on update | Per-row `is_user_modified` flag. Updates refresh untouched factory defaults; never clobber user-edited rows. |
| Install scope | **Per-user, no admin** (`%LocalAppData%\Programs`). Data safety identical to Program Files; elevation-free auto-updates. |
| Legacy users | One-time auto-import of existing localStorage config + cached run logs into the DB on first launch of the new version, then mark done. |
| User identity | **ADO authenticated identity** — real `emailAddress`/`uniqueName` resolved from the existing PAT via ADO connection/profile API. |
| Feature policy source | **Local DB only** (defaults ship in the seed DB). Central change lever = reissuing a signed license (see Change 2). |
| Unresolved/offline policy state | Each feature's seed `default_enabled` applies until real policy/identity resolves. |
| License model | **Perpetual + maintenance window.** App works forever once activated; *new versions* are gated by the maintenance window. |
| License binding | **ADO identity** — `license.issuedTo` must equal the resolved ADO email. Prevents sharing; follows the person across machines. |
| License delivery | **Separate signed `license.bcm` file**, imported on first run, cached in the live DB. |

---

## 1. Critical platform constraint (the reason for the whole design)

On Windows, the install directory (Program Files **or** the per-user
`%LocalAppData%\Programs`) is treated as program code, not user data:

- ✅ A DB shipped in the bundle can be **read**.
- ❌ A DB in the install dir must **not** be used as the read-write store
  (Program Files is read-only for standard users; even per-user installs should
  keep code and data separated for clean updates/uninstall).

Therefore: **ship a read-only seed DB; run from a writable copy in AppData.**

---

## Change 1 — Ship Database With Installer

### 1.1 Architecture

```
<install dir>\resources\seed\app-seed.sqlite     ← shipped, READ-ONLY (schema + factory defaults)
        │  first launch, if live missing → copy
        ▼
%AppData%\Roaming\<App>\app.sqlite                ← LIVE, read-write (config + run logs + policy)
%AppData%\Roaming\<App>\backups\app-<ts>.bak      ← automatic pre-migration backups
```

- Seed path resolved via `process.resourcesPath` + `seed/app-seed.sqlite`.
- Live path: `app.getPath('userData')` + `app.sqlite`.
- Live DB survives app updates **and** uninstall (NSIS does not remove user data
  by default). Users never browse AppData, so "user won't delete it" is met
  without needing Program Files.

### 1.2 Live DB schema

```sql
-- Migration version marker
PRAGMA user_version;                       -- integer, bumped by migration runner

CREATE TABLE app_meta (                     -- bootstrap/state flags
  key   TEXT PRIMARY KEY,                   -- 'legacy_import_done', 'seed_version',
  value TEXT NOT NULL                       --   'last_seen_utc' (anti-rollback), ...
);

CREATE TABLE app_config (
  key             TEXT PRIMARY KEY,
  value           TEXT,
  is_user_modified INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL
);

CREATE TABLE feature_registry (             -- mirror of the code enum, for UI/admin
  feature_key TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  default_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE roles (
  role_key TEXT PRIMARY KEY,
  label    TEXT NOT NULL
);

CREATE TABLE role_features (
  role_key    TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  enabled     INTEGER NOT NULL,
  PRIMARY KEY (role_key, feature_key)
);

CREATE TABLE user_roles (
  user_email TEXT NOT NULL,                 -- ADO uniqueName/email (lowercased)
  role_key   TEXT NOT NULL,
  PRIMARY KEY (user_email, role_key)
);

CREATE TABLE feature_overrides (
  user_email      TEXT NOT NULL,
  feature_key     TEXT NOT NULL,
  enabled         INTEGER NOT NULL,
  is_user_modified INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_email, feature_key)
);

CREATE TABLE release_logs ( ... );          -- existing scheduler release-log table, moved here

CREATE TABLE license_state (                -- see Change 2
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  raw_license     TEXT,                     -- the imported signed blob
  payload_json    TEXT,                     -- verified, parsed payload
  issued_to       TEXT,
  maintenance_until TEXT,
  activated_at    TEXT,
  last_verified_at TEXT
);
```

### 1.3 Launch lifecycle (Electron main)

1. Resolve live DB path. If missing → `fs.mkdirSync` + copy seed → live;
   run `PRAGMA integrity_check` on the seed before copying.
2. Read `PRAGMA user_version`. If the code's target version is higher:
   a. Copy live DB → `backups\app-<timestamp>.bak`.
   b. Run ordered migrations `v(current+1) … v(target)`, **each in its own
      `BEGIN/COMMIT`**. On any failure: restore from backup, surface a clear
      error, refuse to continue (do not run on a half-migrated DB).
   c. Set `user_version` to target.
3. **Seed config sync** — for every key in the new seed's `app_config`:
   - absent in live → `INSERT`.
   - present and `is_user_modified = 0` → update value from seed.
   - present and `is_user_modified = 1` → leave untouched.
   - Same rule for `feature_registry` / `role_features` / `feature_overrides`.
4. **One-time legacy import** — if `app_meta.legacy_import_done` is unset:
   - Renderer handshake pushes existing localStorage config + cached run logs.
   - Write into DB; mark migrated user-edited rows `is_user_modified = 1`.
   - Set `legacy_import_done = 1` only after full success (idempotent).
5. App reads/writes via new IPC handlers.

### 1.4 Migration runner

Replace the current ad-hoc `PRAGMA table_info` checks with an ordered list:

```js
const MIGRATIONS = [
  { v: 1, sql: `<seed schema == migration #1, single source of truth>` },
  { v: 2, sql: `ALTER TABLE ...` },
  // ...
];
```

The **seed DB is regenerated at build time from this same list** so seed schema
and migration #1 can never drift.

### 1.5 IPC surface (renderer ↔ main)

- `desktop:config-get` → full config object (hydrated once at startup, cached in
  renderer to avoid refactoring every call site to async).
- `desktop:config-set(key, value)` → writes value, sets `is_user_modified = 1`.
- `desktop:release-log-*` → keep existing API shape (DB moved underneath; call
  sites unaffected).
- `desktop:legacy-import(payload)` → one-time importer.

### 1.6 Packaging (electron-builder)

- `extraResources`: ship `seed/app-seed.sqlite`.
- `asarUnpack`: `**/node_modules/sqlite3/**` (native `.node` cannot load from
  asar). Verify on a clean machine.
- NSIS: `oneClick` per-user (`perMachine: false`), no elevation.
- Build script: regenerate `app-seed.sqlite` from the migration list + a
  checked-in `seed-data` file (factory config, roles, registry). Seed is
  reproducible and versioned in git; the raw `.sqlite` may be git-ignored.

### 1.7 Risks & mitigations

| Risk | Mitigation |
|---|---|
| Bad migration corrupts data | Per-step transaction + automatic pre-migration backup + restore path |
| Seed/live schema drift | Seed generated from the same migration list at build time |
| Partial legacy import | Idempotent; `legacy_import_done` flips only on full success |
| Multi-Windows-user machine | Each user seeded independently from the same template (expected) |
| AppData write blocked (AV/locked) | try/catch with clear, actionable error |

---

## Change 2 — License Key To Allow Features

### 2.1 Enforcement point

**Gate at first-run, not at the installer.** App installs freely; the main UI
is blocked behind an **activation gate** until a valid signed license is
present. More reliable than custom NSIS, and update-friendly.

### 2.2 Signed license file (offline, no server)

```
license.bcm = base64( JSON payload ) + "." + base64( signature )

payload = {
  licenseId,
  issuedTo,            // ADO email (lowercased) — binding target
  org,
  issuedAt,            // ISO
  maintenanceUntil,    // ISO — the "path valid until" window for NEW versions
  binding: "identity",
  entitlements: {      // doubles as the feature policy (overrides local DB)
    "schedule-run": true,
    "run-history": false,
    "...": true
  }
}

signature = Ed25519_sign(payload_bytes, PRIVATE_KEY)   // you hold the private key
```

- App embeds **only the public key**. Verification is fully offline and stops
  forgery/editing. (`node:crypto` Ed25519, or tweetnacl.)
- Issuing tool: `scripts/mint-license.mjs` (sets `issuedTo`,
  `maintenanceUntil`, `entitlements`; signs with the offline private key).
- Keypair generation script; **private key never in the repo**, backed up
  offline. Lost key = cannot issue; leaked key = anyone can mint.

### 2.3 Activation flow

**First run (pre-gate shell only — limited UI):**
1. User enters ADO PAT → resolve ADO identity (email/uniqueName).
2. User imports `license.bcm`.
3. Verify signature with embedded public key. Reject if tampered.
4. Check `payload.issuedTo === resolved ADO identity` (lowercased). Reject
   mismatch (anti-sharing).
5. Persist verified payload + `activated_at` into `license_state`. Unlock UI.

**Subsequent runs (offline-capable):**
- Load cached verified license from `license_state`.
- Re-check identity binding against the connected ADO identity.
- **Anti-rollback:** maintain `app_meta.last_seen_utc` (monotonic). On launch,
  if `now < last_seen_utc - skew` → refuse (clock tampering). Update on each
  successful run.

### 2.4 Version gating ("path valid")

The build embeds its **release date** (injected at build time).

- App release date **≤** `license.maintenanceUntil` → runs normally
  (perpetual; works forever once activated).
- A future version whose release date **>** `maintenanceUntil` → **that
  version** refuses with: "Maintenance expired for this version — use ≤ vX or
  renew your license." The already-activated older version keeps working
  indefinitely.

This implements: *next version requires a valid path; otherwise the user stays
on the working version until they renew.*

### 2.5 Feature resolution (composition with Change 1)

```
canAccess(user, feature) =
    license.entitlements[feature]            (if license present — central lever)
  > feature_overrides(user, feature)
  > role_features via user_roles
  > feature_registry.default_enabled         (seed default; offline/unresolved)
```

Reissuing a signed `license.bcm` changes entitlements **without an app
release** — this is the answer to the earlier "local DB only = no central
control" limitation.

**Enforcement call sites (one shared resolver / `useFeatureAccess()` hook):**
- `MainWorkspace` sidebar/nav → filter items (e.g. hide *Schedule Run*,
  *Run History*).
- Route guards → redirect deep-links to hidden routes.
- `actionRegistry` → gate menu/actions.
- **Admin screen** is itself a gated feature (seed your own ADO email as
  `admin` role) to manage `user_roles` / `feature_overrides` locally.

### 2.6 Honest limits (must communicate)

- Signature verification stops forgery/editing completely, offline.
- It does **not** stop a determined reverse-engineer patching the binary —
  true of all client-side licensing. Acceptable for entitlement; do not use it
  to protect secrets.
- Offline clock rollback mitigated by monotonic `last_seen_utc`; a full fix
  needs an optional online check (out of scope unless requested).
- Offline revocation is hard — lever is short `maintenanceUntil` + reissue.

---

## 3. Unified implementation order

> Steps 1–4 are the shared foundation. Build and validate step 1 before
> anything else — everything depends on it.

1. **Electron DB layer + migration runner** — seed→AppData copy, `user_version`
   ordered migrations, automatic pre-migration backup + restore.
2. Config DAO + IPC; move `release_logs` into the live DB (keep API shape).
3. One-time legacy import (localStorage/cache → DB), idempotent.
4. ADO identity resolver (profile/`connectionData` on connect, cached in DB).
5. License module — embedded public key, Ed25519 verify, payload schema,
   identity-binding check, anti-rollback `last_seen_utc`, `license_state`.
6. Activation gate — pre-gate shell (PAT → identity → import license); block
   main UI until verified.
7. Feature registry enum + resolver (license → overrides → roles → seed
   default); `useFeatureAccess()` hook.
8. Gate nav, routes, action registry; Admin screen (gated).
9. `scripts/mint-license.mjs` + keypair generation; document key custody.
10. electron-builder: `extraResources` seed, embed public key + build release
    date, `asarUnpack` sqlite3, per-user NSIS, seed-generation build script.

---

## 4. Pre-build checklist (resolve before coding)

- [ ] Confirm final `app_config` keys to migrate out of localStorage (enumerate
      every current setting + connection field).
- [ ] Confirm the canonical feature key list for `feature_registry`
      (`schedule-run`, `run-history`, `db-updater`, …).
- [ ] Confirm role set (`admin`, `scheduler`, `viewer`, …) and which ADO
      emails seed into `admin`.
- [ ] Choose Ed25519 implementation (`node:crypto` vs tweetnacl) and license
      file extension/format.
- [ ] Decide backup retention (how many `.bak` files to keep).
- [ ] Confirm electron-builder config currently has `sqlite3` in
      `dependencies` and is `asarUnpack`'d.
- [ ] Decide whether an optional online validation is ever wanted (affects
      revocation/clock-rollback strength) — currently **out of scope**.

---

## 5. Success criteria

- Clean-machine install creates the live DB from the seed on first run; no DB
  shipped as writable.
- App update preserves all run logs and user-edited config; new factory
  defaults flow in without clobbering user edits (`is_user_modified`).
- Existing users' localStorage config + cached logs auto-import once, losslessly.
- Without a valid signed `license.bcm` matching the ADO identity, the main UI
  is unreachable.
- A version released after `maintenanceUntil` refuses to run while the prior
  activated version keeps working.
- Hiding *Schedule Run* / *Run History* for a specific user works via
  entitlements/roles, enforced in nav + routes + actions.
- Tampered or wrong-identity license is rejected offline.
