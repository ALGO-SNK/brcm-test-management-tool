// Factory defaults for the seed database
// This is separate from migrations so seed data can be updated without schema changes

module.exports = {
  appMeta: [
    // Bootstrap markers that get set at runtime, not in seed
  ],
  appConfig: [
    // Empty by default; users and admins populate these
  ],
  featureRegistry: [
    { feature_key: 'schedule-run', label: 'Schedule Run', default_enabled: 1 },
    { feature_key: 'run-history', label: 'Run History', default_enabled: 1 },
    { feature_key: 'db-updater', label: 'Database Updater', default_enabled: 1 },
    { feature_key: 'admin-panel', label: 'Admin Panel', default_enabled: 0 },
  ],
  roles: [
    { role_key: 'admin', label: 'Administrator' },
    { role_key: 'scheduler', label: 'Scheduler' },
    { role_key: 'viewer', label: 'Viewer' },
  ],
  roleFeatures: [
    // Admin: all features
    { role_key: 'admin', feature_key: 'schedule-run', enabled: 1 },
    { role_key: 'admin', feature_key: 'run-history', enabled: 1 },
    { role_key: 'admin', feature_key: 'db-updater', enabled: 1 },
    { role_key: 'admin', feature_key: 'admin-panel', enabled: 1 },
    // Scheduler: schedule and view history
    { role_key: 'scheduler', feature_key: 'schedule-run', enabled: 1 },
    { role_key: 'scheduler', feature_key: 'run-history', enabled: 1 },
    { role_key: 'scheduler', feature_key: 'db-updater', enabled: 0 },
    { role_key: 'scheduler', feature_key: 'admin-panel', enabled: 0 },
    // Viewer: read-only
    { role_key: 'viewer', feature_key: 'schedule-run', enabled: 0 },
    { role_key: 'viewer', feature_key: 'run-history', enabled: 1 },
    { role_key: 'viewer', feature_key: 'db-updater', enabled: 0 },
    { role_key: 'viewer', feature_key: 'admin-panel', enabled: 0 },
  ],
  userRoles: [
    // Empty by default; populate at runtime via license or admin panel
  ],
  featureOverrides: [
    // Empty by default; per-user overrides set at runtime
  ],
};
