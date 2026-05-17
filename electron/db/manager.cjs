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

    // Create schema from migration #1
    await db.exec('PRAGMA journal_mode = WAL;');
    const schemaSql = MIGRATIONS[0].sql;
    await db.exec(schemaSql);

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

async function seedConfigSync(db, seedDb) {
  console.log('[DB] Syncing config from seed...');

  // For now, this is a no-op since app_config is empty in seed
  // In future, this will update factory defaults without clobbering user edits
  console.log('[DB] Config sync complete');
}

async function getOrCreateDb(app, resourcesPath) {
  if (liveDb) {
    return liveDb;
  }

  const userDataPath = app.getPath('userData');
  const liveDbPath = getLiveDbPath(userDataPath);
  const seedDbPath = getSeedDbPath(resourcesPath);

  // On first launch, copy seed to live
  if (!fs.existsSync(liveDbPath)) {
    console.log('[DB] First launch: live DB missing, initializing from seed');

    // If seed doesn't exist (in dev), create it
    if (!fs.existsSync(seedDbPath)) {
      await createSeedDb(seedDbPath);
    }

    await copySeedToLive(seedDbPath, liveDbPath);
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
