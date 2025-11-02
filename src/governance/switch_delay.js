#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');

function setEnvVar(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) {
    return content.replace(re, line);
  }
  // Append if missing, ensure trailing newline
  return content.replace(/\n?$/, '\n') + line + '\n';
}

function getEnvVar(content, key) {
  const re = new RegExp(`^${key}=([^\n]*)$`, 'm');
  const m = content.match(re);
  return m ? m[1] : undefined;
}

function main() {
  const projectRoot = process.cwd();
  const envPath = path.join(projectRoot, '.env');

  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      content = '';
    } else {
      throw e;
    }
  }

  const arg = process.argv[2];
  const current = getEnvVar(content, 'GOVERNANCE_DELAY_SECONDS');
  let nextValue;

  if (arg && arg !== 'toggle') {
    const n = Number(arg);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      console.error('Provide a non-negative integer (e.g., 0 or 86400) or use "toggle".');
      process.exit(1);
    }
    nextValue = String(n);
  } else {
    // toggle mode
    const curNum = current !== undefined ? Number(current) : NaN;
    if (Number.isFinite(curNum) && curNum === 0) {
      nextValue = '86400';
    } else {
      nextValue = '0';
    }
  }

  const updated = setEnvVar(content, 'GOVERNANCE_DELAY_SECONDS', nextValue);
  fs.writeFileSync(envPath, updated, 'utf8');

  console.log(`GOVERNANCE_DELAY_SECONDS: ${current ?? '(unset)'} -> ${nextValue}`);
  if (nextValue === '0') {
    console.log('Note: zero delay is for fast testing only. Remember to switch back to 86400 (24h) for production.');
  } else {
    console.log('Using a 24h timelock. You can switch back to fast testing with the toggle command.');
  }
}

main();
