    const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const readline = require('readline');

const SESSION_FOLDER = './session';
let askedForCode = false;

async function question(text) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(text, ans => { rl.close(); resolve(ans); }));
}

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
            console.log('Scan this QR or wait for Pairing Code:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            console.log('✅ MUFASER-X CONNECTED!');
            askedForCode = true;
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect.error?.output?.statusCode;
            if (statusCode === 401) {
                console.log('❌ Logged out. Delete session folder and restart.');
                process.exit();
            }
            console.log('Connection closed. Waiting 5s to retry...');
            await delay(5000);
            startBot();
        }
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    // PAIRING CODE - ONLY ASK ONCE
    if (!state.creds.registered && !askedForCode) {
        askedForCode = true;
        await delay(3000);
        const phoneNumber = await question('\nEnter your WhatsApp number with country code, no +: ex: 2567XXXXXXX\n> ');
        const code = await sock.requestPairingCode(phoneNumber.replace(/[^0-9]/g, ''));
        console.log('\n🔑 YOUR PAIRING CODE:', code?.match(/.{1,4}/g)?.join('-') || code);
        console.log('Go WhatsApp > Linked Devices > Link with phone number\n');
    }
}

startBot();