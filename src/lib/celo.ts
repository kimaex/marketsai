// Celo mainnet constants. Verified against docs.celo.org and docs.mento.org; decimals read onchain.
export const CELO_CHAIN_ID = 42220;
export const CELO_NETWORK_CAIP = "eip155:42220";
export const CELO_RPC_URL = "https://forno.celo.org";
export const EXPLORER_BASE = "https://celoscan.io";

export type PayToken = "USDC" | "USDT" | "USDm";

export const TOKENS: Record<
  PayToken,
  { symbol: PayToken; name: string; address: `0x${string}`; decimals: number; feeCurrency: `0x${string}` }
> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin (Circle native)",
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    decimals: 6,
    feeCurrency: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    decimals: 6,
    feeCurrency: "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72",
  },
  USDm: {
    symbol: "USDm",
    name: "Mento Dollar (formerly cUSD)",
    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    decimals: 18,
    feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  },
};

export const PAY_TOKENS: PayToken[] = ["USDC", "USDT", "USDm"];

// Mento local-currency stablecoins used for onchain FX quotes against USDm.
export const MENTO_LOCAL = {
  NGN: { symbol: "NGNm", address: "0xE2702Bd97ee33c88c8f6f92DA3B733608aa76F71" as `0x${string}` },
  KES: { symbol: "KESm", address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0" as `0x${string}` },
  GHS: { symbol: "GHSm", address: "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313" as `0x${string}` },
  ZAR: { symbol: "ZARm", address: "0x4c35853A3B4e647fD266f4de678dCc8fEC410BF6" as `0x${string}` },
} as const;
export type LocalCurrency = keyof typeof MENTO_LOCAL;

export const MENTO_BROKER = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as const;

export const ERC8004 = {
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as `0x${string}`,
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as `0x${string}`,
};

export const X402_FACILITATOR_URL = "https://api.x402.celo.org";

export const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_BASE}/address/${address}`;
export const agentNftUrl = (agentId: string) =>
  `${EXPLORER_BASE}/nft/${ERC8004.identityRegistry}/${agentId}`;

export const shortHash = (h: string, n = 6) => (h.length > 2 * n + 2 ? `${h.slice(0, n + 2)}…${h.slice(-n)}` : h);

export const isEvmAddress = (v: string | null | undefined): v is `0x${string}` =>
  !!v && /^0x[0-9a-fA-F]{40}$/.test(v);
