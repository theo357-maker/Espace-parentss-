// Système de mise à jour en temps réel pour PWA
class UpdateSystem {
  constructor() {
    this.currentVersion = null;
    this.newVersion = null;
    this.updateCheckInterval = 2 * 60 * 1000; // 2 minutes
    this.manifestUrl = './version-manifest.json';
    this.updateAvailable = false;
    this.isChecking = false;
    
    console.log('🔄 Update System initialisé');
    
    this.init();
  }
  
  async init() {
    // Charger la version actuelle
    await this.loadCurrentVersion();
    
    // Initialiser le Service Worker
    await this.initServiceWorker();
    
    // Démarrer les vérifications
    this.startUpdateChecks();
    
    // Écouter les messages du Service Worker
    this.setupMessageListeners();
    
    // Ajouter les éléments UI
    this.addUIElements();
    
    console.log(`📱 Version actuelle: ${this.currentVersion}`);
  }
  
  async loadCurrentVersion() {
    try {
      const response = await fetch(`${this.manifestUrl}?t=${Date.now()}`);
      const manifest = await response.json();
      this.currentVersion = manifest.currentVersion;
      
      // Stocker dans localStorage pour accès rapide
      localStorage.setItem('app_version', this.currentVersion);
      localStorage.setItem('app_manifest', JSON.stringify(manifest));
      
    } catch (error) {
      console.warn('⚠️ Impossible de charger la version, utilisant valeur par défaut');
      this.currentVersion = '2.1.0';
    }
  }
  
  async initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        
        console.log('✅ Service Worker enregistré:', registration);
        
        // Vérifier l'état du Service Worker
        if (registration.waiting) {
          console.log('⚠️ Nouveau Service Worker en attente');
          this.showUpdateReadyNotification();
        }
        
        if (registration.installing) {
          registration.installing.addEventListener('statechange', () => {
            if (registration.installing.state === 'installed') {
              console.log('✅ Nouveau Service Worker installé');
            }
          });
        }
        
        // Écouter les mises à jour
        registration.addEventListener('updatefound', () => {
          console.log('🔄 Mise à jour du Service Worker trouvée');
          this.showToast('Mise à jour en cours...', 'info');
        });
        
