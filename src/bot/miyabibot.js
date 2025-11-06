const GeminiClient = require('../ai/geminiClient');
const MoodSystem = require('./moodSystem');
const MessageHandler = require('./messageHandler');
const { shouldRespond, extractMessageText, isGroupMessage, getSenderName } = require('../utils/helpers');
const StickerManager = require('../utils/stickers');

class MiyabiBot {
    constructor(db) {
        this.db = db;
        this.gemini = new GeminiClient();
        this.moodSystem = new MoodSystem();
        this.stickerManager = new StickerManager();
        this.messageHandler = new MessageHandler(this);
        this.name = process.env.BOT_NAME || 'Miyabi';
        this.creator = process.env.CREATOR_NUMBER || '+237692798136';
        
        // Démarrer le système d'humeurs
        this.moodSystem.startMoodUpdates();
        
        console.log(`🎀 Miyabi initialisée - Humeur actuelle: ${this.moodSystem.getCurrentMood().name}`);
    }

    async handleMessage(message, sock) {
        const messageText = extractMessageText(message);
        if (!messageText) {
            // Gérer les messages média sans texte
            await this.messageHandler.handleMediaMessage(message, sock);
            return;
        }

        const chatId = message.key.remoteJid;
        const isGroup = isGroupMessage(message);
        const sender = message.key.participant || message.key.remoteJid;
        
        // Sauvegarder le message en base
        await this.db.saveMessage({
            message_id: message.key.id,
            chat_id: chatId,
            sender: sender,
            message: messageText,
            is_group: isGroup,
            timestamp: new Date(message.messageTimestamp * 1000)
        });

        // Traiter le message via le MessageHandler
        await this.messageHandler.handleMessage(message, sock);
    }

    async generateAndSendResponse(message, sock) {
        const chatId = message.key.remoteJid;
        const messageText = extractMessageText(message);
        const sender = message.key.participant || message.key.remoteJid;
        const isGroup = isGroupMessage(message);
        
        try {
            // Obtenir le contexte de la conversation
            const conversationContext = await this.db.getConversationContext(chatId, 5);
            
            // Obtenir l'humeur actuelle
            const currentMood = this.moodSystem.getCurrentMood();
            
            // Analyser le message pour les déclencheurs d'humeur
            this.moodSystem.analyzeMessageForMoodTrigger(messageText);
            
            // Générer la réponse avec Gemini
            const response = await this.gemini.generateResponse({
                message: messageText,
                context: conversationContext,
                mood: currentMood,
                botName: this.name,
                sender: sender,
                isCreator: sender === this.creator,
                isGroup: isGroup
            });

            if (response) {
                // Envoyer le sticker d'humeur
                const sticker = this.stickerManager.getStickerForMood(currentMood.name);
                if (sticker) {
                    await sock.sendMessage(chatId, {
                        sticker: { url: sticker }
                    });
                }

                // Envoyer la réponse textuelle
                await sock.sendMessage(chatId, { text: response });

                // Sauvegarder la réponse
                await this.db.saveMessage({
                    message_id: `response_${Date.now()}`,
                    chat_id: chatId,
                    sender: this.name,
                    message: response,
                    is_group: isGroup,
                    timestamp: new Date(),
                    is_bot: true
                });

                console.log(`💬 Miyabi a répondu (${currentMood.name}): ${response.substring(0, 50)}...`);
            }

        } catch (error) {
            console.error('❌ Erreur génération réponse:', error);
            
            // Réponse d'erreur selon l'humeur
            const errorResponses = {
                happy: "Désolée, j'ai un petit bug là... mais ça va passer! 😊",
                sad: "Je ne me sens pas bien... je n'arrive pas à répondre... 😔",
                angry: "ARRGH! Mon cerveau bug! Laisse-moi tranquille! 😠",
                excited: "Oops! Problème technique! Mais c'est pas grave! 🎉",
                tired: "Je suis trop fatiguée pour réfléchir... 😴",
                default: "Désolée, je n'arrive pas à répondre pour le moment."
            };
            
            const currentMood = this.moodSystem.getCurrentMood();
            const errorResponse = errorResponses[currentMood.name] || errorResponses.default;
            
            await sock.sendMessage(chatId, { text: errorResponse });
        }
    }
}

module.exports = MiyabiBot;