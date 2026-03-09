import 'dotenv/config';
import { runStartupAudit } from '../../src/services/startup-audit';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const walletIdIdx = args.indexOf('--wallet-id');
const walletId = walletIdIdx !== -1 ? args[walletIdIdx + 1] : undefined;

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  STARTUP AUDIT — Binance Sync');
  if (dryRun) console.log('  MODE: DRY RUN (no writes)');
  if (walletId) console.log(`  WALLET: ${walletId}`);
  console.log('='.repeat(80));
  console.log(`  Time: ${new Date().toISOString()}\n`);

  const summaries = await runStartupAudit({ dryRun, walletId });

  if (summaries.length === 0) {
    console.log('No wallets audited.');
    process.exit(0);
  }

  let totalFixed = 0;
  let totalWarnings = 0;
  let hasErrors = false;

  for (const s of summaries) {
    console.log('-'.repeat(80));
    console.log(`Wallet: ${s.walletId}`);
    console.log(`  Fixed:    ${s.fixed}`);
    console.log(`  Warnings: ${s.warnings.length}`);
    console.log(`  Errors:   ${s.errors.length}`);
    console.log(`  Duration: ${s.durationMs}ms`);

    for (const w of s.warnings) console.log(`  ⚠ ${w}`);
    for (const e of s.errors) {
      console.log(`  ✗ ${e}`);
      hasErrors = true;
    }

    totalFixed += s.fixed;
    totalWarnings += s.warnings.length;
  }

  console.log('\n' + '='.repeat(80));
  console.log(`  SUMMARY: ${totalFixed} fixed, ${totalWarnings} warnings across ${summaries.length} wallet(s)`);
  if (dryRun) console.log('  (dry run — no changes written)');
  console.log('='.repeat(80) + '\n');

  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
