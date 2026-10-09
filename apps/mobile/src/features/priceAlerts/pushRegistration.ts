import { sha256 } from '@noble/hashes/sha256';
export const PUSH_COPY = Object.freeze({
  ask: 'Turn on notifications to get this alert.',
  on: 'Turn on',
  later: 'Not now',
  off: 'Notifications are off. This alert will show in the app only.',
  settings: 'Open settings',
});
export const PUSH_TOKEN_KEY = 'corso.priceAlert.pushToken.v1';
export const PUSH_ACTIVE_KEY = 'corso.priceAlert.pushRevocation.v1';
export const PUSH_PENDING_KEY = 'corso.priceAlert.pushPending.v1';
export type Revocation = { id: string; capability: string };
export type DeviceBinding = Revocation & { receipt: string };
export type PushPorts = {
  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  };
  flags(): Promise<{ priceAlertsEnabled: boolean; pricesEnabled: boolean }>;
  ask(): Promise<boolean>;
  permission(): Promise<boolean>;
  granted(): Promise<boolean>;
  status(row: DeviceBinding): Promise<boolean>;
  token(): Promise<string>;
  register(token: string, prepared: (row: Revocation) => Promise<void>): Promise<DeviceBinding>;
  confirm(row: DeviceBinding): Promise<void>;
  revoke(row: Revocation): Promise<void>;
};
export function pushArmed(flags: {
  priceAlertsEnabled?: unknown;
  pricesEnabled?: unknown;
}) {
  return flags.priceAlertsEnabled === true && flags.pricesEnabled === true;
}
export function createPushRegistration(ports: PushPorts) {
  let epoch = 0;
  let busy = false;
  let inFlight: { row: Revocation; epoch: number } | undefined;
  let tail = Promise.resolve();
  function serialized<T>(work: () => Promise<T>): Promise<T> {
    const result = tail.then(work);
    tail = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  const parse = (value: string | null): Revocation[] => {
    if (!value) return [];
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows)) throw Error('push_storage_invalid');
    // One damaged entry must not prevent deleting other recoverable rows.
    return rows
      .filter((r) => r && typeof r.id === 'string' && typeof r.capability === 'string')
      .map((r) => ({ id: r.id, capability: r.capability }));
  };
  async function pend(row: Revocation) {
    const rows = parse(await ports.storage.get(PUSH_PENDING_KEY));
    if (!rows.some((r) => r.id === row.id)) rows.push({id: row.id, capability: row.capability});
    await ports.storage.set(PUSH_PENDING_KEY, JSON.stringify(rows));
  }
  async function retryPending() {
    if (!pushArmed(await ports.flags().catch(() => ({})))) return;
    // Only deletion authority is read here. No SDK or push-token read on launch.
    const rows = await serialized(async () =>
      parse(await ports.storage.get(PUSH_PENDING_KEY)),
    );
    for (const row of rows) {
      // Recheck after the snapshot: a completed request may have removed its
      // tombstone, and foreground events must not cancel this epoch's request.
      const eligible = await serialized(async () => {
        const pending = parse(await ports.storage.get(PUSH_PENDING_KEY));
        const current = inFlight?.epoch === epoch &&
          inFlight.row.id === row.id && inFlight.row.capability === row.capability;
        return !current && pending.some((r) => r.id === row.id && r.capability === row.capability);
      });
      if (!eligible) continue;
      try {
        await ports.revoke(row);
      } catch {
        continue;
      }
      await serialized(async () => {
        const remaining = parse(
          await ports.storage.get(PUSH_PENDING_KEY),
        ).filter((r) => r.id !== row.id || r.capability !== row.capability);
        if (remaining.length)
          await ports.storage.set(PUSH_PENDING_KEY, JSON.stringify(remaining));
        else await ports.storage.remove(PUSH_PENDING_KEY);
        const active = parse(await ports.storage.get(PUSH_ACTIVE_KEY));
        if (
          active.some((r) => r.id === row.id && r.capability === row.capability)
        ) {
          await ports.storage.remove(PUSH_ACTIVE_KEY);
          await ports.storage.remove(PUSH_TOKEN_KEY);
        }
      });
    }
  }
  async function clearOnTeardown() {
    epoch++;
    const pending = await serialized(async () => {
      await ports.storage.remove(PUSH_TOKEN_KEY);
      const active = parse(await ports.storage.get(PUSH_ACTIVE_KEY));
      for (const row of active) await pend(row);
      await ports.storage.remove(PUSH_ACTIVE_KEY);
      return parse(await ports.storage.get(PUSH_PENDING_KEY)).length > 0;
    });
    // Network work is never awaited by sign-out or Remove-wallet.
    if (pending) void retryPending().catch(() => {});
  }
  async function fromUserSetAlert(
    walletAddress: string,
    register = ports.register,
  ): Promise<'off' | 'in-app' | 'registered'> {
    const captured = epoch;
    if (busy) return 'off';
    busy = true;
    try {
      if (!pushArmed(await ports.flags().catch(() => ({})))) return 'off';
      if (captured !== epoch) return 'in-app';
      // Wallet association is local metadata; tombstones retain deletion authority only.
      const ownerDigest = Buffer.from(sha256(Buffer.from(walletAddress))).toString('hex');
      await retryPending();
      if (captured !== epoch) return 'in-app';
      const cached = await serialized(async () => ({
        active: await ports.storage.get(PUSH_ACTIVE_KEY),
        token: await ports.storage.get(PUSH_TOKEN_KEY),
      }));
      let token: string | undefined;
      if (await ports.granted()) {
        token = await ports.token();
        if (captured !== epoch) return 'in-app';
        const rows = parse(cached.active);
        const metadata = cached.active ? JSON.parse(cached.active) : [];
        const row = rows[0];
        if (row && metadata[0]?.ownerDigest === ownerDigest && cached.token === token &&
            await ports.status(metadata[0])) {
          return captured === epoch ? 'registered' : 'in-app';
        }
      }
      if (captured !== epoch || !(await ports.ask()) || captured !== epoch)
        return 'in-app';
      if (!(await ports.permission()) || captured !== epoch) return 'in-app';
      token ??= await ports.token();
      if (captured !== epoch) return 'in-app';
      const row = await register(token, async (prepared) => {
        await serialized(async () => {
          if (captured !== epoch) throw Error('push_cancelled');
          inFlight = { row: prepared, epoch: captured };
          // Signature-derived deletion authority is durable BEFORE the POST.
          // Launch can revoke even when its response never reached this device.
          await pend(prepared);
        });
      });
      await serialized(async () => {
        if (captured !== epoch) { await pend(row); return; }
        const old = parse(await ports.storage.get(PUSH_ACTIVE_KEY));
        for (const prior of old) if (prior.id !== row.id) await pend(prior);
        await ports.storage.set(PUSH_ACTIVE_KEY, JSON.stringify([{...row, ownerDigest}]));
      });
      if (captured !== epoch) {
        void retryPending().catch(() => {});
        return 'in-app';
      }
      // This acknowledges durable storage using a separate receipt credential, no wallet signature.
      await ports.confirm(row);
      await serialized(async () => {
        if (captured !== epoch) return;
        await ports.storage.set(PUSH_TOKEN_KEY, token!);
        const remaining = parse(await ports.storage.get(PUSH_PENDING_KEY))
          .filter((r) => r.id !== row.id || r.capability !== row.capability);
        if (remaining.length) await ports.storage.set(PUSH_PENDING_KEY, JSON.stringify(remaining));
        else await ports.storage.remove(PUSH_PENDING_KEY);
      });
      return captured === epoch ? 'registered' : 'in-app';
    } finally { inFlight = undefined; busy = false; }
  }
  return { fromUserSetAlert, clearOnTeardown, retryPending };
}
