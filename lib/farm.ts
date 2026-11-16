// Farm plans: one concrete plan per protocol, generated from its category,
// its chains and its size — never the same boilerplate twice.
//
// A plan answers three questions for the reader: what do I actually do, what
// does it cost me (gas, capital, fees, in dollars), and how long does it take
// (minutes a day, over how many weeks). The templates below are written per
// category family, and every step is parameterised with the protocol's own
// facts: its name, its primary chain and the gas that chain charges, the
// capital tier its TVL band calls for, and its seven-day growth where the
// snapshot reports it. A launched protocol's plan is about its live token
// (staking, liquidity, governance); a pre-token plan is about earning the
// position — points, volume, liquidity — that a launch typically rewards.

import type { Protocol } from './model.ts';

/** Rough per-transaction gas a chain charges, in dollars, for the plan's cost lines. */
const GAS_USD: Record<string, string> = {
  Ethereum: '$6–20',
  Bitcoin: '$1–5',
  Solana: 'under $0.05',
  Tron: 'under $0.30',
  Avalanche: '$0.10–0.50',
  Fantom: 'under $0.05',
  'zkSync Era': '$0.05–0.25',
  Starknet: '$0.05–0.25',
  'Hyperliquid L1': 'under $0.05',
};

/** Gas wording for a chain: the table above, or the L2 default most chains on a board live on. */
function gasFor(chain: string): string {
  return GAS_USD[chain] ?? '$0.05–0.50';
}

/** The working capital a protocol's TVL band calls for: bigger pools dilute small wallets. */
function capitalFor(tvl: number): string {
  if (tvl >= 1_000_000_000) return '$2,000–10,000';
  if (tvl >= 250_000_000) return '$1,000–5,000';
  if (tvl >= 50_000_000) return '$500–2,500';
  if (tvl >= 10_000_000) return '$250–1,000';
  return '$100–500';
}

/** The category families the templates are written for; anything else takes the generic plan. */
type Family = 'lending' | 'dex' | 'bridge' | 'staking' | 'yield' | 'derivatives' | 'exchange' | 'chain' | 'rwa' | 'generic';

const FAMILIES: Record<string, Family> = {
  Lending: 'lending', 'Uncollateralized Lending': 'lending', CDP: 'lending', 'CDP Manager': 'lending',
  'Collateral Markets': 'lending', 'Collateral Management': 'lending',
  Dexs: 'dex',
  Bridge: 'bridge', 'Cross Chain Bridge': 'bridge', 'Canonical Bridge': 'bridge',
  'Liquid Staking': 'staking', 'Staking Pool': 'staking', Restaking: 'staking', 'Liquid Restaking': 'staking',
  'Restaked BTC': 'staking', 'Anchor BTC': 'staking', 'Decentralized BTC': 'staking',
  Yield: 'yield', 'Yield Aggregator': 'yield', Farm: 'yield', 'Leveraged Farming': 'yield',
  'Liquidity Manager': 'yield', 'Risk Curators': 'yield', 'Onchain Capital Allocator': 'yield', 'Basis Trading': 'yield',
  Derivatives: 'derivatives', Options: 'derivatives', 'Options Vault': 'derivatives',
  'Interest Rate Derivatives': 'derivatives', Synthetics: 'derivatives',
  CEX: 'exchange', CeDeFi: 'exchange',
  Chain: 'chain',
  RWA: 'rwa',
};

interface Ctx {
  name: string;
  chain: string;
  chainList: string;
  chainCount: number;
  gas: string;
  capital: string;
  tvlM: string;
  growth: string;
  symbol: string;
}

function ctx(p: Protocol, status: 'pre-token' | 'launched'): Ctx {
  const chain = p.chains[0] ?? 'Ethereum';
  return {
    name: p.name,
    chain,
    chainList: p.chains.slice(0, 3).join(', ') || chain,
    chainCount: p.chains.length,
    gas: gasFor(chain),
    capital: capitalFor(p.tvl_usd),
    tvlM: `$${(p.tvl_usd / 1_000_000).toFixed(p.tvl_usd >= 100_000_000 ? 0 : 1)}M`,
    growth: p.change_7d === null ? 'flat' : `${p.change_7d > 0 ? 'up' : 'down'} ${Math.abs(p.change_7d).toFixed(1)}% in seven days`,
    symbol: p.symbol ?? 'its token',
  };
}

