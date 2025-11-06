const { Pool } = require('pg');

class Database {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.init();
    }

    async init() {
        try {
            await this.createTables();
            console.log('✅ Base de données initialisée');
        } catch (error) {
            console.error('❌ Erreur initialisation DB:', error);
        }
    }

    async connect() {
        try {
            await this.pool.connect();
            console.log('✅ Connecté à PostgreSQL');
        } catch (error) {
            console.error('❌ Erreur connexion DB:', error);
            throw error;
        }
    }

    async createTables() {
        const messagesTable = `
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                message_id VARCHAR(255) UNIQUE NOT NULL,
                chat_id VARCHAR(255) NOT NULL,
                sender VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                is_group BOOLEAN DEFAULT FALSE,
                is_bot BOOLEAN DEFAULT FALSE,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        const conversationsTable = `
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                chat_id VARCHAR(255) UNIQUE NOT NULL,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        const moodsTable = `
            CREATE TABLE IF NOT EXISTS mood_history (
                id SERIAL PRIMARY KEY,
                mood_name VARCHAR(50) NOT NULL,
                duration INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await this.pool.query(messagesTable);
        await this.pool.query(conversationsTable);
        await this.pool.query(moodsTable);
    }

    async saveMessage(messageData) {
        const query = `
            INSERT INTO messages (message_id, chat_id, sender, message, is_group, is_bot, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (message_id) DO NOTHING
        `;

        const values = [
            messageData.message_id,
            messageData.chat_id,
            messageData.sender,
            messageData.message,
            messageData.is_group,
            messageData.is_bot || false,
            messageData.timestamp
        ];

        try {
            await this.pool.query(query, values);
            
            // Mettre à jour la conversation
            await this.updateConversation(messageData.chat_id);
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde message:', error);
        }
    }

    async updateConversation(chatId) {
        const query = `
            INSERT INTO conversations (chat_id, last_activity, message_count)
            VALUES ($1, CURRENT_TIMESTAMP, 1)
            ON CONFLICT (chat_id) 
            DO UPDATE SET 
                last_activity = CURRENT_TIMESTAMP,
                message_count = conversations.message_count + 1
        `;

        await this.pool.query(query, [chatId]);
    }

    async getConversationContext(chatId, limit = 5) {
        const query = `
            SELECT sender, message, timestamp 
            FROM messages 
            WHERE chat_id = $1 
            ORDER BY timestamp DESC 
            LIMIT $2
        `;

        const result = await this.pool.query(query, [chatId, limit]);
        return result.rows.reverse();
    }

    async disconnect() {
        await this.pool.end();
        console.log('✅ Déconnecté de la base de données');
    }
}

module.exports = Database;