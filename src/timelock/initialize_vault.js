require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const anchor = require('@coral-xyz/anchor');
const { PublicKey, Keypair, SystemProgram } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotent, getOrCreateAssociatedTokenAccount, transfer } = require('@solana/spl-token');

function loadKeypair(filePath) {
  const resolved = filePath
    ? filePath.replace(/^~\//, os.homedir() + '/')
    : path.join(os.homedir(), '.config', 'solana', 'id.json');
  const secret = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function parseReleaseAt() {
  const iso = process.env.RELEASE_AT_ISO || '2025-12-30T00:00:00Z';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error('Invalid RELEASE_AT_ISO');
  return Math.floor(t / 1000);
}

function bn(n) { return new anchor.BN(n); }

async function main() {
  const rpc = process.env.RPC_URL || 'https://api.devnet.solana.com';
  const kpPath = process.env.PAYER_KEYPAIR;
  const payer = loadKeypair(kpPath);
  const provider = new anchor.AnchorProvider(new anchor.web3.Connection(rpc, 'confirmed'), new anchor.Wallet(payer), {});
  anchor.setProvider(provider);

  const programIdStr = process.env.PROGRAM_ID || 'Timelock1111111111111111111111111111111111';
  const programId = new PublicKey(programIdStr);
  const idl = {
    version: '0.1.0',
    name: 'timelock_vault',
    instructions: [
      { name: 'initialize', accounts: [
        { name: 'payer', isMut: true, isSigner: true },
        { name: 'mint', isMut: false, isSigner: false },
        { name: 'destination', isMut: false, isSigner: false },
        { name: 'state', isMut: true, isSigner: false },
        { name: 'vaultAuthority', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ], args: [ { name: 'releaseAt', type: 'i64' }, { name: 'vaultBump', type: 'u8' } ] },
    ]
  };
  const program = new anchor.Program(idl, programId, provider);

  const mintStr = process.env.MINT_ADDRESS;
  if (!mintStr) throw new Error('MINT_ADDRESS required');
  const devStr = process.env.DEV_WALLET || process.env.DESTINATION_OWNER;
  if (!devStr) throw new Error('DEV_WALLET (destination) required');
  const mint = new PublicKey(mintStr);
  const destination = new PublicKey(devStr);

  const [state] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_state'), mint.toBuffer(), destination.toBuffer()],
    programId
  );
  const [vaultAuthority, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_auth'), state.toBuffer()],
    programId
  );

  const releaseAt = parseReleaseAt();
  console.log('Initialize timelock state at:', releaseAt, new Date(releaseAt * 1000).toISOString());
  console.log('State PDA:', state.toBase58());
  console.log('Vault authority PDA:', vaultAuthority.toBase58());

  // Send initialize tx
  await program.methods.initialize(new anchor.BN(releaseAt), vaultBump)
    .accounts({
      payer: payer.publicKey,
      mint,
      destination,
      state,
      vaultAuthority,
      systemProgram: SystemProgram.programId,
    }).rpc();

  console.log('Initialized state');

  // Ensure vault ATA exists
  const vaultAta = await getAssociatedTokenAddress(mint, vaultAuthority, true);
  const connection = provider.connection;
  await createAssociatedTokenAccountIdempotent(connection, payer, mint, vaultAuthority, { commitment: 'confirmed' });
  console.log('Vault ATA:', vaultAta.toBase58());

  // Deposit 600M into vault from payer (or from the account that currently holds tokens)
  const decimals = parseInt(process.env.MINT_DECIMALS || '9', 10);
  const amtWhole = BigInt(process.env.LOCK_AMOUNT || '600000000');
  const multiplier = 10n ** BigInt(decimals);
  const amount = amtWhole * multiplier;

  const fromOwner = new PublicKey(process.env.SOURCE_OWNER || payer.publicKey);
  const fromAtaInfo = await getOrCreateAssociatedTokenAccount(connection, payer, mint, fromOwner);
  await transfer(connection, payer, fromAtaInfo.address, vaultAta, payer.publicKey, amount);
  console.log('Deposited (base units):', amount.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
