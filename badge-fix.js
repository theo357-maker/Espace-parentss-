// badge-fix.js - Correctif pour badges PWA

class PwaBadgeManager {
  constructor() {
    this.supported = this.checkSupport();
    this.currentCount = 0;
    this.init();
  }
  
  checkSupport() {
    const checks = {
      badgeApi: 'setAppBadge' in navigator,
      serviceWorker: 'serviceWorker' in navigator,
      notifications: 'Notification' in window,
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      ios: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
      android: /Android/.test(navigator.userAgent)
    };
    
    console.log('📋 Support badges:', checks);
    return checks;
  }
  
  async init() {
    // Charger le compte actuel
    this.loadCount();
    
    // Mettre à jour le badge
    await this.update(this.currentCount);
    
    // Écouter les changements
    this.setupListeners();
  }
  
  loadCount() {
    try {
      const saved = localStorage.getItem('pwa_badge_count');
      this.currentCount = saved ? parseInt(saved) : 0;
    } catch (error) {
      console.error('Erreur chargement compte badge:', error);
      this.currentCount = 0;
    }
  }
  
  saveCount() {
    try {
      localStorage.setItem('pwa_badge_count', this.currentCount.toString());
    } catch (error) {
      console.error('Erreur sauvegarde compte badge:', error);
    }
  }
  
  async update(count) {
    this.currentCount = Math.max(0, count);
    this.saveCount();
    
    console.log(`🔄 Mise à jour badge: ${this.currentCount}`);
    
    // Essayer différentes méthodes
    const methods = [
      this.setViaBadgeAPI.bind(this),
      this.setViaServiceWorker.bind(this),
      this.setViaTabTitle.bind(this)
    ];
    
    for (const method of methods) {
      try {
        const success = await method(this.currentCount);
        if (success) break;
      } catch (error) {
        console.warn('Méthode échouée:', error);
      }
    }
  }
  
  async setViaBadgeAPI(count) {
    if (!this.supported.badgeApi) return false;
    
    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
        console.log(`✅ Badge API: ${count}`);
      } else {
        await navigator.clearAppBadge();
        console.log('✅ Badge API effacé');
      }
      return true;
    } catch (error) {
      console.warn('❌ Badge API échoué:', error);
      return false;
    }
  }
  
  async setViaServiceWorker(count) {
    if (!this.supported.serviceWorker || !navigator.serviceWorker.controller) {
      return false;
    }
    
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'UPDATE_PWA_BADGE',
        count: count,
        timestamp: Date.now()
      });
      
      console.log(`✅ Demande envoyée au SW: ${count}`);
      return true;
    } catch (error) {
      console.warn('❌ Service Worker échoué:', error);
      return false;
    }
  }
  
  setViaTabTitle(count) {
    try {
      // Méthode de secours: badge dans le titre
      const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
      console.log(`📌 Badge titre: (${count})`);
      return true;
    } catch (error) {
      console.warn('❌ Badge titre échoué:', error);
      return false;
    }
  }
  
  setupListeners() {
    // Écouter les messages du Service Worker
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'BADGE_UPDATED') {
          console.log('🔄 Badge mis à jour par SW:', event.data.count);
          this.currentCount = event.data.count;
          this.saveCount();
        }
      });
    }
    
    // Mettre à jour quand la page devient visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.update(this.currentCount);
      }
    });
    
    // Vérifier périodiquement
    setInterval(() => {
      this.update(this.currentCount);
    }, 60000); // Toutes les minutes
  }
  
  // Méthodes publiques
  increment() {
    return this.update(this.currentCount + 1);
  }
  
  decrement() {
    return this.update(this.currentCount - 1);
  }
  
  reset() {
    return this.update(0);
  }
  
  test() {
    console.log('🧪 Test badge PWA...');
    
    // Test séquentiel
    const testSequence = async () => {
      console.log('1. Définir badge à 3');
      await this.update(3);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('2. Réduire à 1');
      await this.update(1);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('3. Effacer le badge');
      await this.reset();
    };
    
    testSequence();
  }
}

// Initialiser le gestionnaire
const pwaBadge = new PwaBadgeManager();

// Exporter pour utilisation globale
window.pwaBadge = pwaBadge;

// Auto-initialisation
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Gestionnaire badges PWA initialisé');
  
  // Ajouter un bouton de test si en développement
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const testBtn = document.createElement('button');
    testBtn.textContent = '🧪 Test Badge';
    testBtn.style.position = 'fixed';
    testBtn.style.bottom = '100px';
    testBtn.style.right = '10px';
    testBtn.style.zIndex = '9999';
    testBtn.style.padding = '8px 12px';
    testBtn.style.background = '#f39c12';
    testBtn.style.color = 'white';
    testBtn.style.border = 'none';
    testBtn.style.borderRadius = '4px';
    testBtn.style.cursor = 'pointer';
    
    testBtn.onclick = () => pwaBadge.test();
    
    document.body.appendChild(testBtn);
  }
});