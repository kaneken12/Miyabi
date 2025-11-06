const { shouldRespond, extractMessageText, isGroupMessage, getSenderName } = require('../utils/helpers');

class MessageHandler {
    constructor(bot) {
        this.bot = bot;
        this.commands = new Map();
        this.setupCommands();
    }

    setupCommands() {
        // Commande d'aide
        this.commands.set('aide', this.handleHelp.bind(this));
        this.commands.set('help', this.handleHelp.bind(this));
        
        // Commande d'humeur
        this.commands.set('humeur', this.handleMood.bind(this));
        this.commands.set('mood', this.handleMood.bind(this));
        
        // Commande statut
        this.commands.set('statut', this.handleStatus.bind(this));
        this.commands.set('status', this.handleStatus.bind(this));
        
        // Commandes réservées à la mère
        this.commands.set('changehumeur', this.handleChangeMood.bind(this));
        this.commands.set('forcerhumeur', this.handleChangeMood.bind(this));
    }

    async handleMessage(message, sock) {
        const messageText = extractMessageText(message);
        if (!messageText) return;

        const chatId = message.key.remoteJid;
        const isGroup = isGroupMessage(message);
        const sender = message.key.participant || message.key.remoteJid;
        const senderName = getSenderName(message);

        console.log(`📩 Message reçu de ${senderName}: ${messageText}`);

        // Vérifier si c'est une commande
        if (await this.handleCommand(messageText, message, sock)) {
            return;
        }

        // Vérifier si Miyabi doit répondre
        if (shouldRespond(messageText, this.bot.name, message)) {
            await this.bot.generateAndSendResponse(message, sock);
        } else {
            // Analyser le message pour les déclencheurs d'humeur même si pas de réponse
            this.bot.moodSystem.analyzeMessageForMoodTrigger(messageText);
        }
    }

    async handleCommand(messageText, message, sock) {
        const chatId = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        const isCreator = sender === this.bot.creator;
        
        const commandMatch = messageText.toLowerCase().match(/^!(\w+)\s*(.*)$/);
        if (!commandMatch) return false;

        const [, command, args] = commandMatch;
        
        if (this.commands.has(command)) {
            await this.commands.get(command)(args, message, sock, isCreator);
            return true;
        }

        // Commande inconnue
        if (isCreator) {
            await sock.sendMessage(chatId, { 
                text: `❌ Commande inconnue: !${command}\nTapez !aide pour voir les commandes disponibles.` 
            });
        }
        
        return true;
    }

    async handleHelp(args, message, sock, isCreator) {
        const chatId = message.key.remoteJid;
        
        let helpText = `🎀 *Aide de Miyabi* 🎀\n\n`;
        helpText += `*Commandes disponibles:*\n`;
        helpText += `• !aide - Affiche ce message d'aide\n`;
        helpText += `• !humeur - Affiche l'humeur actuelle de Miyabi\n`;
        helpText += `• !statut - Affiche le statut du bot\n`;
        
        if (isCreator) {
            helpText += `\n*Commandes réservées à ma mère:*\n`;
            helpText += `• !changehumeur <humeur> - Change l'humeur de Miyabi\n`;
            helpText += `• !forcerhumeur <humeur> - Force un changement d'humeur\n`;
            helpText += `\nHumeurs disponibles: happy, sad, angry, excited, tired, neutral`;
        }
        
        helpText += `\n\n*Utilisation normale:*\n`;
        helpText += `• En privé: Parlez directement à Miyabi\n`;
        helpText += `• En groupe: Mentionnez @${this.bot.name} ou dites "Miyabi"`;

        await sock.sendMessage(chatId, { text: helpText });
    }

    async handleMood(args, message, sock) {
        const chatId = message.key.remoteJid;
        const currentMood = this.bot.moodSystem.getCurrentMood();
        const moodDuration = Date.now() - this.bot.moodSystem.moodStartTime;
        const minutes = Math.floor(moodDuration / 60000);

        let moodText = `🎭 *Humeur actuelle de Miyabi:*\n\n`;
        moodText += `*${this.getMoodEmoji(currentMood.name)} ${currentMood.name.toUpperCase()}*\n`;
        moodText += `_${currentMood.description}_\n\n`;
        moodText += `📊 Intensité: ${Math.round(currentMood.intensity * 100)}%\n`;
        moodText += `⏰ Depuis: ${minutes} minute${minutes > 1 ? 's' : ''}\n\n`;
        
        // Message d'humeur spécifique
        const moodMessages = {
            happy: "Je me sens tellement bien aujourd'hui ! Tout est génial ! 🌸",
            sad: "Je ne me sens pas très bien... J'ai besoin de réconfort... 😔",
            angry: "GRRR ! Ne m'énerve pas en ce moment ! 😠",
            excited: "WOUHOU ! Je suis super excitée ! Trop de choses géniales ! 🎉",
            tired: "Bâille... Je suis si fatiguée... J'ai besoin de dormir... 😴",
            neutral: "Je me sens plutôt calme et équilibrée en ce moment. 😐"
        };

        moodText += moodMessages[currentMood.name] || "Je me sens un peu particulière aujourd'hui...";

        await sock.sendMessage(chatId, { text: moodText });
    }

