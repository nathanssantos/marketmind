import {
    colorize,
    type BatchResult,
    type ColorName,
    type MaintenanceResult,
    type RotationResult,
    type SetupValidationEntry,
    type ValidationCheck,
    type WatcherResult,
} from '@marketmind/logger';

const ICONS = {
  SUCCESS: '✓',
  ERROR: '✗',
  WARNING: '!',
  PENDING: '~',
  SKIP: '~',
  ACTION: '>',
  INFO: '·',
} as const;

const STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
  SKIPPED: 'skipped',
  PARTIAL: 'partial',
  FAILED: 'failed',
  EXECUTED: 'executed',
} as const;

const DIRECTION = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;

const fmtTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const header = (title: string, time: Date, durationMs: number): string =>
  colorize(`--- ${title.toLowerCase()}`, 'cyan') + colorize(` · ${fmtTime(time)} · ${durationMs}ms ---`, 'dim');

export const dimHeader = (title: string, time: Date, durationMs: number): string =>
  colorize(`--- ${title.toLowerCase()}`, 'dim') + colorize(` · ${fmtTime(time)} · ${durationMs}ms ---`, 'dim');

const joinParts = (parts: string[]): string => parts.filter(Boolean).join(colorize(' · ', 'dim'));

const dirDisplay = (direction: string): string => {
  const icon = direction === DIRECTION.LONG ? '▲' : '▼';
  const color: ColorName = direction === DIRECTION.LONG ? 'green' : 'red';
  return colorize(`${icon}${direction}`, color);
};

const formatValidationCheck = (check: ValidationCheck): string => {
  const icon = check.passed ? colorize(ICONS.SUCCESS, 'green') : colorize(ICONS.ERROR, 'red');
  const name = check.name.padEnd(20);
  let detail = '';
  if (check.value !== undefined && check.expected !== undefined) {
    detail = check.passed
      ? colorize(check.value, 'dim')
      : `${colorize(check.value, 'yellow')} (need ${check.expected})`;
  } else if (check.reason) {
    detail = check.passed ? colorize(check.reason, 'dim') : colorize(check.reason, 'yellow');
  }
  return `      ${icon} ${name} ${detail}`;
};

const formatSetupValidation = (v: SetupValidationEntry): string[] => {
  const lines: string[] = [];
  lines.push(`    ${dirDisplay(v.direction)} ${colorize(v.setupType, 'bright')} @ ${v.entryPrice}`);

  for (const check of v.checks) {
    lines.push(formatValidationCheck(check));
  }

  let outcomeIcon: string;
  let outcomeColor: ColorName;
  let outcomeText: string;

  switch (v.outcome) {
    case 'executed':
      outcomeIcon = ICONS.SUCCESS;
      outcomeColor = 'green';
      outcomeText = v.execution ? `EXECUTED qty=${v.execution.quantity}` : 'EXECUTED';
      break;
    case 'blocked':
      outcomeIcon = ICONS.ERROR;
      outcomeColor = 'red';
      outcomeText = `BLOCKED${v.outcomeReason ? `: ${v.outcomeReason}` : ''}`;
      break;
    case 'failed':
      outcomeIcon = ICONS.ERROR;
      outcomeColor = 'red';
      outcomeText = `FAILED${v.outcomeReason ? `: ${v.outcomeReason}` : ''}`;
      break;
    default:
      outcomeIcon = ICONS.PENDING;
      outcomeColor = 'yellow';
      outcomeText = 'PENDING';
  }

  lines.push(`      └ ${colorize(outcomeIcon, outcomeColor)} ${colorize(outcomeText, outcomeColor)}`);
  return lines;
};

