import type { VelaThemeMode } from './velaBridge.js';
import { accent, colors } from '../../../../constants/theme.js';
import { VELA_PROJECT_URL } from './velaNavigationPolicy.js';
import { copy } from '../../../../constants/copy.js';
import {
  VELA_GLOBAL_MIN_JS,
  VELA_VENDOR_SHA256,
  VELA_VENDOR_VERSION,
} from '../../../../vendor/vela/velaGlobal.generated.js';

/**
 * The page font stack. The WebView's CSP allows `font-src data:` only, so the
 * embedded InterVariable the app ships cannot be reached from here; the page
 * asks for Inter by name and falls back to the platform face.
 */
const VELA_FONT_STACK = 'Inter, -apple-system, system-ui, sans-serif';

export const VELA_PAGE_THEMES = {
  dark: {
    background: colors.surface,
    textColor: colors.inkTertiary,
    gridColor: 'transparent',
    borderColor: colors.line,
    upColor: colors.priceUp,
    downColor: colors.priceDown,
    fontFamily: VELA_FONT_STACK,
  },
  light: {
    background: colors.ink,
    textColor: 'rgba(6, 6, 6, 0.62)',
    gridColor: 'transparent',
    borderColor: 'rgba(6, 6, 6, 0.16)',
    upColor: colors.priceUp,
    downColor: colors.priceDown,
    fontFamily: VELA_FONT_STACK,
  },
} as const satisfies Record<VelaThemeMode, Record<string, string>>;

export const VELA_OVERLAY_PAINT = {
  orderBlockBull: colors.priceUp,
  orderBlockBear: colors.priceDown,
  fvg: colors.riskDanger,
  fvgFilled: colors.inkQuaternary,
  liquidity: colors.inkTertiary,
  sweep: colors.riskDanger,
  premiumDiscount: colors.inkQuaternary,
  structureBull: colors.priceUp,
  structureBear: colors.priceDown,
  priceLine: accent.chartLine,
  /** Legend + source-tag chrome: structure, never a line anyone must read. */
  chromeInk: colors.inkTertiary,
  chromeFaint: colors.inkQuaternary,
} as const;

/** Signal timeframe → Vela timeframe token (minutes, or `1D`). */
export const VELA_TIMEFRAME_TOKENS = {
  '1m': '1',
  '5m': '5',
  '1H': '60',
  '4H': '240',
  '1D': '1D',
} as const;

export const VELA_PAGE_TUNING = {
  /** Crosshair `select` posts are throttled to this many ms. */
  selectThrottleMs: 80,
  /** fps is sampled over this window after every init/append, then posted. */
  perfSampleMs: 1500,
  /** Overlay zones extend right from their bar for this many bars (visual only). */
  zoneExtendBars: 24,
  /**
   * De-collision. Structure marks (CHoCH / CHoCH+ / BOS) and liquidity rays
   * arrive from the bundle clustered on the same bars and the same prices, and
   * Vela draws each one where it is told — so they used to stack on top of each
   * other and read as a smear. Two rules, both purely visual and neither
   * touching what the server said:
   *
   * - a mark whose (label, direction, bar) or (kind, price) is already on the
   *   chart is DROPPED, not redrawn — a duplicate is not new information;
   * - marks that survive and would land within `stackPriceRatio` of the visible
   *   price span are stepped apart by that much, bulls stepping down and bears
   *   stepping up, so each label owns its own row.
   */
  stackPriceRatio: 0.022,
  /** How many stacked steps a single cluster may take before it gives up. */
  stackMaxSteps: 4,
  /** Liquidity levels closer than this share of the span are one level. */
  levelDedupeRatio: 0.004,
} as const;

export const VELA_ATTRIBUTION_HTML =
  `<a href="${VELA_PROJECT_URL}" rel="noopener" ` +
  `style="font:500 10.5px ${VELA_FONT_STACK};letter-spacing:.2px;` +
  `color:${VELA_OVERLAY_PAINT.chromeFaint};text-decoration:none">Chart by Vela</a>`;

