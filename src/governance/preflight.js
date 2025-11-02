require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, clusterApiUrl } = require('@solana/web3.js');

function envOrDefault(name, fallback) {
  return process.env[name] && process.env[name].trim() !== ''
    ? process.env[name].trim()
    : fallback;
}

function loadKeypair(filePath) {
  const resolved = filePath
    ? filePath.replace(/^~\//, os.homedir() + '/')
    : path.join(os.homedir(), '.config', 'solana', 'id.json');
  const secret = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function main() {
  const RPC_URL = envOrDefault('RPC_URL', clusterApiUrl('devnet'));
  const PAYER_KEYPAIR = process.env.PAYER_KEYPAIR;
  const payer = loadKeypair(PAYER_KEYPAIR);

  const membersCsv = envOrDefault('GOVERNANCE_MEMBERS', '');
  const members = membersCsv
    ? membersCsv.split(',').map((s) => new PublicKey(s.trim()))
    : [];

  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('RPC:', RPC_URL);
  console.log('Fee payer:', payer.publicKey.toBase58());
  const payerLamports = await connection.getBalance(payer.publicKey);
  console.log('  Balance:', (payerLamports / LAMPORTS_PER_SOL).toFixed(6), 'SOL');

  if (members.length === 0) {
    console.log('No GOVERNANCE_MEMBERS provided. Set it in .env when ready.');
    return;
  }

  console.log('\nGovernance members:');
  for (const pk of members) {
    try {
      const lamports = await connection.getBalance(pk);
      console.log('-', pk.toBase58(), '|', (lamports / LAMPORTS_PER_SOL).toFixed(6), 'SOL');
    } catch (e) {
      console.log('-', pk.toBase58(), '| error fetching balance:', e.message || e);
    }
  }

  console.log('\nNote: Only the fee payer must have SOL for fees/rent. Members do not need SOL to sign, unless they will act as fee payer or need their token accounts created.');
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
