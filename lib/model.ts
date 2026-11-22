// The radar's value model: one sealed snapshot in, one ranked board out.
//
// Every board row is a protocol that records no token (no market cap, no CoinGecko id, no
// symbol) and is not a centralised exchange, a bridge, a versioned pool of another protocol,
// a product whose name says it is wrapped or staked, or a product whose name begins with an
// exchange's name. Bridges are left out for the house's own reason: the snapshot cannot tell a
// bridge protocol from a wrapped asset issued through a bridge, so neither is ranked here as a
// launch candidate. Liquid-staking protocols stay: the watchlist leaves them out on the same
// caution, but the watchlist is a floor, never a ceiling, and a staking protocol with no token
// on record is a genuine launch candidate. Protocols whose token already trades never enter
// the ranking: the dashboard shows them apart, with the market cap the market already gave them.
// Those live-token protocols do a second job here: they calibrate the model (see below).
//
// Implied value is one function of the snapshot's own figures, the same for every protocol.
// Its anchor is the market itself, computed from the snapshot at runtime, never a constant
// written by hand:
//
//   anchor       = the median mcap/TVL ratio of the snapshot's live-token protocols in the
//                  row's own category, where that category has at least MIN_SAMPLE of them;
//                  otherwise the median over all live-token protocols, and the row says so.
//   base         = tvl_usd x anchor
//   growthMult   = 1 + clamp(change_7d, -50, 150) / 100 x GROWTH_WEIGHT
//   maturityMult = MATURITY_FLOOR + (1 - MATURITY_FLOOR) x min(age_days, MATURITY_DAYS) / MATURITY_DAYS
//   implied      = max(1, round(base x growthMult x maturityMult))
//
// A live-token protocol is one whose token already trades: a market cap above zero and locked
// value above zero, so the ratio is a number the market actually set. The median is used
// because the ratios spread wide (the first quartile sits near 0.04, the third near 1.04): a
// mean would let one outlier protocol set the anchor for every row. A category with too few
// live-token protocols to trust its own median falls back to the global median, so no row is
// priced off one or two examples. No protocol name is ever special-cased, and no number in
// the anchor is hand-written: run the same program on a different snapshot and the anchor
// moves with that snapshot's own market.
//
// Seven-day growth is clamped so one explosive week cannot carry a row. Age is the time since
// DefiLlama first listed the protocol, the record of how long it has run with no token; an
// unlisted age is treated as one year. Chain breadth is not a separate factor any more: the
// market ratios the anchor is built from already price how far a protocol reaches, because
// live multi-chain protocols carry their reach in their own ratios, so a second chain factor
// would pay for the same reach twice.

/** One protocol entry: exactly the ten fields the sealed snapshot carries. */
export interface SnapshotProtocol {
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

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, stated in the dashboard so the page can recompute every row. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_days: number;
  unknown_age_days: number;
  /** A category needs this many live-token protocols before its own median is trusted. */
  min_calibration_sample: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 150,
  maturity_floor: 0.55,
  maturity_days: 1460,
  unknown_age_days: 365,
  min_calibration_sample: 5,
};

/** The model's version label, shown in the dashboard header. */
export const MODEL_VERSION = 'calibrated-1';

/** How many live-token protocols the dashboard's separate live view carries. */
export const LIVE_ROWS = 24;

/** One category's market anchor: its live-token median, or the global one on fallback. */
export interface CalibrationEntry {
  /** The median mcap/TVL ratio this row is priced with. */
  median: number;
  /** How many live-token protocols the median is taken over. */
  sample: number;
  /** True when the category had too few live-token protocols and the global median applies. */
  fallback: boolean;
  /** The category whose median applies, or null when the global median applies. */
  category: string | null;
}

/** The whole calibration, computed from the snapshot at runtime. */
export interface Calibration {
  /** The median mcap/TVL ratio over every live-token protocol in the snapshot. */
  global_median: number;
  /** How many live-token protocols the global median is taken over. */
  global_sample: number;
  /** The first and third quartiles of the live-token ratios, for the dashboard to show. */
  q1: number;
  q3: number;
  /** The smallest sample a category needs before its own median is trusted. */
  min_sample: number;
  /** Every category with a trusted median of its own, largest sample first. */
  categories: { category: string; median: number; sample: number }[];
}

