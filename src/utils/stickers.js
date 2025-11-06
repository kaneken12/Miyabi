class StickerManager {
    constructor() {
        this.moodStickers = {
            happy: [
                'https://raw.githubusercontent.com/your-repo/stickers/main/happy1.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/happy2.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/happy3.webp'
            ],
            sad: [
                'https://raw.githubusercontent.com/your-repo/stickers/main/sad1.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/sad2.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/sad3.webp'
            ],
            angry: [
                'https://raw.githubusercontent.com/your-repo/stickers/main/angry1.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/angry2.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/angry3.webp'
            ],
            excited: [
                'https://raw.githubusercontent.com/your-repo/stickers/main/excited1.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/excited2.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/excited3.webp'
            ],
            tired: [
                'https://raw.githubusercontent.com/your-repo/stickers/main/tired1.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/tired2.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/tired3.webp'
            ],
            neutral: [
                'https://raw.githubusercontent.com/your-repo/stickers/main/neutral1.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/neutral2.webp',
                'https://raw.githubusercontent.com/your-repo/stickers/main/neutral3.webp'
            ]
        };
    }

    getStickerForMood(moodName) {
        const stickers = this.moodStickers[moodName] || this.moodStickers.neutral;
        return stickers[Math.floor(Math.random() * stickers.length)];
    }

    addSticker(moodName, stickerUrl) {
        if (!this.moodStickers[moodName]) {
            this.moodStickers[moodName] = [];
        }
        this.moodStickers[moodName].push(stickerUrl);
    }
}

module.exports = StickerManager;