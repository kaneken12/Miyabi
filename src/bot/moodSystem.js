// Ajoutez le paramètre db dans le constructeur
constructor(db = null) {
    this.db = db;
    // ... reste du constructeur
}

// Modifiez la méthode changeMood
changeMood(newMoodName) {
    const newMood = this.moods.find(m => m.name === newMoodName);
    if (newMood && newMood !== this.currentMood) {
        const previousMood = this.currentMood;
        const moodDuration = Date.now() - this.moodStartTime;
        
        this.currentMood = newMood;
        this.moodStartTime = Date.now();
        console.log(`🎭 Humeur changée: ${previousMood.name} → ${newMood.name} (${newMood.description})`);
        
        // Sauvegarder le changement d'humeur en base
        if (this.db) {
            this.db.saveMoodChange(newMood.name, moodDuration);
        }
        
        // Planifier le prochain changement d'humeur
        this.scheduleNextMoodChange();
    }
}