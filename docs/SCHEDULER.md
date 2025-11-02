# Scheduled release options

You can automate the timelock release at or after 2025-12-30 00:00:00 UTC using either your own server (cron) or GitHub Actions.

## Option A: GitHub Actions (recommended)

A workflow is included at `.github/workflows/timelock-release.yml`.

Configure these repository secrets (Settings → Secrets and variables → Actions → New repository secret):

- `RPC_URL`
- `PROGRAM_ID` (deployed timelock program address)
- `MINT_ADDRESS`
- `DEV_WALLET`
- `PAYER_KEYPAIR_JSON` (JSON array from your Solana keypair, e.g. contents of id.json)

How it works:

- It runs at 00:00 UTC on December 30th every year but exits unless the year is 2025.
- You can also trigger it manually via the “Run workflow” button.
- It writes your keypair to `~/.config/solana/id.json`, installs deps, and calls `npm run timelock:release`.

Note: The program enforces the timestamp on-chain; if this job runs a minute late, it still succeeds and releases.

## Option B: Cron on your own server

Use the provided wrapper `scripts/timelock_release.sh`. This script loads `.env`, optionally checks the timestamp, then runs `npm run timelock:release`.

1) Make it executable:

```bash
chmod +x scripts/timelock_release.sh
```

1) Add a cron entry (runs at 00:00 UTC Dec 30 every year but the script itself also guards by time):

```cron
0 0 30 12 * cd /path/to/myxen-token && ./scripts/timelock_release.sh >> release.log 2>&1
```

Notes:

- Standard cron has no “year” field; keeping it annual is fine because the script checks `RELEASE_AT_ISO` and will no-op when early or in the wrong year.
- If your system uses a different timezone, adjust or use `TZ=UTC` in the crontab.
- Alternative: one-time scheduling with `at` if available: `echo "cd repo && ./scripts/timelock_release.sh" | at -t 202512300000`.
