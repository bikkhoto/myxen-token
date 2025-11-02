require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');

function loadKeypair(filePath) {
  const resolved = filePath
    ? filePath.replace(/^~\//, os.homedir() + '/')
    : path.join(os.homedir(), '.config', 'solana', 'id.json');
  const secret = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secret));
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
    version: '0.1.0',
    name: 'timelock_vault',
    instructions: [
      { name: 'release', accounts: [
        { name: 'caller', isMut: false, isSigner: true },
        { name: 'mint', isMut: false, isSigner: false },
        { name: 'state', isMut: true, isSigner: false },
        { name: 'vaultAuthority', isMut: false, isSigner: false },
        { name: 'vaultAta', isMut: true, isSigner: false },
        { name: 'destinationAta', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'associatedTokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ], args: [] },
    ]
  };
  const program = new anchor.Program(idl, programId, provider);

  const mint = new PublicKey(process.env.MINT_ADDRESS);
  const destination = new PublicKey(process.env.DEV_WALLET || process.env.DESTINATION_OWNER);

  const [state] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_state'), mint.toBuffer(), destination.toBuffer()],
    programId
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_auth'), state.toBuffer()],
    programId
  );

  // We compute ATAs client side; program will verify owners and mint match
  const { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotent } = require('@solana/spl-token');
  const vaultAta = await getAssociatedTokenAddress(mint, vaultAuthority, true);
  const destinationAta = await getAssociatedTokenAddress(mint, destination);

  // Ensure destination ATA exists (idempotent)
  await createAssociatedTokenAccountIdempotent(provider.connection, provider.wallet.payer, mint, destination);

  console.log('Calling release...');
  await program.methods.release().accounts({
    caller: payer.publicKey,
    mint,
    state,
    vaultAuthority,
    vaultAta,
    destinationAta,
    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
    systemProgram: anchor.web3.SystemProgram.programId,
  }).rpc();

  console.log('Release transaction sent. If after unlock time, 600M should be transferred to the dev wallet.');
}

main().catch((e) => { console.error(e); process.exit(1); });
