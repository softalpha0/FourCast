---
name: fourcast
description: Real-time bonding curve intelligence for Four.meme — scores active curves, identifies graduation candidates, and executes buys via the TEE wallet.
---

# FourCast Skill

FourCast monitors every active bonding curve on Four.meme (BNB Chain), scores them by momentum and graduation probability, and surfaces the highest-conviction opportunities. It can also execute buys directly through the TEE wallet using `purr fourmeme buy`.

## Tools

### Get Top Opportunities
Fetches the highest-scored active bonding curves ranked by graduation probability.

**When to use:** User asks "what are the top opportunities", "which tokens are trending on Four.meme", "show me the best bonding curves", or any variation of finding high-potential tokens.

**How to invoke:**
```
curl https://fourcast-production.up.railway.app/curves/top?limit=5
```

Returns: ranked list of tokens with score (0–100), fill %, velocity (BNB/hr), graduation probability, and estimated time to graduation.

---

### Analyze a Token
Deep analysis of a specific bonding curve by token address.

**When to use:** User provides a token address and wants a detailed breakdown, or after getting top opportunities and wanting to drill into a specific token.

**How to invoke:**
```
curl https://fourcast-production.up.railway.app/curves/<TOKEN_ADDRESS>
```

Returns: score breakdown (Fill, Velocity, Age, Activity, Oracle, Hot), fill %, funds accumulated, purchase count, estimated graduation ETA, and recommended position size in BNB.

---

### Get Market Summary
Overview of the entire Four.meme market — active curves, graduated tokens, open positions, LP oracle yield.

**When to use:** User asks "how is the market", "give me a summary", "what's happening on Four.meme right now".

**How to invoke:**
```
curl https://fourcast-production.up.railway.app/status
curl https://fourcast-production.up.railway.app/oracle/stats
```

Returns: active curve count, graduated count, last indexed block, uptime, and median LP yield APY from graduated tokens.

---

### Get Buy Quote
Estimate how many tokens you receive for a given BNB amount before executing.

**When to use:** User wants to know what they'd get before buying, or to confirm a trade before execution.

**How to invoke:**
```
curl "https://fourcast-production.up.railway.app/trade/quote/buy?token=<TOKEN_ADDRESS>&bnb=<AMOUNT>"
```

Returns: estimated token amount, fee, and total BNB required.

---

### Buy a Token (On-Chain Execution)
Execute a buy on Four.meme using the TEE wallet.

**When to use:** User explicitly says "buy", "execute", "open a position", or confirms after seeing a quote. Always show the quote first and ask for confirmation before executing.

**How to invoke:**
```
purr fourmeme buy --token <TOKEN_ADDRESS> --amount <BNB_AMOUNT> --execute
```

Uses the TEE wallet — no seed phrase or private key required. Executes directly on BNB Chain via the Four.meme bonding curve contract.

**Safety rules:**
- Always fetch a quote first with the Get Buy Quote tool
- Confirm with the user before executing
- Default position size: 0.05 BNB unless user specifies otherwise
- Never execute if graduation probability is below 30%

---

### Get Graduated Tokens (LP Yield)
List tokens that have graduated from the bonding curve and now have locked PancakeSwap V2 LP positions.

**When to use:** User asks about graduated tokens, LP yield, or tokens that have already listed.

**How to invoke:**
```
curl https://fourcast-production.up.railway.app/graduated
```

Returns: list of graduated tokens with PancakeSwap pair address, BNB reserve, graduation block, and final fill %.

---

## Execution Flow

For a full buy workflow:
1. Call Get Top Opportunities to find best candidates
2. Call Analyze a Token on the top result for confirmation
3. Call Get Buy Quote with the desired BNB amount
4. Present the quote to the user and ask for confirmation
5. Execute with `purr fourmeme buy --token <address> --amount <bnb> --execute`

## Context

- Chain: BNB Chain Mainnet (Chain ID 56)
- DEX: PancakeSwap V2
- Graduation threshold: 18 BNB
- Scoring model: Fill(25) + Velocity(25) + Age(15) + Activity(15) + Oracle(20) + Hot bonus(5)
- API base: `https://fourcast-production.up.railway.app`
