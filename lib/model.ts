// Token Radar model (radar-2): snapshot in, ranked board out.
//
// A protocol records no token when its DefiLlama record carries no market cap,
// no CoinGecko id and no symbol. Those are the only protocols the board ranks.
// Protocols whose token already trades are set aside with their market cap;
// they are never ranked as pre-token launches.
//
// Implied value follows only from the snapshot's own figures, never from a
// protocol's name. For a protocol with TVL T, seven-day change g and age a:
//
//   base        = T x 0.30
//   growth      = clamp(g, -50, +100)          (null growth counts as 0;
//                                                one week printed +4,448% in
//                                                this snapshot, so the clamp
//                                                is what keeps a small base
//                                                from dominating the board)
//   growthMult  = 1 + growth / 100 x 0.60
//   maturity    = 0.55 + 0.45 x min(a, 1460) / 1460   (unknown age counts as 365d)
//   category    = a risk multiplier by category (see CATEGORY_MULT)
//   chains      = 1 + 0.02 x min(chains - 1, 5)      (multi-chain reach, max 1.10)
//   implied     = round(base x growthMult x maturity x category x chains)
//
// Why each factor: TVL is the size of the business a token would price;
// growth is the direction it is moving (clamped, because one week can print
// +4,448% on a small base); age is how long it has run with no token, which
// is the closest thing the snapshot has to pent-up launch value, capped at
// four years so a 2021 listing does not dominate; category is launch risk
// (lending and CDP protocols have a proven fee model, bridges and staking
// pools are often products of a token that already trades); chains is reach.
// After scoring, ranks are made strictly decreasing: if two protocols score
// the same whole dollar, the lower-ranked one is nudged down by $1, so the
// board is a ranking, not a tie.

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

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_cap: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.3,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_cap: 5,
};

export const MODEL_VERSION = 'radar-2';

/** Category risk multipliers, keyed by the category group a category falls in. */
export const CATEGORY_MULT: Record<string, number> = {
  lending: 1.1, // Lending, CDP, Collateral Markets: a proven fee model
  trading: 1.05, // Dexs, Derivatives, Basis Trading, Leveraged Farming
  curation: 1.0, // Risk Curators, Onchain Capital Allocator, Yield Aggregator
  yield: 1.0, // Yield, RWA, Farm: steady, already-yielding businesses
  infra: 0.95, // Chain, Payments, Prediction Market, Insurance, CeDeFi, other
  bridged: 0.85, // Bridge-like, staking pools, stablecoin wrappers: often a product, not a launch
};

export function categoryGroup(category: string | null): string {
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'lending';
  if (c.includes('dex') || c.includes('derivative') || c.includes('basis') || c.includes('leveraged farm') || c.includes('perpetual')) return 'trading';
  if (c.includes('curator') || c.includes('allocator') || c.includes('aggregator') || c.includes('liquidity manager')) return 'curation';
  if (c.includes('yield') || c.includes('rwa') || c === 'farm' || c.includes('interest rate')) return 'yield';
  if (c.includes('bridge') || c.includes('staking') || c.includes('restak') || c.includes('stablecoin wrapper') || c.includes('anchor btc') || c.includes('decentralized btc')) return 'bridged';
  return 'infra';
}

export function categoryMult(category: string | null): number {
  return CATEGORY_MULT[categoryGroup(category)] ?? 0.95;
}

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

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
  thesis: string | null;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_usd: number;
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    category_group: string;
    category_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_multiplier: number;
  chain_multiplier: number;
  watchlist: boolean;
  thesis: string | null;
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface CategorySummary {
  category: string;
  rows: number;
  median_tvl_usd: number;
  top_slug: string;
  top_name: string;
}

export interface ChainSummary {
  chain: string;
  rows: number;
  total_tvl_usd: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  category_map: CategorySummary[];
  chain_map: ChainSummary[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; catGroup: string; catMult: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  // Maturity is capped at the floor + the full range: a protocol listed
  // before the four-year window earns no more than one listed four years in.
  const maturityMult = Math.min(
    model.maturity_floor + model.maturity_range,
    model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range,
  );
  const catGroup = categoryGroup(protocol.category);
  const catMult = CATEGORY_MULT[catGroup] ?? 0.95;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_cap);
  const chainMult = 1 + extraChains * model.chain_step;
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * catMult * chainMult));
  return { implied, base: Math.round(base), growthPct, growthMult, maturityMult, catGroup, catMult, chainMult, age };
}

