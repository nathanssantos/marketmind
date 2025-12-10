#!/usr/bin/env node

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const LOCAL_STORAGE_PATH = join(
    homedir(),
    'Library/Application Support/marketmind/Local Storage/leveldb'
);

console.log('🔍 Verificando configuração de setups...\n');

const configPath = join(
    homedir(),
    'Library/Application Support/marketmind/marketmind-secure.json'
);

try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    if (!config.setupDetection) {
        console.log('⚠️  Nenhuma configuração de setups encontrada no arquivo.');
        console.log('📝 O LocalStorage deve ser verificado manualmente no DevTools.\n');
        console.log('Para verificar/habilitar setups:');
        console.log('1. Abra o app MarketMind');
        console.log('2. Abra DevTools (Cmd+Option+I)');
        console.log('3. Vá para Console');
        console.log('4. Execute:');
        console.log('\n   const store = JSON.parse(localStorage.getItem("marketmind-setup-storage"));');
        console.log('   console.log(store.state.config);\n');
        console.log('Para habilitar todos os setups:');
        console.log('\n   store.state.config.pattern123.enabled = true;');
        console.log('   store.state.config.bullTrap.enabled = true;');
        console.log('   store.state.config.bearTrap.enabled = true;');
        console.log('   store.state.config.breakoutRetest.enabled = true;');
        console.log('   localStorage.setItem("marketmind-setup-storage", JSON.stringify(store));');
        console.log('   location.reload();\n');
    } else {
        console.log('✅ Configuração de setups encontrada!');
        console.log(JSON.stringify(config.setupDetection, null, 2));
    }
} catch (error) {
    console.error('❌ Erro ao ler arquivo de configuração:', error.message);
    console.log('\n📝 Para verificar setups via DevTools:');
    console.log('1. Abra MarketMind');
    console.log('2. DevTools (Cmd+Option+I) → Console');
    console.log('3. Execute: JSON.parse(localStorage.getItem("marketmind-setup-storage")).state.config\n');
}