/** One protocol's standing inside its own category, from the whole snapshot. */
export interface CategoryStanding {
  /** The category's TVL across every protocol in the snapshot that names it. */
  total_tvl_usd: number;
  /** The protocol's rank by TVL among the snapshot's protocols in its category. */
  rank: number;
  /** How many snapshot protocols name the category. */
  size: number;
}

/** One row of board.json. */
export interface BoardRow {
  rank: number;
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
  token_status: 'pre-token';
  on_watchlist: boolean;
  age_days: number | null;
  /** The protocol's rank by TVL inside its own category, for the dashboard's signals line. */
  category_rank: number | null;
  /** How many snapshot protocols name the protocol's category. */
  category_size: number | null;
  implied_value_usd: number;
  model: {
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    calibration_median: number;
    calibration_sample: number;
    calibration_fallback: boolean;
    calibration_category: string | null;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** A board row's compact form for the dashboard's data script. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  /** The market anchor, unrounded: the page multiplies by it, so the recompute is exact. */
  calibration_median: number;
  calibration_sample: number;
  calibration_fallback: boolean;
  calibration_category: string | null;
  category_rank: number | null;
  category_size: number | null;
  on_watchlist: boolean;
}

/** A protocol whose token already trades: shown apart, with the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard renders. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  calibration: Calibration;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  total_implied_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The middle value of sorted numbers; the mean of the two middle values when there are two. */
export function medianOf(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) throw new SnapshotError('no live-token protocol to calibrate from');
  return n % 2 === 1 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/** The value at the q-th fraction of sorted numbers, by nearest lower index. */
export function quartileOf(sorted: number[], q: number): number {
  return sorted[Math.floor(q * (sorted.length - 1))]!;
}

/** A protocol whose token already trades, with a market cap and locked value to divide by. */
export function isLiveToken(p: SnapshotProtocol): boolean {
  return (
    typeof p.mcap_usd === 'number' &&
    Number.isFinite(p.mcap_usd) &&
    p.mcap_usd > 0 &&
    typeof p.tvl_usd === 'number' &&
    Number.isFinite(p.tvl_usd) &&
    p.tvl_usd > 0
  );
}

/** The market anchor, computed from the snapshot's own live-token protocols. */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const live = snapshot.protocols.filter(isLiveToken);
  if (live.length === 0) throw new SnapshotError('the snapshot holds no live-token protocol to calibrate from');
  const ratios = live.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
  const byCategory = new Map<string, number[]>();
  for (const p of live) {
    if (p.category === null) continue;
    const list = byCategory.get(p.category) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCategory.set(p.category, list);
  }
  const categories: { category: string; median: number; sample: number }[] = [];
  for (const [category, values] of byCategory) {
    if (values.length < model.min_calibration_sample) continue;
    categories.push({ category, median: medianOf([...values].sort((a, b) => a - b)), sample: values.length });
  }
  categories.sort((a, b) => b.sample - a.sample || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  return {
    global_median: medianOf(ratios),
    global_sample: live.length,
    q1: quartileOf(ratios, 0.25),
    q3: quartileOf(ratios, 0.75),
    min_sample: model.min_calibration_sample,
    categories,
  };
}

/** The anchor one protocol is priced with: its category's median, or the global one. */
export function calibrationFor(category: string | null, calibration: Calibration): CalibrationEntry {
  if (category !== null) {
    const own = calibration.categories.find((c) => c.category === category);
    if (own !== undefined) return { median: own.median, sample: own.sample, fallback: false, category };
  }
  return { median: calibration.global_median, sample: calibration.global_sample, fallback: true, category: null };
}

/** The multipliers and the implied value one protocol gets. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  calibration: Calibration,
): {
  implied: number;
  base: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  anchor: CalibrationEntry;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = typeof protocol.change_7d === 'number' && Number.isFinite(protocol.change_7d) ? protocol.change_7d : 0;
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor + (1 - model.maturity_floor) * (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days);
  const anchor = calibrationFor(protocol.category, calibration);
  const base = Math.max(protocol.tvl_usd, 0) * anchor.median;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, base, growthPct, growthMult, maturityMult, anchor, age };
}

/** Every protocol's standing inside its own category, keyed by slug. */
export function categoryStandings(snapshot: Snapshot): Map<string, CategoryStanding> {
  const byCategory = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    if (p.category === null) continue;
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }
  const standings = new Map<string, CategoryStanding>();
  for (const list of byCategory.values()) {
    const total = list.reduce((sum, p) => sum + Math.max(p.tvl_usd, 0), 0);
    const ordered = [...list].sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    ordered.forEach((p, i) => standings.set(p.slug, { total_tvl_usd: total, rank: i + 1, size: ordered.length }));
  }
  return standings;
}

