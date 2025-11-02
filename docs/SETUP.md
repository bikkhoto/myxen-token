# Create the token on Solana (fixed supply 1B)

This guide shows how to create a fixed-supply SPL token on Solana and revoke the mint authority so the supply can never increase.

Assumptions (configurable via `.env`):

- Decimals: 9 (standard for SPL)
- Fixed supply: 1,000,000,000 whole tokens (1B)
- Mint authority: revoked immediately after minting the initial supply
- Optional: revoke freeze authority for full trustlessness

## 1) Prerequisites

- Node.js 18+
- A funded Solana keypair (Devnet for testing or Mainnet for production)
- RPC URL for the target cluster

Optional: Install Solana CLI to create/fund a keypair if needed.

## 2) Install dependencies

```bash
npm install
```

## 3) Configure

Copy `.env.example` to `.env` and set values:

- `RPC_URL` – e.g., `https://api.devnet.solana.com` (Devnet) or a Mainnet RPC
- `PAYER_KEYPAIR` – path to your keypair JSON (e.g., `~/.config/solana/id.json`)
- `DESTINATION_OWNER` – wallet to receive the initial supply (defaults to payer)
- `MINT_DECIMALS` – default `9`
- `INITIAL_SUPPLY` – default `1000000000` (1B)
- `REVOKE_FREEZE_AUTHORITY` – set to `true` if you also want to revoke the freeze authority

## 4) Create the token (and revoke mint authority)

```bash
npm run create
```

This will:

1. Create the mint
2. Create your associated token account (ATA)
3. Mint the full fixed supply to the destination wallet
4. Revoke the mint authority (and optionally freeze authority)

The script prints the Mint address, supply, and authorities at the end. Save the Mint address.

## 5) Verify the token

```bash
# Replace <MINT> with the address printed above
npm run verify -- <MINT>
```

You should see:

- Mint authority: null (revoked)
- Supply: 1,000,000,000 (with 9 decimals, base units are 1e9 times larger)

## Optional: Quick offline check

```bash
npm run calc:test
```

This just prints the base-unit amount for the configured decimals and supply.

## Alternative (SPL Token CLI)

If you prefer the CLI route, you can achieve the same with `spl-token`:

1. Create mint (decimals 9):
   - spl-token create-token --decimals 9
2. Create ATA for your wallet:
   - spl-token create-account `MINT`
3. Mint 1B tokens:
   - spl-token mint `MINT` 1000000000
4. Revoke mint authority:
   - spl-token authorize `MINT` mint --disable
5. (Optional) Revoke freeze authority:
   - spl-token authorize `MINT` freeze --disable

Note: The CLI commands are illustrative; adapt to your setup and cluster.