/** A name ending in a release marker is a pool of another protocol, not a launch. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Wrapped / staked / bridged products of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Rankable: records no token, not an exchange, not a versioned pool, not a wrapped/staked/bridged product. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (EXCLUDED_CATEGORIES.has(p.category ?? '')) return false;
  if (VERSIONED.test(p.name)) return false;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  // Every watchlist slug, whatever its size: the floor, never the ceiling.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined && isPreToken(p)) chosen.set(slug, p);
  }
  // Every other rankable protocol the snapshot holds, including pre-token
  // protocols at or above the floor that the watchlist leaves out (they are
  // still pre-token launches by the record). No TVL cap on the count.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // Strictly decreasing implied values, so rank 1..N is a real ranking.
  let prev = Number.POSITIVE_INFINITY;
  return scored.map((s, i) => {
    let implied = s.implied;
    if (implied >= prev) implied = prev - 1;
    if (implied < 1) implied = 1;
    prev = implied;
    return {
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
      thesis: snapshot.watchlist.includes(s.p.slug) ? thesisFor(s.p, snapshot.as_of, i + 1, implied) : null,
      age_days: s.age,
      implied_value_usd: implied,
      model: {
        base_usd: s.base,
        base_multiple: model.base_multiple,
        growth_pct: s.growthPct,
        growth_multiplier: round4(s.growthMult),
        maturity_multiplier: round4(s.maturityMult),
        category_group: s.catGroup,
        category_multiplier: s.catMult,
        chain_multiplier: round4(s.chainMult),
        age_days: s.age,
      },
      farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Gas for one transaction on the protocol's first chain, in dollars. */
function gasUsd(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 12;
  if (c === 'bitcoin' || c === 'tron') return 5;
  if (c === 'solana' || c === 'sui' || c === 'aptos') return 1;
  return 2; // L2s and most other chains
}

function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow a small amount against it so both sides of the position are active.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain}, in the pool the protocol's own page lists first.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('aggregator'))
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares for the whole farming window.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis'))
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it the same week.`;
  if (c.includes('rwa'))
    return `Mint $${capital} of ${name}'s yield asset on ${chain} and hold it in the wallet you farm with.`;
  if (c.includes('stable'))
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and keep it in the protocol.`;
  if (c.includes('prediction'))
    return `Fund $${capital} and place one market position on ${name}, on a market that closes within the month.`;
  if (c.includes('insurance'))
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy open for the farming window.`;
  if (c.includes('restak') || c.includes('staking'))
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in your wallet.`;
  if (c.includes('bridge'))
    return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds inside its app.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp')) return `Repay the borrow and re-borrow a different amount once, so the position shows two loan events on ${chain}.`;
  if (c.includes('dex') || c.includes('yield')) return `Swap $${Math.max(10, Math.round(capital / 5))} of one asset for another inside ${name} on ${chain}, once a week.`;
  if (c.includes('curator') || c.includes('allocator')) return `Move $${Math.max(10, Math.round(capital / 5))} between two of ${name}'s vaults on ${chain} once, and keep the larger share where it started.`;
  if (c.includes('rwa') || c.includes('stable')) return `Top up the position by $${Math.max(10, Math.round(capital / 5))} once, so the deposit is not a single event.`;
  return `Use ${name}'s own app on ${chain} once a week — a vote, a claim, a swap or a deposit — and keep the receipts.`;
}

/**
 * Seven farm steps, derived only from the protocol's own record (category,
 * chains, TVL, age). Every step names what it costs and how long it takes.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasUsd(chain);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the $${capital} you plan to farm, and keep its seed phrase offline, never in a screenshot or a chat.`,
      cost: `about $${gas} of gas for the first transaction on ${chain}`,
      time: '5 minutes',
    },
    { text: action, cost: `$${capital} of capital and about $${gas} of gas`, time: '15 minutes to set up' },
    {
      text: second,
      cost: `about $${gas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days, so the activity is counted in more than one snapshot and not as a single deposit.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Check the protocol's own points or rewards page once a week from the link it publishes, and note the points balance in your farm log.`,
      cost: 'no fee to check',
      time: '10 minutes a week',
    },
    {
      text: `Never pay to claim, never connect the wallet to a link from a chat or a search ad, and never approve an unlimited spend unless the protocol's own page asks for it.`,
      cost: 'nothing, and it saves the whole position',
      time: '2 minutes to check each approval',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, then unwind in reverse order — claim first, then withdraw — when you stop farming.`,
      cost: `about $${gas} of gas to exit`,
      time: '15 minutes to unwind',
    },
  ];
}

/** A whole-dollar figure in one short unit, for a sentence, not a table. */
function shortUsd(n: number): string {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n);
}

