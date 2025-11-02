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

## Approach B: Token-2022 for the base token (not recommended for listing)

- You could reissue the base token as Token-2022 with a Transfer Hook and enforce compliance on every transfer.
- This introduces centralization risk and will likely raise red flags with some exchanges and users.
- Migration of supply/liquidity is non-trivial.

We advise against this for your main listing asset, but you can consider it for private networks or internal tokens.

## Addressing "FBI/darknet/restricted" concerns

- Maintain an on-chain blocklist registry of public keys flagged by your risk/compliance team, updated via multisig after legal review. Entries store: pubkey, reason code, evidence hash, timestamp.
- The compliance hook denies cMYXN transfers to/from keys on the list.
- For emergency cases, allow a time-bound emergency pause only for cMYXN (not MYXN). Subject to tight governance and audit logs.

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
