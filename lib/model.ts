// The token launch radar's value model and board construction.
//
// Everything on the board is derived from the sealed DefiLlama snapshot and
// nothing else: no protocol is named in this file, no value is hardcoded per
// protocol, and the same code run on the same snapshot writes the same board.
//
// V2 corrects winsorised launched-peer ratios to the target's TVL using the
// global log-log slope, then shrinks category statistics toward global ones.
// Momentum and maturity scale the estimate and its middle-half value band.
// Launched anchors retain their real market cap.

import { farmSteps } from './farm.ts';

/** One protocol record, exactly the snapshot's ten fields. */
export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The sealed snapshot: a protocol list, a watchlist, and the fetch facts. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

/** How one protocol's implied value was reached, shown in its detail view. */
export interface Breakdown {
  size_slope: number;
  value_low_usd: number;
  value_high_usd: number;
  confidence: 'A' | 'B' | 'C';
  base_multiple: number;
  calibration_peers: number;
  momentum_factor: number;
  maturity_factor: number;
  age_days: number | null;
}

/** A board row: the gate's fields plus everything the dashboard renders. */
export interface Row {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  status: 'pre-token' | 'launched';
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  on_watchlist: boolean;
  breakdown: Breakdown;
  farm_steps: string[];
}

/** The whole radar: the board plus the facts the dashboard header states. */
export interface Radar {
  as_of: string;
  source: string;
  floor_usd: number;
  scanned: number;
  watchlist_size: number;
  pre_token_rows: number;
  launched_rows: number;
  validation: ReturnType<typeof validateModel>;
  rows: Row[];
}

const DAY_MS = 86_400_000;
/** Multiples are clamped to this band so one thin category cannot dominate the board. */
const MULTIPLE_MIN = 0.03;
const MULTIPLE_MAX = 3;
/** Board shape: how many pre-token rows and launched anchors the radar carries. */
export const PRE_TOKEN_ROWS = 185;
export const LAUNCHED_ROWS = 25;

/** Parse the snapshot's JSON text, refusing anything that is not its shape. */
export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Snapshot;
  if (!Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist) || typeof raw.as_of !== 'string') {
    throw new Error('snapshot: not the sealed DefiLlama snapshot shape');
  }
  return raw;
}

/** Linear-interpolation quantile; a neutral ratio is used for an empty calibration. */
const quantile = (xs: number[], q: number): number => {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lo = Math.floor(index);
  return sorted[lo]! + (sorted[Math.ceil(index)]! - sorted[lo]!) * (index - lo);
};
const median = (xs: number[]): number => quantile(xs, 0.5);

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Whole days between two UTC dates (YYYY-MM-DD), or null when either is missing. */
function daysBetween(from: string | null, to: string): number | null {
  if (from === null) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

const launchedPeers = (protocols: Protocol[]): Protocol[] =>
  protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);

/** Fit the raw log-log slope and global winsor bounds using only these peers. */
export function calibrate(protocols: Protocol[]) {
  const peers = launchedPeers(protocols);
  const ratios = peers.map((p) => p.mcap_usd! / p.tvl_usd);
  const xs = peers.map((p) => Math.log10(p.tvl_usd));
  const ys = ratios.map((r) => Math.log10(r));
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const mx = mean(xs), my = mean(ys);
  const variance = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  const slope = variance === 0 ? 0 : xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i]! - my), 0) / variance;
  return { peers, ratios, slope, lo: quantile(ratios, 0.05), hi: quantile(ratios, 0.95) };
}

function factors(p: Protocol, asOf: string) {
  const momentum = p.change_7d === null ? 1 : 1 + (0.6 * clamp(p.change_7d, -25, 25)) / 100;
  const ageDays = daysBetween(p.listed_at, asOf);
  const years = ageDays === null ? 0 : ageDays / 365.25;
  const maturity = Math.min(1.5, 1 + 0.12 * Math.log(1 + years));
  return { momentum, maturity, ageDays };
}