const PRE: Record<Family, (c: Ctx) => string[]> = {
  lending: (c) => [
    `Open ${c.name} on ${c.chain} and supply ${c.capital} of ETH or a major stablecoin as collateral; at ${c.gas} a transaction on ${c.chain}, the full setup — approve, supply, enable collateral — costs under $25 in gas.`,
    `Borrow 40–55% of your supplied value against the collateral and re-supply the borrowed asset; two or three lend–borrow loops build borrow volume, the metric lending launches usually reward, in about 20 minutes.`,
    `Keep the position's health factor above 1.6 at all times: set a price alert and check the position for 5 minutes a day, topping up collateral before volatility, not after a liquidation warning.`,
    `Hold the looped position for 6–10 weeks rather than days; snapshots for points programmes are rarely announced, and a position opened and closed in one week earns a fraction of a held one.`,
    `Spread a second, smaller position across ${c.chainList} if you farm more than one market of ${c.name}: activity on more than one chain has historically counted separately in points programmes.`,
    `Withdraw in stages once a token or points conversion is announced, repaying borrows first; unstaking under time pressure is how farmers donate their margin to liquidators.`,
  ],
  dex: (c) => [
    `Connect to ${c.name} on ${c.chain} and make your first swaps there: 3–5 swaps of $100–500 each week, at ${c.gas} a transaction, keeps you an active trader for under $10 a month in fees and gas.`,
    `Provide ${c.capital} to the deepest ETH/stablecoin pool on ${c.name}; concentrated ranges earn more fees but need rebalancing twice a week, a full-range position needs almost none.`,
    `Grow volume in tiers rather than in one burst: roughly $1,000 of organic volume a week for 6–8 weeks reads as a real user, where one $50,000 day reads as a farm.`,
    `Use the aggregator or limit-order surface if ${c.name} offers one, not only spot swaps; product breadth is a common second axis in exchange airdrop criteria.`,
    `Claim and re-stake every fee or incentive the pool pays out weekly — five minutes each Friday — so the position compounds instead of idling in the wallet.`,
  ],
  bridge: (c) => [
    `Bridge $500–2,000 to ${c.chain} through ${c.name} and leave the funds working on the far side for at least a month; bridge-and-hold is the behaviour bridge launches reward, not bridge-and-return.`,
    `Repeat with smaller amounts — $100–300 — on a weekly cadence for 6–10 weeks; at ${c.gas} a transfer the whole season costs under $30 in fees, and consistency beats size.`,
    `Route value both ways and across ${c.chainCount > 2 ? `several of its ${c.chainCount} routes (${c.chainList})` : 'both of its routes'}: route diversity is the cheapest signal that you are a user, not a script.`,
    `Park the bridged funds in a lending market or stablecoin vault on the destination chain so the capital earns yield while the bridge activity ages.`,
    `Keep records of your transfer hashes and dates; if a retroactive claim ever opens, it is checked against exactly this history.`,
  ],
  staking: (c) => [
    `Stake ${c.capital} of the base asset through ${c.name} on ${c.chain} and hold the liquid staking receipt in the same wallet; gas for the stake and claim cycle runs about ${c.gas} a transaction.`,
    `Put the receipt token to work in one lending market or liquidity pool that accepts it — the double position (stake plus receipt in use) is what restaking-era points programmes count twice.`,
    `Restake or re-deposit only the rewards each month rather than adding fresh capital; ten minutes a month keeps the position compounding without growing your risk.`,
    `Hold for at least 8–12 weeks and through any announced snapshot window; staking positions unstaked days before a snapshot are the classic way to farm nothing at full cost.`,
    `Track the exit queue before you need it: know whether unstaking from ${c.name} takes hours or weeks, and never let the whole position sit behind a long queue near a deadline.`,
  ],
  yield: (c) => [
    `Deposit ${c.capital} of stablecoins or ETH into the flagship vault of ${c.name} on ${c.chain}; entry and exit together cost about ${c.gas} a transaction, so the position pays for its gas within the first weeks at current yields.`,
    `Split the deposit across two or three of its vaults or curated markets rather than one: curators and allocators weight breadth of use when they design points or retroactive rewards.`,
    `Reinvest the yield monthly instead of withdrawing it — five minutes a month — so both your balance and your time-in-protocol grow on the record.`,
    `Stay for 8–12 weeks minimum; vault share of TVL is ${c.tvlM} here, and short hot-money deposits are the first thing a sane snapshot filters out.`,
    `Read the vault's strategy page once before depositing and once a month after: know whether your yield comes from lending, basis trades or incentives before you size up.`,
  ],
  derivatives: (c) => [
    `Fund a trading account on ${c.name} with $500–2,000 on ${c.chain} and trade small: $200–1,000 notional per position keeps margin safe while building genuine volume history.`,
    `Trade 3–4 days a week for 6–10 weeks, mixing market and limit orders; consistent mid-size volume is the profile derivatives launches reward, at ${c.gas} an order plus exchange fees.`,
    `Keep leverage under 3x and never let one position risk more than 5% of the account: a liquidated farmer earns no airdrop, and the fees on survival are the real cost of this farm.`,
    `Use more than the perpetuals surface if it exists — options, vaults or the spot book — because multi-product users are a standard second criterion.`,
    `Log your weekly volume and fees in a simple sheet, ten minutes a week; if a tiered programme is announced you will know exactly which tier you are in and what the next one costs.`,
  ],
  exchange: (c) => [
    `Complete KYC on ${c.name} and make it a venue you actually use: route your ordinary spot trades through it for 6–10 weeks rather than opening the account and leaving it empty.`,
    `Hold a working balance of $500–2,500 on the exchange and keep average monthly volume above $5,000; balance-plus-volume is the pair of metrics exchange token sales and drops have used before.`,
    `Use two or three of its products — spot, earn/staking, and the card or P2P desk if offered — since product breadth is cheap to show and often a separate reward axis.`,
    `Join its launchpool or rewards hub with the held balance whenever a campaign opens; five minutes to enrol, and idle exchange balances are the most commonly wasted farm in this category.`,
    `Withdraw to your own wallet monthly and re-deposit part of it: regular two-way flow marks the account as a person, not a parked bot, at normal network fees.`,
  ],
  chain: (c) => [
    `Bridge $300–1,500 of ETH or stablecoins onto ${c.name} and make it your home chain for a season: hold the balance there instead of round-tripping it back within the month.`,
    `Be active on 8–12 distinct days a month — a swap, a lend, a mint — across at least five native applications; chain launches count unique active days and app breadth above raw volume.`,
    `Pay gas in the chain's own asset and keep a small reserve of it untouched; at ${c.gas} a transaction, a full season of light use costs under $40.`,
    `Use the chain's flagship DEX, lending market and bridge at least once each in the first two weeks, so your wallet touches the ecosystem's core contracts early.`,
    `Stake or delegate a slice of the bridged funds to a validator if the chain supports it: delegators are the one group every chain genesis drop has rewarded.`,
  ],
  rwa: (c) => [
    `Complete the onboarding and KYC of ${c.name} early — real-world-asset platforms gate deposits behind review that can take days, and late farmers miss snapshot windows entirely.`,
    `Deposit ${c.capital} into its flagship tokenised treasury or credit product on ${c.chain}; at ${c.gas} a transaction the on-chain cost is minor next to the minimums this category usually sets.`,
    `Hold the position through at least two full yield distributions (typically 8–12 weeks) rather than exiting after the first: holding period is the metric RWA programmes can verify on-chain.`,
    `Reinvest each distribution into the same product instead of withdrawing, five minutes per cycle, so your average balance — the usual snapshot figure — keeps rising.`,
    `Keep your KYC documents and deposit confirmations filed together; if a token conversion ever requires proof of account history, you will be the farmer who has it.`,
  ],
  generic: (c) => [
    `Start on ${c.chain}: connect a wallet to ${c.name} and make the core deposit or stake of ${c.capital} that its product is built around; setup takes about 15 minutes and ${c.gas} a transaction in gas.`,
    `Return weekly for 6–10 weeks — claim rewards, re-stake or top up small amounts — because time-in-protocol and visit count are the two signals every points programme records.`,
    `Use a second surface of the product if one exists (a second market, chain or vault among ${c.chainList}); breadth of use is a standard multiplier in retroactive criteria.`,
    `Keep total costs honest and small: this farm should cost under $50 in gas and fees for the season at ${c.chain} prices, plus the opportunity cost of the capital itself.`,
    `Watch its official channels for a points programme or snapshot announcement and be positioned before it, not after: the deposit you make the week of the announcement is worth the least.`,
  ],
};

