const { Pool } = require('pg');
const { ModelFactory, User, BotSettings } = require('./models');

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
            await this.initializeDefaultSettings();
            await this.initializeCreatorUser();
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
        // Table des messages
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
            
            CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
        `;

        // Table des conversations
        const conversationsTable = `
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                chat_id VARCHAR(255) UNIQUE NOT NULL,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_conversations_last_activity ON conversations(last_activity);
        `;

        // Table historique des humeurs
        const moodsTable = `
            CREATE TABLE IF NOT EXISTS mood_history (
                id SERIAL PRIMARY KEY,
                mood_name VARCHAR(50) NOT NULL,
                duration INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_mood_history_timestamp ON mood_history(timestamp);
        `;

        // Table des utilisateurs
        const usersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(255),
                is_creator BOOLEAN DEFAULT FALSE,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                interaction_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
            CREATE INDEX IF NOT EXISTS idx_users_is_creator ON users(is_creator);
        `;

        // Table des paramètres du bot
        const settingsTable = `
            CREATE TABLE IF NOT EXISTS bot_settings (
                id SERIAL PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value TEXT,
                setting_type VARCHAR(20) DEFAULT 'string',
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_bot_settings_key ON bot_settings(setting_key);
        `;

        await this.pool.query(messagesTable);
        await this.pool.query(conversationsTable);
        await this.pool.query(moodsTable);
        await this.pool.query(usersTable);
        await this.pool.query(settingsTable);
    }

    async initializeDefaultSettings() {
        const defaultSettings = [
            {
                key: 'bot_name',
                value: 'Miyabi',
                type: 'string',
                description: 'Nom du bot'
            },
            {
                key: 'mood_change_interval_min',
                value: '300000',
                type: 'number',
                description: 'Intervalle minimum de changement d\'humeur (ms)'
            },
            {
                key: 'mood_change_interval_max',
                value: '900000',
                type: 'number',
                description: 'Intervalle maximum de changement d\'humeur (ms)'
            },
            {
                key: 'max_context_messages',
                value: '5',
                type: 'number',
                description: 'Nombre maximum de messages pour le contexte'
            },
            {
                key: 'response_timeout',
                value: '30000',
                type: 'number',
                description: 'Timeout pour les réponses (ms)'
            }
        ];

        for (const setting of defaultSettings) {
            const query = `
                INSERT INTO bot_settings (setting_key, setting_value, setting_type, description)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (setting_key) DO NOTHING
            `;
            await this.pool.query(query, [
                setting.key,
                setting.value,
                setting.type,
                setting.description
            ]);
        }
    }

    async initializeCreatorUser() {
        const creatorNumber = process.env.CREATOR_NUMBER;
        if (creatorNumber) {
            const query = `
                INSERT INTO users (phone_number, name, is_creator, interaction_count)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (phone_number) 
                DO UPDATE SET 
                    is_creator = EXCLUDED.is_creator,
                    last_seen = CURRENT_TIMESTAMP
            `;
            await this.pool.query(query, [creatorNumber, 'Créateur', true, 0]);
        }
    }

    async saveMessage(messageData) {
        const query = `
            INSERT INTO messages (message_id, chat_id, sender, message, is_group, is_bot, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (message_id) DO NOTHING
            RETURNING *
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
            const result = await this.pool.query(query, values);
            
            // Mettre à jour la conversation
            await this.updateConversation(messageData.chat_id);
            
            // Mettre à jour les statistiques utilisateur
            await this.updateUserStats(messageData.sender);
            
            if (result.rows.length > 0) {
                return ModelFactory.createMessage(result.rows[0]);
            }
            return null;
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde message:', error);
            return null;
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
            RETURNING *
        `;

        const result = await this.pool.query(query, [chatId]);
        return ModelFactory.createConversation(result.rows[0]);
    }

    async updateUserStats(phoneNumber) {
        const query = `
            INSERT INTO users (phone_number, last_seen, interaction_count)
            VALUES ($1, CURRENT_TIMESTAMP, 1)
            ON CONFLICT (phone_number) 
            DO UPDATE SET 
                last_seen = CURRENT_TIMESTAMP,
                interaction_count = users.interaction_count + 1,
                name = COALESCE(users.name, EXCLUDED.name)
            RETURNING *
        `;

        const result = await this.pool.query(query, [phoneNumber]);
        return ModelFactory.createUser(result.rows[0]);
    }

    async getConversationContext(chatId, limit = 5) {
        const query = `
            SELECT sender, message, timestamp, is_bot
            FROM messages 
            WHERE chat_id = $1 
            ORDER BY timestamp DESC 
            LIMIT $2
        `;

        const result = await this.pool.query(query, [chatId, limit]);
        return result.rows.reverse();
    }

    async getStats() {
        try {
            const messagesQuery = 'SELECT COUNT(*) as total_messages FROM messages';
            const conversationsQuery = 'SELECT COUNT(*) as total_conversations FROM conversations';
            const usersQuery = 'SELECT COUNT(*) as total_users FROM users';
            const botMessagesQuery = 'SELECT COUNT(*) as bot_messages FROM messages WHERE is_bot = true';
            
            const messagesResult = await this.pool.query(messagesQuery);
            const conversationsResult = await this.pool.query(conversationsQuery);
            const usersResult = await this.pool.query(usersQuery);
            const botMessagesResult = await this.pool.query(botMessagesQuery);
            
            return {
                totalMessages: parseInt(messagesResult.rows[0].total_messages),
                totalConversations: parseInt(conversationsResult.rows[0].total_conversations),
                totalUsers: parseInt(usersResult.rows[0].total_users),
                botMessages: parseInt(botMessagesResult.rows[0].bot_messages)
            };
        } catch (error) {
            console.error('❌ Erreur récupération stats:', error);
            return { 
                totalMessages: 0, 
                totalConversations: 0, 
                totalUsers: 0, 
                botMessages: 0 
            };
        }
    }

    async saveMoodChange(moodName, duration) {
        const query = `
            INSERT INTO mood_history (mood_name, duration)
            VALUES ($1, $2)
            RETURNING *
        `;

        try {
            const result = await this.pool.query(query, [moodName, duration]);
            return ModelFactory.createMoodHistory(result.rows[0]);
        } catch (error) {
            console.error('❌ Erreur sauvegarde humeur:', error);
            return null;
        }
    }

    async getMoodHistory(limit = 10) {
        const query = `
            SELECT mood_name, duration, timestamp 
            FROM mood_history 
            ORDER BY timestamp DESC 
            LIMIT $1
        `;

        try {
            const result = await this.pool.query(query, [limit]);
            return ModelFactory.createMultipleFromDB('mood_history', result.rows);
        } catch (error) {
            console.error('❌ Erreur récupération historique humeurs:', error);
            return [];
        }
    }

    async getSetting(key) {
        const query = 'SELECT * FROM bot_settings WHERE setting_key = $1';
        
        try {
            const result = await this.pool.query(query, [key]);
            if (result.rows.length > 0) {
                return ModelFactory.createBotSettings(result.rows[0]);
            }
            return null;
        } catch (error) {
            console.error('❌ Erreur récupération setting:', error);
            return null;
        }
    }

    async updateSetting(key, value) {
        const query = `
            UPDATE bot_settings 
            SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
            WHERE setting_key = $2
            RETURNING *
        `;

        try {
            const result = await this.pool.query(query, [value, key]);
            if (result.rows.length > 0) {
                return ModelFactory.createBotSettings(result.rows[0]);
            }
            return null;
        } catch (error) {
            console.error('❌ Erreur mise à jour setting:', error);
            return null;
        }
    }

    async getUser(phoneNumber) {
        const query = 'SELECT * FROM users WHERE phone_number = $1';
        
        try {
            const result = await this.pool.query(query, [phoneNumber]);
            if (result.rows.length > 0) {
                return ModelFactory.createUser(result.rows[0]);
            }
            return null;
        } catch (error) {
            console.error('❌ Erreur récupération utilisateur:', error);
            return null;
        }
    }

    async getTopUsers(limit = 10) {
        const query = `
            SELECT * FROM users 
            ORDER BY interaction_count DESC 
            LIMIT $1
        `;

        try {
            const result = await this.pool.query(query, [limit]);
            return ModelFactory.createMultipleFromDB('user', result.rows);
        } catch (error) {
            console.error('❌ Erreur récupération top utilisateurs:', error);
            return [];
        }
    }

    async getRecentConversations(limit = 10) {
        const query = `
            SELECT * FROM conversations 
            ORDER BY last_activity DESC 
            LIMIT $1
        `;

        try {
            const result = await this.pool.query(query, [limit]);
            return ModelFactory.createMultipleFromDB('conversation', result.rows);
        } catch (error) {
            console.error('❌ Erreur récupération conversations récentes:', error);
            return [];
        }
    }

    async disconnect() {
        await this.pool.end();
        console.log('✅ Déconnecté de la base de données');
    }
}

module.exports = Database;