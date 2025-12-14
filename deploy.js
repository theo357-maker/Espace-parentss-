// deploy.js - Script pour déployer une nouvelle version
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function deployNewVersion() {
  console.log('\n🚀 DÉPLOIEMENT NOUVELLE VERSION\n');
  
  // Lire la version actuelle
  const manifestContent = fs.readFileSync('version-manifest.json', 'utf8');
  const versionMatch = manifestContent.match(/"currentVersion": "([^"]+)"/);
  const currentVersion = versionMatch ? versionMatch[1] : '2.1.0';
  
  console.log(`📋 Version actuelle: ${currentVersion}`);
  
  // Demander le type de mise à jour
  console.log('\n📊 Type de mise à jour:');
  console.log('1. Patch (2.1.0 → 2.1.1) - Corrections de bugs');
  console.log('2. Minor (2.1.0 → 2.2.0) - Nouvelles fonctionnalités');
  console.log('3. Major (2.1.0 → 3.0.0) - Changements majeurs');
  
  const typeChoice = await askQuestion('\nChoisir (1-3): ');
  
  let newVersion;
  const parts = currentVersion.split('.').map(Number);
  
  switch (typeChoice) {
    case '2':
      parts[1] += 1;
      parts[2] = 0;
      newVersion = parts.join('.');
      break;
    case '3':
      parts[0] += 1;
      parts[1] = 0;
      parts[2] = 0;
      newVersion = parts.join('.');
      break;
    case '1':
    default:
      parts[2] += 1;
      newVersion = parts.join('.');
      break;
  }
  
  // Demander le changelog
  console.log(`\n📝 Nouvelle version: ${newVersion}`);
  const changelog = await askQuestion('Notes de version: ');
  
  // Demander si mise à jour obligatoire
  const mandatory = (await askQuestion('Mise à jour obligatoire ? (o/n): ')).toLowerCase() === 'o';
  
  // Date actuelle
  const today = new Date().toISOString().split('T')[0];
  
  // Mettre à jour le manifest
  let newManifestContent = manifestContent
    .replace(/"currentVersion": "[^"]+"/, `"currentVersion": "${newVersion}"`)
    .replace(/"releaseDate": "[^"]+"/, `"releaseDate": "${today}"`)
    .replace(/"changelog": "[^"]*"/, `"changelog": "${changelog.replace(/"/g, '\\"')}"`)
    .replace(/"mandatory": [^,]+/, `"mandatory": ${mandatory}`);
  
  fs.writeFileSync('version-manifest.json', newManifestContent);
  
  // Mettre à jour sw.js (version dans le cache)
  let swContent = fs.readFileSync('sw.js', 'utf8');
  swContent = swContent.replace(
    /let APP_VERSION = '[^']+'/,
    `let APP_VERSION = '${newVersion}'`
  );
  fs.writeFileSync('sw.js', swContent);
  
  console.log('\n✅ FICHIERS MIS À JOUR:');
  console.log(`- version-manifest.json → v${newVersion}`);
  console.log(`- sw.js → Cache: colombe-cache-v${newVersion}`);
  
  // Générer les commandes Git
  console.log('\n📦 COMMANDES GIT:');
  console.log('git add .');
  console.log(`git commit -m "Release v${newVersion}: ${changelog}"`);
  console.log('git push origin main');
  
  // Info déploiement
  console.log('\n🚀 DÉPLOIEMENT:');
  console.log(`1. Les utilisateurs recevront une notification pour v${newVersion}`);
  console.log(`2. ${mandatory ? 'Mise à jour OBLIGATOIRE' : 'Mise à jour optionnelle'}`);
  console.log('3. GitHub Pages se mettra à jour en 1-2 minutes');
  
  rl.close();
}

deployNewVersion().catch(console.error);