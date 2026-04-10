# FourCast

**Full-lifecycle DeFi intelligence agent for Four.meme bonding curves on BNB Chain.**

FourCast watches every active bonding curve on Four.meme in real time, scores them using a multi-factor model, routes capital to the highest-conviction graduation candidates, tracks positions through graduation onto PancakeSwap V2, and measures the permanently locked LP yield. An AI agent powered by Llama 3.3 70B lets you query all of this in natural language.

---

## What it does

### Primitive 1 — Bonding Curve Capital Router

FourCast bootstraps on startup by scanning the last 600 blocks (~30 minutes) of `TokenPurchase` events on the Four.meme proxy contract, then polls every 5 seconds to stay current. Every active curve is scored 0–100 using six weighted signals:

| Signal | Weight | What it measures |
|---|---|---|
| Fill % | 25 pts | Sweet spot is 30–75% filled — early enough for upside, late enough to confirm demand |
| Velocity | 25 pts | BNB/hr accumulation rate — curves filling in <2h score highest |
| Age | 15 pts | Fresh curves signal live demand; old slow curves signal stalled momentum |
| Activity | 15 pts | Purchase count distinguishes organic from bot-driven volume |
| Oracle | 20 pts | Historical LP yield from previously graduated tokens feeds back into scoring |
| Hot bonus | 5 pts | Four.meme's own hot rankings as an external confirmation signal |

### Primitive 2 — Graduation Position Manager

When a curve scores above threshold, FourCast opens a position using `TokenManagerHelper3.tryBuy` for on-chain pre-trade validation before any real execution. Positions are tracked through the full lifecycle:

```
open_curve → (PairCreated detected) → open_pancake → closed_profit / closed_loss / closed_rug
```

- Entry on the bonding curve via `buyTokenAMAP`
- Graduation detection via `PairCreated` events on PancakeSwap V2
- Configurable post-graduation hold period
- Rug detection via reserve monitoring
- Exit via `sellToken` back to the curve, or PancakeSwap V2 router post-graduation
- Full paper trading mode — simulates everything without real transactions

### Primitive 3 — Locked LP Yield Oracle

When Four.meme graduates a token, all LP tokens are burned — permanently locking liquidity that generates 0.17% swap fees forever with zero counterparty risk. FourCast tracks every graduated token's PancakeSwap V2 pair, monitors `Swap` events to calculate 24h volume, computes annualized yield on the burned LP value, and feeds this back into the scorer as the oracle signal.

### AI Agent — Llama 3.3 70B via Groq

A natural language interface with an agentic loop: the LLM decides which tools to call, chains multiple calls when needed, and synthesizes findings into a single response.

Available tools: `getTopOpportunities`, `analyzeToken`, `getMarketSummary`, `getPositions`, `getBuyQuote`, `getSellQuote`, `openTrade`, `closePosition`

Example:
> **You:** "Which token is most likely to graduate in the next hour?"
>
> Agent calls `getTopOpportunities` → finds high-velocity candidates → calls `analyzeToken` on the top result → **"PEPPER at 77% fill with 14.4 BNB/hr velocity is on track to graduate in ~23 minutes. Score 82/100. Recommended position: 0.042 BNB."**

---

## Four.meme Agentic Skill

FourCast is built on the official [`@four-meme/four-meme-ai`](https://www.npmjs.com/package/@four-meme/four-meme-ai) npm package — Four.meme's agentic skill layer that exposes on-chain capabilities as programmable tools. FourCast integrates five of these skills directly into its core pipeline:

| Skill | How FourCast uses it |
|---|---|
| **Rankings** | `getHotRankings()` fetches the live HOT ranking every 60s, injecting the hot bonus signal (5 pts) into every curve's score |
| **Buy/sell quotes** | `quoteBuy()` calls `TokenManagerHelper3.tryBuy` on-chain before every entry — validating real price, fee, and slippage before capital is committed |
| **Execute buy/sell** | `buyTokenAMAP` and `sellToken` on the Four.meme proxy are called by the executor for live on-chain entries and exits |
| **On-chain events** | `TokenPurchase` events from the Four.meme proxy are the primary data source — every buy is indexed in real time to build fill%, velocity, and activity signals |
| **Token info** | `TokenManagerHelper3.getTokenInfo` returns live offers, funds, price, and graduation status for each tracked token |

The AI agent layer (Llama 3.3 70B via Groq) exposes these same capabilities as natural language tools — so you can ask *"get a buy quote for 0.05 BNB on this token"* and the agent calls `quoteBuy` on-chain and returns the real estimate.

---

## Architecture

```
BSC Chain (getLogs polling every 5s)
        │
        ▼
   Indexer (src/indexer.ts)
   TokenPurchase events → CurveState
   PairCreated events → GraduatedToken
        │
        ▼
   Store (src/store.ts)              ← in-memory state, all Maps
   curves · graduates · scores
   positions · lpYields · metadata
        │
   ┌────┴─────┐
   ▼          ▼
Scorer     Oracle
(30s)     (15min)
   │          │
   └────┬─────┘
        ▼
  Position Manager (src/positions.ts)
        │
        ▼
  REST API (src/api.ts — port 3000)
  ├── /curves, /positions, /oracle
  ├── /trade/quote/buy|sell
  ├── /agent/chat          ← Groq agentic loop
  └── /agent/tool/:name    ← OpenServ proxy
        │
        ▼
  Next.js Dashboard (frontend/ — port 3001)
  CurvesTable · PositionsPanel · OraclePanel · AgentPanel
```


## Tech Stack

**Backend:** Node.js 22, TypeScript, Express 5, viem
**Frontend:** Next.js 14, Tailwind CSS
**AI:** Groq API (Llama 3.3 70B)
**Chain:** BNB Smart Chain Mainnet
**DEX:** PancakeSwap V2

---

## License

MIT