const LAUNCHED: Record<Family, (c: Ctx) => string[]> = {
  lending: (c) => [
    `${c.symbol} already trades, so the farm here is the token itself: stake or vote-lock ${c.symbol} in ${c.name}'s governance on ${c.chain} if the programme is live — one transaction, about ${c.gas}, then rewards accrue without further work.`,
    `Supply ${c.capital} on ${c.name} as before — lenders still earn the supply yield — and borrow conservatively under a 1.6 health factor while any ${c.symbol} incentive emissions last.`,
    `Provide liquidity for the ${c.symbol} pair on the main ${c.chain} DEX: LP fees plus any gauge rewards, rebalanced monthly in about 15 minutes.`,
    `Vote in its governance at least once a quarter; active voter lists are what later ecosystem drops — from protocols integrating ${c.name} — are built from.`,
  ],
  dex: (c) => [
    `${c.symbol} already trades: the highest-yield farm is its liquidity — provide ${c.capital} to the ${c.symbol} pool on ${c.name} itself and claim the fee share weekly.`,
    `Stake or lock ${c.symbol} in the exchange's revenue-share programme if offered; one deposit, about ${c.gas} in gas, and the yield is the protocol's real fees rather than emissions.`,
    `Keep trading through ${c.name} at your normal size — fee tiers and any remaining volume incentives still reward the users the exchange already has.`,
    `Watch for ${c.symbol} buyback or fee-switch votes: holding through governance decisions, not around them, is what long-term holder snapshots capture.`,
  ],
  bridge: (c) => [
    `${c.symbol} already trades: stake it in ${c.name}'s security or fee-sharing programme if one is live — a single deposit of ${c.capital} in token value, about ${c.gas} in gas.`,
    `Keep bridging through ${c.name} for your real transfers: fee discounts and relayer rewards for token holders have historically been paid to users, not speculators.`,
    `Provide ${c.symbol} liquidity on ${c.chain} so your position earns LP fees while the bridge's volume grows into the token's fee base.`,
    `Review the position quarterly: bridge tokens re-rate on volume, so check that its routed volume is still growing before adding, and trim if two straight quarters shrink.`,
  ],
  staking: (c) => [
    `${c.symbol} already trades: hold the liquid staking position as usual and add the token position — stake or delegate ${c.symbol} where its own staking programme runs, about ${c.gas} a transaction.`,
    `Use the receipt token in one lending market and vote with ${c.symbol} in the same week each month; the combined profile is what partner protocols snapshot for their own drops.`,
    `Claim and compound both reward streams monthly, ten minutes a month, rather than selling them: compounding is the whole point of a staking asset that also has a token.`,
    `Keep the unstake path rehearsed: know the current exit queue length for both the stake and the token lock before you need either, and never let both sit behind long queues at once.`,
  ],
  yield: (c) => [
    `${c.symbol} already trades: stake it for the protocol's revenue share if offered, and keep ${c.capital} in its flagship vault so you earn both the vault yield and the token's.`,
    `Provide ${c.symbol} liquidity on ${c.chain} and stake the LP position in its gauge; rebalanced once a month in about 15 minutes.`,
    `Stay through emissions schedules rather than rotating out at the first dip: vault loyalty and holding duration are both on-chain and both get snapshotted by partners.`,
    `Compare the vault's net yield against its own token's staking yield once a quarter and hold the better side; loyalty is a strategy, not a default.`,
  ],
  derivatives: (c) => [
    `${c.symbol} already trades: stake it for fee rebates on ${c.name} first — the rebate is worth more than the staking yield to anyone who trades weekly.`,
    `Keep your normal trading volume on ${c.name} with leverage under 3x; volume tiers now pay in fee discounts and ${c.symbol} rewards rather than promises.`,
    `Provide to its insurance or vault pool with ${c.capital} if you want the other side of the trade flow, and review the position monthly.`,
    `Withdraw staking rewards on a schedule — monthly, ten minutes — instead of letting them accumulate unclaimed through a full market cycle.`,
  ],
  exchange: (c) => [
    `${c.symbol} already trades: hold the amount its VIP and launchpool tiers require on ${c.name} — the tier benefits and sale allocations are the real farm for an exchange token.`,
    `Enrol every launchpool with your held balance as campaigns open; five minutes each, and allocations scale with the balance you already keep there.`,
    `Route your ordinary trading through ${c.name} to hold your fee tier, reviewing the tier thresholds once a month against your actual volume.`,
    `Keep the account's records — statements, campaign enrolments, tier history — exported quarterly; exchange programmes are the ones most often settled from account history rather than chain data.`,
  ],
  chain: (c) => [
    `${c.symbol} is the chain's own asset and already trades: delegate ${c.capital} of it to a mid-size validator — one transaction, about ${c.gas} — and claim staking rewards monthly.`,
    `Stay active across the chain's native apps as before; ecosystem drops on a launched chain snapshot the same active-day and breadth metrics.`,
    `Hold a slice of ${c.symbol} unstaked for governance votes: chains reward voters in later ecosystem rounds more reliably than passive holders.`,
    `Re-delegate if your validator falls out of the active set or raises commission twice; five minutes to switch, and a jailed validator earns nothing while you decide.`,
  ],
  rwa: (c) => [
    `${c.symbol} already trades: hold it alongside the product position — deposit ${c.capital} into the flagship tokenised product and keep the token in the same wallet that holds the shares.`,
    `Stay through at least two yield distributions so both records — product holder and token holder — cover the same full periods.`,
    `Provide ${c.symbol} liquidity only if a pool with real depth exists on ${c.chain}; thin RWA token pools charge more in slippage than they pay in fees.`,
    `Keep KYC and account records current with the platform; in this category an expired document, not a market move, is the usual reason a payout or conversion stalls.`,
  ],
  generic: (c) => [
    `${c.symbol} already trades: the farm is holding and using it — keep ${c.capital} in the token and use ${c.name}'s product weekly so both records agree.`,
    `Stake ${c.symbol} in any programme the protocol runs, about ${c.gas} a transaction, and claim rewards monthly rather than letting them idle.`,
    `Provide liquidity for the ${c.symbol} pair on ${c.chain} if a real pool exists, sized so a bad week cannot cost you more than the season's expected rewards.`,
    `Vote in its governance at least once a quarter and keep the wallet that holds ${c.symbol} the same one that uses the product: partner snapshots read both records together.`,
  ],
};

