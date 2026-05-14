import { useEffect, useRef } from 'react';
import { useNotification } from '../context/useNotification';
import { startFailedSuiteScheduler } from '../services/failedSuiteScheduler';
import type { WorkspaceSettingsValues } from './pages/WorkspaceSettings';

interface AppSchedulerProps {
  workspaceSettings: WorkspaceSettingsValues;
}

export function AppScheduler({ workspaceSettings }: AppSchedulerProps) {
  const { addNotification } = useNotification();
  const schedulerControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!workspaceSettings.schedulerEnabled) {
      return;
    }

    // Only start if we have required settings
    if (!workspaceSettings.patToken || !workspaceSettings.organization) {
      return;
    }

    // Clean up any existing scheduler
    if (schedulerControllerRef.current) {
      schedulerControllerRef.current.abort();
    }

    // Start the 5 AM scheduler
    const controller = startFailedSuiteScheduler(
      {
        organization: workspaceSettings.organization,
        projectName: workspaceSettings.projectName,
        patToken: workspaceSettings.patToken,
        apiVersion: workspaceSettings.apiVersion,
      },
      (status) => {
        console.log('[Scheduler]', status);
      },
      (message) => {
        addNotification('info', message);
      },
      (error) => {
        console.error('[Scheduler Error]', error);
        addNotification('error', `Scheduler error: ${error.message}`);
      },
    );

    schedulerControllerRef.current = controller;

    return () => {
      controller.abort();
    };
  }, [workspaceSettings.schedulerEnabled, workspaceSettings.patToken, workspaceSettings.organization, addNotification, workspaceSettings.projectName, workspaceSettings.apiVersion]);

  return null;
}
