import { useState, useEffect, type ComponentType } from 'react';
import { readPushFlags } from './pushClient';
import { pushArmed } from './pushRegistration';
export type AlertPanelProps = {
  refreshKey: number;
  onState(state: { loading: boolean; count: number }): void;
};
/** Flags are read before even constructing the additional proof signer. */
export function PriceAlertNotifications(props: AlertPanelProps) {
  const [Panel, setPanel] = useState<ComponentType<AlertPanelProps> | null>(
    null,
  );
  useEffect(() => {
    let current = true;
    void readPushFlags()
      .then(async (flags) => {
        if (!pushArmed(flags)) {
          if (current) {
            setPanel(null);
            props.onState({ loading: false, count: 0 });
          }
          return;
        }
        const { AlertNotificationsPanel } = await import(
          './AlertNotificationsPanel'
        );
        if (current) setPanel(() => AlertNotificationsPanel);
      })
      .catch(() => {
        if (current) {
          setPanel(null);
          props.onState({ loading: false, count: 0 });
        }
      });
    return () => {
      current = false;
    };
  }, [props.refreshKey, props.onState]);
  return Panel ? <Panel {...props} /> : null;
}
