require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const MiyabiBot = require('./src/bot/miyabibot');
const Helpers = require('./src/utils/Helpers);
const Database = require('./src/database/db');

class WhatsAppClient {
    constructor() {
        this.sock = null;
        this.bot = null;
        this.db = null;
        this.authState = null;
    }

    async initialize() {
        try {
            console.log('🚀 Initialisation du bot Miyabi...');
            
            // Initialisation de la base de données
            this.db = new Database();
            await this.db.connect();
            
            // Initialisation du bot
            this.bot = new MiyabiBot(this.db);
            
            // Connexion WhatsApp
            await this.connectToWhatsApp();
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            process.exit(1);
        }
    }

    async connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        this.authState = state;

        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`📱 Using WA v${version.join('.')}, isLatest: ${isLatest}`);

        this.sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
            },
            generateHighQualityLinkPreview: true,
        });

        this.sock.ev.on('creds.update', saveCreds);
        this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
        this.sock.ev.on('messages.upsert', this.handleMessagesUpsert.bind(this));
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('🔐 Scan ce QR code pour vous connecter:');
            require('qrcode-terminal').generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Connection closed, reconnecting...', shouldReconnect);
            
            if (shouldReconnect) {
                setTimeout(() => this.connectToWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ Connecté à WhatsApp avec succès!');
            console.log('🤖 Miyabi est maintenant opérationnelle!');
        }
    }

    async handleMessagesUpsert({ messages }) {
        const message = messages[0];
        if (!message.message || message.key.fromMe) return;

        try {
            await this.bot.handleMessage(message, this.sock);
        } catch (error) {
            console.error('❌ Erreur lors du traitement du message:', error);
        }
    }
}

// Démarrage de l'application
const client = new WhatsAppClient();
client.initialize().catch(console.error);

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
    console.log('\n👋 Arrêt de Miyabi...');
    if (client.db) {
        await client.db.disconnect();
    }
    process.exit(0);
});