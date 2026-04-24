import { and, eq, gte, lt, inArray, sql, asc } from 'drizzle-orm';
import { db } from '../../db';
import { incomeEvents } from '../../db/schema';
import {
  INCOME_TYPES,
  PNL_CONTRIBUTING_TYPES,
  type IncomeType,
} from '../../constants/income-types';

export interface DailyIncomeQuery {
  walletId: string;
  userId: string;
  from: Date;
  to: Date;
  tz?: string;
  types?: readonly IncomeType[];
  asset?: string;
}

export interface DailyIncomeBucket {
  date: string;
  total: number;
  byType: Partial<Record<IncomeType, number>>;
}

export const getDailyIncomeSum = async (query: DailyIncomeQuery): Promise<Map<string, number>> => {
  const tz = query.tz || 'UTC';
  const types = query.types ?? PNL_CONTRIBUTING_TYPES;
  const asset = query.asset ?? 'USDT';

  const rows = await db
    .select({
      day: sql<string>`TO_CHAR(${incomeEvents.incomeTime} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`.as('day'),
      total: sql<string>`COALESCE(SUM(${incomeEvents.amount}), 0)`,
    })
    .from(incomeEvents)
    .where(
      and(
        eq(incomeEvents.walletId, query.walletId),
        eq(incomeEvents.userId, query.userId),
        eq(incomeEvents.asset, asset),
        gte(incomeEvents.incomeTime, query.from),
        lt(incomeEvents.incomeTime, query.to),
        inArray(incomeEvents.incomeType, types as unknown as IncomeType[]),
      ),
    )
    .groupBy(sql`1`);

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.day, parseFloat(row.total));
  }
  return map;
};

export const getDailyIncomeBreakdown = async (query: DailyIncomeQuery): Promise<DailyIncomeBucket[]> => {
  const tz = query.tz || 'UTC';
  const types = query.types ?? INCOME_TYPES;
  const asset = query.asset ?? 'USDT';

  const rows = await db
    .select({
      day: sql<string>`TO_CHAR(${incomeEvents.incomeTime} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`.as('day'),
      incomeType: incomeEvents.incomeType,
      total: sql<string>`COALESCE(SUM(${incomeEvents.amount}), 0)`,
    })
    .from(incomeEvents)
    .where(
      and(
        eq(incomeEvents.walletId, query.walletId),
        eq(incomeEvents.userId, query.userId),
        eq(incomeEvents.asset, asset),
        gte(incomeEvents.incomeTime, query.from),
        lt(incomeEvents.incomeTime, query.to),
        inArray(incomeEvents.incomeType, types as unknown as IncomeType[]),
      ),
    )
    .groupBy(sql`1`, incomeEvents.incomeType);

  const byDay = new Map<string, DailyIncomeBucket>();
  for (const row of rows) {
    const amount = parseFloat(row.total);
    const bucket = byDay.get(row.day) ?? { date: row.day, total: 0, byType: {} };
    bucket.byType[row.incomeType] = (bucket.byType[row.incomeType] ?? 0) + amount;
    if ((PNL_CONTRIBUTING_TYPES as readonly string[]).includes(row.incomeType)) {
      bucket.total += amount;
    }
    byDay.set(row.day, bucket);
  }
  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export interface EquityCurvePoint {
  time: number;
  cumulative: number;
  delta: number;
  incomeType: IncomeType;
}

export const getEquityCurvePoints = async (query: DailyIncomeQuery): Promise<EquityCurvePoint[]> => {
  const types = query.types ?? PNL_CONTRIBUTING_TYPES;
  const asset = query.asset ?? 'USDT';

  const rows = await db
    .select({
      time: incomeEvents.incomeTime,
      amount: incomeEvents.amount,
      incomeType: incomeEvents.incomeType,
    })
    .from(incomeEvents)
    .where(
      and(
        eq(incomeEvents.walletId, query.walletId),
        eq(incomeEvents.userId, query.userId),
        eq(incomeEvents.asset, asset),
        gte(incomeEvents.incomeTime, query.from),
        lt(incomeEvents.incomeTime, query.to),
        inArray(incomeEvents.incomeType, types as unknown as IncomeType[]),
      ),
    )
    .orderBy(asc(incomeEvents.incomeTime));

  let cumulative = 0;
  return rows.map((row) => {
    const delta = parseFloat(row.amount);
    cumulative += delta;
    return {
      time: row.time.getTime(),
      cumulative,
      delta,
      incomeType: row.incomeType,
    };
  });
};
