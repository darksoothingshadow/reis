import { useEffect, useState } from 'react';
import { loggers } from '../../utils/logger';
import { signalReady, requestData, isInIframe } from '../../api/proxyClient';
import { StorageService, STORAGE_KEYS } from '../../services/storage';
import { syncService } from '../../services/sync';
import type { SyncedData } from '../../types/messages';

export function useMessageBridge() {
  const [syncData, setSyncData] = useState<SyncedData | null>(null);

  useEffect(() => {
    if (!isInIframe()) {
      loggers.ui.info('[MessageBridge] Running standalone (dev mode)');
      return;
    }

    loggers.ui.info('[MessageBridge] Setting up postMessage listener');

    const handleMessage = (event: MessageEvent) => {
      // Security check: Accept messages from parent only
      if (event.source !== window.parent) return;

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'REIS_DATA' || data.type === 'REIS_SYNC_UPDATE') {
        const receivedData = data.data || data;
        setSyncData(receivedData);

        // Bridge postMessage to StorageService
        if (receivedData.schedule) {
          StorageService.set(STORAGE_KEYS.SCHEDULE_DATA, receivedData.schedule);
        }
        if (receivedData.exams) {
          StorageService.set(STORAGE_KEYS.EXAMS_DATA, receivedData.exams);
        }
        if (receivedData.subjects) {
          StorageService.set(STORAGE_KEYS.SUBJECTS_DATA, receivedData.subjects);
        }
        if (receivedData.files && typeof receivedData.files === 'object') {
          const filesData = receivedData.files as Record<string, unknown>;
          for (const [courseCode, files] of Object.entries(filesData)) {
            const key = `${STORAGE_KEYS.SUBJECT_FILES_PREFIX}${courseCode}`;
            StorageService.set(key, files);
          }
        }
        if (receivedData.lastSync) {
          StorageService.set(STORAGE_KEYS.LAST_SYNC, receivedData.lastSync);
        }

        // Trigger hooks to re-read from localStorage
        syncService.triggerRefresh();
        loggers.ui.info('[MessageBridge] Data synchronized and stored:', data.type);
      }
    };

    window.addEventListener('message', handleMessage);
    signalReady();
    requestData('all');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return { syncData };
}
