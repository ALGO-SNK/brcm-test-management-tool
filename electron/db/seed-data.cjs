// Factory defaults for the seed database
// This is separate from migrations so seed data can be updated without schema changes

module.exports = {
  appMeta: [
    // Bootstrap markers that get set at runtime, not in seed
  ],
  appConfig: [
    // Factory defaults for the workspace settings form. Seeded once on first
    // install so users see sensible values they can then edit. Because the seed
    // DB is only copied when no live DB exists and migrations never re-run, a
    // user's saved edits (is_user_modified = 1) are never clobbered on update.
    {
      key: 'workspace.settings',
      value: JSON.stringify({
        organization: '',
        projectName: '',
        patToken: '',
        apiVersion: '7.1',
        seleniumRepoPath: '',
        dbDirectory: 'C:\\Automation Tests\\Database',
        mainDbName: 'BromcomTestCases.db',
        worldPayDbName: 'BromcomWorldPayTestCases.db',
        dbMappings: [
          { id: 'main', label: 'Main Plan', planId: 78806, dbName: 'BromcomTestCases.db', enabled: true },
          { id: 'worldPay', label: 'WorldPay Plan', planId: 139145, dbName: 'BromcomWorldPayTestCases.db', enabled: true },
        ],
        testRunWorkingDirectory: '',
        testRunProjectPath: 'BromCom.Tests\\BromCom.Tests.csproj',
        testRunSettingsPath: 'BromCom.Tests\\Bromcom.runsettings',
        testRunLogger: 'console;verbosity=detailed',
        testRunUsePatAsEnv: true,
        schedulerEnabled: true,
        schedulerTimezone: 'Asia/Kolkata',
        schedulerPollSeconds: 30,
        schedulerDefaultCron: '0 0 1 * * *',
        schedulerDefaultMode: 'nightly_full',
        schedulerDefaultBatchSize: 10,
        schedulerMaxHistoryRows: 500,
        schedulerPointBatchSize: 15,
        schedulerBuildDefinitionId: 762,
        schedulerDefaultConfigurationId: 33,
        schedulerDefaultPointConfigurationId: 33,
        schedulerReleaseDefinitionFolder: 'Overnight CDs A, Overnight CDs B',
        schedulerExcludedReleaseDefinitionIdsCsv: '24, 25',
        schedulerWorldPayRegressionBranch: 'refs/heads/regression_worldpay',
        schedulerWorldPayKanbanBranch: 'refs/heads/kanban_worldpay',
        schedulerSagePayTestPlanId: 78806,
        schedulerWorldPayTestPlanId: 139145,
        schedulerEnabledPlanIds: [78806, 139145],
        schedulerMappingWorkItemIds: '136838,147829',
        schedulerRequireSuiteMapping: true,
        schedulerArtifactAlias: '_Automated Testing Framework-ASP.NET Core-CI',
        schedulerManualEnvironmentsCsv: 'Test Run Execute',
        schedulerExcludedSuiteIdsCsv: '209484, 144095, 144094',
        schedulerExcludedSuiteNamePatterns: 'initial,intial',
      }),
    },
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
