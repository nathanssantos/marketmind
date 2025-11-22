#!/usr/bin/env node

import { existsSync, readdirSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const getStoragePath = () => {
    const platform = process.platform;
    const appName = 'MarketMind';

    if (platform === 'darwin') {
        return join(homedir(), 'Library', 'Application Support', appName);
    } else if (platform === 'win32') {
        return join(process.env.APPDATA || '', appName);
    } else {
        return join(homedir(), '.config', appName);
    }
};

const clearStorage = () => {
    const storagePath = getStoragePath();
    const configFile = join(storagePath, 'config.json');

    console.log('🧹 Clearing Electron Storage...\n');
    console.log(`📂 Storage path: ${storagePath}`);

    if (!existsSync(storagePath)) {
        console.log('✅ Storage directory does not exist. Nothing to clear.');
        return;
    }

    if (existsSync(configFile)) {
        try {
            unlinkSync(configFile);
            console.log('✅ Deleted config.json');
        } catch (error) {
            console.error('❌ Failed to delete config.json:', error.message);
        }
    } else {
        console.log('ℹ️  config.json not found');
    }

    try {
        const files = readdirSync(storagePath);
        console.log(`\n📋 Files in storage directory: ${files.length}`);
        files.forEach(file => console.log(`   - ${file}`));
    } catch (error) {
        console.error('❌ Failed to list files:', error.message);
    }

    console.log('\n✨ Storage cleared successfully!');
    console.log('ℹ️  Restart the app to verify.');
};

clearStorage();
