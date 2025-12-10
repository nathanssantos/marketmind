#!/usr/bin/env node
/**
 * Interactive Batch Optimization with Live Log Monitoring
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const STRATEGIES = [
    'order-block-fvg',
    'liquidity-sweep',
    'divergence-rsi-macd',
    'larry-williams-9-1',
    'larry-williams-9-2',
    'larry-williams-9-3',
    'larry-williams-9-4',
    'connors-rsi2',
    'mean-reversion-bb-rsi',
    'rsi2-mean-reversion',
];

const LOG_FILE = 'optimization-progress.log';
let lastLogSize = 0;
let completed = 0;
let currentStrategy = '';

function clearScreen() {
    process.stdout.write('\x1b[2J\x1b[0f');
}

function drawProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    const width = 50;
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;

    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
}

function updateDisplay() {
    clearScreen();

    const percent = Math.round((completed / STRATEGIES.length) * 100);

    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                 BATCH OPTIMIZATION - PROGRESSO EM TEMPO REAL                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

    console.log(`  Progresso Geral: ${completed}/${STRATEGIES.length} estratégias`);
    console.log(`  ${drawProgress(completed, STRATEGIES.length)}\n`);

    if (currentStrategy) {
        console.log(`  🔧 Otimizando: ${currentStrategy}`);
    }

    console.log('\n  ─────────────────────────────────────────────────────────────────────────────');

    // Read and display last 10 lines of log
    if (existsSync(LOG_FILE)) {
        const content = readFileSync(LOG_FILE, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        const recent = lines.slice(-10);

        console.log('\n  📋 Últimas Atividades:\n');
        recent.forEach(line => {
            if (line.includes('✅')) {
                console.log(`  \x1b[32m${line}\x1b[0m`);
            } else if (line.includes('❌')) {
                console.log(`  \x1b[31m${line}\x1b[0m`);
            } else if (line.includes('🔧')) {
                console.log(`  \x1b[33m${line}\x1b[0m`);
            } else {
                console.log(`  \x1b[90m${line}\x1b[0m`);
            }
        });
    }

    console.log('\n  ─────────────────────────────────────────────────────────────────────────────');
    console.log('  \x1b[90mAtualizando a cada 2s... (Ctrl+C para cancelar)\x1b[0m\n');
}

function monitorLog() {
    if (!existsSync(LOG_FILE)) return;

    const content = readFileSync(LOG_FILE, 'utf-8');

    if (content.length > lastLogSize) {
        const newContent = content.slice(lastLogSize);
        lastLogSize = content.length;

        // Count completed
        const completedMatches = content.match(/✅ Optimization complete for/g);
        completed = completedMatches ? completedMatches.length : 0;

        // Get current strategy
        const currentMatches = newContent.match(/🔧 Optimizing: ([\w-]+)/);
        if (currentMatches) {
            currentStrategy = currentMatches[1];
        }

        updateDisplay();
    }
}

async function main() {
    console.log('\n🚀 Iniciando Batch Optimization...\n');
    console.log('   Período: 2023-01-01 a 2024-12-31');
    console.log('   Símbolo: BTCUSDT');
    console.log('   Estratégias: 10');
    console.log('   Workers paralelos: 4\n');

    // Clear log file
    writeFileSync(LOG_FILE, '');

    console.log('⏳ Preparando otimização...\n');

    // Start optimization in background
    const child = spawn('node', ['batch-optimize-bg.mjs'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let outputBuffer = '';

    child.stdout.on('data', (data) => {
        const text = data.toString();
        outputBuffer += text;

        // Write to log file
        const lines = text.split('\n').filter(l => l.trim());
        lines.forEach(line => {
            const logLine = line.replace(/\[\d{4}-\d{2}-\d{2}T[\d:\.Z]+\]\s*/, '');
            if (logLine) {
                writeFileSync(LOG_FILE, `${logLine}\n`, { flag: 'a' });
            }
        });
    });

    child.stderr.on('data', (data) => {
        const text = data.toString();
        writeFileSync(LOG_FILE, `ERROR: ${text}\n`, { flag: 'a' });
    });

    // Monitor log every 2 seconds
    const interval = setInterval(monitorLog, 2000);

    child.on('close', (code) => {
        clearInterval(interval);
        monitorLog(); // Final update

        clearScreen();
        console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
        console.log('║                        OTIMIZAÇÃO CONCLUÍDA                                   ║');
        console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');

        console.log(`  ✅ Estratégias completadas: ${completed}/${STRATEGIES.length}`);
        console.log(`  📁 Resultados em: ./results/optimizations/`);
        console.log(`  📄 Log completo: ${LOG_FILE}\n`);

        if (code === 0) {
            console.log('  🎉 Sucesso! Próximo passo: node apply-optimized-params.mjs\n');
        } else {
            console.log(`  ⚠️  Processo terminou com código ${code}\n`);
        }

        process.exit(code);
    });

    // Initial update
    setTimeout(() => {
        updateDisplay();
    }, 1000);
}

process.on('SIGINT', () => {
    clearScreen();
    console.log('\n\n  ⚠️  Otimização cancelada pelo usuário\n');
    process.exit(130);
});

main().catch(console.error);
