function extractMessageText(message) {
    if (!message.message) return null;

    const messageTypes = [
        'conversation',
        'extendedTextMessage',
        'imageMessage',
        'videoMessage',
        'documentMessage'
    ];

    for (const type of messageTypes) {
        if (message.message[type]) {
            return message.message[type].text || 
                   message.message[type].caption || 
                   message.message[type].conversation;
        }
    }

    return null;
}

function isGroupMessage(message) {
    return message.key.remoteJid.endsWith('@g.us');
}

function shouldRespond(messageText, botName, message) {
    if (!messageText) return false;

    const lowerMessage = messageText.toLowerCase();
    const botNameLower = botName.toLowerCase();
    const isGroup = isGroupMessage(message);

    // Répondre si mentionné dans un groupe
    if (isGroup && message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botName)) {
        return true;
    }

    // Répondre si taggé avec @
    if (isGroup && lowerMessage.includes(`@${botNameLower}`)) {
        return true;
    }

    // Répondre si son nom est mentionné
    if (lowerMessage.includes(botNameLower)) {
        return true;
    }

    // Répondre toujours en message privé
    if (!isGroup) {
        return true;
    }

    return false;
}

function getSenderName(message) {
    if (message.pushName) {
        return message.pushName;
    }
    
    const sender = message.key.participant || message.key.remoteJid;
    return sender.split('@')[0];
}

module.exports = {
    extractMessageText,
    isGroupMessage,
    shouldRespond,
    getSenderName
};