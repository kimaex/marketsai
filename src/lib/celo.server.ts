// Server-only Celo mainnet helpers. Signs with the agent wallet key from AGENT_PRIVATE_KEY.
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  parseAbi,
  parseUnits,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { CELO_RPC_URL, ERC8004, MENTO_BROKER, MENTO_LOCAL, TOKENS, type LocalCurrency, type PayToken } from "./celo";

export function publicClient() {
  return createPublicClient({ chain: celo, transport: http(CELO_RPC_URL, { timeout: 20_000 }) });
}

export function agentConfigured() {
  const k = process.env["AGENT_PRIVATE_KEY"];
  return !!k && /^(0x)?[0-9a-fA-F]{64}$/.test(k.trim());
}

export function agentAccount() {
  const raw = process.env["AGENT_PRIVATE_KEY"]?.trim();
  if (!raw || !/^(0x)?[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("AGENT_WALLET_NOT_CONFIGURED");
  }
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  return privateKeyToAccount(key);
}

function walletClient() {
  return createWalletClient({ account: agentAccount(), chain: celo, transport: http(CELO_RPC_URL, { timeout: 30_000 }) });
}

export async function getBalances(address: `0x${string}`) {
  const pc = publicClient();
  const [celoBal, ...tokenBals] = await Promise.all([
    pc.getBalance({ address }),
    ...Object.values(TOKENS).map((t) =>
      pc.readContract({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    ),
  ]);
  const tokens = Object.values(TOKENS).map((t, i) => ({
    symbol: t.symbol,
    balance: Number(formatUnits(tokenBals[i] as bigint, t.decimals)),
  }));
  return { celo: Number(formatUnits(celoBal, 18)), tokens };
}

/** Picks native CELO for gas when there is enough, otherwise pays gas in the same stablecoin (Celo fee abstraction). */
async function gasOptions(token: PayToken): Promise<{ feeCurrency?: `0x${string}` }> {
  const pc = publicClient();
  const bal = await pc.getBalance({ address: agentAccount().address });
  if (bal >= parseUnits("0.02", 18)) return {};
  return { feeCurrency: TOKENS[token].feeCurrency };
}

export async function sendStablecoin(token: PayToken, to: `0x${string}`, amount: number) {
  const t = TOKENS[token];
  const value = parseUnits(amount.toFixed(t.decimals > 6 ? 6 : t.decimals), t.decimals);
  const pc = publicClient();
  const from = agentAccount().address;
  const bal = await pc.readContract({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [from] });
  if (bal < value) {
    throw new Error(`INSUFFICIENT_BALANCE: agent wallet has ${formatUnits(bal, t.decimals)} ${token}, needs ${amount}`);
  }
  const wc = walletClient();
  const gas = await gasOptions(token);
  const hash = await wc.sendTransaction({
    to: t.address,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, value] }),
    ...gas,
  });
  return { hash, value: value.toString() };
}

export async function waitForTx(hash: Hex) {
  const receipt = await publicClient().waitForTransactionReceipt({ hash, timeout: 60_000 });
  return receipt;
}

// ---------------- Mento onchain FX ----------------
const brokerAbi = parseAbi([
  "function getExchangeProviders() view returns (address[])",
  "function getAmountOut(address exchangeProvider, bytes32 exchangeId, address tokenIn, address tokenOut, uint256 amountIn) view returns (uint256)",
]);
const providerAbi = parseAbi([
  "struct Exchange { bytes32 exchangeId; address[] assets; }",
  "function getExchanges() view returns (Exchange[])",
]);

/** Quotes 1 USDm -> local Mento stablecoin via the Mento Broker. Exchanges are discovered onchain, never hardcoded. */
export async function mentoQuotes(currencies: LocalCurrency[] = ["NGN", "KES", "GHS", "ZAR"]) {
  const pc = publicClient();
  const providers = await pc.readContract({ address: MENTO_BROKER, abi: brokerAbi, functionName: "getExchangeProviders" });
  const usdm = TOKENS.USDm.address.toLowerCase();
  const out: Record<string, { rate: number; exchangeId: string; token: string } | null> = {};
  for (const c of currencies) out[c] = null;
  for (const p of providers) {
    const exchanges = await pc.readContract({ address: p, abi: providerAbi, functionName: "getExchanges" });
    for (const ex of exchanges) {
      const assets = ex.assets.map((a) => a.toLowerCase());
      if (!assets.includes(usdm)) continue;
      for (const c of currencies) {
        const local = MENTO_LOCAL[c].address.toLowerCase();
        if (out[c] || !assets.includes(local)) continue;
        try {
          const amt = await pc.readContract({
            address: MENTO_BROKER,
            abi: brokerAbi,
            functionName: "getAmountOut",
            args: [p, ex.exchangeId, TOKENS.USDm.address, MENTO_LOCAL[c].address, parseUnits("1", 18)],
          });
          out[c] = { rate: Number(formatUnits(amt, 18)), exchangeId: ex.exchangeId, token: MENTO_LOCAL[c].symbol };
        } catch (e) {
          console.error("mento quote failed", c, e);
        }
      }
    }
  }
  return out;
}

/** Off-chain reference rates (open.er-api.com, free, no key). Shown alongside the onchain quote. */
export async function referenceRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { rates?: Record<string, number>; time_last_update_utc?: string };
    if (!j.rates) return null;
    return {
      NGN: j.rates["NGN"] ?? null,
      KES: j.rates["KES"] ?? null,
      GHS: j.rates["GHS"] ?? null,
      ZAR: j.rates["ZAR"] ?? null,
      updated: j.time_last_update_utc ?? null,
    };
  } catch {
    return null;
  }
}

/** NGN per USD used for pricing orders: Mento onchain first, reference rate as fallback. */
export async function ngnPerUsd(): Promise<{ rate: number; source: string }> {
  try {
    const q = await mentoQuotes(["NGN"]);
    if (q["NGN"]?.rate) return { rate: q["NGN"].rate, source: "Mento onchain (USDm→NGNm)" };
  } catch (e) {
    console.error("mento NGN failed", e);
  }
  const ref = await referenceRates();
  if (ref?.NGN) return { rate: ref.NGN, source: "open.er-api.com reference rate" };
  throw new Error("FX_UNAVAILABLE");
}

// ---------------- ERC-8004 identity ----------------
const identityAbi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

export async function registerAgentIdentity(agentURI: string) {
  const wc = walletClient();
  const gas = await gasOptions("USDC");
  const hash = await wc.sendTransaction({
    to: ERC8004.identityRegistry,
    data: encodeFunctionData({ abi: identityAbi, functionName: "register", args: [agentURI] }),
    ...gas,
  });
  const receipt = await waitForTx(hash);
  if (receipt.status !== "success") throw new Error(`Registration reverted: ${hash}`);
  let agentId: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ERC8004.identityRegistry.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: identityAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "Registered") agentId = ev.args.agentId.toString();
    } catch {
      /* other events */
    }
  }
  if (!agentId) throw new Error(`Registered event not found in ${hash}`);
  return { agentId, hash };
}