        return registration;
        
      } catch (error) {
        console.error('❌ Erreur Service Worker:', error);
        this.showToast('Erreur Service Worker', 'error');
      }
    } else {
      console.warn('⚠️ Service Worker non supporté');
    }
  }
  
  startUpdateChecks() {
    // Vérifier au démarrage
    setTimeout(() => this.checkForUpdate(), 5000);
    
    // Vérifier périodiquement
    this.checkInterval = setInterval(() => {
      this.checkForUpdate();
    }, this.updateCheckInterval);
    
    // Vérifier quand l'app reprend le focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(() => this.checkForUpdate(), 1000);
      }
    });
    
    console.log(`🔍 Vérifications programmées toutes les ${this.updateCheckInterval/60000} minutes`);
  }
  
  async checkForUpdate() {
    if (this.isChecking) return;
    
    this.isChecking = true;
    
    try {
      console.log('🔍 Vérification mise à jour...');
      
      // Méthode 1: Via Service Worker
      let hasUpdate = false;
      
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        hasUpdate = await this.checkViaServiceWorker();
      }
      
      // Méthode 2: Vérification directe
      if (!hasUpdate) {
        hasUpdate = await this.checkDirectManifest();
      }
      
      if (hasUpdate) {
        console.log('🎉 Mise à jour disponible!');
        this.updateAvailable = true;
      }
      
    } catch (error) {
      console.warn('⚠️ Erreur vérification:', error);
    } finally {
      this.isChecking = false;
    }
  }
  
  async checkViaServiceWorker() {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_FOR_UPDATES'
      }, [messageChannel.port2]);
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.hasUpdate || false);
      };
      
      // Timeout après 3 secondes
      setTimeout(() => resolve(false), 3000);
    });
  }
  
  async checkDirectManifest() {
    try {
      const response = await fetch(`${this.manifestUrl}?t=${Date.now()}`);
      const manifest = await response.json();
      
      if (this.compareVersions(manifest.currentVersion, this.currentVersion) > 0) {
        console.log(`📱 Nouvelle version sur serveur: ${manifest.currentVersion}`);
        
        this.newVersion = manifest.currentVersion;
        
        // Vérifier si déjà notifié
        const lastNotify = localStorage.getItem(`notified_${this.newVersion}`);
        if (!lastNotify && !manifest.mandatory) {
          this.showUpdateNotification(manifest);
        }
        
        if (manifest.mandatory) {
          this.showMandatoryUpdateModal(manifest);
        }
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.warn('⚠️ Erreur vérification manifest:', error);
      return false;
    }
  }
  
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
  
  setupMessageListeners() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event);
      });
      
      // Écouter les changements de Service Worker
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker controller changé');
        this.showUpdateAppliedNotification();
      });
    }
  }
  
  handleServiceWorkerMessage(event) {
    const { type, data } = event.data || {};
    
    switch (type) {
      case 'UPDATE_AVAILABLE':
        this.handleUpdateAvailable(data);
        break;
        
      case 'MANDATORY_UPDATE':
        this.handleMandatoryUpdate(data);
        break;
    }
  }
  
  handleUpdateAvailable(data) {
    const { currentVersion, newVersion, changelog, mandatory } = data;
    
    console.log(`📨 Mise à jour disponible: ${newVersion}`);
    
    this.newVersion = newVersion;
    this.updateAvailable = true;
    
    if (mandatory) {
      this.showMandatoryUpdateModal({
        currentVersion: newVersion,
        mandatory: true,
        changelog: changelog
      });
    } else {
      const lastNotify = localStorage.getItem(`notified_${newVersion}`);
      if (!lastNotify) {
        this.showUpdateNotification({
          currentVersion: newVersion,
          changelog: changelog,
          mandatory: false
        });
      }
    }
  }
  
  handleMandatoryUpdate(data) {
    const { currentVersion, newVersion } = data;
    
    this.showMandatoryUpdateModal({
      currentVersion: newVersion,
      mandatory: true,
      message: 'Mise à jour critique requise'
    });
  }
  
  showUpdateNotification(manifest) {
    // Marquer comme notifiée (pour 24h)
    localStorage.setItem(`notified_${manifest.currentVersion}`, Date.now().toString());
    
    const notification = this.createUpdateNotification(manifest);
    document.body.appendChild(notification);
    
    // Animation d'entrée
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Gestion des événements
    this.setupNotificationEvents(notification, manifest);
  }
  
  createUpdateNotification(manifest) {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      padding: 20px;
      width: 350px;
      max-width: 90vw;
      z-index: 10000;
      transform: translateX(400px);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border-left: 5px solid #3498db;
      font-family: 'Segoe UI', sans-serif;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="background: #e3f2fd; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #3498db;">
            <i class="fas fa-cloud-download-alt"></i>
          </div>
          <div>
            <h3 style="margin: 0; color: #2c3e50; font-size: 16px;">Mise à jour disponible</h3>
            <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 13px;">Version ${manifest.currentVersion}</p>
          </div>
        </div>
        <button class="close-notif" style="background: none; border: none; color: #95a5a6; cursor: pointer; font-size: 20px; padding: 0; width: 30px; height: 30px;">
          &times;
        </button>
      </div>
      
      <div style="margin: 15px 0;">
        <p style="margin: 0 0 10px 0; color: #34495e; line-height: 1.5; font-size: 14px;">
          Une nouvelle version de l'application est disponible.
        </p>
        ${manifest.changelog ? `
          <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin-top: 10px; border-left: 3px solid #3498db;">
            <p style="margin: 0; color: #2c3e50; font-size: 13px;">
              <i class="fas fa-bullhorn" style="margin-right: 8px; color: #3498db;"></i>
              ${manifest.changelog}
            </p>
          </div>
        ` : ''}
      </div>
      
      <div style="display: flex; gap: 10px; margin-top: 20px;">
        <button class="update-now-btn" style="
          flex: 1;
          background: #3498db;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: background 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        ">
          <i class="fas fa-download"></i>
          Mettre à jour
        </button>
        <button class="update-later-btn" style="
          background: #f8f9fa;
          color: #7f8c8d;
          border: 1px solid #e9ecef;
          padding: 12px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
        ">
          Plus tard
        </button>
      </div>
    `;
    
    return notification;
  }
  
  setupNotificationEvents(notification, manifest) {
    // Bouton "Mettre à jour"
    notification.querySelector('.update-now-btn').addEventListener('click', () => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
      this.applyUpdate();
    });
    
    // Bouton "Plus tard"
    notification.querySelector('.update-later-btn').addEventListener('click', () => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    });
    
    // Bouton fermer
    notification.querySelector('.close-notif').addEventListener('click', () => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    });
    
    // Auto-fermeture après 30 secondes
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 300);
      }
    }, 30000);
  }
  
  showMandatoryUpdateModal(manifest) {
    // Créer overlay bloquant
    const overlay = this.createMandatoryUpdateOverlay(manifest);
    document.body.appendChild(overlay);
    
    // Empêcher l'interaction avec le reste de l'app
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('button, a, input').forEach(el => {
      el.style.pointerEvents = 'none';
    });
    
    // Focus sur le bouton de mise à jour
    setTimeout(() => {
      const updateBtn = document.getElementById('force-update-btn');
      if (updateBtn) updateBtn.focus();
    }, 500);
  }
  
  createMandatoryUpdateOverlay(manifest) {
    const overlay = document.createElement('div');
    overlay.id = 'mandatory-update-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.95);
      z-index: 99999;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    `;
    
    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        max-width: 500px;
        width: 100%;
        overflow: hidden;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      ">
        <div style="
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          padding: 30px;
          color: white;
        ">
          <div style="font-size: 60px; margin-bottom: 20px;">
            ⚠️
          </div>
          <h2 style="margin: 0; font-size: 24px;">Mise à jour requise</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Pour continuer à utiliser l'application</p>
        </div>
        
        <div style="padding: 30px;">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 25px;
          ">
            <div>
              <p style="margin: 0 0 5px 0; color: #7f8c8d; font-size: 14px;">Actuel</p>
              <p style="margin: 0; color: #2c3e50; font-weight: bold; font-size: 18px;">${this.currentVersion}</p>
            </div>
            <div style="color: #bdc3c7; font-size: 24px;">
              <i class="fas fa-arrow-right"></i>
            </div>
            <div>
              <p style="margin: 0 0 5px 0; color: #7f8c8d; font-size: 14px;">Nouveau</p>
              <p style="margin: 0; color: #27ae60; font-weight: bold; font-size: 18px;">${manifest.currentVersion}</p>
            </div>
          </div>
          
          ${manifest.changelog ? `
            <div style="
              background: #fff8e1;
              padding: 15px;
              border-radius: 8px;
              border-left: 4px solid #ffb300;
              margin-bottom: 25px;
              text-align: left;
            ">
              <p style="margin: 0; color: #5d4037; font-size: 14px; line-height: 1.5;">
                <i class="fas fa-info-circle" style="margin-right: 8px; color: #ffb300;"></i>
                ${manifest.changelog}
              </p>
            </div>
          ` : ''}
          
          <button id="force-update-btn" style="
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            border: none;
            padding: 16px 40px;
            border-radius: 50px;
            font-size: 16px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
          ">
            <i class="fas fa-sync-alt"></i>
            Mettre à jour maintenant
          </button>
          
          <p style="color: #95a5a6; font-size: 13px;">
            <i class="fas fa-exclamation-triangle" style="margin-right: 5px;"></i>
            Cette mise à jour est obligatoire pour continuer
          </p>
        </div>
      </div>
    `;
    
    // Gestion du bouton
    overlay.querySelector('#force-update-btn').addEventListener('click', () => {
      this.applyUpdate();
    });
    
    return overlay;
  }
  
  async applyUpdate() {
    console.log('🔄 Application de la mise à jour...');
    
    this.showToast('Mise à jour en cours...', 'info');
    
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        
        if (registration) {
          // Forcer la mise à jour du Service Worker
          await registration.update();
          
          // Envoyer message pour sauter l'attente
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          
          // Redémarrer après 1 seconde
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          
        } else {
          window.location.reload();
        }
      } catch (error) {
        console.error('❌ Erreur mise à jour:', error);
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  }
  
  showUpdateReadyNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #27ae60;
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      z-index: 9999;
      box-shadow: 0 5px 20px rgba(39, 174, 96, 0.3);
      transform: translateY(100px);
      transition: transform 0.3s ease;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-check-circle" style="font-size: 20px;"></i>
        <div>
          <strong>Mise à jour prête !</strong>
          <p style="margin: 5px 0 0 0; font-size: 14px;">
            Cliquez pour redémarrer et appliquer
          </p>
        </div>
        <button style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 8px 15px;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
          margin-left: 10px;
        ">
          Redémarrer
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transform = 'translateY(0)';
    }, 100);
    
    notification.querySelector('button').addEventListener('click', () => {
      window.location.reload();
    });
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.transform = 'translateY(100px)';
        setTimeout(() => notification.remove(), 300);
      }
    }, 10000);
  }
  
  showUpdateAppliedNotification() {
    this.showToast('✅ Mise à jour appliquée avec succès !', 'success');
    
    // Mettre à jour le badge de version
    this.updateVersionBadge();
  }
  
  addUIElements() {
    // Badge de version
    this.addVersionBadge();
    
    // Bouton de vérification manuelle
    this.addManualCheckButton();
    
    // Statut des mises à jour
    this.addUpdateStatus();
  }
  
  addVersionBadge() {
    const badge = document.createElement('div');
    badge.id = 'version-badge';
    badge.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(52, 152, 219, 0.15);
      color: #3498db;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-family: monospace;
      z-index: 9998;
      opacity: 0.7;
      border: 1px solid rgba(52, 152, 219, 0.3);
      cursor: help;
      transition: all 0.3s ease;
    `;
    badge.title = `Version ${this.currentVersion}\nCliquez pour vérifier les mises à jour`;
    badge.textContent = `v${this.currentVersion}`;
    
    badge.addEventListener('click', () => {
      this.checkForUpdate();
      badge.style.transform = 'scale(0.95)';
      setTimeout(() => badge.style.transform = 'scale(1)', 200);
    });
    
    badge.addEventListener('mouseenter', () => {
      badge.style.opacity = '1';
      badge.style.background = 'rgba(52, 152, 219, 0.25)';
    });
    
    badge.addEventListener('mouseleave', () => {
      badge.style.opacity = '0.7';
      badge.style.background = 'rgba(52, 152, 219, 0.15)';
    });
    
    document.body.appendChild(badge);
  }
  
  updateVersionBadge() {
    const badge = document.getElementById('version-badge');
    if (badge) {
      badge.textContent = `v${this.currentVersion}`;
      badge.title = `Version ${this.currentVersion}\nCliquez pour vérifier les mises à jour`;
    }
  }
  
  addManualCheckButton() {
    const btn = document.createElement('button');
    btn.id = 'manual-update-check';
    btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    btn.title = 'Vérifier les mises à jour';
    btn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #9b59b6, #8e44ad);
      color: white;
      border: none;
      font-size: 20px;
      cursor: pointer;
      z-index: 9998;
      box-shadow: 0 4px 15px rgba(155, 89, 182, 0.4);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    btn.addEventListener('click', () => {
      this.checkForUpdate();
      btn.style.animation = 'spin 1s linear';
      setTimeout(() => btn.style.animation = '', 1000);
      this.showToast('Vérification en cours...', 'info');
    });
    
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 20px rgba(155, 89, 182, 0.6)';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 15px rgba(155, 89, 182, 0.4)';
    });
    
    document.body.appendChild(btn);
    
    // Ajouter l'animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  addUpdateStatus() {
    const status = document.createElement('div');
    status.id = 'update-status';
    status.style.cssText = `
      position: fixed;
      bottom: 140px;
      right: 20px;
      background: rgba(255,255,255,0.9);
      border-radius: 10px;
      padding: 10px 15px;
      font-size: 12px;
      color: #666;
      z-index: 9997;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      max-width: 200px;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(status);
  }
  
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `update-toast ${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#3498db'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 9999;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      transform: translateX(120%);
      transition: transform 0.3s ease;
      font-size: 14px;
    `;
    
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3000);
  }
}

// Initialiser le système
document.addEventListener('DOMContentLoaded', () => {
  // Attendre que tout soit chargé
  setTimeout(() => {
    window.updateSystem = new UpdateSystem();
    console.log('🚀 Système de mise à jour démarré');
  }, 2000);
});

// Fonctions de debug
window.debugUpdateSystem = function() {
  console.log('=== DEBUG UPDATE SYSTEM ===');
  console.log('Version:', window.updateSystem?.currentVersion);
  console.log('Nouvelle version disponible:', window.updateSystem?.updateAvailable);
  console.log('Service Worker:', navigator.serviceWorker?.controller?.state);
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      console.log('Registration:', reg);
      console.log('Active:', reg?.active);
      console.log('Waiting:', reg?.waiting);
      console.log('Installing:', reg?.installing);
    });
  }
  
  fetch('./version-manifest.json?t=' + Date.now())
    .then(r => r.json())
    .then(manifest => {
      console.log('Manifest serveur:', manifest);
    });
};

window.forceCheckUpdate = function() {
  if (window.updateSystem) {
    window.updateSystem.checkForUpdate();
  }
};

window.forceApplyUpdate = function() {
  if (window.updateSystem) {
    window.updateSystem.applyUpdate();
  }
};