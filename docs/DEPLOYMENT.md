# Deployment workflows

This repo includes two GitHub Actions workflows to streamline mainnet operations.

## Deploy Timelock Program (one-off)

Workflow: `.github/workflows/deploy-program.yml`

Secrets required:

- `RPC_URL` – mainnet RPC URL
- `ANCHOR_WALLET_JSON` – JSON of the wallet that will own the program upgrade authority
- `PROGRAM_KEYPAIR_JSON` – JSON of the program keypair (its public key must match the input `program_id`)

Usage:

1. Actions → Deploy Timelock Program → Run workflow

1. Inputs:

- program_id: the program public key (must match PROGRAM_KEYPAIR_JSON)
- confirm: YES

1. The job patches Program ID into `programs/timelock_vault/src/lib.rs` and `Anchor.toml`, builds, and deploys to mainnet.

## Mint and Lock (one-off)

Workflow: `.github/workflows/mint-and-lock.yml`

Secrets required:

- `RPC_URL` – mainnet RPC URL
- `PROGRAM_ID` – deployed timelock program ID
- `DEV_WALLET` – dev wallet that should receive the 400M and the 600M on release
- `PAYER_KEYPAIR_JSON` – JSON of payer keypair to mint and transfer
- Optional metadata secrets:
  - `METADATA_NAME`, `METADATA_SYMBOL`, `METADATA_URI`, `METADATA_UPDATE_AUTHORITY_PUBKEY`

Inputs (override secrets if provided):

- metadata_name, metadata_symbol, metadata_uri, metadata_update_authority_pubkey

What it does:

- Writes `.env` for the run, minting 1B to DEV_WALLET and setting metadata if provided
- Runs `npm run create` to mint and revoke authorities
- Locks 600M in the timelock vault with release at 2025-12-30 00:00:00 UTC
- Verifies before/after

## Scheduled release

Workflow: `.github/workflows/timelock-release.yml`

Secrets required:

- `RPC_URL`, `PROGRAM_ID`, `MINT_ADDRESS`, `DEV_WALLET`, `PAYER_KEYPAIR_JSON`

It runs at 00:00 UTC on Dec 30, 2025 and calls `npm run timelock:release`. The program enforces the timestamp; late runs still succeed.
