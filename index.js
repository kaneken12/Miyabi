// index.js (CommonJS)
require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const MiyabiBot = require('./src/bot/miyabibot');
const Helper = require('./src/utils/Helper');
const Database = require('./src/database/db');

const logger = pino({ level: process.env.PINO_LEVEL || 'silent' });

class WhatsAppClient {
  constructor() {
    this.sock = null;
    this.bot = null;
    this.db = null;
    this.authState = null;
    this.saveCreds = null;
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
      console.error("❌ Erreur lors de l'initialisation:", error);
      process.exit(1);
    }
  }

  async connectToWhatsApp() {
    // Auth state multi-file (répertoire auth_info_baileys)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    this.authState = state;
    this.saveCreds = saveCreds;

    // Récupère la version la plus récente de WA Web
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📱 Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    // Crée un cacheable key store avec le même logger (évite conflits et log incohérent)
    const keys = makeCacheableSignalKeyStore(state.keys, logger);

    // Crée la socket Baileys
    this.sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false, // on gère l'affichage QR nous-même
      auth: {
        creds: state.creds,
        keys
      },
      generateHighQualityLinkPreview: true
    });

    // Écouteurs
    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update));
    this.sock.ev.on('messages.upsert', (m) => this.handleMessagesUpsert(m));
    // optionnel: log d'erreurs non catchées
    this.sock.ev.on('connection.error', (err) => logger.error({ err }, 'connection.error'));
  }

  async handleConnectionUpdate(update) {
    try {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('🔐 Scan ce QR code pour vous connecter:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        // Récupère le statusCode en sécurité (selon la forme que prend lastDisconnect)
        let statusCode = null;
        try {
          statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
            ? lastDisconnect.error.output.statusCode
            : null;
        } catch (e) {
          statusCode = null;
        }

        // Si la déconnexion provient d'un logout (session supprimée), ne pas reconnecter automatiquement
        if (statusCode === DisconnectReason.loggedOut) {
          console.log('❌ Session déconnectée : logged out. Supprime le dossier auth_info_baileys et rescan le QR.');
          return;
        }

        console.log('❌ Connection closed, attempting to reconnect...');
        // Reconnexion progressive
        setTimeout(() => {
          // protège en cas d'appel après arrêt du process
          if (this.sock) {
            console.log('🔁 Tentative de reconnexion...');
            this.connectToWhatsApp().catch(err => {
              console.error('❌ Erreur lors de la reconnexion :', err);
            });
          }
        }, 5000);
      } else if (connection === 'open') {
        console.log('✅ Connecté à WhatsApp avec succès!');
        console.log('🤖 Miyabi est maintenant opérationnelle!');
      }
    } catch (err) {
      // évite crash si update a une forme inattendue
      console.error('❌ Erreur handleConnectionUpdate:', err);
    }
  }

  async handleMessagesUpsert(m) {
    try {
      // m peut être { messages, type } ou structure équivalente
      const { messages, type } = m || {};

      // Filtre : ne traiter que les notifications entrantes (évite historique / append)
      if (type && type !== 'notify') return;

      if (!Array.isArray(messages) || messages.length === 0) return;

      const message = messages[0];
      if (!message) return;
      if (!message.message) return;
      if (message.key && message.key.fromMe) return; // ignore les messages envoyés par le bot lui-même

      try {
        await this.bot.handleMessage(message, this.sock);
      } catch (err) {
        console.error('❌ Erreur lors du traitement du message:', err);
      }
    } catch (err) {
      console.error('❌ Erreur handleMessagesUpsert:', err);
    }
  }

  // méthode pour arrêter proprement (optionnel)
  async shutdown() {
    try {
      console.log('\n👋 Arrêt de Miyabi...');
      if (this.db && typeof this.db.disconnect === 'function') {
        await this.db.disconnect();
      }

      // tente de sauvegarder les credentials avant de quitter
      if (typeof this.saveCreds === 'function') {
        try {
          await this.saveCreds();
        } catch (e) {
          // saveCreds peut échouer si déjà supprimé, ignore
        }
      }

      // ferme la socket proprement si possible
      try {
        if (this.sock && this.sock.ws && typeof this.sock.ws.close === 'function') {
          this.sock.ws.close();
        }
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('❌ Erreur pendant shutdown:', err);
    } finally {
      process.exit(0);
    }
  }
}

// Démarrage de l'application
const client = new WhatsAppClient();
client.initialize().catch(err => {
  console.error('❌ Erreur init client:', err);
  process.exit(1);
});

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
  await client.shutdown();
});
process.on('SIGTERM', async () => {
  await client.shutdown();
});

// catch unhandled rejections pour debug (optionnel mais utile)
process.on('unhandledRejection', (reason, p) => {
  logger.error({ reason, p }, 'Unhandled Rejection');
});