# Compliance and risk controls without harming exchange listings

Your base token is a standard SPL mint with fixed supply and no admin controls (mint and freeze authorities revoked). That’s ideal for exchange friendliness. If you also want to prevent suspicious or sanctioned actors from using the token in your products, there are two paths that preserve the clean base token while adding controls for payments.

## Approach A (recommended): App-level compliant wrapper for payments

- Keep base token (MYXN) simple and non-censorable. This is the asset that gets listed on exchanges and traded freely.
- For your own payment rails, require users to deposit MYXN into a program vault and receive a compliant receipt token (e.g., cMYXN) in return.
- cMYXN is a Token-2022 mint with a Transfer Hook that calls a compliance program on every transfer to enforce rules:
  - Blocklist/allowlist checks (OFAC-style, LE requests, internal risk scores)
  - Jurisdiction rules (country-based controls if needed)
  - Velocity/amount checks (optional)
- Users spend cMYXN inside your apps/merchants. They can redeem cMYXN back to MYXN at any time (subject to policy, e.g., not to a blocked wallet).

Benefits:

- Base token remains listing-friendly (no central controls).
- Your commerce layer enforces compliance. Exchanges can list MYXN normally.
- You can update rules over time via on-chain registry governance (multisig + timelock), and all changes are transparent.

Implementation outline:

- Program 1: cMYXN mint (Token-2022) with Transfer Hook extension.
- Program 2: Compliance Hook Program (invoked on every cMYXN transfer). It reads:
  - A blocklist/allowlist registry PDA
  - Policy settings (e.g., freeze-high-risk)
- Program 3: Wrapper/Vault (deposit MYXN → mint cMYXN; redeem cMYXN → withdraw MYXN), with hooks to refuse withdrawals to blocked addresses.

Governance and ops:

- On-chain registry managed by a multisig; updates are time-delayed (timelock) and logged for transparency.
- Integrate off-chain intel providers by periodically committing their lists on-chain via signed updates (oracles, or your backend posting digests); the on-chain program only reads on-chain lists.

Limitations:

- Direct MYXN transfers on-chain remain free (by design). Compliance applies to the payment experience (cMYXN flows), not the base token.

## Governance plan (what this is and how we’ll set it up)

Governance is how changes to the compliance rules happen. In our wrapper design, governance controls ONLY the cMYXN layer (registry entries and policy switches), never the base MYXN mint.

- What it is:
  - An on-chain multisig that owns the Registry PDA and Policy PDA. Any change (add/remove a blocked key, flip a policy flag) must be proposed, queued, and executed by this multisig.
  - A timelock enforces a delay between approval and execution so the community and exchanges can see changes before they take effect.
  - All actions are transparent via on-chain events and state diffs.

- Suggested composition (exchange-friendly, operationally safe):
  - 3-of-5 threshold multisig.
  - Members:
    - Founder cold wallet (hardware, long-term)
    - Co-founder/CTO cold wallet
    - Security lead hardware wallet
    - Legal/compliance controlled wallet (firm custody or dedicated HSM)
    - Independent advisor/DAO rep for neutrality
  - Rotation: keys can be rotated via a governed action with the same timelock.

- Timelock duration: recommended 24 hours
  - Trade-offs: Shorter (<12h) can feel “too centralized”; longer (>48h) slows legitimate responses.
  - Emergency path: allow a narrowly-scoped emergency action with a shorter delay (e.g., 6h) ONLY to add a temporary block entry with auto-expiry. No other powers (no sweeping freezes).

- What exactly is “queued” and “executed”:
  - queued: proposal includes the instruction data (e.g., AddBlocked { subject, reason_code, evidence_hash }). It emits an event and sets an ETA = now + delay.
  - executed: after ETA and before expiry, anyone can trigger execute() to apply the change on-chain; event emitted.
  - canceled: before ETA, the same multisig (or a higher threshold, e.g., 4-of-5) can cancel.

This governance applies only to cMYXN compliance. MYXN remains immutable with mint/freeze authorities revoked, preserving listing friendliness.

## Approach B: Token-2022 for the base token (not recommended for listing)

- You could reissue the base token as Token-2022 with a Transfer Hook and enforce compliance on every transfer.
- This introduces centralization risk and will likely raise red flags with some exchanges and users.
- Migration of supply/liquidity is non-trivial.

