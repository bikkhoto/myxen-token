require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram } = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotent,
  transfer,
} = require('@solana/spl-token');

function loadKeypair(filePath) {
  const resolved = filePath
    ? filePath.replace(/^~\//, os.homedir() + '/')
    : path.join(os.homedir(), '.config', 'solana', 'id.json');
  const secret = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secret));
}

function parseReleaseAt() {
  const iso = process.env.RELEASE_AT_ISO || '2025-12-30T00:00:00Z';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error('Invalid RELEASE_AT_ISO');
  return Math.floor(t / 1000);
}

async function main() {
  const rpc = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const kpPath = process.env.PAYER_KEYPAIR;
  const payer = loadKeypair(kpPath);
  const provider = new anchor.AnchorProvider(new anchor.web3.Connection(rpc, 'confirmed'), new anchor.Wallet(payer), {});
  anchor.setProvider(provider);

  const programIdStr = process.env.PROGRAM_ID || 'Timelock1111111111111111111111111111111111';
  const programId = new PublicKey(programIdStr);
  const idl = {
    version: '0.1.0', name: 'timelock_vault',
    instructions: [{ name: 'initialize', accounts: [
      { name: 'payer', isMut: true, isSigner: true },
      { name: 'mint', isMut: false, isSigner: false },
      { name: 'destination', isMut: false, isSigner: false },
      { name: 'state', isMut: true, isSigner: false },
      { name: 'vaultAuthority', isMut: false, isSigner: false },
      { name: 'systemProgram', isMut: false, isSigner: false },
    ], args: [ { name: 'releaseAt', type: 'i64' }, { name: 'vaultBump', type: 'u8' } ] }]
  };
  const program = new anchor.Program(idl, programId, provider);

  const mint = new PublicKey(process.env.MINT_ADDRESS);
  const dev = new PublicKey(process.env.DEV_WALLET || process.env.DESTINATION_OWNER);

  const [state] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_state'), mint.toBuffer(), dev.toBuffer()],
    programId
  );
  const [vaultAuthority, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_auth'), state.toBuffer()],
    programId
  );
  const releaseAt = parseReleaseAt();

  // Ensure ATAs
  const conn = provider.connection;
  const sourceOwner = new PublicKey(process.env.SOURCE_OWNER || dev.toBase58());
  const payerAta = await getOrCreateAssociatedTokenAccount(conn, payer, mint, payer.publicKey);
  const devAta = await getOrCreateAssociatedTokenAccount(conn, payer, mint, dev);
  const sourceAta = await getOrCreateAssociatedTokenAccount(conn, payer, mint, sourceOwner);
  const vaultAta = await getAssociatedTokenAddress(mint, vaultAuthority, true);
  await createAssociatedTokenAccountIdempotent(conn, payer, mint, vaultAuthority);

  // Transfer 400M to devs (skip if the source is already the dev wallet)
  const decimals = parseInt(process.env.MINT_DECIMALS || '9', 10);
  const fourHundredM = 400_000_000n * (10n ** BigInt(decimals));
  if (sourceOwner.equals(dev)) {
    console.log('Source is the dev wallet; skipping 400M transfer (already held by dev).');
  } else {
    await transfer(conn, payer, sourceAta.address, devAta.address, payer.publicKey, fourHundredM);
    console.log('Sent 400M to devs ATA');
  }

  // Initialize state and deposit 600M to vault
  await program.methods.initialize(new anchor.BN(releaseAt), vaultBump)
    .accounts({
      payer: payer.publicKey,
      mint,
      destination: dev,
      state,
      vaultAuthority,
      systemProgram: SystemProgram.programId,
    }).rpc();
  console.log('Initialized timelock state');

  const sixHundredM = 600_000_000n * (10n ** BigInt(decimals));
  await transfer(conn, payer, sourceAta.address, vaultAta, payer.publicKey, sixHundredM);
  console.log('Locked 600M in vault');

  console.log('Done. You can safely revoke MINT authority now if not already');
}

main().catch((e) => { console.error(e); process.exit(1); });