export const VELA_STRUCTURE_MARK_WORDS: Record<string, string> = Object.fromEntries(
  (['CHoCH', 'CHoCH+', 'BOS'] as const).flatMap((label) =>
    (['bull', 'bear'] as const).map((direction) => [
      `${label}|${direction}`,
      copy.chartEdge.structure(label, direction),
    ]),
  ),
);

export const VELA_LEGEND_ITEMS = [
  {
    key: 'structure',
    label: copy.chartEdge.structureLegend,
    swatches: [
      VELA_OVERLAY_PAINT.structureBull,
      VELA_OVERLAY_PAINT.structureBear,
    ],
  },
  {
    key: 'ob',
    label: 'Order block',
    swatches: [
      VELA_OVERLAY_PAINT.orderBlockBull,
      VELA_OVERLAY_PAINT.orderBlockBear,
    ],
  },
  { key: 'fvg', label: 'FVG', swatches: [VELA_OVERLAY_PAINT.fvg] },
  {
    key: 'liq',
    label: 'Liquidity \u00B7 sweep',
    swatches: [VELA_OVERLAY_PAINT.liquidity, VELA_OVERLAY_PAINT.sweep],
  },
  { key: 'price', label: 'Last', swatches: [VELA_OVERLAY_PAINT.priceLine] },
] as const;

/** The legend markup, built once at page-build time from the items above. */
function buildLegendHtml(): string {
  return VELA_LEGEND_ITEMS.map(
    (item) =>
      `<span class="lg" data-k="${item.key}" hidden>` +
      item.swatches
        .map((color) => `<i class="sw" style="background:${color}"></i>`)
        .join('') +
      `<b>${item.label}</b></span>`,
  ).join('');
}

/**
 * Inline `</script` would terminate the host `<script>` early; the vendored
 * bundle carries none today but the escape is kept so a bump cannot break the
 * page silently.
 */
function escapeInlineScript(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script');
}

/**
 * The glue is plain ES5-ish JavaScript (WKWebView iOS 15+, Android System
 * WebView) — no bundler, no transpile step, so keep it boring.
 */