    async handleStatus(args, message, sock) {
        const chatId = message.key.remoteJid;
        const currentMood = this.bot.moodSystem.getCurrentMood();
        
        // Statistiques de la base de données
        const stats = await this.bot.db.getStats();
        
        let statusText = `🤖 *Statut de Miyabi*\n\n`;
        statusText += `📍 *État:* 🟢 En ligne\n`;
        statusText += `🎭 *Humeur:* ${this.getMoodEmoji(currentMood.name)} ${currentMood.name}\n`;
        statusText += `💾 *Messages traités:* ${stats.totalMessages || 0}\n`;
        statusText += `👥 *Conversations:* ${stats.totalConversations || 0}\n`;
        statusText += `🕒 *Uptime:* ${this.formatUptime(process.uptime())}\n\n`;
        statusText += `_Miyabi est opérationnelle et prête à discuter !_`;

        await sock.sendMessage(chatId, { text: statusText });
    }

    async handleChangeMood(args, message, sock, isCreator) {
        const chatId = message.key.remoteJid;
        
        if (!isCreator) {
            await sock.sendMessage(chatId, { 
                text: "❌ Désolée, cette commande est réservée à ma mère créatrice seulement !" 
            });
            return;
        }

        const moodName = args.toLowerCase().trim();
        const validMoods = ['happy', 'sad', 'angry', 'excited', 'tired', 'neutral'];

        if (!moodName || !validMoods.includes(moodName)) {
            await sock.sendMessage(chatId, { 
                text: `❌ Usage: !changehumeur <humeur>\nHumeurs valides: ${validMoods.join(', ')}` 
            });
            return;
        }

        // Changer l'humeur
        this.bot.moodSystem.changeMood(moodName);
        const newMood = this.bot.moodSystem.getCurrentMood();

        const moodChangeMessages = {
            happy: "Youpi ! Merci maman, je me sens tellement heureuse maintenant ! 🌸✨",
            sad: "Snif... Pourquoi tu veux que je sois triste, maman ? 😢",
            angry: "GRRR ! D'accord, mais c'est toi qui vas le regretter ! 😠",
            excited: "WOUHOU ! Je suis trop excitée ! Merci maman ! 🎉🌟",
            tired: "Bâille... D'accord, je vais me reposer un peu... 😴💤",
            neutral: "D'accord maman, je me calme. Merci. 😐"
        };

        await sock.sendMessage(chatId, { 
            text: `✅ Humeur changée: ${this.getMoodEmoji(newMood.name)} ${newMood.name}\n\n${moodChangeMessages[newMood.name] || "Merci maman !"}`
        });
    }

    getMoodEmoji(moodName) {
        const moodEmojis = {
            happy: '😊',
            sad: '😢',
            angry: '😠',
            excited: '🎉',
            tired: '😴',
            neutral: '😐'
        };
        return moodEmojis[moodName] || '🎭';
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    // Gestion des messages spéciaux (images, vidéos, etc.)
    async handleMediaMessage(message, sock) {
        const chatId = message.key.remoteJid;
        const messageText = extractMessageText(message);
        
        if (message.message?.imageMessage) {
            await sock.sendMessage(chatId, { 
                text: "📸 Joli photo ! Mais je suis encore en train d'apprendre à analyser les images..." 
            });
        } else if (message.message?.videoMessage) {
            await sock.sendMessage(chatId, { 
                text: "🎥 Vidéo intéressante ! Je préfère encore le texte pour le moment." 
            });
        } else if (message.message?.documentMessage) {
            await sock.sendMessage(chatId, { 
                text: "📄 Document reçu ! Je lis surtout le texte pour l'instant." 
            });
        }
    }
}

module.exports = MessageHandler;