const formatWatcherLine = (r: WatcherResult): string => {
  const sym = colorize(`${r.symbol}/${r.interval}`, 'bright');
  const rotatedTag = r.isRecentlyRotated ? colorize(' R', 'magenta') : '';

  if (r.status === STATUS.ERROR) {
    const reason = r.reason ?? r.logs.filter(l => l.level === 'error').map(l => l.message).join('; ') ?? 'unknown';
    return `  ${colorize(ICONS.ERROR, 'red')} ${sym}${rotatedTag} ${colorize(`error: ${reason}`, 'red')}`;
  }

  if (r.status === STATUS.SKIPPED) {
    return `  ${colorize(ICONS.INFO, 'dim')} ${colorize(`${r.symbol}/${r.interval}`, 'dim')} ${colorize(ICONS.SKIP, 'dim')} ${colorize(`skipped${r.reason ? ` (${r.reason})` : ''}`, 'dim')}`;
  }

  if (r.status === STATUS.PENDING) {
    return `  ${colorize(ICONS.INFO, 'dim')} ${colorize(`${r.symbol}/${r.interval}`, 'dim')} ${colorize(`~ pending`, 'dim')}`;
  }

  const klines = r.klinesCount ? `${colorize(ICONS.SUCCESS, 'green')} ${r.klinesCount} klines` : '';
  const setups = r.setupsDetected.length > 0
    ? colorize(r.setupsDetected.map(s => `${s.type}(${s.direction[0]})`).join(', '), 'magenta')
    : colorize('no setups', 'dim');
  const trades = r.tradesExecuted > 0 ? colorize(`${r.tradesExecuted} trade${r.tradesExecuted > 1 ? 's' : ''}`, 'green') : '';
  const time = colorize(`${r.durationMs}ms`, 'dim');

  return `  ${colorize(ICONS.ACTION, 'dim')} ${sym}${rotatedTag} ${joinParts([klines, setups, trades, time].filter(Boolean))}`;
};

export const formatBatchResults = (batch: BatchResult): string => {
  const lines: string[] = [];
  const durationMs = batch.endTime.getTime() - batch.startTime.getTime();

  lines.push('');
  lines.push(header(`cycle #${batch.batchId}`, batch.startTime, durationMs));

  const summaryParts = [
    `${batch.totalWatchers} watchers`,
    colorize(`${ICONS.SUCCESS} ${batch.successCount}`, 'green'),
    batch.skippedCount > 0 ? colorize(`${ICONS.SKIP} ${batch.skippedCount} skipped`, 'dim') : '',
    batch.errorCount > 0 ? colorize(`${ICONS.ERROR} ${batch.errorCount}`, 'red') : '',
  ];
  lines.push(`  ${joinParts(summaryParts)}`);

  const allRejections = batch.watcherResults.flatMap(r => r.rejections);
  const allFilterBlocks = batch.watcherResults.flatMap(r => r.filterChecks.filter(f => !f.passed));
  const totalRejected = batch.totalRejections + batch.totalFilterBlocks;

  let rejectionSummary = '';
  if (allRejections.length > 0 || allFilterBlocks.length > 0) {
    const reasonCounts = new Map<string, number>();
    for (const rejection of allRejections) {
      const key = rejection.reason.split(':')[0]?.trim() ?? rejection.reason;
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
    for (const filter of allFilterBlocks) {
      const key = `${filter.filterName}`;
      reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
    }
    rejectionSummary = Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([reason, count]) => `${count}x ${reason}`)
      .join(', ');
  }

  const detailParts = [
    batch.totalSetupsDetected > 0 ? colorize(`${batch.totalSetupsDetected} setups`, 'magenta') : '',
    batch.totalTradesExecuted > 0 ? colorize(`${batch.totalTradesExecuted} trade${batch.totalTradesExecuted > 1 ? 's' : ''}`, 'green') : '',
    totalRejected > 0
      ? colorize(`${ICONS.WARNING} ${totalRejected} rejected`, 'yellow') + (rejectionSummary ? colorize(` (${rejectionSummary})`, 'dim') : '')
      : '',
  ];
  const filteredDetailParts = detailParts.filter(Boolean);
  if (filteredDetailParts.length > 0) lines.push(`  ${joinParts(filteredDetailParts)}`);

  if (batch.watcherResults.length > 0) {
    lines.push('');
    for (const result of batch.watcherResults) {
      lines.push(formatWatcherLine(result));
    }
  }

  const setupResults = batch.watcherResults.filter(r => r.setupsDetected.length > 0);
  if (setupResults.length > 0) {
    lines.push('');
    lines.push(colorize('  > setups detected', 'magenta'));
    for (const result of setupResults) {
      for (const setup of result.setupsDetected) {
        const dirColor: ColorName = setup.direction === DIRECTION.LONG ? 'green' : 'red';
        lines.push(
          `    ${colorize(result.symbol, 'bright')} ${setup.type} ${colorize(setup.direction, dirColor)} ` +
          `${joinParts([`entry=${setup.entryPrice}`, `sl=${setup.stopLoss}`, `tp=${setup.takeProfit}`, `rr=${setup.riskReward}`, `${setup.confidence}%`])}`
        );
      }
    }
  }

  const errorResults = batch.watcherResults.filter(r => r.status === STATUS.ERROR);
  if (errorResults.length > 0) {
    lines.push('');
    lines.push(colorize(`  ${ICONS.ERROR} errors`, 'red'));
    for (const result of errorResults) {
      const errorLogs = result.logs.filter(l => l.level === 'error');
      const errorMsg = result.reason ?? errorLogs.map(l => l.message).join('; ') ?? 'Unknown error';
      lines.push(`    ${colorize(ICONS.ERROR, 'red')} ${result.symbol}/${result.interval} ${colorize(errorMsg, 'red')}`);
    }
  }

  const watchersWithValidations = batch.watcherResults.filter(r => r.setupValidations && r.setupValidations.length > 0);
  if (watchersWithValidations.length > 0) {
    lines.push('');
    lines.push(colorize('  > setup analysis', 'cyan'));
    for (const result of watchersWithValidations) {
      lines.push(`    ${colorize(result.symbol, 'bright')}/${result.interval} (${result.marketType})`);
      for (const validation of result.setupValidations) {
        lines.push(...formatSetupValidation(validation));
      }
    }
  }

  const tradeResults = batch.watcherResults.filter(r => r.tradeExecutions.length > 0);
  if (tradeResults.length > 0) {
    lines.push('');
    lines.push(colorize(`  ${ICONS.ACTION} trade executions`, 'green'));
    for (const result of tradeResults) {
      for (const trade of result.tradeExecutions) {
        const statusColor: ColorName = trade.status === STATUS.EXECUTED ? 'green' : trade.status === STATUS.PENDING ? 'yellow' : 'red';
        lines.push(
          `    ${colorize(result.symbol, 'bright')} ${trade.setupType} ${dirDisplay(trade.direction)} ` +
          `${joinParts([`entry=${trade.entryPrice}`, `qty=${trade.quantity}`, trade.stopLoss ? `sl=${trade.stopLoss}` : '', trade.takeProfit ? `tp=${trade.takeProfit}` : '', `${trade.orderType}`, colorize(trade.status, statusColor)].filter(Boolean))}`
        );
      }
    }
  }

  lines.push('');
  return lines.join('\n');
};

