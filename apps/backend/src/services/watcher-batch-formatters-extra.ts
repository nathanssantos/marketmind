import {
    colorize,
    type ColorName,
    type PositionSyncResult,
    type ReconnectionValidationResult,
} from '@marketmind/logger';
import type { PendingOrdersCheckResult } from '@marketmind/logger';
import { dimHeader, header } from './watcher-batch-formatters';

const ICONS = {
  SUCCESS: '✓',
  ERROR: '✗',
  WARNING: '!',
  PENDING: '~',
  SKIP: '~',
  ACTION: '>',
  INFO: '·',
} as const;

const DIRECTION = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;

const joinParts = (parts: string[]): string => parts.filter(Boolean).join(colorize(' · ', 'dim'));

const dirDisplay = (direction: string): string => {
  const icon = direction === DIRECTION.LONG ? '▲' : '▼';
  const color: ColorName = direction === DIRECTION.LONG ? 'green' : 'red';
  return colorize(`${icon}${direction}`, color);
};

const pnlDisplay = (value: number, suffix = ''): string => {
  if (value > 0) return colorize(`+${value.toFixed(2)}${suffix}`, 'green');
  if (value < 0) return colorize(`${value.toFixed(2)}${suffix}`, 'red');
  return `${value.toFixed(2)}${suffix}`;
};

export const formatReconnectionValidationResults = (result: ReconnectionValidationResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  lines.push('');
  lines.push(header('reconnection validation', result.startTime, durationMs));

  lines.push(`  ${joinParts([
    `${result.pairsChecked} pairs`,
    `${result.klinesChecked} klines`,
    result.totalMismatches > 0 ? colorize(`${ICONS.WARNING} ${result.totalMismatches} mismatches`, 'yellow') : `${ICONS.SUCCESS} 0 mismatches`,
    result.totalFixed > 0 ? colorize(`${ICONS.SUCCESS} ${result.totalFixed} fixed`, 'green') : `${ICONS.SUCCESS} 0 fixed`,
  ])}`);

  if (result.mismatches.length > 0) {
    lines.push('');
    lines.push(colorize('  > OHLC corrections', 'yellow'));
    for (const m of result.mismatches) {
      const timeStr = m.openTime.toISOString().replace('T', ' ').slice(0, 19);
      const status = m.fixed ? colorize(ICONS.SUCCESS, 'green') : colorize(ICONS.ERROR, 'red');
      const diffStr = `${m.diffPercent.toFixed(2)}%`;
      lines.push(
        `    ${colorize(ICONS.WARNING, 'yellow')} ${m.symbol}/${m.interval} ${colorize(timeStr, 'dim')} ` +
        `${m.field.toUpperCase()} ${m.dbValue.toPrecision(6)} -> ${m.apiValue.toPrecision(6)} ${colorize(diffStr, 'yellow')} ${status}`
      );
    }
  }

  lines.push('');
  return lines.join('\n');
};

export const formatPositionSyncResults = (result: PositionSyncResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  const hasIssues = result.totalOrphaned > 0 || result.totalUnknown > 0;

  lines.push('');
  lines.push(hasIssues
    ? header('position sync', result.startTime, durationMs)
    : dimHeader('position sync', result.startTime, durationMs));

  lines.push(`  ${joinParts([
    `${result.walletsChecked} wallets`,
    result.totalOrphaned > 0 ? colorize(`${ICONS.WARNING} ${result.totalOrphaned} orphaned`, 'yellow') : `${ICONS.SUCCESS} 0 orphaned`,
    result.totalUnknown > 0 ? colorize(`${ICONS.ERROR} ${result.totalUnknown} unknown`, 'red') : `${ICONS.SUCCESS} 0 unknown`,
    result.totalUpdated > 0 ? colorize(`${ICONS.SUCCESS} ${result.totalUpdated} updated`, 'cyan') : `${ICONS.SUCCESS} 0 updated`,
  ])}`);

  if (result.orphanedPositions.length > 0) {
    lines.push('');
    lines.push(colorize('  > orphaned positions (closed on exchange but open in DB)', 'yellow'));
    for (const p of result.orphanedPositions) {
      lines.push(
        `    ${colorize(ICONS.WARNING, 'yellow')} ${p.symbol} ${dirDisplay(p.side)} ` +
        `entry=${p.entryPrice.toPrecision(6)} exit=${p.exitPrice.toPrecision(6)} qty=${p.quantity.toPrecision(4)} ` +
        `pnl=${pnlDisplay(p.pnl)} (${pnlDisplay(p.pnlPercent, '%')})`
      );
    }
  }

  if (result.unknownPositions.length > 0) {
    lines.push('');
    lines.push(colorize(`  ${ICONS.ERROR} unknown positions (on exchange but NOT in DB - MANUAL CHECK REQUIRED)`, 'red'));
    for (const p of result.unknownPositions) {
      lines.push(
        `    ${colorize(ICONS.ERROR, 'red')} ${p.symbol} qty=${p.positionAmt.toPrecision(4)} ` +
        `entry=${p.entryPrice.toPrecision(6)} pnl=${pnlDisplay(p.unrealizedPnl)} ` +
        `${p.leverage}x ${p.marginType}`
      );
    }
  }

  if (result.updatedPositions.length > 0) {
    lines.push('');
    lines.push(colorize('  > position updates (synced from exchange)', 'cyan'));
    for (const p of result.updatedPositions) {
      lines.push(
        `    ${colorize(ICONS.SUCCESS, 'green')} ${p.symbol} ${p.field}: ${p.oldValue.toPrecision(6)} -> ${p.newValue.toPrecision(6)}`
      );
    }
  }

  lines.push('');
  return lines.join('\n');
};