/** A name ending in a version marker names a pool of another protocol, not a launch of its own. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name that says the product is wrapped or staked names a derivative, not a protocol. */
const DERIVATIVE_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name is an exchange's product, not a farmable launch. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Categories the radar never ranks: exchanges, and bridges the snapshot cannot tell from wrapped assets. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol may be ranked: pre-token, in a ranked category, not a versioned pool, not a named derivative, not an exchange's product. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !DERIVATIVE_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The protocols the board ranks: every rankable pre-token protocol, strongest first, ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const standings = categoryStandings(snapshot);
  const calibration = calibrate(snapshot, model);
  const watch = new Set(snapshot.watchlist);
  const chosen = snapshot.protocols.filter((p) => isRankable(p) || watch.has(p.slug));
  const scored = chosen.map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, calibration);
    return { p, standing: standings.get(p.slug) ?? null, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    on_watchlist: watch.has(s.p.slug),
    age_days: s.age,
    category_rank: s.standing === null ? null : s.standing.rank,
    category_size: s.standing === null ? null : s.standing.size,
    implied_value_usd: s.implied,
    model: {
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      calibration_median: s.anchor.median,
      calibration_sample: s.anchor.sample,
      calibration_fallback: s.anchor.fallback,
      calibration_category: s.anchor.category,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age, s.implied),
  }));
}

// ---- Farm plans ----
// Each plan is derived from the protocol's own record: its category picks the action, its
// calibrated implied value picks the capital, its first chain picks the gas band, its age
// picks the hold. A row whose calibrated value is far below its TVL farms like a small row,
// not like a top row: the capital follows the implied value, not the TVL. Every step states
// what it costs in dollars and how long it takes, and the plan ends with a concrete exit
// condition: when to claim, and when to unwind even if no claim ever opens. Nothing is
// hand-written per protocol, no URL is invented, and no plan claims a protocol has no token.

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The capital one farm position needs, from the protocol's calibrated implied value. */
function capitalFor(impliedValueUsd: number): number {
  if (impliedValueUsd >= 100_000_000) return 200;
  if (impliedValueUsd >= 25_000_000) return 120;
  if (impliedValueUsd >= 5_000_000) return 80;
  return 50;
}

/** Rollups and sidechains where one transaction costs a few dollars at most. */
const CHEAP_CHAINS = ['arbitrum', 'optimism', 'base', 'blast', 'zksync', 'polygon', 'linea', 'scroll', 'mantle', 'mode', 'fraxtal', 'ink', 'unichain', 'worldchain', 'abstract', 'soneium', 'bnb', 'bsc', 'avalanche', 'gnosis'];

/** The gas band for one transaction on a chain, in whole dollars, from the chain alone. */
export function gasBand(chain: string): { low: number; high: number } {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return { low: 8, high: 15 };
  if (c === 'solana') return { low: 0, high: 1 };
  if (c === 'bitcoin') return { low: 2, high: 5 };
  if (CHEAP_CHAINS.includes(c)) return { low: 1, high: 3 };
  return { low: 2, high: 5 };
}

