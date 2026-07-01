const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const SESSION_FOLDER = './session';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Desktop')
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('Scan this QR or use Pairing Code below:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            console.log('✅ MUFASER-X CONNECTED!');
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) startBot();
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // PAIRING CODE PART
    if (!sock.authState.creds.registered) {
        await delay(2000);
        const phoneNumber = await question('Enter your WhatsApp number with country code: ex: 2567XXXXXXX\n> ');
        const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
        console.log('🔑 YOUR PAIRING CODE:', code?.match(/.{1,4}/g)?.join('-') || code);
    }
}

function question(text) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(text, ans => { rl.close(); resolve(ans); }));
}

startBot();