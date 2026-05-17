const MIGRATIONS = [
  {
    v: 1,
    name: 'Initial schema',
    sql: `
      -- Bootstrap and state flags
      CREATE TABLE app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Application configuration
      CREATE TABLE app_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        is_user_modified INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      -- Feature registry (mirror of code enum)
      CREATE TABLE feature_registry (
        feature_key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        default_enabled INTEGER NOT NULL DEFAULT 1
      );

      -- User roles
      CREATE TABLE roles (
        role_key TEXT PRIMARY KEY,
        label TEXT NOT NULL
      );

      -- Role-feature entitlements
      CREATE TABLE role_features (
        role_key TEXT NOT NULL,
        feature_key TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        PRIMARY KEY (role_key, feature_key)
      );

      -- User role assignments
      CREATE TABLE user_roles (
        user_email TEXT NOT NULL,
        role_key TEXT NOT NULL,
        PRIMARY KEY (user_email, role_key)
      );

      -- Per-user feature overrides
      CREATE TABLE feature_overrides (
        user_email TEXT NOT NULL,
        feature_key TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        is_user_modified INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_email, feature_key)
      );

      -- Release logs (moved from scheduler.sqlite)
      CREATE TABLE release_logs (
        release_id INTEGER PRIMARY KEY,
        release_name TEXT,
        release_definition_id INTEGER NOT NULL,
        release_definition_name TEXT,
        test_suite_id INTEGER NOT NULL,
        test_run_id INTEGER,
        is_failed_rerun INTEGER NOT NULL DEFAULT 0,
        total_tests INTEGER,
        passed_tests INTEGER,
        failed_tests INTEGER,
        release_start_time TEXT,
        release_run_time TEXT,
        release_log_modified_time TEXT,
        batch_index INTEGER,
        batch_count INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_release_logs_modified_time ON release_logs(release_log_modified_time DESC);
      CREATE INDEX IF NOT EXISTS idx_release_logs_test_suite_id ON release_logs(test_suite_id);

      -- Scheduler settings (moved from scheduler.sqlite)
      CREATE TABLE scheduler_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Scheduler schedules (moved from scheduler.sqlite)
      CREATE TABLE scheduler_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cron TEXT NOT NULL,
        timezone TEXT NOT NULL,
        mode TEXT NOT NULL,
        selected_configuration_id INTEGER NOT NULL,
        plan_id INTEGER,
        suite_ids_json TEXT NOT NULL,
        batch_size INTEGER NOT NULL,
        enabled INTEGER NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Scheduler runs (moved from scheduler.sqlite)
      CREATE TABLE scheduler_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id INTEGER,
        schedule_name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        status TEXT NOT NULL,
        triggered_at TEXT NOT NULL,
        finished_at TEXT,
        message TEXT,
        payload_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scheduler_runs_triggered_at ON scheduler_runs(triggered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_scheduler_runs_schedule_id ON scheduler_runs(schedule_id);

      -- License state (for Change 2)
      CREATE TABLE license_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        raw_license TEXT,
        payload_json TEXT,
        issued_to TEXT,
        maintenance_until TEXT,
        activated_at TEXT,
        last_verified_at TEXT
      );
    `,
  },
];

module.exports = { MIGRATIONS };