/**
 * The farm plan for one protocol: the family template for its category and
 * status, with a growth step added when the snapshot shows real momentum.
 */
export function farmSteps(p: Protocol, status: 'pre-token' | 'launched', signal?: { categoryRank: number; categoryCount: number; peers: number; confidence: 'A' | 'B' | 'C'; lowUsd: number; highUsd: number }): string[] {
  const family = (p.category !== null ? FAMILIES[p.category] : undefined) ?? 'generic';
  const c = ctx(p, status);
  const steps = [...(status === 'launched' ? LAUNCHED[family] : PRE[family])(c)];
  if (status === 'pre-token' && p.change_7d !== null && p.change_7d >= 5) {
    steps.splice(2, 0, `${c.name} is growing — TVL ${c.growth} — so front-load the plan: complete the core position this week, while the protocol is adding users, instead of spreading setup over a month.`);
  }
  if (status === 'pre-token' && p.change_7d !== null && p.change_7d <= -10) {
    steps.push(`TVL is ${c.growth}: size the position at the low end of the ${c.capital} band and add only if outflows stop — farming a shrinking protocol is how budgets die quietly.`);
  }
  if (status === 'pre-token' && p.chains.length >= 8) {
    steps.splice(3, 0, `${c.name} runs on ${p.chains.length} chains: after the home position on ${c.chain} is aged a few weeks, open a small second position on one more of them — multi-chain users are a distinct, cheap-to-earn tier in most points designs.`);
  }
  if (signal) {
    const money = (n: number): string => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
      : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`;
    const band = `${money(signal.lowUsd)}–${money(signal.highUsd)}`;
    const standing = `holds the #${signal.categoryRank} TVL position of ${signal.categoryCount} pre-token ${p.category ?? 'Uncategorized'} protocols, `;
    const source = signal.peers > 0
      ? `is priced from ${signal.peers} launched peers at confidence ${signal.confidence}, and the honest band on its implied value is ${band}`
      : `has no launched peers in its category, so its price comes from the global launched median at confidence ${signal.confidence}, and the honest band on its implied value is ${band}`;
    const signalStep = (context: string) => `Read the radar's own signal before sizing in: ${p.name} ${context}${source} — size this farm to the low end of the band and treat anything above it as upside, not as the plan.`;
    const full = signalStep(standing);
    steps.push(full.length <= 600 ? full : signalStep(''));
  }
  return steps.slice(0, 9);
}
