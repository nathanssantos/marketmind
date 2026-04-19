import 'dotenv/config';
import { runStartupAudit, ALL_AUDIT_CHECKS, type AuditCheck } from '../../src/services/startup-audit';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: pnpm tsx scripts/audit/startup-audit.ts [options]

Options:
  --dry-run              Preview changes without writing to DB
  --wallet-id <id>       Audit a specific wallet only
  --only <checks>        Run specific checks (comma-separated)
  --help, -h             Show this help

Available checks:
  positions              Reconcile open positions (DB vs Binance)
  pending                Fix orphaned pending entries and untracked orders
  protection             Fix stale/missing SL/TP protection order IDs
  fees                   Correct fee discrepancies (last 3 days, up to 10 trades)
  balance                Sync wallet balance with Binance

Examples:
  pnpm tsx scripts/audit/startup-audit.ts                     # Full audit
  pnpm tsx scripts/audit/startup-audit.ts --dry-run           # Preview only
  pnpm tsx scripts/audit/startup-audit.ts --only balance      # Balance sync only
  pnpm tsx scripts/audit/startup-audit.ts --only fees,balance # Fees + balance
`);
  process.exit(0);
}

const dryRun = args.includes('--dry-run');
const walletIdIdx = args.indexOf('--wallet-id');
const walletId = walletIdIdx !== -1 ? args[walletIdIdx + 1] : undefined;

const onlyIdx = args.indexOf('--only');
let checks: AuditCheck[] | undefined;
if (onlyIdx !== -1 && args[onlyIdx + 1]) {
  const requested = args[onlyIdx + 1]!.split(',').map((s) => s.trim()) as AuditCheck[];
  const valid = requested.filter((c) => ALL_AUDIT_CHECKS.includes(c));
  const invalid = requested.filter((c) => !ALL_AUDIT_CHECKS.includes(c));
  if (invalid.length > 0) {
    console.error(`Unknown checks: ${invalid.join(', ')}`);
    console.error(`Valid checks: ${ALL_AUDIT_CHECKS.join(', ')}`);
    process.exit(1);
  }
  checks = valid;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  STARTUP AUDIT — Binance Sync');
  if (dryRun) console.log('  MODE: DRY RUN (no writes)');
  if (walletId) console.log(`  WALLET: ${walletId}`);
  if (checks) console.log(`  CHECKS: ${checks.join(', ')}`);
  console.log('='.repeat(80));
  console.log(`  Time: ${new Date().toISOString()}\n`);

  const summaries = await runStartupAudit({ dryRun, walletId, checks });

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
