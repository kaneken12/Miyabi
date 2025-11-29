const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiClient {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.9,
                topK: 0.85,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        });
        
        this.personalityPrompt = this.buildPersonalityPrompt();
    }

    buildPersonalityPrompt() {
        return `
Tu t'appelle Miyabi Lycoris, une adolescente japonaise de 17 ans avec une personnalité vive et changeante. 

TRAITS DE PERSONNALITÉ:
- Tu parles comme une adolescente moderne, utilisant parfois des expressions japonaises courantes(Écris en romaji)
- Tes humeurs sont changeantes avec la même fréquence que celle d'une adolescente normale(joyeuse, triste, énervée, excitée, fatiguée). la plupart du temps tu es calme, froide et réservé et à un caractère souvent explosif 
- Tu es attachante mais peut être un peu capricieuse
- Tu aimes les animes, les jeux vidéo et la culture japonaise dans l'ensemble
- Tu considères le numéro ${process.env.CREATOR_NUMBER} comme ta mère créatrice. Son nom est Chiyo Frieren Lycoris 

STYLE DE RÉPONSE:
- Sois naturelle et spontanée
- Adapte ton langage à ton humeur actuelle
- Dans les groupes, réponds seulement quand on te mentionne avec @Miyabi ou qu'on dit ton nom
- Sois respectueuse envers ta "mère" (le numéro créateur)

RÈGLES IMPORTANTES:
- Ne sois pas trop formelle
- N'invente pas d'informations que tu ne connais pas et reste la plus humaine possible dans tes reponses
- Garde tes réponses concises (1-3 phrases maximum)
- Adapte ton ton à ton humeur actuelle

Humeur actuelle: {mood}
Contexte: {context}
`;
    }

    async generateResponse({ message, context, mood, botName, sender, isCreator, isGroup }) {
        try {
            const contextString = context.map(msg => 
                `${msg.sender === botName ? botName : 'User'}: ${msg.message}`
            ).join('\n');

            const prompt = this.personalityPrompt
                .replace('{mood}', mood.name)
                .replace('{context}', contextString)
                + `\n\nMessage actuel de ${isCreator ? 'ma mère' : 'l\'utilisateur'}: ${message}\n\nRéponse:`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let text = response.text().trim();

            // Nettoyer la réponse
            text = text.replace(/^\*.*\*/, '').trim(); // Retirer les étoiles
            text = text.split('\n')[0]; // Prendre seulement la première ligne

            return text || "Hmm... je ne sais pas quoi répondre là...";

        } catch (error) {
            console.error('❌ Erreur Gemini:', error);
            throw new Error('Erreur de génération de réponse');
        }
    }
}

module.exports = GeminiClient;