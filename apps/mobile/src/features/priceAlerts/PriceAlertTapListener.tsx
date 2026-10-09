import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import type { NotificationResponse } from 'expo-notifications';
import { copy } from '@/constants/copy';
import { useCorsoSession } from '../session/SessionContext';
import { readPushFlags } from './pushClient';
import { pushArmed } from './pushRegistration';
import { ALERT_COPY } from './alertCopy';
import { alertIdFromNotification } from './alertPrefill';
import { clearAlertTapEntry } from './alertTapEntry';
import {
  PriceAlertTapResolution,
  type AlertTapRequest,
} from './PriceAlertTapResolution';
import type { CorsoSession } from '../session/types';
type Pending = {
  id: string | null;
  owner: CorsoSession | null;
  tappedAtMs: number;
};
type NotificationsModule = typeof import('expo-notifications');
// The alert-tap notices carry no title. The one button reuses an approved, shipped
// dismiss label (`copy.import.dismiss`, the recovery-phrase screenshot
// notice) so the OS never supplies its own word.
function notice(message: string) {
  Alert.alert('', message, [{ text: copy.import.dismiss }]);
}
export function PriceAlertTapListener() {
  const { session, locked, phase } = useCorsoSession();
  const live = useRef({ session, locked, phase });
  live.current = { session, locked, phase };
  const [pending, setPending] = useState<Pending | null>(null);
  const [request, setRequest] = useState<AlertTapRequest | null>(null);
  const [notifications, setNotifications] =
    useState<NotificationsModule | null>(null);
  const seen = useRef(new Set<string>());
  const previous = useRef(session);
  const finish = useCallback((gone: boolean) => {
    setRequest(null);
    setPending(null);
    if (gone && live.current.session && !live.current.locked) {
      router.replace('/');
      notice(ALERT_COPY.gone);
    }
  }, []);
  useEffect(() => {
    if (previous.current && previous.current !== session) {
      setPending(null);
      setRequest(null);
      clearAlertTapEntry();
    }
    previous.current = session;
  }, [session]);
  // Flags off is off: the notifications package (and its native module) is
  // loaded and subscribed only after both alert flags read true. A build or
  // binary without alerts never evaluates it at launch. Retried when the
  // session or lock changes, until armed; a cold-start tap is still read
  // from `getLastNotificationResponseAsync` once subscribed.
  useEffect(() => {
    if (notifications) return;
    let active = true;
    void readPushFlags()
      .then(async (flags) => {
        if (!active || !pushArmed(flags)) return;
        const loaded = await import('expo-notifications');
        if (active) setNotifications(() => loaded);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [notifications, session, locked]);
  useEffect(() => {
    if (!notifications) return;
    const Notifications = notifications;
    let active = true;
    let liveResponse = false;
    const receive = (response: NotificationResponse, fromCache = false) => {
      if (
        !active ||
        response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
      )
        return;
      if (!fromCache) liveResponse = true;
      const data: unknown = response.notification.request.content.data;
      if (!data || typeof data !== 'object' || !('alertId' in data)) return;
      const key = response.notification.request.identifier;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      if (seen.current.size > 100)
        seen.current.delete(seen.current.values().next().value!);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      const id = alertIdFromNotification(data);
      setRequest(null);
      clearAlertTapEntry();
      setPending({ id, owner: live.current.session, tappedAtMs: Date.now() });
    };
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => receive(response),
    );
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response && !liveResponse) receive(response, true);
      })
      .catch(() => {});
    return () => {
      active = false;
      sub.remove();
    };
  }, [notifications]);
  useEffect(() => {
    if (!pending || request || phase === 'booting' || locked) return;
    if (!session || (pending.owner && pending.owner !== session)) {
      setPending(null);
      return;
    }
    let active = true;
    void readPushFlags()
      .then((flags) => {
        if (!active || live.current.session !== session || live.current.locked)
          return;
        if (!pushArmed(flags)) {
          setPending(null);
          router.replace('/');
          notice(ALERT_COPY.off);
          return;
        }
        if (!pending.id) {
          finish(true);
          return;
        }
        setRequest({
          id: pending.id,
          owner: session,
          tappedAtMs: pending.tappedAtMs,
        });
      })
      .catch(() => {
        if (
          active &&
          live.current.session === session &&
          !live.current.locked
        ) {
          setPending(null);
          router.replace('/');
          notice(ALERT_COPY.off);
        }
      });
    return () => {
      active = false;
    };
  }, [pending, request, phase, locked, session, finish]);
  return request && session === request.owner && !locked ? (
    <PriceAlertTapResolution request={request} finish={finish} />
  ) : null;
}