export const formatDetailedLogs = (results: WatcherResult[]): string => {
  const lines: string[] = [];

  for (const result of results) {
    if (result.logs.length === 0) continue;

    lines.push('');
    lines.push(colorize(`  [${result.symbol}/${result.interval}/${result.marketType}]`, 'cyan'));

    for (const log of result.logs) {
      const time = log.timestamp.toISOString().slice(11, 23);
      const levelColor: ColorName = log.level === 'error' ? 'red' : log.level === 'warn' ? 'yellow' : 'dim';
      const dataStr = log.data ? colorize(` ${JSON.stringify(log.data)}`, 'dim') : '';
      lines.push(`    ${colorize(time, 'gray')} ${log.emoji} ${colorize(log.message, levelColor)}${dataStr}`);
    }
  }

  return lines.join('\n');
};

export const formatMaintenanceResults = (result: MaintenanceResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();
  const title = result.type === 'startup' ? 'startup maintenance' : 'periodic maintenance';

  lines.push('');
  lines.push(header(title, result.startTime, durationMs));

  lines.push(`  ${joinParts([
    `${result.pairsChecked} pairs`,
    result.totalGapsFound > 0 ? colorize(`${result.totalGapsFound} gaps`, 'yellow') : colorize('0 gaps', 'dim'),
    result.totalCandlesFilled > 0 ? colorize(`${result.totalCandlesFilled} filled`, 'green') : colorize('0 filled', 'dim'),
    result.totalCorruptedFixed > 0 ? colorize(`${result.totalCorruptedFixed} fixed`, 'blue') : colorize('0 fixed', 'dim'),
  ])}`);

  const gapsWithActivity = result.gapFills.filter(g => g.gapsFound > 0 || g.candlesFilled > 0);
  if (gapsWithActivity.length > 0) {
    lines.push('');
    lines.push(colorize('  > gap fills', 'yellow'));
    for (const g of gapsWithActivity) {
      const icon = g.status === STATUS.SUCCESS ? colorize(ICONS.SUCCESS, 'green') : g.status === STATUS.PARTIAL ? colorize(ICONS.WARNING, 'yellow') : colorize(ICONS.ERROR, 'red');
      lines.push(`    ${colorize(ICONS.ACTION, 'dim')} ${colorize(g.symbol, 'bright')}/${g.interval} ${g.gapsFound} gap${g.gapsFound !== 1 ? 's' : ''} · ${g.candlesFilled} candle${g.candlesFilled !== 1 ? 's' : ''} filled ${icon}`);
    }
  }

  const corruptionsWithActivity = result.corruptionFixes.filter(c => c.corruptedFound > 0);
  if (corruptionsWithActivity.length > 0) {
    lines.push('');
    lines.push(colorize('  > corruption fixes', 'blue'));
    for (const c of corruptionsWithActivity) {
      const icon = c.status === STATUS.SUCCESS ? colorize(ICONS.SUCCESS, 'green') : colorize(ICONS.ERROR, 'red');
      lines.push(`    ${colorize(ICONS.ACTION, 'dim')} ${colorize(c.symbol, 'bright')}/${c.interval} ${c.corruptedFound} found · ${c.fixed} fixed ${icon}`);
    }
  }

  const errors = result.gapFills.filter(g => g.status === STATUS.ERROR);
  if (errors.length > 0) {
    lines.push('');
    lines.push(colorize(`  ${ICONS.ERROR} errors`, 'red'));
    for (const e of errors) {
      lines.push(`    ${colorize(ICONS.ERROR, 'red')} ${e.symbol}/${e.interval} ${colorize(e.reason ?? 'Unknown error', 'red')}`);
    }
  }

  lines.push('');
  return lines.join('\n');
};