export const formatPendingOrdersCheckResults = (result: PendingOrdersCheckResult): string => {
  const lines: string[] = [];
  const durationMs = result.endTime.getTime() - result.startTime.getTime();

  const hasActivity = result.expiredCount > 0 || result.invalidCount > 0 || result.filledCount > 0 || result.errorCount > 0;

  lines.push('');
  lines.push(hasActivity
    ? header('pending orders', result.startTime, durationMs)
    : dimHeader('pending orders', result.startTime, durationMs));

  const summaryParts = [
    `${result.totalChecked} orders`,
    result.filledCount > 0 ? colorize(`${ICONS.SUCCESS} ${result.filledCount} filled`, 'green') : `${ICONS.SUCCESS} 0 filled`,
    result.expiredCount > 0 ? colorize(`${ICONS.WARNING} ${result.expiredCount} expired`, 'yellow') : `${ICONS.SUCCESS} 0 expired`,
    result.invalidCount > 0 ? colorize(`${ICONS.ERROR} ${result.invalidCount} invalid`, 'red') : `${ICONS.SUCCESS} 0 invalid`,
    result.pendingCount > 0 ? colorize(`${ICONS.PENDING} ${result.pendingCount} pending`, 'cyan') : '',
    result.errorCount > 0 ? colorize(`${ICONS.ERROR} ${result.errorCount} errors`, 'red') : '',
  ].filter(Boolean);
  lines.push(`  ${joinParts(summaryParts)}`);

  const actionsToShow = result.actions.filter(a => a.action !== 'PENDING');
  if (actionsToShow.length > 0) {
    lines.push('');
    for (const action of actionsToShow) {
      const sideColor: ColorName = action.side === DIRECTION.LONG ? 'green' : 'red';
      let actionColor: ColorName = 'dim';
      let actionIcon: string = ICONS.INFO;

      switch (action.action) {
        case 'FILLED':
          actionColor = 'green';
          actionIcon = ICONS.ACTION;
          break;
        case 'EXPIRED':
          actionColor = 'yellow';
          actionIcon = ICONS.SKIP;
          break;
        case 'INVALID':
          actionColor = 'red';
          actionIcon = ICONS.ERROR;
          break;
        case 'ERROR':
          actionColor = 'red';
          actionIcon = ICONS.WARNING;
          break;
        case 'PENDING':
          actionColor = 'dim';
          actionIcon = ICONS.INFO;
          break;
      }

      const details = action.error
        ?? (action.action === 'EXPIRED' && action.expiresAt
          ? `expired at ${action.expiresAt.toLocaleTimeString()}`
          : action.action === 'FILLED' && action.currentPrice
            ? `filled at ${action.currentPrice.toPrecision(6)}`
            : '');

      lines.push(
        `    ${colorize(actionIcon, actionColor)} ${action.symbol} ${colorize(action.side, sideColor)} ` +
        `${colorize(action.action, actionColor)}${ 
        action.limitPrice ? ` limit=${action.limitPrice.toPrecision(6)}` : '' 
        }${details ? ` ${colorize(details, 'dim')}` : ''}`
      );
    }
  }

  lines.push('');
  return lines.join('\n');
};
