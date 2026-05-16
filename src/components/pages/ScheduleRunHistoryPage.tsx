import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotification } from '../../context/useNotification';
import { IconDownload, IconRefresh } from '../Common/Icons';

export function ScheduleRunHistoryPage() {
  const { addNotification } = useNotification();
  const [logs, setLogs] = useState<DesktopReleaseLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSuite, setFilterSuite] = useState('');
  const [filterRelease, setFilterRelease] = useState('');

  const loadLogs = useCallback(async () => {
    if (!window.desktop?.listReleaseLogs) {
      addNotification('error', 'Release logs API unavailable');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.desktop.listReleaseLogs(500);
      setLogs(Array.isArray(result) ? result : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load release logs';
      addNotification('error', message);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const suiteMatch =
        filterSuite === '' || String(log.testSuiteId).includes(filterSuite);
      const releaseMatch =
        filterRelease === '' ||
        String(log.releaseId).includes(filterRelease) ||
        log.releaseName.toLowerCase().includes(filterRelease.toLowerCase()) ||
        log.releaseDefinitionName.toLowerCase().includes(filterRelease.toLowerCase());
      return suiteMatch && releaseMatch;
    });
  }, [logs, filterSuite, filterRelease]);

  const handleDownloadCsv = () => {
    if (filteredLogs.length === 0) {
      addNotification('warning', 'No logs to download');
      return;
    }

    const headers = [
      'Release ID',
      'Release Name',
      'Release Definition',
      'Test Suite ID',
      'Batch',
      'Failed Rerun',
      'Total',
      'Passed',
      'Failed',
      'Release Start Time',
      'Release Run Time',
      'Last Modified',
    ];

    const rows = filteredLogs.map((log) => {
      const cdLabel = log.releaseDefinitionName?.trim()
        ? `${log.releaseDefinitionName} (ID: ${log.releaseDefinitionId})`
        : `CD ${log.releaseDefinitionId}`;
      return [
        log.releaseId,
        log.releaseName,
        cdLabel,
        log.testSuiteId,
        log.batchIndex && log.batchCount ? `${log.batchIndex}/${log.batchCount}` : '',
        log.isFailedRerun ? 'Yes' : 'No',
        log.totalTests ?? '',
        log.passedTests ?? '',
        log.failedTests ?? '',
        log.releaseStartTime,
        log.releaseRunTime,
        log.releaseLogModifiedTime,
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `release-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="workspace-hub__plans-panel">
      <div className="settings-panel__head workspace-hub__plans-head">
        <div>
          <div className="suite-main-heading">
            <h2>Run History</h2>
          </div>
          <p className="settings-panel__sub">
            Per-release execution log persisted locally (mirrors C# ReleaseLog table).
          </p>
        </div>
        <div className="workspace-hub__plans-meta">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => void loadLogs()}
            disabled={isLoading}
          >
            <IconRefresh size={15} />
            Refresh
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleDownloadCsv}
            disabled={filteredLogs.length === 0}
          >
            <IconDownload size={15} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="workspace-hub__plans-body">
        {isLoading ? (
          <div className="empty-state">
            <p className="empty-state__title">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No release logs yet</p>
            <p className="empty-state__desc">
              Logs will appear here once a scheduled run creates a release.
            </p>
          </div>
        ) : (
          <>
            <div className="scheduler-history-filters">
              <div className="scheduler-history-filter-group">
                <input
                  type="text"
                  placeholder="Filter by Test Suite ID..."
                  value={filterSuite}
                  onChange={(e) => setFilterSuite(e.target.value)}
                  className="scheduler-history-filter-input"
                />
              </div>
              <div className="scheduler-history-filter-group">
                <input
                  type="text"
                  placeholder="Filter by Release ID or Definition Name..."
                  value={filterRelease}
                  onChange={(e) => setFilterRelease(e.target.value)}
                  className="scheduler-history-filter-input"
                />
              </div>
              <div className="scheduler-history-filter-info">
                Showing {filteredLogs.length} of {logs.length} logs
              </div>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table history-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>Release ID</th>
                    <th>Release Name</th>
                    <th>Release Definition</th>
                    <th style={{ width: 90 }}>Suite ID</th>
                    <th style={{ width: 90 }}>Run ID</th>
                    <th style={{ width: 70 }}>Batch</th>
                    <th style={{ width: 80 }}>Rerun?</th>
                    <th style={{ width: 70 }}>Total</th>
                    <th style={{ width: 70 }}>Passed</th>
                    <th style={{ width: 70 }}>Failed</th>
                    <th style={{ width: 160 }}>Start Time</th>
                    <th style={{ width: 100 }}>Runtime</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const cdLabel = log.releaseDefinitionName?.trim()
                      ? `${log.releaseDefinitionName} (ID: ${log.releaseDefinitionId})`
                      : `CD ${log.releaseDefinitionId}`;
                    return (
                    <tr key={log.releaseId}>
                      <td style={{ textAlign: 'center', fontWeight: 500 }}>{log.releaseId}</td>
                      <td>{log.releaseName || '—'}</td>
                      <td>{cdLabel}</td>
                      <td style={{ textAlign: 'center' }}>{log.testSuiteId}</td>
                      <td style={{ textAlign: 'center' }}>{log.testRunId ?? '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: '12px' }}>
                        {log.batchIndex && log.batchCount
                          ? `${log.batchIndex}/${log.batchCount}`
                          : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {log.isFailedRerun ? (
                          <span className="meta-pill meta-pill--warning">Yes</span>
                        ) : (
                          'No'
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>{log.totalTests ?? '—'}</td>
                      <td
                        style={{
                          textAlign: 'center',
                          color: log.passedTests ? 'var(--color-success)' : undefined,
                        }}
                      >
                        {log.passedTests ?? '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'center',
                          color: log.failedTests ? 'var(--color-danger)' : undefined,
                        }}
                      >
                        {log.failedTests ?? '—'}
                      </td>
                      <td style={{ fontSize: '12px' }}>{log.releaseStartTime || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{log.releaseRunTime || '—'}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