/** Score with size-corrected, shrunk log statistics and an honest middle-half band. */
export function impliedValue(
  p: Protocol,
  calib: ReturnType<typeof calibrate>,
  asOf: string,
): { value: number; breakdown: Breakdown } {
  const logs = calib.peers.map((q, i) => Math.log10(clamp(calib.ratios[i]!, calib.lo, calib.hi))
    - calib.slope * (Math.log10(q.tvl_usd) - Math.log10(p.tvl_usd > 0 ? p.tvl_usd : 1)));
  const category = logs.filter((_, i) => p.category !== null && calib.peers[i]!.category === p.category);
  const n = category.length;
  const w = n / (n + 6);
  const blended = (q: number) => n === 0 ? quantile(logs, q) : w * quantile(category, q) + (1 - w) * quantile(logs, q);
  const multiple = clamp(10 ** blended(0.5), MULTIPLE_MIN, MULTIPLE_MAX);
  const { momentum, maturity, ageDays } = factors(p, asOf);
  const scale = p.tvl_usd * momentum * maturity;
  const low = Math.max(1, Math.round(scale * 10 ** blended(0.25)));
  const high = Math.max(low, Math.round(scale * 10 ** blended(0.75)));
  const value = clamp(Math.max(1, Math.round(scale * multiple)), low, high);
  const score = (n >= 8 ? 2 : n >= 4 ? 1 : 0) + (p.listed_at !== null ? 1 : 0) + (p.change_7d !== null ? 1 : 0);
  return {
    value,
    breakdown: {
      base_multiple: multiple, calibration_peers: n,
      momentum_factor: momentum, maturity_factor: maturity, age_days: ageDays,
      size_slope: calib.slope, value_low_usd: low, value_high_usd: high,
      confidence: n === 0 ? 'C' : score >= 3 ? 'A' : score === 2 ? 'B' : 'C',
    },
  };
}

/** Leave each real price out of both calibrations before predicting it. */
export function validateModel(snapshot: Snapshot) {
  const launched = launchedPeers(snapshot.protocols);
  const model: number[] = [], baseline: number[] = [];
  const bandHits: boolean[] = [], bandWidths: number[] = [];
  for (const p of launched) {
    const calib = calibrate(launched.filter((q) => q !== p));
    const { value: prediction, breakdown } = impliedValue(p, calib, snapshot.as_of);
    bandHits.push(p.mcap_usd! >= breakdown.value_low_usd && p.mcap_usd! <= breakdown.value_high_usd);
    bandWidths.push(breakdown.value_high_usd / breakdown.value_low_usd);
    const category = calib.peers.flatMap((q, i) => p.category !== null && q.category === p.category ? [calib.ratios[i]!] : []);
    const multiple = clamp(median(category.length >= 3 ? category : calib.ratios), MULTIPLE_MIN, MULTIPLE_MAX);
    const { momentum, maturity } = factors(p, snapshot.as_of);
    const naive = Math.max(1, Math.round(p.tvl_usd * multiple * momentum * maturity));
    model.push(Math.abs(Math.log10(prediction / p.mcap_usd!)));
    baseline.push(Math.abs(Math.log10(naive / p.mcap_usd!)));
  }
  const metrics = (errors: number[]) => ({
    median_abs_log10: Number(median(errors).toFixed(3)),
    within_2x: Number((100 * errors.filter((e) => e <= Math.log10(2)).length / (errors.length || 1)).toFixed(1)),
    within_3x: Number((100 * errors.filter((e) => e <= Math.log10(3)).length / (errors.length || 1)).toFixed(1)),
  });
  return {
    n: launched.length,
    model: {
      ...metrics(model),
      band_coverage_pct: Number((100 * bandHits.filter(Boolean).length / (bandHits.length || 1)).toFixed(1)),
      median_band_width: Number(median(bandWidths).toFixed(2)),
    },
    baseline: metrics(baseline),
  };
}

const byValueDesc = (a: Row, b: Row): number =>
  b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1);

