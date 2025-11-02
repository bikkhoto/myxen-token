#!/usr/bin/env node
/*
 Read a file and print base64 of its exact contents (useful for GitHub Secrets).
 Usage:
   node src/tools/print_b64.js .keys/ops.json
*/

const fs = require('fs');

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node src/tools/print_b64.js <file>');
    process.exit(1);
  }
  const data = fs.readFileSync(file);
  const b64 = data.toString('base64');
  console.log(b64);
}

main();
