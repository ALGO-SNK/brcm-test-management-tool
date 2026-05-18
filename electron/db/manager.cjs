const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { MIGRATIONS } = require('./migrations.cjs');
const seedData = require('./seed-data.cjs');
const { seedActionCatalog } = require('./legacy-import.cjs');

let liveDb = null;

function getSeedDbPath(resourcesPath) {
  if (!resourcesPath) {
    throw new Error('resourcesPath not available');
  }
  return path.join(resourcesPath, 'seed', 'app-seed.sqlite');
}

function getLiveDbPath(userDataPath) {
  return path.join(userDataPath, 'app.sqlite');
}

function getBackupDir(userDataPath) {
  const dir = path.join(userDataPath, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function verifySeedDb(seedDbPath) {
  let db = null;
  try {
    db = await open({
      filename: seedDbPath,
      driver: sqlite3.Database,
      readonly: true,
    });
    const result = await db.exec('PRAGMA integrity_check;');
    if (result && result[0] !== 'ok') {
      throw new Error(`Seed DB integrity check failed: ${result}`);
    }
    console.log('[DB] Seed DB integrity check passed');
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function copySeedToLive(seedDbPath, liveDbPath) {
  console.log(`[DB] Copying seed DB from ${seedDbPath} to ${liveDbPath}`);

  // Verify seed before copying
  await verifySeedDb(seedDbPath);

  // Copy file
  fs.copyFileSync(seedDbPath, liveDbPath);
  console.log('[DB] Seed DB copied successfully');
}

async function createSeedDb(seedDbPath) {
  console.log(`[DB] Generating seed DB at ${seedDbPath}`);

  const dir = path.dirname(seedDbPath);
  fs.mkdirSync(dir, { recursive: true });

  let db = null;
  try {
    db = await open({
      filename: seedDbPath,
      driver: sqlite3.Database,
    });

    // Apply every migration in order so a freshly built DB has the full
    // schema. Stamping user_version below to MIGRATIONS.length without
    // running them all would leave later tables (e.g. action_catalog)
    // missing while runMigrations() believes it is already up to date.
    await db.exec('PRAGMA journal_mode = WAL;');
    for (const migration of MIGRATIONS) {
      await db.exec(migration.sql);
    }

    // Populate factory defaults
    for (const row of seedData.featureRegistry) {
      await db.run(
        'INSERT OR IGNORE INTO feature_registry (feature_key, label, default_enabled) VALUES (?, ?, ?)',
        [row.feature_key, row.label, row.default_enabled]
      );
    }

    for (const row of seedData.roles) {
      await db.run(
        'INSERT OR IGNORE INTO roles (role_key, label) VALUES (?, ?)',
        [row.role_key, row.label]
      );
    }

    for (const row of seedData.roleFeatures) {
      await db.run(
        'INSERT OR IGNORE INTO role_features (role_key, feature_key, enabled) VALUES (?, ?, ?)',
        [row.role_key, row.feature_key, row.enabled]
      );
    }

    const seedNow = new Date().toISOString();
    for (const row of seedData.appConfig) {
      await db.run(
        'INSERT OR IGNORE INTO app_config (key, value, is_user_modified, updated_at) VALUES (?, ?, 0, ?)',
        [row.key, row.value, seedNow]
      );
    }

    // Set initial user_version to match latest migration
    const targetVersion = MIGRATIONS.length;
    await db.exec(`PRAGMA user_version = ${targetVersion};`);

    console.log(`[DB] Seed DB created with schema version ${targetVersion}`);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

async function runMigrations(db, currentVersion, targetVersion, backupPath) {
  if (currentVersion >= targetVersion) {
    console.log(`[DB] DB is at version ${currentVersion}, no migrations needed`);
    return;
  }

  console.log(`[DB] Running migrations from v${currentVersion} to v${targetVersion}`);

  for (let v = currentVersion + 1; v <= targetVersion; v++) {
    const migration = MIGRATIONS[v - 1];
    if (!migration) {
      throw new Error(`Migration #${v} not found`);
    }

    console.log(`[DB] Applying migration #${v}: ${migration.name}`);
    try {
      await db.exec('BEGIN;');
      await db.exec(migration.sql);
      await db.exec(`PRAGMA user_version = ${v};`);
      await db.exec('COMMIT;');
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw new Error(
        `Migration #${v} failed: ${error.message}. ` +
        `Backup available at ${backupPath}. Please restore and retry.`
      );
    }
  }

  console.log('[DB] All migrations completed successfully');
}

async function seedConfigSync(db) {
  console.log('[DB] Syncing config from seed...');

  // Backfill ONLY missing factory-default keys. INSERT OR IGNORE leaves any
  // existing row untouched, so user edits (is_user_modified = 1) are never
  // clobbered on version update — new defaults added in later versions still
  // appear for users who installed before the key existed.
  const now = new Date().toISOString();
  let inserted = 0;
  for (const row of seedData.appConfig) {
    const result = await db.run(
      'INSERT OR IGNORE INTO app_config (key, value, is_user_modified, updated_at) VALUES (?, ?, 0, ?)',
      [row.key, row.value, now]
    );
    if (result && result.changes) {
      inserted += result.changes;
    }
  }

  console.log(`[DB] Config sync complete (${inserted} default key(s) backfilled)`);
}

async function getOrCreateDb(app, resourcesPath) {
  if (liveDb) {
    return liveDb;
  }

  const userDataPath = app.getPath('userData');
  const liveDbPath = getLiveDbPath(userDataPath);
  const seedDbPath = getSeedDbPath(resourcesPath);

  // On first launch, materialise the live DB.
  if (!fs.existsSync(liveDbPath)) {
    if (fs.existsSync(seedDbPath)) {
      console.log('[DB] First launch: live DB missing, copying bundled seed');
      await copySeedToLive(seedDbPath, liveDbPath);
    } else {
      // Seed not bundled (or stale build). NEVER write into resourcesPath —
      // it is read-only in a packaged install and causes SQLITE_CANTOPEN.
      // Build the schema directly into userData, which is always writable.
      console.warn('[DB] Seed DB not found; building live DB directly at userData');
      try {
        await createSeedDb(liveDbPath);
      } catch (error) {
        // Don't leave a half-built DB behind — the next launch would see the
        // file exist, skip creation, and open a poisoned database.
        if (fs.existsSync(liveDbPath)) {
          fs.rmSync(liveDbPath, { force: true });
        }
        throw error;
      }
    }
  }

  // Open live DB
  liveDb = await open({
    filename: liveDbPath,
    driver: sqlite3.Database,
  });

  await liveDb.exec('PRAGMA journal_mode = WAL;');

  // Handle migrations
  const userVersionResult = await liveDb.all('PRAGMA user_version;');
  const currentVersion = userVersionResult[0]['user_version'] || 0;
  const targetVersion = MIGRATIONS.length;

  if (currentVersion < targetVersion) {
    // Backup before migration
    const backupDir = getBackupDir(userDataPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `app-${timestamp}.bak`);

    console.log(`[DB] Creating pre-migration backup at ${backupPath}`);
    fs.copyFileSync(liveDbPath, backupPath);

    try {
      await runMigrations(liveDb, currentVersion, targetVersion, backupPath);
    } catch (error) {
      console.error(`[DB] Migration failed: ${error.message}`);
      // Close the corrupted DB and restore
      await liveDb.close();
      liveDb = null;
      fs.copyFileSync(backupPath, liveDbPath);
      throw error;
    }
  }

  // Seed action catalog on first run
  await seedActionCatalog(liveDb);

  // Backfill any missing factory-default config keys (never clobbers user edits)
  await seedConfigSync(liveDb);

  console.log('[DB] Database ready');
  return liveDb;
}

async function closeDb() {
  if (liveDb) {
    await liveDb.close();
    liveDb = null;
    console.log('[DB] Database closed');
  }
}

function getLiveDb() {
  if (!liveDb) {
    throw new Error('Database not initialized. Call getOrCreateDb first.');
  }
  return liveDb;
}

module.exports = {
  getOrCreateDb,
  closeDb,
  getLiveDb,
  getSeedDbPath,
  getLiveDbPath,
  createSeedDb,
};