function buildGlueScript(): string {
  return `
(function () {
  'use strict';
  var THEMES = ${JSON.stringify(VELA_PAGE_THEMES)};
  var PAINT = ${JSON.stringify(VELA_OVERLAY_PAINT)};
  var MARK_WORDS = ${JSON.stringify(VELA_STRUCTURE_MARK_WORDS)};
  var TF = ${JSON.stringify(VELA_TIMEFRAME_TOKENS)};
  var TUNING = ${JSON.stringify(VELA_PAGE_TUNING)};
  var ATTRIBUTION = ${JSON.stringify(VELA_ATTRIBUTION_HTML)};
  var VENDOR = { version: ${JSON.stringify(VELA_VENDOR_VERSION)}, sha256: ${JSON.stringify(VELA_VENDOR_SHA256)} };

  var chart = null;
  var bars = [];
  var overlayIds = [];
  var priceLineId = null;
  var themeMode = 'dark';
  var lastSelectAt = 0;
  var perfTimer = null;

  function post(msg) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    } catch (e) { /* the bridge is best-effort */ }
  }
  function fail(detail) { post({ t: 'error', detail: String(detail).slice(0, 200) }); }

  function backendName() {
    try {
      var probe = document.createElement('canvas');
      return probe.getContext('webgl2') ? 'webgl2' : 'canvas2d';
    } catch (e) { return 'unknown'; }
  }

  function num(s) { var n = Number(s); return isFinite(n) ? n : null; }
  function toBar(c) {
    var o = num(c.o), h = num(c.h), l = num(c.l), cl = num(c.c), v = num(c.v);
    if (typeof c.t !== 'number' || o === null || h === null || l === null || cl === null) return null;
    return { time: c.t, open: o, high: h, low: l, close: cl, volume: v === null ? 0 : v };
  }
  function toBars(candles) {
    var out = [];
    for (var i = 0; i < (candles || []).length; i++) { var b = toBar(candles[i]); if (b) out.push(b); }
    return out;
  }
  function barMs() {
    if (bars.length < 2) return 60000;
    return Math.max(1, bars[bars.length - 1].time - bars[bars.length - 2].time);
  }

  function sampleFps() {
    if (perfTimer) { cancelAnimationFrame(perfTimer.raf); clearTimeout(perfTimer.stop); }
    var frames = 0, started = performance.now();
    var handle = { raf: 0, stop: 0 };
    function tick() { frames++; handle.raf = requestAnimationFrame(tick); }
    handle.raf = requestAnimationFrame(tick);
    handle.stop = setTimeout(function () {
      cancelAnimationFrame(handle.raf);
      var seconds = (performance.now() - started) / 1000;
      perfTimer = null;
      post({ t: 'perf', fps: Math.round(frames / Math.max(seconds, 0.001)), backend: backendName() });
    }, TUNING.perfSampleMs);
    perfTimer = handle;
  }

  /**
   * Canon skin. Everything here is CHROME — what the terminal looks like, never
   * what it says. Applied after \`ready()\` (and again after a theme swap) so a
   * re-theme cannot quietly restore the vendor's own defaults.
   */
  function applySkin() {
    if (!chart) return;
    try {
      chart.renderer.set({
        // Canon §2.4: no grid. The theme also paints gridColor transparent.
        gridlines: false,
        // Axes stay: a terminal without a price scale is a picture. They are
        // softened to the ink ramp by the theme instead of being removed.
        axisLabels: true,
        // Vela paints its own last-price line in the candle up/down pair.
        // The white 2px ray below replaces it (CANON-LOCK Chart).
        currentPriceLine: false,
        // No live bar ships in the pilot, so a bar countdown would be a
        // promise the data does not keep.
        countdown: false,
        // Third-party chrome with no canon home. Drawings are already off.
        settings: false,
        indicatorTitles: false,
        indicatorValues: false,
        // NOTICE-sanctioned restyle, never a removal. See the file header.
        attribution: ATTRIBUTION,
      });
    } catch (e) { fail('skin: ' + (e && e.message)); }
  }

  /**
   * Reveal the legend rows the bundle actually earned. A family with nothing on
   * the chart stays hidden — the legend reads the drawing, it does not promise
   * one.
   */
  function paintLegend(ov) {
    var host = document.getElementById('legend');
    if (!host) return;
    var present = {
      structure: !!(ov && ov.structure && ov.structure.length),
      ob: !!(ov && ov.orderBlocks && ov.orderBlocks.length),
      fvg: !!(ov && ov.fvg && ov.fvg.length),
      liq: !!(ov && ((ov.liquidity && ov.liquidity.length) || ov.premiumDiscount)),
      price: bars.length > 0,
    };
    var rows = host.querySelectorAll('.lg');
    var any = false;
    for (var i = 0; i < rows.length; i++) {
      var on = present[rows[i].getAttribute('data-k')] === true;
      rows[i].hidden = !on;
      if (on) any = true;
    }
    host.hidden = !any;
  }

  function priceSpan() {
    if (!bars.length) return 0;
    var hi = -Infinity, lo = Infinity;
    for (var i = 0; i < bars.length; i++) {
      if (bars[i].high > hi) hi = bars[i].high;
      if (bars[i].low < lo) lo = bars[i].low;
    }
    return isFinite(hi) && isFinite(lo) && hi > lo ? hi - lo : 0;
  }

  function clearOverlays() {
    if (!chart || overlayIds.length === 0) { overlayIds = []; return; }
    try { chart.drawings.removeMany(overlayIds); } catch (e) { /* stale ids are harmless */ }
    overlayIds = [];
  }
  function keep(d) { if (d && d.id) { overlayIds.push(d.id); try { chart.drawings.lock(d.id, true); } catch (e) {} } }
  function zone(fromMs, top, bottom, color, opacity) {
    var toMs = fromMs + barMs() * TUNING.zoneExtendBars;
    keep(chart.drawings.add('box', {
      anchors: [{ time: fromMs, price: top }, { time: toMs, price: bottom }],
      style: { lineColor: color, lineWidth: 1, lineStyle: 'solid', fillColor: color, fillOpacity: opacity },
    }));
  }
  function level(fromMs, price, color, dashed, label) {
    keep(chart.drawings.add('hray', {
      anchors: [{ time: fromMs, price: price }],
      style: { lineColor: color, lineWidth: 1, lineStyle: dashed ? 'dashed' : 'solid' },
      text: label ? { value: label, size: 'tiny', hAlign: 'right', vAlign: 'top', color: color } : undefined,
    }));
  }
  function mark(atMs, price, text, color, vAlign) {
    keep(chart.drawings.add('text', {
      anchors: [{ time: atMs, price: price }],
      style: { lineColor: color, lineWidth: 1, lineStyle: 'solid' },
      text: { value: text, size: 'tiny', hAlign: 'center', vAlign: vAlign || 'center', color: color, bold: true },
    }));
  }

  /**
   * The one white 2px line (CANON-LOCK Chart). Vela's built-in price line is
   * off, so the last close is drawn here in the accent instead of the candle
   * pair. It lives outside \`overlayIds\` because an overlay repaint must not
   * take the price with it.
   */
  function paintPriceLine() {
    if (!chart || !bars.length) return;
    if (priceLineId) {
      try { chart.drawings.remove(priceLineId); } catch (e) {}
      priceLineId = null;
    }
    try {
      // \`hray\` runs from its anchor to the RIGHT edge, so the anchor is the
      // FIRST bar: the line has to cross the whole plot, not sit as a stub
      // beyond the last candle.
      var last = bars[bars.length - 1];
      var d = chart.drawings.add('hray', {
        anchors: [{ time: bars[0].time, price: last.close }],
        style: { lineColor: PAINT.priceLine, lineWidth: 2, lineStyle: 'solid' },
      });
      if (d && d.id) {
        priceLineId = d.id;
        try { chart.drawings.lock(d.id, true); } catch (e) {}
      }
    } catch (e) { fail('price_line: ' + (e && e.message)); }
  }

  /** Paint backend-precomputed overlays. Nothing here computes a signal. */
  function paintOverlays(ov) {
    if (!chart || !ov) return;
    clearOverlays();
    var first = bars.length ? bars[0].time : 0;
    var span = priceSpan();
    var step = span * TUNING.stackPriceRatio;
    var levelEpsilon = span * TUNING.levelDedupeRatio;
    var i, p;
    try {
      for (i = 0; i < (ov.orderBlocks || []).length; i++) {
        p = ov.orderBlocks[i];
        zone(p.barMs, num(p.top), num(p.bottom), p.side === 'bull' ? PAINT.orderBlockBull : PAINT.orderBlockBear, 0.16);
      }
      for (i = 0; i < (ov.fvg || []).length; i++) {
        p = ov.fvg[i];
        zone(p.barMs, num(p.top), num(p.bottom), p.filled ? PAINT.fvgFilled : PAINT.fvg, p.filled ? 0.06 : 0.14);
      }
      // Liquidity: one ray per distinct level. Two sweeps a tenth of a percent
      // apart are the same line on screen and their labels used to overprint.
      var drawnLevels = [];
      for (i = 0; i < (ov.liquidity || []).length; i++) {
        p = ov.liquidity[i];
        var lvl = num(p.level);
        if (lvl === null || seenLevel(drawnLevels, p.kind, lvl, levelEpsilon)) continue;
        drawnLevels.push({ kind: p.kind, price: lvl });
        level(p.barMs, lvl, p.kind === 'sweep' ? PAINT.sweep : PAINT.liquidity, p.kind !== 'sweep', p.kind.toUpperCase());
      }
      if (ov.premiumDiscount) {
        level(first, num(ov.premiumDiscount.premium), PAINT.premiumDiscount, true, 'Premium');
        level(first, num(ov.premiumDiscount.equilibrium), PAINT.premiumDiscount, true, 'Equilibrium');
        level(first, num(ov.premiumDiscount.discount), PAINT.premiumDiscount, true, 'Discount');
      }
      // Structure: dedupe the repeats, then step the survivors apart so a
      // CHoCH and the BOS that follows it do not print over each other.
      var seenMarks = {};
      var placed = [];
      for (i = 0; i < (ov.structure || []).length; i++) {
        p = ov.structure[i];
        var price = num(p.price);
        if (price === null) continue;
        var bull = p.direction === 'bull';
        var key = p.label + '|' + p.direction + '|' + p.barMs;
        if (seenMarks[key]) continue;
        seenMarks[key] = 1;
        var at = destack(placed, p.barMs, price, bull, step);
        placed.push({ barMs: p.barMs, price: at });
        mark(p.barMs, at, (MARK_WORDS[p.label + '|' + p.direction] || '') + (bull ? ' \\u25B2' : ' \\u25BC'),
          bull ? PAINT.structureBull : PAINT.structureBear, bull ? 'top' : 'bottom');
      }
    } catch (e) { fail('overlay_paint: ' + (e && e.message)); }
    paintPriceLine();
    paintLegend(ov);
  }

  /** Has a ray of this kind already been drawn within eps of this price? */
  function seenLevel(drawn, kind, price, eps) {
    for (var i = 0; i < drawn.length; i++) {
      if (drawn[i].kind === kind && Math.abs(drawn[i].price - price) <= eps) return true;
    }
    return false;
  }

  /**
   * Step a structure mark off any mark already sharing its bar and its row.
   * Bulls walk down, bears walk up — the direction the arrow already points
   * away from — so the label lands beside the swing rather than on it. Purely
   * visual: the bundle's price is never rewritten, only where the LABEL sits.
   */
  function destack(placed, barMs, price, bull, step) {
    if (!(step > 0)) return price;
    var at = price;
    for (var n = 0; n < TUNING.stackMaxSteps; n++) {
      var clash = false;
      for (var i = 0; i < placed.length; i++) {
        if (placed[i].barMs === barMs && Math.abs(placed[i].price - at) < step) { clash = true; break; }
      }
      if (!clash) return at;
      at = bull ? at - step : at + step;
    }
    return at;
  }

  function destroyChart() {
    if (!chart) return;
    try { chart.destroy(); } catch (e) {}
    chart = null; overlayIds = []; priceLineId = null;
    var host = document.getElementById('chart');
    if (host) host.innerHTML = '';
  }

  function init(msg) {
    destroyChart();
    themeMode = msg.theme === 'light' ? 'light' : 'dark';
    document.body.style.background = THEMES[themeMode].background;
    bars = toBars(msg.candles);
    if (bars.length < 2) { fail('init: fewer than 2 candles'); return; }
    try {
      chart = new window.Vela.Vela('#chart', {
        symbol: 'CORSO',
        timeframe: TF[msg.timeframe] || '60',
        data: bars,
        live: false,
        theme: THEMES[themeMode],
        upColor: THEMES[themeMode].upColor,
        downColor: THEMES[themeMode].downColor,
        drawings: false,
        volume: true,
        animations: false,
        // Off at construction AND in applySkin — the white 2px ray replaces it.
        currentPriceLine: false,
        nativeBackend: 'auto',
      });
      window.__velaChart = chart;
    } catch (e) { fail('init: ' + (e && e.message)); return; }
    chart.ready().then(function () {
      applySkin();
      paintOverlays(msg.overlays);
      try {
        chart.renderer.onCrosshairMove(function (e) {
          if (!e || typeof e.time !== 'number' || typeof e.price !== 'number') return;
          var now = performance.now();
          if (now - lastSelectAt < TUNING.selectThrottleMs) return;
          lastSelectAt = now;
          post({ t: 'select', barMs: e.time, price: String(e.price) });
        });
      } catch (e) { fail('crosshair: ' + (e && e.message)); }
      post({ t: 'painted', bars: bars.length, overlays: overlayIds.length, backend: backendName() });
      sampleFps();
    }, function (e) { fail('ready: ' + (e && e.message)); });
  }

  function append(candle) {
    var bar = toBar(candle || {});
    if (!bar || !chart) return;
    if (bars.length && bars[bars.length - 1].time === bar.time) bars[bars.length - 1] = bar;
    else if (!bars.length || bar.time > bars[bars.length - 1].time) bars.push(bar);
    else return;
    var range = null;
    try { range = chart.getVisibleRange(); } catch (e) {}
    chart.setMarket({ data: bars.slice() }).then(function () {
      if (range) { try { chart.setVisibleRange(range); } catch (e) {} }
      paintPriceLine();
      sampleFps();
    }, function (e) { fail('append: ' + (e && e.message)); });
  }

  function onHostMessage(raw) {
    var msg;
    try { msg = typeof raw === 'string' ? JSON.parse(raw) : null; } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'init') init(msg);
    else if (msg.t === 'append') append(msg.candle);
    else if (msg.t === 'overlays') {
      if (chart) {
        paintOverlays(msg.overlays);
        post({ t: 'painted', bars: bars.length, overlays: overlayIds.length, backend: backendName() });
      }
    }
    else if (msg.t === 'theme') {
      themeMode = msg.mode === 'light' ? 'light' : 'dark';
      document.body.style.background = THEMES[themeMode].background;
      if (chart) {
        try { chart.setTheme(THEMES[themeMode]); } catch (e) {}
        applySkin();
      }
    }
    else if (msg.t === 'setRange') {
      if (chart && msg.range) { try { chart.setVisibleRange({ from: msg.range.fromMs, to: msg.range.toMs }); } catch (e) {} }
    }
  }

  // RN posts to document (Android) or window (iOS) 'message' events.
  document.addEventListener('message', function (e) { onHostMessage(e.data); });
  window.addEventListener('message', function (e) { onHostMessage(e.data); });
  window.addEventListener('error', function (e) { fail('page: ' + (e && e.message)); });
  window.addEventListener('unhandledrejection', function (e) { fail('promise: ' + (e && e.reason && e.reason.message)); });
  document.addEventListener('webglcontextlost', function () { fail('webgl_context_lost'); }, true);
  window.addEventListener('resize', function () { if (chart) { try { chart.resize(); } catch (e) {} } });

  if (!window.Vela || typeof window.Vela.Vela !== 'function') { fail('vendor: Vela global missing'); return; }
  post({ t: 'ready', backend: backendName(), vendor: VENDOR.version });
})();
`;
}

