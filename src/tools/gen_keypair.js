#!/usr/bin/env node
/*
 Generate a Solana keypair (wallet or program) and write it to a JSON file.
 Prints the public key and a base64 version of the JSON for GitHub Secrets.

 Usage:
   node src/tools/gen_keypair.js .keys/ops.json
   node src/tools/gen_keypair.js .keys/compliance_wrapper-keypair.json
*/

const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    console.error('Usage: node src/tools/gen_keypair.js <output.json>');
    process.exit(1);
  }
  const kp = Keypair.generate();
  const secret = Array.from(kp.secretKey);
  const json = JSON.stringify(secret);

  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, json + '\n', 'utf8');

  const b64 = Buffer.from(json, 'utf8').toString('base64');
  console.log('Wrote keypair:', outPath);
  console.log('Public key:', kp.publicKey.toBase58());
  console.log('GitHub secret (base64 JSON):');
  console.log(b64);
  console.log('\nSecurity: Do NOT commit this file. .gitignore is configured to ignore .keys/ and target/.');
}

main();
