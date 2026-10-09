import { useEffect } from 'react';
import { useAlertList } from './useAlertList';
import { AlertList } from './AlertList';
import type { AlertPanelProps } from './PriceAlertNotifications';
export function AlertNotificationsPanel({
  refreshKey,
  onState,
}: AlertPanelProps) {
  const data = useAlertList();
  useEffect(() => {
    if (refreshKey > 0) void data.refresh();
  }, [refreshKey, data.refresh]);
  useEffect(() => {
    onState({
      loading: data.loading,
      count: data.failed
        ? Math.max(1, data.alerts.length + data.events.length)
        : data.alerts.length + data.events.length,
    });
  }, [
    data.loading,
    data.alerts.length,
    data.events.length,
    data.failed,
    onState,
  ]);
  return (
    <>
      <AlertList data={data} />
    </>
  );
}
