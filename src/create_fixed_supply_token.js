require('dotenv').config();

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} = require('@solana/web3.js');
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
  AuthorityType,
  getMint,
} = require('@solana/spl-token');
const {
  PROGRAM_ID: METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} = require('@metaplex-foundation/mpl-token-metadata');

function loadKeypair(filePath) {
  const resolved = filePath
    ? filePath.replace(/^~\//, os.homedir() + '/')
    : path.join(os.homedir(), '.config', 'solana', 'id.json');
  const secret = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function envOrDefault(name, fallback) {
  return process.env[name] && process.env[name].trim() !== ''
    ? process.env[name].trim()
    : fallback;
}

async function main() {
  const RPC_URL = envOrDefault('RPC_URL', clusterApiUrl('devnet'));
  const PAYER_KEYPAIR = process.env.PAYER_KEYPAIR;
  const payer = loadKeypair(PAYER_KEYPAIR);

  const DESTINATION_OWNER = process.env.DESTINATION_OWNER;
  const ownerPubkey = DESTINATION_OWNER && DESTINATION_OWNER !== ''
    ? new PublicKey(DESTINATION_OWNER)
    : payer.publicKey;

  const MINT_DECIMALS = parseInt(envOrDefault('MINT_DECIMALS', '9'), 10);
  if (isNaN(MINT_DECIMALS) || MINT_DECIMALS < 0 || MINT_DECIMALS > 18) {
    throw new Error('MINT_DECIMALS must be a number between 0 and 18');
  }

  const INITIAL_SUPPLY = envOrDefault('INITIAL_SUPPLY', '1000000000'); // 1B
  if (!/^\d+$/.test(INITIAL_SUPPLY)) {
    throw new Error('INITIAL_SUPPLY must be a positive integer string');
  }

  const REVOKE_FREEZE_AUTHORITY = /^true$/i.test(envOrDefault('REVOKE_FREEZE_AUTHORITY', 'false'));

  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('Network RPC:', RPC_URL);
  console.log('Payer:', payer.publicKey.toBase58());
  console.log('Destination owner:', ownerPubkey.toBase58());
  console.log('Decimals:', MINT_DECIMALS);
  console.log('Initial supply (whole tokens):', INITIAL_SUPPLY);
  console.log('Revoke freeze authority:', REVOKE_FREEZE_AUTHORITY);
  console.log('Metadata name:', process.env.METADATA_NAME || '(none)');
  console.log('Metadata symbol:', process.env.METADATA_SYMBOL || '(none)');
  console.log('Metadata URI:', process.env.METADATA_URI || '(none)');

  // 1. Create the mint with payer as initial authorities
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey, // mintAuthority (temporary)
    payer.publicKey, // freezeAuthority (optional, may revoke below)
    MINT_DECIMALS
  );

  console.log('Created mint:', mint.toBase58());

  // 2. Create/get destination ATA
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    ownerPubkey
  );
  console.log('Owner ATA:', ata.address.toBase58());

  // 3. Mint initial fixed supply
  const supplyWhole = BigInt(INITIAL_SUPPLY);
  const multiplier = 10n ** BigInt(MINT_DECIMALS);
  const supplyBaseUnits = supplyWhole * multiplier;

  await mintTo(
    connection,
    payer,
    mint,
    ata.address,
    payer, // mint authority (current)
    supplyBaseUnits
  );
  console.log('Minted amount (base units):', supplyBaseUnits.toString());

  // 3.5 Create Token Metadata (optional, before revoking mint authority)
  const name = process.env.METADATA_NAME;
  const symbol = process.env.METADATA_SYMBOL;
  const uri = process.env.METADATA_URI;
  const updateAuthPubkey = process.env.METADATA_UPDATE_AUTHORITY_PUBKEY
    ? new PublicKey(process.env.METADATA_UPDATE_AUTHORITY_PUBKEY)
    : payer.publicKey;

  if (name && symbol && uri) {
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      METADATA_PROGRAM_ID
    );
    const ix = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPda,
        mint: mint,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: updateAuthPubkey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name,
            symbol,
            uri,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
          },
          isMutable: true,
          collectionDetails: null,
        },
      }
    );
    const tx = new (require('@solana/web3.js').Transaction)().add(ix);
    await require('@solana/web3.js').sendAndConfirmTransaction(connection, tx, [payer]);
    console.log('Created token metadata with update authority:', updateAuthPubkey.toBase58());
  } else {
    console.log('Metadata not provided; skipping metadata creation.');
  }

  // 4. Revoke mint authority to make supply fixed
  await setAuthority(
    connection,
    payer,
    mint,
    payer.publicKey,
    AuthorityType.MintTokens,
    null
  );
  console.log('Mint authority revoked');

  // 5. Optionally revoke freeze authority for full trustlessness
  if (REVOKE_FREEZE_AUTHORITY) {
    await setAuthority(
      connection,
      payer,
      mint,
      payer.publicKey,
      AuthorityType.FreezeAccount,
      null
    );
    console.log('Freeze authority revoked');
  }

  // 6. Verify
  const mintInfo = await getMint(connection, mint);
  const humanSupply = Number(mintInfo.supply) / Number(multiplier);
  console.log('--- Summary ---');
  console.log('Mint:', mint.toBase58());
  console.log('Decimals:', mintInfo.decimals);
  console.log('Supply (whole tokens):', humanSupply.toLocaleString());
  console.log('Mint authority:', mintInfo.mintAuthority === null ? 'null (revoked)' : mintInfo.mintAuthority.toBase58());
  console.log('Freeze authority:', mintInfo.freezeAuthority === null ? 'null (revoked)' : mintInfo.freezeAuthority.toBase58());
  console.log('Owner ATA:', ata.address.toBase58());
  console.log('Destination owner:', ownerPubkey.toBase58());

  console.log('\nToken created successfully. Save the mint address above.');
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