function growthClause(raw: number | null): string {
  if (raw === null) return 'its seven-day move is unreported';
  if (raw > 0) return 'up ' + raw.toFixed(2) + '% over the last seven days';
  if (raw < 0) return 'down ' + Math.abs(raw).toFixed(2) + '% over the last seven days';
  return 'flat over the last seven days';
}

function ageClause(age: number | null): string {
  if (age === null) return 'an unlisted age';
  if (age >= 365) return 'more than a year with no token on record';
  if (age >= 90) return Math.round(age / 30) + ' months with no token on record';
  return 'only ' + age + ' days with no token on record';
}

/**
 * One-line thesis for a watchlist row: what the protocol does, how big it
 * is, which way it is moving, and why that puts it at its rank. Built only
 * from the snapshot's own figures; the name is never special-cased.
 */
export function thesisFor(p: SnapshotProtocol, asOf: string, rank: number, implied: number): string {
  const kind = p.category === null ? 'protocol' : p.category.toLowerCase() + ' protocol';
  return (
    p.name +
    ' is a ' +
    kind +
    ' holding ' +
    shortUsd(p.tvl_usd) +
    ' of TVL, ' +
    growthClause(p.change_7d) +
    ', and ' +
    ageClause(ageDays(asOf, p.listed_at)) +
    ' — the scale and staying power behind rank ' +
    rank +
    ' and an implied launch value of ' +
    shortUsd(implied) +
    '.'
  );
}

function medianOf(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Per-category map of the ranked board: how many rows each category holds,
 * the median TVL inside it, and the category's top protocol by implied
 * value. Ordered by row count, then by name, so the order is fixed.
 */
export function summarizeCategories(board: BoardRow[]): CategorySummary[] {
  const groups = new Map<string, BoardRow[]>();
  for (const row of board) {
    const key = row.category ?? 'Other';
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  const out = [...groups.entries()].map(([category, rows]) => ({
    category,
    rows: rows.length,
    median_tvl_usd: medianOf(rows.map((r) => r.tvl_usd)),
    top_slug: rows[0]!.slug,
    top_name: rows[0]!.name,
  }));
  out.sort((a, b) => b.rows - a.rows || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  return out;
}

/**
 * Per-chain map of the ranked board: how many rows touch each chain and the
 * TVL they hold between them. A row on three chains counts once per chain.
 * Ordered by total TVL, then by chain name, so the order is fixed.
 */
export function summarizeChains(board: BoardRow[]): ChainSummary[] {
  const totals = new Map<string, { rows: number; tvl: number }>();
  for (const row of board) {
    for (const chain of row.chains.length > 0 ? row.chains : ['Unnamed']) {
      const cur = totals.get(chain) ?? { rows: 0, tvl: 0 };
      cur.rows += 1;
      cur.tvl += row.tvl_usd;
      totals.set(chain, cur);
    }
  }
  const out = [...totals.entries()].map(([chain, v]) => ({ chain, rows: v.rows, total_tvl_usd: v.tvl }));
  out.sort((a, b) => b.total_tvl_usd - a.total_tvl_usd || (a.chain < b.chain ? -1 : a.chain > b.chain ? 1 : 0));
  return out;
}

export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, 24)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function radarRow(row: BoardRow, watchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_usd: row.model.base_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    category_multiplier: row.model.category_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    watchlist,
    thesis: row.thesis,
  };
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
    category_map: summarizeCategories(board),
    chain_map: summarizeChains(board),
  };
  return { board, radar };
}

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

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return `the board repeats a slug: ${board.length - slugs.size} duplicate row${board.length - slugs.size === 1 ? '' : 's'}`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value`;
  }
  for (const r of board) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
