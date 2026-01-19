import { incomeSyncService } from '../src/services/income-sync-service';

async function main() {
  console.log('🔄 Starting fee backfill for last 30 days...');

  const result = await incomeSyncService.backfillAllTrades();

  console.log('\n✅ Backfill completed!');
  console.log(`   Trades processed: ${result.tradesProcessed}`);
  console.log(`   Trades updated: ${result.tradesUpdated}`);

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
