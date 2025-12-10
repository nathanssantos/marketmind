#!/usr/bin/env node

import { readdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const LEVELDB_PATH = join(
    homedir(),
    'Library/Application Support/marketmind/Local Storage/leveldb'
);

console.log('🔍 Analisando LocalStorage do MarketMind...\n');

try {
    const files = readdirSync(LEVELDB_PATH);
    const logFiles = files.filter(f => f.endsWith('.log'));

    console.log(`📁 Arquivos encontrados: ${logFiles.length}`);

    let setupConfigFound = false;

    for (const file of logFiles) {
        const filePath = join(LEVELDB_PATH, file);
        const content = readFileSync(filePath, 'utf8');

        if (content.includes('marketmind-setup-storage')) {
            console.log(`\n✅ Encontrado em: ${file}`);

            const matches = content.match(/marketmind-setup-storage[^}]+\{[^}]+state[^}]+config[^}]+\{[\s\S]+?\}\}\}/);

            if (matches && matches[0]) {
                setupConfigFound = true;
                const rawData = matches[0].replace('marketmind-setup-storage', '').trim();

                try {
                    const jsonMatch = rawData.match(/\{[\s\S]+\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.state && parsed.state.config) {
                            console.log('\n📊 Configuração atual dos setups:\n');

                            const config = parsed.state.config;

                            console.log(`Setup 9.1:         ${config.setup91?.enabled ? '✅ Habilitado' : '❌ Desabilitado'} (Confidence: ${config.setup91?.minConfidence})`);
                            console.log(`Pattern 1-2-3:     ${config.pattern123?.enabled ? '✅ Habilitado' : '❌ Desabilitado'} (Confidence: ${config.pattern123?.minConfidence})`);
                            console.log(`Bull Trap:         ${config.bullTrap?.enabled ? '✅ Habilitado' : '❌ Desabilitado'} (Confidence: ${config.bullTrap?.minConfidence})`);
                            console.log(`Bear Trap:         ${config.bearTrap?.enabled ? '✅ Habilitado' : '❌ Desabilitado'} (Confidence: ${config.bearTrap?.minConfidence})`);
                            console.log(`Breakout Retest:   ${config.breakoutRetest?.enabled ? '✅ Habilitado' : '❌ Desabilitado'} (Confidence: ${config.breakoutRetest?.minConfidence})`);

                            console.log('\n🔧 Configurações adicionais:');
                            console.log(`Trend Filter:      ${config.enableTrendFilter ? '✅ Habilitado' : '❌ Desabilitado'}`);
                            console.log(`Allow Counter:     ${config.allowCounterTrend ? '✅ Sim' : '❌ Não'}`);
                            console.log(`Cooldown Period:   ${config.setupCooldownPeriod} klines`);
                        }
                    }
                } catch (e) {
                    console.log('⚠️  Não foi possível parsear o JSON automaticamente');
                }
            }
        }
    }

    if (!setupConfigFound) {
        console.log('\n⚠️  Configuração de setups não encontrada no LocalStorage');
        console.log('    Isso é normal se o app nunca foi aberto ou se a configuração foi limpa.');
    }

    console.log('\n\n💡 SOLUÇÃO: Para habilitar todos os setups:');
    console.log('\n1. Abra o MarketMind');
    console.log('2. Vá em Settings → Setups');
    console.log('3. Habilite cada setup manualmente:');
    console.log('   - Pattern 1-2-3');
    console.log('   - Bull Trap');
    console.log('   - Bear Trap');
    console.log('   - Breakout Retest');
    console.log('\nOu via DevTools (Cmd+Option+I):');
    console.log('\nconst store = JSON.parse(localStorage.getItem("marketmind-setup-storage"));');
    console.log('store.state.config.pattern123.enabled = true;');
    console.log('store.state.config.bullTrap.enabled = true;');
    console.log('store.state.config.bearTrap.enabled = true;');
    console.log('store.state.config.breakoutRetest.enabled = true;');
    console.log('localStorage.setItem("marketmind-setup-storage", JSON.stringify(store));');
    console.log('location.reload();\n');

} catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\n💡 Dica: Execute o script com sudo se houver erro de permissão');
    console.log('    sudo node scripts/enable-all-setups.mjs\n');
}
