const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { getMeta, setMeta } = require('./config-dao.cjs');

const LEGACY_IMPORT_DONE_KEY = 'legacy_import_done';

async function isLegacyImportDone(db) {
  const value = await getMeta(db, LEGACY_IMPORT_DONE_KEY);
  return value === '1' || value === 1;
}

async function openLegacyDb(userDataPath) {
  const legacyDbPath = path.join(userDataPath, 'scheduler', 'scheduler.sqlite');

  if (!fs.existsSync(legacyDbPath)) {
    console.log('[DB] No legacy scheduler.sqlite found, skipping import');
    return null;
  }

  console.log(`[DB] Opening legacy DB at ${legacyDbPath}`);

  const db = await open({
    filename: legacyDbPath,
    driver: sqlite3.Database,
    readonly: true,
  });

  return db;
}

async function importLegacyData(liveDb, legacyDb) {
  console.log('[DB] Importing legacy scheduler data...');

  try {
    // Migrate scheduler_settings
    const settings = await legacyDb.all('SELECT key, value, updated_at FROM scheduler_settings;');
    for (const row of settings) {
      await liveDb.run(
        `INSERT OR IGNORE INTO scheduler_settings (key, value, updated_at)
         VALUES (?, ?, ?);`,
        [row.key, row.value, row.updated_at]
      );
    }
    console.log(`[DB] Imported ${settings.length} scheduler settings`);

    // Migrate scheduler_schedules
    const schedules = await legacyDb.all(
      `SELECT id, name, cron, timezone, mode, selected_configuration_id, plan_id,
              suite_ids_json, batch_size, enabled, metadata_json, created_at, updated_at
       FROM scheduler_schedules;`
    );
    for (const row of schedules) {
      await liveDb.run(
        `INSERT OR IGNORE INTO scheduler_schedules
         (id, name, cron, timezone, mode, selected_configuration_id, plan_id,
          suite_ids_json, batch_size, enabled, metadata_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          row.id, row.name, row.cron, row.timezone, row.mode,
          row.selected_configuration_id, row.plan_id, row.suite_ids_json,
          row.batch_size, row.enabled, row.metadata_json, row.created_at, row.updated_at,
        ]
      );
    }
    console.log(`[DB] Imported ${schedules.length} scheduler schedules`);

    // Migrate scheduler_runs
    const runs = await legacyDb.all(
      `SELECT id, schedule_id, schedule_name, trigger_type, status,
              triggered_at, finished_at, message, payload_json
       FROM scheduler_runs;`
    );
    for (const row of runs) {
      await liveDb.run(
        `INSERT OR IGNORE INTO scheduler_runs
         (id, schedule_id, schedule_name, trigger_type, status,
          triggered_at, finished_at, message, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          row.id, row.schedule_id, row.schedule_name, row.trigger_type, row.status,
          row.triggered_at, row.finished_at, row.message, row.payload_json,
        ]
      );
    }
    console.log(`[DB] Imported ${runs.length} scheduler runs`);

    // Migrate release_logs
    const logs = await legacyDb.all(
      `SELECT release_id, release_name, release_definition_id, release_definition_name,
              test_suite_id, test_run_id, is_failed_rerun, total_tests, passed_tests,
              failed_tests, release_start_time, release_run_time, release_log_modified_time,
              batch_index, batch_count
       FROM release_logs;`
    );
    for (const row of logs) {
      await liveDb.run(
        `INSERT OR IGNORE INTO release_logs
         (release_id, release_name, release_definition_id, release_definition_name,
          test_suite_id, test_run_id, is_failed_rerun, total_tests, passed_tests,
          failed_tests, release_start_time, release_run_time, release_log_modified_time,
          batch_index, batch_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          row.release_id, row.release_name, row.release_definition_id,
          row.release_definition_name, row.test_suite_id, row.test_run_id,
          row.is_failed_rerun, row.total_tests, row.passed_tests, row.failed_tests,
          row.release_start_time, row.release_run_time, row.release_log_modified_time,
          row.batch_index, row.batch_count,
        ]
      );
    }
    console.log(`[DB] Imported ${logs.length} release logs`);

    console.log('[DB] Legacy import completed successfully');
  } catch (error) {
    console.error(`[DB] Legacy import failed: ${error.message}`);
    throw error;
  }
}

async function performLegacyImport(liveDb, userDataPath) {
  // Check if already done (idempotent)
  const alreadyDone = await isLegacyImportDone(liveDb);
  if (alreadyDone) {
    console.log('[DB] Legacy import already completed, skipping');
    return;
  }

  let legacyDb = null;
  try {
    legacyDb = await openLegacyDb(userDataPath);
    if (!legacyDb) {
      // No legacy DB found, mark as done and continue
      await setMeta(liveDb, LEGACY_IMPORT_DONE_KEY, '1');
      return;
    }

    await importLegacyData(liveDb, legacyDb);

    // Mark import as done only after full success
    await setMeta(liveDb, LEGACY_IMPORT_DONE_KEY, '1');
    console.log('[DB] Legacy import marker set');
  } finally {
    if (legacyDb) {
      await legacyDb.close();
    }
  }
}

module.exports = {
  performLegacyImport,
  isLegacyImportDone,
};
