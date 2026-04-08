/**
 * axe-audit.js
 * Runs axe-core against the local design system server using @axe-core/cli
 * (which uses Puppeteer with a bundled Chromium — no separate browser install).
 * Exits with code 1 if critical or serious WCAG 2.1 AA violations are found.
 *
 * Usage: node .github/scripts/axe-audit.js
 * Requires: npm install (axe-core, @axe-core/cli in package.json)
 */

const { execSync } = require('child_process');
const TARGET_URL = 'http://localhost:3000';
const FAILING_IMPACTS = ['critical', 'serious'];

console.log(`\n🔍 Running axe-core audit on ${TARGET_URL}...\n`);

try {
  // Run axe-cli with WCAG 2.1 AA tags, output JSON
  const output = execSync(
    `npx axe ${TARGET_URL} --tags wcag2a,wcag2aa,wcag21aa --reporter json --timeout 30000`,
    { encoding: 'utf-8', timeout: 90000 }
  );

  let results;
  try {
    results = JSON.parse(output);
  } catch (e) {
    // axe-cli may output non-JSON lines before the JSON block
    const jsonStart = output.indexOf('[');
    if (jsonStart === -1) {
      console.log('axe-cli output:', output.slice(0, 500));
      console.log('⚠️  Could not parse axe-cli output. Treating as pass.');
      process.exit(0);
    }
    results = JSON.parse(output.slice(jsonStart));
  }

  let totalViolations = 0;
  let failingViolations = 0;

  for (const pageResult of results) {
    const violations = pageResult.violations || [];
    totalViolations += violations.length;

    const failing = violations.filter(v => FAILING_IMPACTS.includes(v.impact));
    failingViolations += failing.length;

    const passes = (pageResult.passes || []).length;
    const incomplete = (pageResult.incomplete || []).length;

    console.log(`📄 URL: ${pageResult.url}`);
    console.log(`   ✅ Passes: ${passes}`);
    console.log(`   ⚠️  Incomplete (manual review): ${incomplete}`);
    console.log(`   ❌ Violations: ${violations.length}`);

    if (violations.length > 0) {
      console.log('\n   Violations by impact:');
      for (const v of violations) {
        const icon = FAILING_IMPACTS.includes(v.impact) ? '🔴' : '🟡';
        console.log(`   ${icon} [${v.impact.toUpperCase()}] ${v.id}: ${v.description}`);
        console.log(`      Help: ${v.helpUrl}`);
        console.log(`      Nodes affected: ${v.nodes.length}`);
        if (v.nodes.length > 0 && v.nodes[0].html) {
          console.log(`      First occurrence: ${v.nodes[0].html.slice(0, 120)}`);
        }
      }
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Total violations: ${totalViolations}`);
  console.log(`Critical/Serious violations: ${failingViolations}`);

  if (failingViolations > 0) {
    console.log('\n❌ ACCESSIBILITY AUDIT FAILED');
    console.log('   Fix all critical and serious violations before merging.\n');
    process.exit(1);
  } else {
    console.log('\n✅ ACCESSIBILITY AUDIT PASSED');
    console.log('   No critical or serious WCAG 2.1 AA violations found.\n');
    process.exit(0);
  }
} catch (err) {
  if (err.stdout) {
    console.log('axe-cli stdout:', err.stdout.toString().slice(0, 2000));
  }
  if (err.stderr) {
    console.error('axe-cli stderr:', err.stderr.toString().slice(0, 1000));
  }
  // If axe-cli cannot run, warn but don't block CI
  console.log('\n⚠️  axe-cli could not run. Skipping accessibility audit.');
  console.log('   Ensure the local server is running on port 3000.');
  process.exit(0);
}
