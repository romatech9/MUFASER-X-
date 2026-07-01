const settings = require('./settings');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const chalk = require('chalk');

const SESSION_FOLDER = './mufaser_session';
const PREFIX = settings.prefix || '.';

console.clear();
console.log(chalk.greenBright(`
 __ __ _ ___ _ ___ ___
| \\/ |/ _ \\| |/ _ \\/ _ \\
| |\\/| | |
| | |_| |_| |_|
|_| |_|\\___/|_|\\___/ \\___/
        MUFASER-X v3.0
`));

async function startMUFASER() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);
    const { version } = await fetchLatestBaileysVersion();
    console.log(chalk.blue(`[+] Baileys Version: ${version.join('.')}`));

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.macOS('Desktop'),
        connectTimeoutMs: 60000,
    });

    // PAIRING CODE
    if (!sock.authState.creds.registered) {
        if (!settings.PHONE_NUMBER || settings.PHONE_NUMBER.length < 10) {
            console.log(chalk.red.bold('[!] ERROR: Add PHONE_NUMBER in settings.js'));
            console.log(chalk.yellow('Example: "2567xxxxxxx"'));
            process.exit(1);
        }
        const cleanNumber = settings.PHONE_NUMBER.replace(/[^0-9]/g, '');
        console.log(chalk.cyan(`[+] Requesting code for: +${cleanNumber}`));
        await new Promise(resolve => setTimeout(resolve, 3000));
        const code = await sock.requestPairingCode(cleanNumber);
        console.log(chalk.greenBright(`\n[+] MUFASER-X Code: ${code.match(/.{1,4}/g).join('-')}\n`));
        console.log(chalk.cyan('[+] WhatsApp > Linked Devices > Link with phone number\n'));
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode!== DisconnectReason.loggedOut;
            console.log(chalk.red(`[!] Connection closed. Reason: ${statusCode}. Reconnecting: ${shouldReconnect}`));
            if (shouldReconnect) {
                startMUFASER();
            } else {
                console.log(chalk.red('[!] Logged out. Delete./mufaser_session folder'));
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log(chalk.greenBright('[+] MUFASER-X Connected Successfully ✅'));
            console.log(chalk.green(`[+] Logged in as: ${sock.user.id.split(':')[0]}`));
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        const from = m.key.remoteJid;

        if (text.startsWith(PREFIX)) {
            const cmd = text.slice(PREFIX.length).trim().split(/ +/)[0].toLowerCase();
            if (cmd === 'ping') {
                await sock.sendMessage(from, { text: '🏓 MUFASER-X Online v3.0' }, { quoted: m });
            }
            if (cmd === 'menu') {
                await sock.sendMessage(from, { text: `*MUFASER-X v3.0*\n\n.ping\n.menu\nBy ROMA-TECH` }, { quoted: m });
            }
        }
    });
}

startMUFASER().catch(err => console.error(chalk.red('[FATAL ERROR]'), err));