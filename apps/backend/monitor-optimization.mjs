#!/usr/bin/env node
/**
 * Monitor Optimization Progress
 * 
 * Monitors the batch optimization process and displays progress
 */

import { execSync } from 'child_process';
import fs from 'fs';

const LOG_FILE = './optimization-log.txt';
const PID_FILE = './optimization.pid';
const RESULTS_DIR = './results/optimizations';

function checkIfRunning() {
    if (!fs.existsSync(PID_FILE)) {
        return false;
    }

    const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();

    try {
        // Check if process is running
        execSync(`ps -p ${pid}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function getLogStats() {
    if (!fs.existsSync(LOG_FILE)) {
        return null;
    }

    const log = fs.readFileSync(LOG_FILE, 'utf-8');

    // Count completed strategies
    const completedMatches = log.match(/✅ Optimization complete for/g);
    const completed = completedMatches ? completedMatches.length : 0;

    // Count failed strategies
    const failedMatches = log.match(/❌ Optimization failed for/g);
    const failed = failedMatches ? failedMatches.length : 0;

    // Get current strategy being optimized
    const currentMatch = log.match(/🔧 Optimizing: ([\w-]+)/g);
    const current = currentMatch ? currentMatch[currentMatch.length - 1].replace('🔧 Optimizing: ', '') : 'None';

    // Count total combinations tested (approximate)
    const combinationsMatches = log.match(/Combinations: (\d+)/g);
    const totalCombinations = combinationsMatches
        ? combinationsMatches.reduce((sum, match) => {
            const num = parseInt(match.match(/\d+/)[0]);
            return sum + num;
        }, 0)
        : 0;

    return {
        completed,
        failed,
        current,
        totalCombinations,
    };
}

function getResultFiles() {
    if (!fs.existsSync(RESULTS_DIR)) {
        return [];
    }

    return fs.readdirSync(RESULTS_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => ({
            name: f,
            time: fs.statSync(`${RESULTS_DIR}/${f}`).mtime,
        }))
        .sort((a, b) => b.time - a.time);
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function main() {
    console.clear();
    console.log('📊 BATCH OPTIMIZATION MONITOR\n');

    const isRunning = checkIfRunning();

    if (!isRunning) {
        console.log('❌ Optimization process is not running\n');

        if (fs.existsSync(LOG_FILE)) {
            console.log('Last log output:');
            execSync(`tail -20 ${LOG_FILE}`, { stdio: 'inherit' });
        }

        return;
    }

    console.log('✅ Optimization is RUNNING\n');

    const stats = getLogStats();
    if (stats) {
        console.log('Progress:');
        console.log(`  • Completed: ${stats.completed}/10 strategies`);
        console.log(`  • Failed: ${stats.failed}`);
        console.log(`  • Current: ${stats.current}`);
        console.log(`  • Total combinations: ${stats.totalCombinations}\n`);
    }

    const results = getResultFiles();
    if (results.length > 0) {
        console.log('Recent results:');
        results.slice(0, 5).forEach(r => {
            const ago = Date.now() - r.time.getTime();
            console.log(`  • ${r.name} (${formatDuration(ago)} ago)`);
        });
        console.log('');
    }

    console.log('Commands:');
    console.log('  • Watch progress: tail -f optimization-log.txt');
    console.log('  • Stop process: kill $(cat optimization.pid)');
    console.log('  • Monitor (loop): watch -n 5 "node monitor-optimization.mjs"\n');

    if (fs.existsSync(LOG_FILE)) {
        console.log('Last 10 lines of log:');
        console.log('─'.repeat(80));
        execSync(`tail -10 ${LOG_FILE}`, { stdio: 'inherit' });
    }
}

main();
