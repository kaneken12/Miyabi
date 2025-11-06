class Message {
    constructor(data) {
        this.id = data.id;
        this.message_id = data.message_id;
        this.chat_id = data.chat_id;
        this.sender = data.sender;
        this.message = data.message;
        this.is_group = data.is_group || false;
        this.is_bot = data.is_bot || false;
        this.timestamp = data.timestamp || new Date();
        this.created_at = data.created_at || new Date();
    }

    toJSON() {
        return {
            id: this.id,
            message_id: this.message_id,
            chat_id: this.chat_id,
            sender: this.sender,
            message: this.message,
            is_group: this.is_group,
            is_bot: this.is_bot,
            timestamp: this.timestamp,
            created_at: this.created_at
        };
    }
}

class Conversation {
    constructor(data) {
        this.id = data.id;
        this.chat_id = data.chat_id;
        this.last_activity = data.last_activity || new Date();
        this.message_count = data.message_count || 0;
        this.created_at = data.created_at || new Date();
    }

    toJSON() {
        return {
            id: this.id,
            chat_id: this.chat_id,
            last_activity: this.last_activity,
            message_count: this.message_count,
            created_at: this.created_at
        };
    }
}

class MoodHistory {
    constructor(data) {
        this.id = data.id;
        this.mood_name = data.mood_name;
        this.duration = data.duration;
        this.timestamp = data.timestamp || new Date();
    }

    toJSON() {
        return {
            id: this.id,
            mood_name: this.mood_name,
            duration: this.duration,
            timestamp: this.timestamp
        };
    }
}

class User {
    constructor(data) {
        this.id = data.id;
        this.phone_number = data.phone_number;
        this.name = data.name;
        this.is_creator = data.is_creator || false;
        this.last_seen = data.last_seen || new Date();
        this.interaction_count = data.interaction_count || 0;
        this.created_at = data.created_at || new Date();
    }

    toJSON() {
        return {
            id: this.id,
            phone_number: this.phone_number,
            name: this.name,
            is_creator: this.is_creator,
            last_seen: this.last_seen,
            interaction_count: this.interaction_count,
            created_at: this.created_at
        };
    }
}

class BotSettings {
    constructor(data) {
        this.id = data.id;
        this.setting_key = data.setting_key;
        this.setting_value = data.setting_value;
        this.setting_type = data.setting_type || 'string';
        this.description = data.description;
        this.updated_at = data.updated_at || new Date();
    }

    toJSON() {
        return {
            id: this.id,
            setting_key: this.setting_key,
            setting_value: this.setting_value,
            setting_type: this.setting_type,
            description: this.description,
            updated_at: this.updated_at
        };
    }
}

// Fonctions utilitaires pour créer des instances
class ModelFactory {
    static createMessage(data) {
        return new Message(data);
    }

    static createConversation(data) {
        return new Conversation(data);
    }

    static createMoodHistory(data) {
        return new MoodHistory(data);
    }

    static createUser(data) {
        return new User(data);
    }

    static createBotSettings(data) {
        return new BotSettings(data);
    }

    // Méthode pour créer des objets à partir des résultats de base de données
    static createFromDB(type, dbRow) {
        const creators = {
            'message': this.createMessage,
            'conversation': this.createConversation,
            'mood_history': this.createMoodHistory,
            'user': this.createUser,
            'bot_settings': this.createBotSettings
        };

        if (creators[type]) {
            return creators[type](dbRow);
        }
        throw new Error(`Type de modèle inconnu: ${type}`);
    }

    // Méthode pour créer des tableaux d'objets
    static createMultipleFromDB(type, dbRows) {
        return dbRows.map(row => this.createFromDB(type, row));
    }
}

module.exports = {
    Message,
    Conversation,
    MoodHistory,
    User,
    BotSettings,
    ModelFactory
};