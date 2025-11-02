require('dotenv').config();

const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const { getMint } = require('@solana/spl-token');

function envOrDefault(name, fallback) {
  return process.env[name] && process.env[name].trim() !== ''
    ? process.env[name].trim()
    : fallback;
}

async function main() {
  const RPC_URL = envOrDefault('RPC_URL', clusterApiUrl('devnet'));
  const connection = new Connection(RPC_URL, 'confirmed');
  const mintArg = process.argv[2] || process.env.MINT_ADDRESS;
  if (!mintArg) {
    console.log('Usage: npm run verify -- <MINT_ADDRESS>');
    console.log('   or: MINT_ADDRESS=<addr> npm run verify');
    process.exit(1);
  }
  const mint = new PublicKey(mintArg);
  const info = await getMint(connection, mint);

  const multiplier = 10n ** BigInt(info.decimals);
  const humanSupply = Number(info.supply) / Number(multiplier);

  console.log('Mint:', mint.toBase58());
  console.log('Decimals:', info.decimals);
  console.log('Supply (base units):', info.supply.toString());
  console.log('Supply (whole tokens):', humanSupply.toLocaleString());
  console.log('Mint authority:', info.mintAuthority === null ? 'null (revoked)' : info.mintAuthority.toBase58());
  console.log('Freeze authority:', info.freezeAuthority === null ? 'null (revoked)' : info.freezeAuthority.toBase58());
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