/**
 * Build the offline HTML document. `theme` sets the pre-init page background
 * (no white flash before `init` lands); the host re-themes via `{ t: 'theme' }`.
 */
export function buildVelaChartHtml(theme: VelaThemeMode = 'dark'): string {
  const bg = VELA_PAGE_THEMES[theme].background;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none';" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: ${bg}; overflow: hidden; overscroll-behavior: none; }
  #chart { position: fixed; inset: 0; touch-action: none; -webkit-user-select: none; user-select: none; }
  /* The legend is chrome over the canvas: it never takes a touch away from
     the chart, and it is hidden until the glue says a family is on screen. */
  #legend {
    position: fixed; top: 8px; left: 10px; right: 10px; z-index: 4;
    display: flex; flex-wrap: wrap; gap: 4px 12px;
    pointer-events: none; -webkit-user-select: none; user-select: none;
    font: 500 10.5px ${VELA_FONT_STACK}; letter-spacing: .2px;
    color: ${VELA_OVERLAY_PAINT.chromeInk};
  }
  #legend[hidden], .lg[hidden] { display: none; }
  .lg { display: inline-flex; align-items: center; gap: 5px; }
  .lg b { font-weight: 500; }
  .sw { width: 7px; height: 2px; border-radius: 1px; display: block; }
  .sw + .sw { margin-left: -3px; }
</style>
</head>
<body>
<div id="chart"></div>
<div id="legend" hidden>${buildLegendHtml()}</div>
<script>/* @luxalgo/vela ${VELA_VENDOR_VERSION} — Apache-2.0 — sha256 ${VELA_VENDOR_SHA256} — vendored offline, see vendor/NOTICE */
${escapeInlineScript(VELA_GLOBAL_MIN_JS)}
</script>
<script>${buildGlueScript()}</script>
</body>
</html>`;
}