/** Build the ranked board: pre-token protocols by implied value, watchlist guaranteed, launched anchors merged in. */
export function buildBoard(snapshot: Snapshot): Row[] {
  const calib = calibrate(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const rows: Row[] = [];

  const preToken = snapshot.protocols.filter((p) => p.mcap_usd === null);
  // Rank across the entire snapshot, before selecting board rows; break TVL ties by slug.
  const categories = new Map<string | null, Protocol[]>();
  for (const p of preToken) {
    const group = categories.get(p.category) ?? [];
    group.push(p);
    categories.set(p.category, group);
  }
  const standing = new Map<string, { categoryRank: number; categoryCount: number }>();
  for (const group of categories.values()) {
    group.sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    group.forEach((p, i) => standing.set(p.slug, { categoryRank: i + 1, categoryCount: group.length }));
  }
  const scored = preToken
    .map((p) => {
      const { value, breakdown } = impliedValue(p, calib, snapshot.as_of);
      return { p, value, breakdown };
    })
    .sort((a, b) => b.value - a.value || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1));

  const chosen = scored.slice(0, PRE_TOKEN_ROWS);
  const chosenSlugs = new Set(chosen.map((c) => c.p.slug));
  // The watchlist is the floor: swap any missing watchlist protocol in for
  // the weakest chosen row that is not itself on the watchlist.
  for (const c of scored) {
    if (!watchlist.has(c.p.slug) || chosenSlugs.has(c.p.slug)) continue;
    for (let i = chosen.length - 1; i >= 0; i--) {
      if (!watchlist.has(chosen[i]!.p.slug)) {
        chosenSlugs.delete(chosen[i]!.p.slug);
        chosen[i] = c;
        chosenSlugs.add(c.p.slug);
        break;
      }
    }
  }
  for (const { p, value, breakdown } of chosen) {
    rows.push({
      slug: p.slug, name: p.name, rank: 0, implied_value_usd: value, status: 'pre-token',
      category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, change_7d: p.change_7d,
      mcap_usd: null, listed_at: p.listed_at, on_watchlist: watchlist.has(p.slug),
      breakdown, farm_steps: farmSteps(p, 'pre-token', { ...standing.get(p.slug)!, peers: breakdown.calibration_peers, confidence: breakdown.confidence, lowUsd: breakdown.value_low_usd, highUsd: breakdown.value_high_usd }),
    });
  }

  const launched = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || (a.slug < b.slug ? -1 : 1))
    .slice(0, LAUNCHED_ROWS);
  for (const p of launched) {
    rows.push({
      slug: p.slug, name: p.name, rank: 0, implied_value_usd: p.mcap_usd!, status: 'launched',
      category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, change_7d: p.change_7d,
      mcap_usd: p.mcap_usd, listed_at: p.listed_at, on_watchlist: false,
      breakdown: { size_slope: calib.slope, value_low_usd: p.mcap_usd!, value_high_usd: p.mcap_usd!, confidence: 'A', base_multiple: p.tvl_usd > 0 ? p.mcap_usd! / p.tvl_usd : 0, calibration_peers: 0, momentum_factor: 1, maturity_factor: 1, age_days: daysBetween(p.listed_at, snapshot.as_of) },
      farm_steps: farmSteps(p, 'launched'),
    });
  }

  rows.sort(byValueDesc);
  rows.forEach((row, i) => { row.rank = i + 1; });
  return rows;
}

/** Assemble the radar object the dashboard renders. */
export function buildRadar(snapshot: Snapshot): Radar {
  const rows = buildBoard(snapshot);
  return {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    scanned: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    pre_token_rows: rows.filter((r) => r.status === 'pre-token').length,
    launched_rows: rows.filter((r) => r.status === 'launched').length,
    validation: validateModel(snapshot),
    rows,
  };
}

/**
 * Check a board against the gate's rules, in the gate's own terms; returns
 * the first refusal, or null when the board is one the gate accepts.
 */
export function boardIssue(rows: Row[], snapshot: Snapshot): string | null {
  if (rows.length < 100 || rows.length > 4000) return `board holds ${rows.length} rows, outside 100..4000`;
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (const row of rows) {
    if (!slugs.has(row.slug)) return `row slug ${row.slug} is not one of the snapshot's protocols`;
    if (seen.has(row.slug)) return `row slug ${row.slug} appears twice`;
    seen.add(row.slug);
    if (!Number.isInteger(row.implied_value_usd) || row.implied_value_usd <= 0) return `row ${row.slug}: implied value is not a positive whole number`;
    if (row.breakdown.value_low_usd > row.implied_value_usd || row.breakdown.value_high_usd < row.implied_value_usd) return `row ${row.slug}: implied value outside value band`;
    if (!['A', 'B', 'C'].includes(row.breakdown.confidence)) return `row ${row.slug}: invalid confidence`;
    if (!Array.isArray(row.farm_steps) || row.farm_steps.length < 3 || row.farm_steps.length > 12) return `row ${row.slug}: farm_steps outside 3..12`;
    for (const step of row.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) return `row ${row.slug}: a farm step is ${len} characters, outside 20..600`;
    }
  }
  const byRank = [...rows].sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < byRank.length; i++) {
    if (byRank[i]!.rank !== i + 1) return `ranks are not exactly 1..${byRank.length}`;
    if (i > 0 && byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `implied value rises at rank ${i + 1}`;
  }
  if (new Set(rows.map((r) => r.implied_value_usd)).size < 2) return 'every implied value is the same: not a ranking';
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return `watchlist protocol ${slug} is missing from the board`;
  }
  return null;
}

/** The dashboard's data, as a script the page loads beside its index.html. */
export function dataScript(radar: Radar): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}
