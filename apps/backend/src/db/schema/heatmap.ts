import { index, pgTable, primaryKey, serial, text, timestamp, unique, varchar, numeric } from 'drizzle-orm/pg-core';

export const heatmapAlwaysCollectSymbols = pgTable(
  'heatmap_always_collect_symbols',
  {
    id: serial().primaryKey(),
    symbol: varchar({ length: 20 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    symbolUnique: unique().on(table.symbol),
  })
);

export const liquidityHeatmapBuckets = pgTable(
  'liquidity_heatmap_buckets',
  {
    symbol: varchar({ length: 20 }).notNull(),
    bucketTime: timestamp('bucket_time', { mode: 'date' }).notNull(),
    priceBinSize: numeric('price_bin_size', { precision: 20, scale: 8 }).notNull(),
    bids: text().notNull(),
    asks: text().notNull(),
    maxQuantity: numeric('max_quantity', { precision: 20, scale: 8 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.symbol, table.bucketTime] }),
    lookupIdx: index('heatmap_lookup_idx').on(table.symbol, table.bucketTime),
  })
);
