const { detectPhoneType } = require('./phoneTypeDetector');

// Test cases for Spanish phone numbers
const testCases = [
  // Mobile numbers (6, 7, 9)
  { phone: '+34 612 345 678', expected: 'mobile', desc: 'Spanish mobile with spaces' },
  { phone: '+34612345678', expected: 'mobile', desc: 'Spanish mobile no spaces' },
  { phone: '0612345678', expected: 'mobile', desc: 'Spanish mobile with leading 0' },
  { phone: '612345678', expected: 'mobile', desc: 'Spanish mobile plain' },
  { phone: '722 123 456', expected: 'mobile', desc: 'Spanish mobile starts with 7' },
  { phone: '692 345 678', expected: 'mobile', desc: 'Spanish mobile starts with 69' },
  
  // Fixed line numbers (2, 3, 4, 5)
  { phone: '+34 912 123 456', expected: 'fixed', desc: 'Spanish landline 91' },
  { phone: '+34912123456', expected: 'fixed', desc: 'Spanish landline 91 no spaces' },
  { phone: '0912123456', expected: 'fixed', desc: 'Spanish landline with leading 0' },
  { phone: '912123456', expected: 'fixed', desc: 'Spanish landline plain' },
  { phone: '933 456 789', expected: 'fixed', desc: 'Spanish landline 93' },
  { phone: '954 789 012', expected: 'fixed', desc: 'Spanish landline 95' },
  { phone: '223 456 789', expected: 'fixed', desc: 'Spanish landline 2' },
  
  // Edge cases
  { phone: null, expected: null, desc: 'Null phone' },
  { phone: '', expected: null, desc: 'Empty phone' },
  { phone: 'abc', expected: null, desc: 'Invalid phone' },
];

console.log('Testing phone type detection:\n');
let passed = 0;
let failed = 0;

testCases.forEach(({ phone, expected, desc }) => {
  const result = detectPhoneType(phone);
  const status = result === expected ? '✓ PASS' : '✗ FAIL';
  if (result === expected) passed++;
  else failed++;
  
  console.log(`${status} | ${desc}`);
  console.log(`       Input: ${phone} => Result: ${result} (Expected: ${expected})\n`);
});

console.log(`\nSummary: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
process.exit(failed > 0 ? 1 : 0);
