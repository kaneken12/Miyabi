class MoodSystem {
    constructor() {
        this.moods = [
            {
                name: 'happy',
                description: 'Joyful and enthusiastic',
                intensity: 0.8,
                duration: 10 * 60 * 1000, // 10 minutes
                triggers: ['good news', 'compliment', 'funny message']
            },
            {
                name: 'sad',
                description: 'Melancholic and emotional',
                intensity: 0.6,
                duration: 8 * 60 * 1000,
                triggers: ['bad news', 'conflict', 'lonely message']
            },
            {
                name: 'angry',
                description: 'Frustrated and irritable',
                intensity: 0.7,
                duration: 5 * 60 * 1000,
                triggers: ['insult', 'argument', 'frustration']
            },
            {
                name: 'excited',
                description: 'Energetic and hyperactive',
                intensity: 0.9,
                duration: 7 * 60 * 1000,
                triggers: ['surprise', 'celebration', 'new idea']
            },
            {
                name: 'tired',
                description: 'Sleepy and lazy',
                intensity: 0.4,
                duration: 12 * 60 * 1000,
                triggers: ['late night', 'boring conversation', 'repetitive topic']
            },
            {
                name: 'neutral',
                description: 'Calm and balanced',
                intensity: 0.4,
                duration: 15 * 60 * 1000,
                triggers: ['normal conversation', 'information request']
            }
        ];

        this.currentMood = this.moods.find(m => m.name === 'neutral');
        this.moodStartTime = Date.now();
        this.moodTimer = null;
    }

    getCurrentMood() {
        return this.currentMood;
    }

    changeMood(newMoodName) {
        const newMood = this.moods.find(m => m.name === newMoodName);
        if (newMood && newMood !== this.currentMood) {
            this.currentMood = newMood;
            this.moodStartTime = Date.now();
            console.log(`🎭 Humeur changée: ${newMood.name} (${newMood.description})`);
            
            // Planifier le prochain changement d'humeur
            this.scheduleNextMoodChange();
        }
    }

    scheduleNextMoodChange() {
        if (this.moodTimer) {
            clearTimeout(this.moodTimer);
        }

        const moodDuration = this.currentMood.duration * (0.8 + Math.random() * 0.4);
        this.moodTimer = setTimeout(() => {
            this.randomMoodChange();
        }, moodDuration);
    }

    randomMoodChange() {
        const availableMoods = this.moods.filter(m => m.name !== this.currentMood.name);
        const randomMood = availableMoods[Math.floor(Math.random() * availableMoods.length)];
        this.changeMood(randomMood.name);
    }

    startMoodUpdates() {
        // Changement d'humeur aléatoire toutes les 5-15 minutes
        const initialDelay = 5 * 60 * 1000 + Math.random() * 10 * 60 * 1000;
        setTimeout(() => {
            this.randomMoodChange();
        }, initialDelay);
    }

    // Analyser le message pour déclencher un changement d'humeur
    analyzeMessageForMoodTrigger(message) {
        const messageLower = message.toLowerCase();
        
        for (const mood of this.moods) {
            for (const trigger of mood.triggers) {
                if (messageLower.includes(trigger)) {
                    // Chance de déclencher l'humeur basée sur l'intensité
                    if (Math.random() < mood.intensity) {
                        this.changeMood(mood.name);
                        return;
                    }
                }
            }
        }
    }
}

module.exports = MoodSystem;