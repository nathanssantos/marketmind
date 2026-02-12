import Binance from 'binance';
import crypto from 'crypto';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function decrypt(encryptedText) {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

async function getWalletCredentials(walletId) {
    const result = await pool.query(`
    SELECT api_key_encrypted, api_secret_encrypted 
    FROM wallets WHERE id = $1
  `, [walletId]);

    const apiKey = decrypt(result.rows[0].api_key_encrypted);
    const apiSecret = decrypt(result.rows[0].api_secret_encrypted);

    return { apiKey, apiSecret };
}

async function main() {
    const wallet = await pool.query("SELECT id FROM wallets WHERE wallet_type = 'live' LIMIT 1");
    const { apiKey, apiSecret } = await getWalletCredentials(wallet.rows[0].id);

    const client = new Binance.USDMClient({
        api_key: apiKey,
        api_secret: apiSecret,
    });

    console.log('🧹 Cancelling ALL algo orders for DOTUSDT and BNBUSDT...\n');

    try {
        await client.cancelAllAlgoOpenOrders({ symbol: 'DOTUSDT' });
        console.log('✅ Cancelled all DOTUSDT algo orders');
    } catch (e) {
        console.log('⚠️ DOTUSDT:', e.message);
    }

    try {
        await client.cancelAllAlgoOpenOrders({ symbol: 'BNBUSDT' });
        console.log('✅ Cancelled all BNBUSDT algo orders');
    } catch (e) {
        console.log('⚠️ BNBUSDT:', e.message);
    }

    await pool.end();
    console.log('\n✅ Done! Now run recreate-protection-orders.mjs to create fresh orders.');
}

main().catch(console.error);
