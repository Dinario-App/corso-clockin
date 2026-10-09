import { copy } from '@/constants/copy';
import type { SkillTokenChoice } from '@/src/features/skills/directory/configureDraft';
import type {
  BotBroadcastBeforeKill,
  BotCanNever,
  BotEnvelope,
  BotFill,
  BotRule,
  BotStatus,
  BotView,
} from './types';

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

/** Base units to a human amount with no float arithmetic; trims trailing zeros. */
export function formatBaseUnits(baseUnits: string, decimals: number): string {
  const digits = baseUnits.replace(/^0+(?=\d)/, '');
  if (decimals === 0) return digits;
  const padded = digits.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

/** The input-mint unit a rule spends in: USDC for buying rules, the token for exits. */
export type InputUnit = { symbol: string; decimals: number };

export function formatAmount(
  baseUnits: string,
  unit: InputUnit | null,
): string {
  if (!unit) return `${baseUnits} base units`;
  return `${formatBaseUnits(baseUnits, unit.decimals)} ${unit.symbol}`;
}

export function formatDay(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelativeLeft(msLeft: number): string {
  if (!Number.isFinite(msLeft) || msLeft <= 0) return 'now';
  const days = Math.round(msLeft / DAY_MS);
  if (days >= 1) return `in ${days} ${days === 1 ? 'day' : 'days'}`;
  const hours = Math.max(1, Math.round(msLeft / HOUR_MS));
  return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export function formatEvery(everyMs: number): string {
  const hours = Math.round(everyMs / HOUR_MS);
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return `${days}d`;
  }
  return `${hours}h`;
}

export function ruleTitle(kind: BotRule['kind']): string {
  return copy.automation.rule[kind].title;
}

export function statusLabel(status: BotStatus): string {
  return copy.automation.status[status];
}

/** Whether the pulsing "live" dot shows. Only a state the server calls live. */
export function isLive(status: BotStatus): boolean {
  return status === 'live' || status === 'firing';
}

/** One line: the rule, its number, both caps, the expiry — all from frozen columns. */
export function describeBot(bot: BotView, unit: InputUnit | null): string {
  const symbol = bot.scope.can.swap.target.symbol;
  const perSwap = formatAmount(bot.scope.can.perFireMaxBaseUnits, unit);
  const perDay = formatAmount(bot.scope.can.perDayMaxBaseUnits, unit);
  const until = formatDay(bot.scope.can.until);
  const s = copy.automation.summary;
  switch (bot.rule.kind) {
    case 'dip':
      return s.dip(symbol, bot.rule.dropPct, perSwap, perDay, until);
    case 'take_profit':
      return s.take_profit(symbol, bot.rule.risePct, perSwap, perDay, until);
    case 'stop_loss':
      return s.stop_loss(symbol, bot.rule.dropPct, perSwap, perDay, until);
    case 'dca':
      return s.dca(
        symbol,
        formatEvery(bot.rule.everyMs),
        perSwap,
        perDay,
        until,
      );
  }
}

/** Spend-today against the daily cap. Ratio is for the bar only; the text carries the numbers. */
export function capBar(
  spentBaseUnits: string,
  capBaseUnits: string,
  unit: InputUnit | null,
): {
  ratio: number;
  text: string;
} {
  let ratio = 0;
  try {
    const spent = BigInt(spentBaseUnits);
    const cap = BigInt(capBaseUnits);
    ratio = cap > 0n ? Number((spent * 1000n) / cap) / 1000 : 0;
  } catch {
    ratio = 0;
  }
  return {
    ratio: Math.max(0, Math.min(1, ratio)),
    text: copy.automation.spentToday(
      formatAmount(spentBaseUnits, unit),
      formatAmount(capBaseUnits, unit),
    ),
  };
}

export function expiryLine(bot: BotView): string {
  if (bot.expiry.state === 'expired') return copy.automation.expiry.expired;
  if (bot.expiry.state === 'expiring_soon') {
    return copy.automation.expiry.soon(formatRelativeLeft(bot.expiry.msLeft));
  }
  return copy.automation.expiry.until(formatDay(bot.expiry.expiresAt));
}

export function fillLine(
  fill: BotFill | null,
  input: InputUnit | null,
  output: InputUnit | null,
): string {
  if (!fill) return copy.automation.fill.unreadable;
  switch (fill.status) {
    case 'landed':
      return copy.automation.fill.landed(
        formatAmount(fill.inBaseUnits, input),
        formatAmount(fill.outBaseUnits, output),
      );
    case 'pending':
      return copy.automation.fill.pending;
    case 'failed':
      return copy.automation.fill.failed;
    case 'unreadable':
      return copy.automation.fill.unreadable;
  }
}

export function fireOutcomeLabel(outcome: string): string {
  const labels = copy.automation.fires.outcome;
  if (outcome === 'landed') return labels.landed;
  if (outcome === 'submitting') return labels.submitting;
  if (outcome === 'skipped') return labels.skipped;
  return labels.failed;
}

export type KillPresentation =
  | { state: 'none' }
  | {
      state: 'revoking';
      title: string;
      body: string;
      broadcast: { count: number; heading: string; rows: BroadcastRow[] };
    }
  | {
      state: 'killed';
      title: string;
      body: string;
      broadcast: { count: number; heading: string; rows: BroadcastRow[] };
    };

export type BroadcastRow = {
  id: string;
  signature: string;
  outcome: string;
  fill: string;
};

function broadcastRows(
  entries: readonly BotBroadcastBeforeKill[],
  input: InputUnit | null,
  output: InputUnit | null,
): BroadcastRow[] {
  return entries.map((entry) => ({
    id: entry.fireId,
    signature: entry.signature,
    outcome: fireOutcomeLabel(entry.outcome),
    fill: fillLine(entry.fill, input, output),
  }));
}

export function killPresentation(
  bot: BotView,
  input: InputUnit | null,
  output: InputUnit | null,
): KillPresentation {
  const kill = bot.kill;
  if (kill === null) return { state: 'none' };
  const rows = broadcastRows(kill.broadcastBeforeKill, input, output);
  const broadcast = {
    count: rows.length,
    heading:
      rows.length > 0
        ? copy.automation.killState.broadcastBeforeKill(rows.length)
        : '',
    rows,
  };
  if (kill.state === 'killed') {
    return {
      state: 'killed',
      title: copy.automation.killState.killed,
      body: copy.automation.killState.killedAt(formatClock(kill.revokedAt)),
      broadcast,
    };
  }
  return {
    state: 'revoking',
    title: copy.automation.killState.revoking,
    body: copy.automation.killState.revokingBody,
    broadcast,
  };
}

export type ScopeRow = { key: string; title: string; body: string | null };

export type ScopeCardModel = {
  name: string;
  tag: string;
  lede: string;
  can: ScopeRow[];
  chain: ScopeRow[];
  corso: ScopeRow[];
  corsoNote: string;
  signsNote: string;
  killNote: string;
};

export function scopeCardModel(args: {
  ruleKind: BotRule['kind'];
  targetSymbol: string;
  input: SkillTokenChoice;
  output: SkillTokenChoice;
  perFireMaxBaseUnits: string;
  perDayMaxBaseUnits: string;
  until: string;
  canNever: readonly BotCanNever[];
}): ScopeCardModel {
  const unit = { symbol: args.input.symbol, decimals: args.input.decimals };
  const perSwap = formatAmount(args.perFireMaxBaseUnits, unit);
  const perDay = formatAmount(args.perDayMaxBaseUnits, unit);
  const until = formatDay(args.until);
  const c = copy.automation.scope;

  return {
    name: ruleTitle(args.ruleKind),
    tag: `${args.targetSymbol} · ${copy.automation.expiry.until(until)}`,
    lede: `${perSwap} per swap · ${perDay} per day`,
    can: [
      {
        key: 'swap',
        title: c.can.swap(args.input.symbol, args.output.symbol),
        body: null,
      },
      { key: 'spend', title: c.can.spend(perSwap, perDay), body: null },
      { key: 'until', title: c.can.until(until), body: null },
    ],
    chain: [
      { key: 'allowance_ceiling', title: c.chain.allowance_ceiling.title,
        body: c.chain.allowance_ceiling.body(perSwap) },
    ],
    corso: [
      { key: 'destination', title: c.corso.destination.title, body: c.corso.destination.body },
      { key: 'daily_cap', title: c.corso.daily_cap.title, body: c.corso.daily_cap.body(perDay) },
      { key: 'expiry', title: c.corso.expiry.title, body: c.corso.expiry.body(until) },
      { key: 'nothing_but_swaps', title: c.corso.nothing_but_swaps.title, body: c.corso.nothing_but_swaps.body },
    ],
    corsoNote: c.corsoNote,
    signsNote: c.signsNote,
    killNote: c.killNote,
  };
}

export function scopeCardFromEnvelope(
  envelope: BotEnvelope,
  pair: { input: SkillTokenChoice; output: SkillTokenChoice },
  canNever: readonly BotCanNever[],
): ScopeCardModel {
  return scopeCardModel({
    ruleKind: envelope.rule.kind,
    targetSymbol: envelope.target.symbol,
    input: pair.input,
    output: pair.output,
    perFireMaxBaseUnits: envelope.caps.perFireMaxBaseUnits,
    perDayMaxBaseUnits: envelope.caps.perDayMaxBaseUnits,
    until: envelope.expiresAt,
    canNever,
  });
}

/** The fleet line: count, live count, and the summed daily spend when every rule shares a unit. */
export function fleetSummary(
  bots: readonly BotView[],
  unitFor: (bot: BotView) => InputUnit | null,
): string {
  const parts = [copy.automation.fleet.count(bots.length)];
  const live = bots.filter((bot) => isLive(bot.status)).length;
  parts.push(copy.automation.fleet.live(live));
  const active = bots.filter(
    (bot) =>
      bot.status === 'live' ||
      bot.status === 'firing' ||
      bot.status === 'paused',
  );
  const units = new Set(active.map((bot) => unitFor(bot)?.symbol ?? null));
  if (active.length > 0 && units.size === 1 && !units.has(null)) {
    const unit = unitFor(active[0]!);
    let spent = 0n;
    let cap = 0n;
    for (const bot of active) {
      spent += BigInt(bot.spentToday.baseUnits);
      cap += BigInt(bot.scope.can.perDayMaxBaseUnits);
    }
    parts.push(
      copy.automation.fleet.spent(
        formatAmount(spent.toString(), unit),
        formatAmount(cap.toString(), unit),
      ),
    );
  }
  return parts.join(' · ');
}

/** Which buttons a card offers, from the server's status alone. */
export function cardActions(bot: BotView): {
  pause: boolean;
  resume: boolean;
  kill: boolean;
  renew: boolean;
} {
  return {
    pause: bot.status === 'live' || bot.status === 'firing',
    resume: bot.status === 'paused' && bot.expiry.state !== 'expired',
    kill: bot.kill?.state !== 'killed' && bot.status !== 'killed',
    renew:
      bot.expiry.renewable &&
      (bot.status === 'expired' || bot.status === 'killed'),
  };
}