export const formatRotationResults = (result: RotationResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  lines.push('');
  lines.push(header('symbol rotation', result.startTime, durationMs));

  lines.push(`  ${joinParts([
    colorize(result.marketType || 'futures', 'cyan'),
    colorize(result.interval, 'dim'),
    `target ${result.targetCount}`,
    result.slotsAvailable > 0 ? colorize(`${result.slotsAvailable} slots`, 'green') : colorize('0 slots', 'dim'),
  ])}`);

  if (result.added.length > 0 || result.removed.length > 0) {
    lines.push('');
    for (const symbol of result.added) {
      const validation = result.klineValidations?.find(v => v.symbol === symbol);
      let status = colorize('ready', 'green');
      if (validation && (validation.gapsFilled > 0 || validation.corruptedFixed > 0)) {
        status = colorize(`validated (gaps: ${validation.gapsFilled}, fixed: ${validation.corruptedFixed})`, 'cyan');
      }
      lines.push(`  ${colorize('+ ', 'green')}${colorize(symbol, 'bright')} added · ${status}`);
    }
    for (const symbol of result.removed) {
      lines.push(`  ${colorize('- ', 'red')}${colorize(symbol, 'bright')} removed`);
    }
  }

  const summaryParts = [
    colorize(`${result.kept} kept`, 'cyan'),
    colorize(`${result.added.length} added`, 'green'),
    colorize(`${result.removed.length} removed`, 'red'),
  ];

  if (result.skippedInsufficientKlines.length > 0) {
    summaryParts.push(colorize(`${result.skippedInsufficientKlines.length} insufficient data`, 'dim'));
  }

  if (result.skippedInsufficientCapital.length > 0) {
    summaryParts.push(colorize(`${result.skippedInsufficientCapital.length} low capital`, 'dim'));
  }

  lines.push(`  ${joinParts(summaryParts)}`);

  if (result.skippedInsufficientKlines.length > 0) {
    lines.push(`  ${colorize(`${ICONS.SKIP} skipped (no data): ${result.skippedInsufficientKlines.join(', ')}`, 'dim')}`);
  }

  if (result.skippedInsufficientCapital.length > 0) {
    lines.push(`  ${colorize(`${ICONS.SKIP} skipped (capital < minNotional): ${result.skippedInsufficientCapital.join(', ')}`, 'dim')}`);
  }

  lines.push('');
  return lines.join('\n');
};

export const formatRotationNoChanges = (result: RotationResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  lines.push('');
  lines.push(header('symbol rotation', result.startTime, durationMs));

  lines.push(`  ${joinParts([
    colorize(result.marketType || 'futures', 'cyan'),
    colorize(result.interval, 'dim'),
    `target ${result.targetCount}`,
  ])}`);

  const summaryParts = [
    colorize(`${ICONS.SUCCESS} no changes`, 'green'),
    colorize(`${result.kept} symbols`, 'cyan'),
  ];

  if (result.skippedInsufficientKlines.length > 0) {
    summaryParts.push(colorize(`${result.skippedInsufficientKlines.length} no data`, 'dim'));
  }

  if (result.skippedInsufficientCapital.length > 0) {
    summaryParts.push(colorize(`${result.skippedInsufficientCapital.length} low capital`, 'dim'));
  }

  lines.push(`  ${joinParts(summaryParts)}`);
  lines.push('');
  return lines.join('\n');
};

export {
    formatPendingOrdersCheckResults,
    formatPositionSyncResults,
    formatReconnectionValidationResults,
} from './watcher-batch-formatters-extra';
