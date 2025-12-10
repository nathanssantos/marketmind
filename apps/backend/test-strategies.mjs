import { StrategyLoader } from './src/services/setup-detection/dynamic/StrategyLoader.js';

const loader = new StrategyLoader();

try {
    const all = await loader.loadAll();
    console.log(`✓ Loaded ${all.length} strategies successfully`);
    process.exit(0);
} catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
}
