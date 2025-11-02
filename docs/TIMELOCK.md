# Timelock vault for the 600M allocation

Goal: enforce a fixed supply (mint authority revoked) while preventing misuse and releasing 600M to the dev wallet only on 2025-12-30 00:00:00 UTC.

This is implemented with a small on-chain program that:

- Owns a PDA authority for a vault token account
- Holds the 600M tokens in that vault
- After the unlock time, anyone can call `release` to transfer all vault tokens to the dev wallet
- Early release is impossible on-chain; after release, it cannot be called again

Important: Solana does not run tasks by itself; a transaction must be sent to trigger the release. You can schedule a simple cron/bot to call `npm run timelock:release` at the unlock time. Even if nobody calls at exactly that second, calling later will still succeed; the program enforces the time check.

## Build and deploy the program

Prereqs: Anchor CLI, Rust toolchain, Solana CLI.

1. Update the program ID
   - Generate a new keypair for the program and replace the placeholder in `Anchor.toml` and `programs/timelock_vault/src/lib.rs` using `declare_id!("...")`.

1. Build and deploy (example commands)

```bash
anchor build
anchor deploy
```

1. Set `PROGRAM_ID` in your `.env` to the deployed address.

## Initialize and lock funds

- Ensure your payer wallet holds the minted tokens (you can mint full 1B to the payer ATA first).
- Set `.env` variables: `MINT_ADDRESS`, `DEV_WALLET`, `PROGRAM_ID`, `RELEASE_AT_ISO`.

Then run one of the following flows:

Option A: One-step allocate and lock

```bash
npm run allocate:dev+lock
```

- Sends 400M to the dev wallet immediately
- Initializes the timelock state
- Deposits 600M into the vault

Option B: Manual steps

```bash
npm run timelock:init
# This initializes state and creates the vault ATA
# Then deposit tokens into the vault (done automatically by allocate:dev+lock)
```

## Schedule automatic release

Create a cronjob or a scheduled runner to execute after the unlock time:

```bash
npm run timelock:release
```

If run before the timestamp, the program will reject; after, it will transfer all vault tokens to the dev wallet and mark as released.

## Safety properties

- Fixed supply: You can revoke the mint authority immediately after minting the full 1B supply.
- No misuse: The 600M portion is in a program-controlled vault; neither you nor anyone else can spend it early.
- Trustless release: Anyone can trigger the release after the timestamp; no multisig or manual confirmation is required.

## Scheduling the release

See `docs/SCHEDULER.md` for two options: a prewired GitHub Actions workflow that runs at the target time, and a local cron wrapper script.