We advise against this for your main listing asset, but you can consider it for private networks or internal tokens.

## Addressing "FBI/darknet/restricted" concerns

- Maintain an on-chain blocklist registry of public keys flagged by your risk/compliance team, updated via multisig after legal review. Entries store: pubkey, reason code, evidence hash, timestamp.
- The compliance hook denies cMYXN transfers to/from keys on the list.
- For emergency cases, allow a time-bound emergency pause only for cMYXN (not MYXN). Subject to tight governance and audit logs.

## Initial policy direction (what options mean and what we recommend)

Policy defines what the Transfer Hook enforces. Two common models:

- Blocklist-only (recommended as default)
  - Transfers are allowed by default; they fail only if sender or receiver is on the blocklist.
  - Pros: Listing-friendly, minimal friction; users can transact unless specifically flagged.
  - Cons: Requires good intel to keep the list fresh; may allow risky flows until flagged.

- Allowlist-first (selective)
  - Transfers are allowed only if sender and/or receiver is on an allowlist (depending on the flow). Everyone else is blocked by default.
  - Pros: Maximum control for sensitive rails (e.g., fiat off-ramps, regulated merchants).
  - Cons: “Censorish” for general use; can harm user experience and listings if used broadly.

Recommended starting stance for cMYXN:

- General cMYXN transfers: Blocklist-only
- Wrap (MYXN -> cMYXN): Allowed unless depositor is blocklisted
- Unwrap (cMYXN -> MYXN): Allowed only to non-blocklisted addresses; in phase 2, optionally allowlist-only for specific off-ramps
- Merchant settlement (optional future): Allowlist merchants for faster disputes/recalls, while p2p remains blocklist-only

Standardize reason codes for transparency:

- 1001: Sanctioned/jurisdiction restricted
- 1002: Law enforcement request (ticket ID in evidence)
- 1003: Exploit/scam proceeds
- 1004: AML/KYT high risk
- 1005: Internal policy/terms violation

Registry entry schema (on-chain):

- subject: Pubkey
- reason_code: u16 (see above)
- evidence_hash: bytes32 (IPFS/Arweave CID digest)
- added_at: i64 (unix)
- added_by: Pubkey (governance action origin)
- `expires_at`: Option<`i64`> (for temporary emergency blocks)

We’ll ship a tiny CLI and UI to publish diffs and show evidence hashes so exchanges and users can independently review changes.

## X402 protocol "future layer"

We can design the wrapper to be extensible:
 

## Practical next steps

1) Keep MYXN as-is (already fixed supply, authorities revoked).
2) Approve building the compliance wrapper stack (cMYXN + hook + registry + vault).
3) Define governance (multisig members, timelock window) and policy (who is considered restricted and evidence requirements).
4) Start with a minimal on-chain registry and simple block/allow logic; iterate to add jurisdictions/velocity rules later.
5) Document publicly: MYXN = free asset; cMYXN = compliant for payments. Explain transparency and governance.

## What we can build for you

- A new Anchor workspace folder `programs/compliance_wrapper` containing:
  - cMYXN Token-2022 mint creation script
  - Transfer Hook Program (enforces registry checks)
  - Registry Program (blocklist/allowlist PDAs, governance-controlled)
  - Wrapper/Vault Program (wrap/unwrap MYXN)
- Client scripts:
  - Initialize governance and registry
  - Add/remove list entries (multisig-only)
  - Wrap/unwrap flows
- GitHub Actions for deploy and controlled updates

This keeps your listing path clean while giving strong compliance controls for payments. If you want us to proceed, we’ll scaffold the program with stubs, add the registry accounts, and prepare the hook interfaces, then iterate on tests and policies.

## Quick answers to your questions

- Governance plan: Which wallets are signers in the multisig, what the approval threshold is (e.g., 3-of-5), and how long the timelock delay is (e.g., 24h). This controls updates to the cMYXN registry/policies only.
- Initial policy direction: Whether we start with blocklist-only (default open with targeted blocks) or allowlist-first (default closed except for approved counterparties) for specific flows. We recommend blocklist-only for general transfers and optional allowlists for sensitive off-ramp flows.
