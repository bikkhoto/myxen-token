#!/usr/bin/env node
/*
 Patches the compliance_wrapper program id in:
  - programs/compliance_wrapper/src/lib.rs (declare_id!)
  - Anchor.toml ([programs.localnet] and [programs.devnet])
  - .env (COMPLIANCE_PROGRAM_ID)

 Usage:
   node src/tools/patch_program_id.js [optional_path_to_program_keypair_json]

 If no path is provided, defaults to target/deploy/compliance_wrapper-keypair.json
 You can also set env PROGRAM_KEYPAIR_PATH.
*/

const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ensureFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }
}

function patchLibRs(libPath, programId) {
  let src = fs.readFileSync(libPath, 'utf8');
  const re = /declare_id!\("([A-Za-z0-9]+)"\);/;
  if (!re.test(src)) {
    throw new Error('declare_id!("…"); not found in lib.rs');
  }
  src = src.replace(re, `declare_id!("${programId}");`);
  fs.writeFileSync(libPath, src, 'utf8');
}

function patchAnchorToml(tomlPath, programId) {
  let txt = fs.readFileSync(tomlPath, 'utf8');

  function upsertInSection(section, key, value) {
    const sectionRe = new RegExp(`(^|\n)\\[${section}\\][\s\S]*?(?=\n\\[|$)`, 'm');
    const hasSection = sectionRe.test(txt);
    if (!hasSection) {
      // append new section
      const toAppend = `\n[${section}]\n${key} = "${value}"\n`;
      txt = txt.replace(/\n?$/, '\n') + toAppend;
      return;
    }
    // we have the section; extract it
    const match = txt.match(sectionRe);
    const block = match[0];
    const keyRe = new RegExp(`(^|\n)${key} = "[^"]*"`);
    let newBlock;
    if (keyRe.test(block)) {
      newBlock = block.replace(keyRe, (m) => m.replace(/= "[^"]*"/, `= "${value}"`));
    } else {
      newBlock = block.replace(/\n?$/, `\n${key} = "${value}"`);
    }
    txt = txt.replace(block, newBlock);
  }

  upsertInSection('programs.localnet', 'compliance_wrapper', programId);
  upsertInSection('programs.devnet', 'compliance_wrapper', programId);

  fs.writeFileSync(tomlPath, txt, 'utf8');
}

function patchEnvDotEnv(envPath, programId) {
  let content = '';
  try { content = fs.readFileSync(envPath, 'utf8'); } catch (_) {}
  const line = `COMPLIANCE_PROGRAM_ID=${programId}`;
  const re = /^COMPLIANCE_PROGRAM_ID=.*$/m;
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    content = content.replace(/\n?$/, '\n') + line + '\n';
  }
  fs.writeFileSync(envPath, content, 'utf8');
}

function main() {
  const cwd = process.cwd();
  const keypairArg = process.argv[2] || process.env.PROGRAM_KEYPAIR_PATH || path.join(cwd, 'target', 'deploy', 'compliance_wrapper-keypair.json');
  ensureFile(keypairArg);

  const secret = readJson(keypairArg);
  const kp = Keypair.fromSecretKey(Uint8Array.from(secret));
  const programId = kp.publicKey.toBase58();

  const libPath = path.join(cwd, 'programs', 'compliance_wrapper', 'src', 'lib.rs');
  const tomlPath = path.join(cwd, 'Anchor.toml');
  const envPath = path.join(cwd, '.env');

  ensureFile(libPath);
  ensureFile(tomlPath);

  patchLibRs(libPath, programId);
  patchAnchorToml(tomlPath, programId);
  patchEnvDotEnv(envPath, programId);

  console.log('Patched program id to:', programId);
  console.log('- Updated declare_id! in', libPath);
  console.log('- Updated Anchor.toml [programs.localnet] and [programs.devnet]');
  console.log('- Updated COMPLIANCE_PROGRAM_ID in .env');
  console.log('\nNext steps:');
  console.log('  1) anchor build');
  console.log('  2) anchor deploy');
  console.log('  3) npm run governance:init');
}

main();