/** The gas band as the words a farm step states. */
function gasNote(chain: string): string {
  const band = gasBand(chain);
  if (band.high <= 1) return `under $1 of fees on ${chain}`;
  return `$${band.low} to $${band.high} of gas on ${chain}`;
}

/** How long to hold, from the protocol's age: younger protocols need a longer window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 60;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 45;
}

/** The category family, from the category string alone. */
function familyOf(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'lend';
  if (c.includes('bridge')) return 'bridge';
  if (c.includes('staking') || c.includes('restak') || c.includes('staking pool')) return 'stake';
  if (c.includes('perpetual') || c.includes('derivative')) return 'perp';
  if (c.includes('dex')) return 'dex';
  if (c.includes('yield') || c.includes('farm') || c.includes('leveraged')) return 'vault';
  if (c.includes('rwa') || c.includes('real world')) return 'rwa';
  if (c.includes('curator') || c.includes('allocator')) return 'curator';
  if (c.includes('basis')) return 'basis';
  if (c.includes('prediction')) return 'predict';
  if (c.includes('insurance')) return 'insure';
  if (c === 'chain') return 'chain';
  if (c.includes('liquidity manager')) return 'manager';
  return 'general';
}

/** The opening action, in the words a farmer can follow. */
function openAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const name = p.name;
  switch (familyOf(p)) {
    case 'lend':
      return `Lend $${capital} of USDC into ${name}'s market on ${chain} and leave it supplied; borrow a small amount against it only if you want a second qualifying action.`;
    case 'bridge':
      return `Bridge $${capital} of USDC into ${chain} through ${name}, then use the bridged funds inside the destination app instead of bridging straight back.`;
    case 'stake':
      return `Stake $${capital} through ${name} on ${chain} and hold the receipt token in the same wallet for the whole window.`;
    case 'perp':
      return `Post $${capital} of USDC as collateral on ${name} (${chain}), open one small low-leverage position, and close it within the same week.`;
    case 'dex':
      return `Add $${capital} of two-sided liquidity to ${name}'s largest pool on ${chain} and keep the position in range.`;
    case 'vault':
      return `Deposit $${capital} into ${name}'s highest-TVL vault on ${chain} and hold the vault shares.`;
    case 'rwa':
      return `Buy $${capital} of ${name}'s tokenised asset on ${chain} and hold it in the farming wallet.`;
    case 'curator':
      return `Allocate $${capital} to a ${name} curator vault on ${chain} and hold the shares for the full window.`;
    case 'basis':
      return `Deposit $${capital} into ${name}'s basis vault on ${chain} and hold the position through at least one full funding cycle.`;
    case 'predict':
      return `Fund the account with $${capital} and take one small position on ${name}; keep the stake small enough to lose.`;
    case 'insure':
      return `Buy $${capital} of cover through ${name} on ${chain} and keep the policy active for the window.`;
    case 'chain':
      return `Bridge $${capital} to the ${name} chain and use its core app: one swap, one liquidity position, and one vote if governance is live.`;
    case 'manager':
      return `Deposit $${capital} into a ${name}-managed position on ${chain} and leave rebalancing to the manager.`;
    default:
      return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open for the full window.`;
  }
}

/** The weekly repeat action, again from the category family. */
function weeklyAction(p: SnapshotProtocol, chain: string): string {
  const name = p.name;
  switch (familyOf(p)) {
    case 'lend':
      return `Once a week, adjust the position: add a little supply, repay part of any borrow, or claim and re-supply rewards.`;
    case 'bridge':
      return `Once a week, bridge a small amount ($10 to $25) through ${name} in either direction and interact with the destination app.`;
    case 'stake':
      return `Once a week, add a small top-up to the stake, or restake any rewards the protocol distributes.`;
    case 'perp':
      return `Once a week, open and close one small hedged trade so the account shows regular activity.`;
    case 'dex':
      return `Once a week, make one swap through ${name}'s pools on ${chain} and check the liquidity position is still in range.`;
    case 'vault':
    case 'curator':
    case 'basis':
      return `Once a week, deposit a small top-up or harvest and re-deposit rewards into the same vault.`;
    case 'chain':
      return `Once a week, use one more app on the ${name} chain: a swap, a stake, or a governance vote.`;
    default:
      return `Once a week, repeat one real action inside ${name}: a deposit, a swap, a vote, or a claim.`;
  }
}

