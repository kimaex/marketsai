# Marketsai

BUILD MARKETMATE AI — AUTONOMOUS AFRICAN BUSINESS PROCUREMENT AGENT

Build a production-quality AI agent called MarketMate AI, designed for African small businesses, wholesalers, retailers and entrepreneurs.

Mission

MarketMate AI is an autonomous procurement agent that helps African businesses find suppliers, compare prices, purchase products, make payments and track deliveries.

The objective is to demonstrate an AI agent performing a real economic task using Celo blockchain infrastructure.

Target markets

- Nigeria
- Ghana
- Kenya
- South Africa
- Other African markets

Start with Nigeria as the primary market.

Core features

1. AI Procurement Assistant

Allow users to communicate with the agent naturally.

Example:
"I need 50 bags of rice for my supermarket. Find reliable suppliers offering the best prices."

The AI should:

- Understand the shopping request.
- Search supplier listings and available APIs.
- Compare product prices.
- Calculate delivery costs.
- Rank suppliers by price, reliability and delivery time.
- Recommend the best purchase.

2. Supplier Marketplace

Build a supplier dashboard where verified suppliers can:

- Register their businesses.
- List products.
- Set prices.
- Update inventory.
- Receive purchase orders.
- Confirm orders.
- Update delivery status.

3. Autonomous Payments on Celo

Integrate Celo mainnet.

Use:

- x402 for paying APIs and services per request.
- Supported dollar stablecoins for payments.
- Onchain currency conversion where supported.
- ERC-8004 for agent identity and reputation.
- Agent-controlled wallet with owner-defined spending permissions.

All payments must be real, verifiable on Celo mainnet.

4. Spending Controls

Allow business owners to configure:

- Maximum payment per transaction.
- Daily spending limit.
- Approved suppliers.
- Approved payment tokens.
- Transactions requiring human approval.

Never allow the agent to exceed its spending permissions.

Require explicit approval before purchasing goods or sending funds unless the owner has enabled a specific autonomous purchasing rule.

5. Order Management

Create an order management dashboard showing:

- Pending orders.
- Approved purchases.
- Completed purchases.
- Payment status.
- Supplier details.
- Delivery status.
- Transaction hashes.

6. African Market Intelligence

Build an AI feature that provides:

- Product price comparisons.
- Supplier recommendations.
- Market price trends.
- Currency conversion.
- Purchase recommendations.
- Potential cost savings.

Never invent supplier prices or claim a supplier is verified without evidence.

7. User Dashboard

Create a modern dashboard with:

- Business wallet balance.
- Total purchases.
- Money saved.
- Active orders.
- Supplier performance.
- Recent blockchain transactions.
- AI procurement chat.

Technology requirements

- Frontend: React and responsive web design.
- Backend: Node.js.
- Database: PostgreSQL or Supabase.
- AI: LLM-powered procurement assistant.
- Blockchain: Celo mainnet.
- Payments: x402.
- Agent identity: ERC-8004.
- Wallet: Owner-custodied or delegated agent wallet with strict permissions.

Use official Celo-compatible integrations and verify supported tokens, payment endpoints and contract addresses before implementation.

Hackathon demonstration

Demonstrate the following complete workflow:

1. A Nigerian supermarket owner logs in.
2. The owner requests 20 bags of rice.
3. MarketMate searches real supplier listings.
4. The agent compares supplier prices.
5. The agent recommends the best supplier.
6. The owner approves the purchase.
7. The agent executes a real Celo mainnet payment.
8. The blockchain transaction is displayed.
9. The supplier confirms the order.
10. The agent tracks and updates the order.

Include transaction explorer links and verifiable onchain activity.

Design

Create a premium fintech-style interface.

Brand: MarketMate AI.

Tagline: "Your Business. Your Agent. Your Market."

Use a clean, modern African fintech design with:

- Dark navy and green accents.
- Professional dashboard.
- Mobile-first responsive interface.
- AI chat interface.
- Supplier marketplace.
- Transaction history.

Final objective

Do not build just a chatbot or a static dashboard.

Build a functioning autonomous business procurement agent that completes a real job, makes an authorized payment on Celo mainnet, and demonstrates measurable value to African businesses.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/66b6e78a-11f4-47cf-a98c-86362cb08465).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
