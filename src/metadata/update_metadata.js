require('dotenv').config();

const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PROGRAM_ID: METADATA_PROGRAM_ID,
  createUpdateMetadataAccountV2Instruction,
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
  const connection = new Connection(RPC_URL, 'confirmed');
  const payer = loadKeypair(process.env.PAYER_KEYPAIR);

  const mintArg = process.argv[2] || process.env.MINT_ADDRESS;
  if (!mintArg) throw new Error('Usage: npm run metadata:update -- <MINT_ADDRESS>');
  const mint = new PublicKey(mintArg);

  const name = envOrDefault('METADATA_NAME', '');
  const symbol = envOrDefault('METADATA_SYMBOL', '');
  const uri = envOrDefault('METADATA_URI', '');
  const updateAuthority = process.env.METADATA_UPDATE_AUTHORITY_PUBKEY
    ? new PublicKey(process.env.METADATA_UPDATE_AUTHORITY_PUBKEY)
    : payer.publicKey;

  if (!name || !symbol || !uri) {
    throw new Error('Set METADATA_NAME, METADATA_SYMBOL, and METADATA_URI in .env to update metadata');
  }

  const [metadataPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    METADATA_PROGRAM_ID
  );

  // Update fields using V2 instruction
  const dataV2 = {
    name,
    symbol,
    uri,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  };

  const ix = createUpdateMetadataAccountV2Instruction(
    {
      metadata: metadataPda,
      updateAuthority,
    },
    {
      updateMetadataAccountArgsV2: {
        data: dataV2,
        updateAuthority: updateAuthority,
        primarySaleHappened: null,
        isMutable: true,
      },
    }
  );

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log('Metadata updated. Tx:', sig);
}

main().catch((e) => { console.error(e); process.exit(1); });