/** One step as a single string: action, then its cost and time, within 20..600 characters. */
function stepText(text: string, cost: string, time: string): string {
  let s = `${text} Cost: ${cost}. Time: ${time}.`;
  if (s.length > 600) s = `${s.slice(0, 597)}...`;
  return s;
}

/** A protocol's seven-step farm plan, derived from its own record. */
export function farmSteps(p: SnapshotProtocol, age: number | null, impliedValueUsd: number): string[] {
  const chain = chainOf(p);
  const capital = capitalFor(impliedValueUsd);
  const hold = holdDaysFor(age);
  const gas = gasNote(chain);
  const exitAfter = hold + 30;
  return [
    stepText(
      'Set up a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.',
      'no cost to create the wallet',
      '5 minutes',
    ),
    stepText(openAction(p, capital, chain), `$${capital} of capital plus ${gas} for the deposit transaction`, '15 minutes to set up'),
    stepText(weeklyAction(p, chain), `${gas} a week for one transaction`, '10 minutes a week'),
    stepText(
      `After 30 days, check the position still qualifies: still supplied, still in range where that applies, and any points balance moving. If the protocol changed its program, follow the new rules from its own announcements only.`,
      `no fee to check; ${gas} if one adjustment transaction is needed`,
      '15 minutes, once',
    ),
    stepText(
      `Hold the position for at least ${hold} days without withdrawing, so the activity is counted in more than one snapshot window.`,
      `the $${capital} stays in the position; about ${gas} a week of upkeep`,
      `${hold} days`,
    ),
    stepText(
      `Exit only when the protocol itself publishes a claim or points page and this wallet shows a balance on it. If no claim page exists after ${exitAfter} days, unwind anyway and treat the position as a plain deposit. Never pay anyone to claim for you, and never sign a claim transaction reached from any link but the protocol's own site.`,
      `${gas} to claim, only if a claim opens`,
      '20 minutes when the claim opens',
    ),
    stepText(
      'Write the wallet address, the dates and every transaction hash in a farm log, then unwind in reverse order: claim, withdraw, and move the funds back to cold storage.',
      `${gas} to unwind`,
      '15 minutes',
    ),
  ];
}

/** The live-token protocols, by market cap, for the dashboard's separate live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, LIVE_ROWS)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, chains: p.chains, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd, change_7d: p.change_7d }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const calibration = calibrate(snapshot, model);
  const early = board.filter((r) => !r.on_watchlist).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    total_implied_usd: board.reduce((sum, r) => sum + r.implied_value_usd, 0),
    rows: board.map((row) => ({
      rank: row.rank,
      slug: row.slug,
      name: row.name,
      category: row.category,
      chains: row.chains,
      tvl_usd: row.tvl_usd,
      change_7d: row.change_7d,
      listed_at: row.listed_at,
      age_days: row.age_days,
      implied_value_usd: row.implied_value_usd,
      growth_multiplier: row.model.growth_multiplier,
      maturity_multiplier: row.model.maturity_multiplier,
      calibration_median: row.model.calibration_median,
      calibration_sample: row.model.calibration_sample,
      calibration_fallback: row.model.calibration_fallback,
      calibration_category: row.model.calibration_category,
      category_rank: row.category_rank,
      category_size: row.category_size,
      on_watchlist: row.on_watchlist,
    })),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}

/** Why a board is not one the gate will take, or null. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'the board repeats a slug';
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `${r.slug} is not one of the snapshot's protocols`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board.every((r) => r.implied_value_usd === board[0]!.implied_value_usd)) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** The dashboard's dataset as one script: no fetch, no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
