require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function setup() {
    console.log('🎀 Configuration de Miyabi WhatsApp Bot\n');
    
    // Vérifier si .env existe
    if (!fs.existsSync('.env')) {
        console.log('📝 Création du fichier .env...');
        fs.copyFileSync('.env.example', '.env');
    }

    // Demander les configurations
    const geminiKey = await question('🔑 Entrez votre clé API Gemini: ');
    const dbHost = await question('🗄️  Host PostgreSQL (localhost): ') || 'localhost';
    const dbPort = await question('🗄️  Port PostgreSQL (5432): ') || '5432';
    const dbName = await question('🗄️  Nom de la base de données (miyabi_bot): ') || 'miyabi_bot';
    const dbUser = await question('🗄️  Utilisateur PostgreSQL (miyabi_user): ') || 'miyabi_user';
    const dbPassword = await question('🗄️  Mot de passe PostgreSQL: ');

    // Mettre à jour le .env
    let envContent = fs.readFileSync('.env', 'utf8');
    envContent = envContent.replace('votre_cle_gemini_ici', geminiKey);
    envContent = envContent.replace('localhost', dbHost);
    envContent = envContent.replace('5432', dbPort);
    envContent = envContent.replace('miyabi_bot', dbName);
    envContent = envContent.replace('miyabi_user', dbUser);
    envContent = envContent.replace('miyabi_password', dbPassword);

    fs.writeFileSync('.env', envContent);

    console.log('\n✅ Configuration terminée!');
    console.log('📦 Installation des dépendances...');

    try {
        execSync('npm install', { stdio: 'inherit' });
        console.log('🎉 Installation terminée!');
        console.log('\n🚀 Pour démarrer le bot:');
        console.log('   npm start');
    } catch (error) {
        console.error('❌ Erreur lors de l\'installation:', error);
    }

    rl.close();
}

setup().catch(console.error);