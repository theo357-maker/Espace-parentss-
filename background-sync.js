// background-sync.js - Synchronisation en arrière-plan
class BackgroundSyncManager {
  constructor() {
    this.syncInterval = null;
    this.lastCheckTime = null;
    this.isOnline = navigator.onLine;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkConnectivity();
    this.registerPeriodicSync();
  }

  setupEventListeners() {
    // Écouter les changements de connexion
    window.addEventListener('online', () => {
      console.log('📶 Connecté à Internet');
      this.isOnline = true;
      this.syncImmediately();
    });

    window.addEventListener('offline', () => {
      console.log('📶 Hors ligne');
      this.isOnline = false;
      this.stopPeriodicSync();
    });
  }

  checkConnectivity() {
    // Vérifier périodiquement la connexion
    setInterval(() => {
      if (navigator.onLine !== this.isOnline) {
        this.isOnline = navigator.onLine;
        if (this.isOnline) {
          this.syncImmediately();
        }
      }
    }, 30000); // Toutes les 30 secondes
  }

  async registerPeriodicSync() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        // Enregistrer la synchronisation avec le Service Worker
        navigator.serviceWorker.controller.postMessage({
          type: 'REGISTER_SYNC'
        });

        // Vérifier les nouvelles données toutes les 30 minutes
        this.syncInterval = setInterval(() => {
          if (this.isOnline) {
            this.checkForNewData();
          }
        }, 30 * 60 * 1000);

        console.log('🔄 Synchronisation périodique activée');
      } catch (error) {
        console.error('Erreur enregistrement sync:', error);
      }
    }
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🔄 Synchronisation périodique désactivée (hors ligne)');
    }
  }

  async syncImmediately() {
    if (!this.isOnline) return;

    console.log('🔄 Synchronisation immédiate déclenchée');
    
    // Vérifier les nouvelles données
    await this.checkForNewData();
    
    // Synchroniser les données en cache
    await this.syncCachedData();
  }

  async checkForNewData() {
    if (!this.isOnline || !window.currentParent) return;

    console.log('🔍 Vérification des nouvelles données...');
    
    try {
      // Vérifier les différentes sources de données
      const checks = [
        this.checkNewGrades(),
        this.checkNewHomework(),
        this.checkNewIncidents(),
        this.checkNewPresences()
      ];

      const results = await Promise.allSettled(checks);
      
      let newDataCount = 0;
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          newDataCount += result.value;
        }
      });

      if (newDataCount > 0) {
        console.log(`📊 ${newDataCount} nouvelles données trouvées`);
        this.notifyNewData(newDataCount);
      }

    } catch (error) {
      console.error('Erreur vérification données:', error);
    }
  }

  async checkNewGrades() {
    try {
      const lastCheck = localStorage.getItem('last_grade_check') || 0;
      const now = Date.now();
      
      // Simuler une vérification
      // Dans la réalité, vous feriez une requête API
      const hasNew = Math.random() > 0.5; // 50% de chance
      
      if (hasNew) {
        localStorage.setItem('last_grade_check', now);
        return 1;
      }
      
      return 0;
    } catch (error) {
      console.error('Erreur vérification notes:', error);
      return 0;
    }
  }

  async checkNewHomework() {
    // Similaire à checkNewGrades
    return Math.random() > 0.7 ? 1 : 0;
  }

  async checkNewIncidents() {
    // Similaire
    return Math.random() > 0.8 ? 1 : 0;
  }

  async checkNewPresences() {
    // Similaire
    return Math.random() > 0.6 ? 1 : 0;
  }

  async syncCachedData() {
    if (!window.childrenList || window.childrenList.length === 0) return;

    try {
      // Synchroniser les données de chaque enfant
      for (const child of window.childrenList) {
        await this.syncChildData(child);
      }

      console.log('✅ Données synchronisées');
    } catch (error) {
      console.error('Erreur synchronisation:', error);
    }
  }

  async syncChildData(child) {
    // Synchroniser les données spécifiques à un enfant
    // Cette fonction serait adaptée à votre structure de données
    console.log(`Syncing data for ${child.fullName}`);
  }

  async notifyNewData(count) {
    // Utiliser le Service Worker pour afficher une notification
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        data: {
          title: 'Nouvelles données disponibles',
          body: `${count} nouvelle(s) donnée(s) disponible(s)`,
          options: {
            data: {
              type: 'new_data',
              count: count,
              timestamp: Date.now()
            }
          }
        }
      });
    }
  }

  // Vérifier si l'appareil a des données cellulaires
  async checkMobileDataEnabled() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      // Vérifier le type de connexion
      const type = connection.type || connection.effectiveType;
      const isMobile = ['cellular', '2g', '3g', '4g', '5g'].includes(type.toLowerCase());
      
      // Vérifier si les données sont activées
      const hasData = connection.downlink > 0;
      
      return isMobile && hasData;
    }
    
    // Fallback: si on est en ligne, on considère que les données sont activées
    return this.isOnline;
  }
}

// Initialiser le gestionnaire quand l'app est chargée
document.addEventListener('DOMContentLoaded', function() {
  if ('serviceWorker' in navigator) {
    window.backgroundSync = new BackgroundSyncManager();
    
    // Démarrer la première vérification après 10 secondes
    setTimeout(() => {
      if (window.backgroundSync.isOnline) {
        window.backgroundSync.syncImmediately();
      }
    }, 10000);
  }
});