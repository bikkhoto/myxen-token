// Quick offline check for supply calculation using BigInt
const decimals = parseInt(process.env.MINT_DECIMALS || '9', 10);
const whole = BigInt(process.env.INITIAL_SUPPLY || '1000000000');
const multiplier = 10n ** BigInt(decimals);
const baseUnits = whole * multiplier;

console.log('Decimals:', decimals);
console.log('Whole supply:', whole.toString());
console.log('Base units:', baseUnits.toString());
