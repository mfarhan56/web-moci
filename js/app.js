/* ===================================================================
   APP BOOTSTRAPPER — WEB MOCI
   Orchestrates state, adapter, audio, mascot, gallery, and UI
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  console.log("%c🤖 WEB MOCI COMPANION READY", "color: #00f5d4; font-size: 16px; font-weight: bold;");

  // 1. Initialize API Adapter with stored mode & IP
  const settings = window.mociState.settings;
  const initialType = settings.connectionType || settings.connectionMode || 'demo';
  window.mociApi.init(initialType, settings.deviceIp || 'http://192.168.4.1');

  // 2. Initialize Mascot (Eyes, Expressions, Sound)
  window.mociMascot.init();

  // 3. Initialize Audio Engine & Music Studio
  window.mociAudio.init();

  // 4. Initialize Gallery & Lightbox
  window.mociGallery.init();

  // 5. Initialize Transfer Queue Manager
  window.mociTransfer.init();

  // 6. Initialize UI & SPA Routing
  window.mociUI.init();

  // 7. Bind Quick Action buttons on Ringkasan (Dashboard)
  bindQuickActions();

  // 8. Bind Idle Timer handler
  initIdleMonitor();
});

function bindQuickActions() {
  const btnQuickPlay = document.getElementById('btnQuickPlayMusic');
  if (btnQuickPlay) {
    btnQuickPlay.addEventListener('click', () => {
      window.mociAudio.togglePlay();
      if (window.mociUI) {
        window.mociUI.showToast(window.mociAudio.isPlaying ? 'Musik Moci sedang diputar!' : 'Musik dijeda.', 'info');
      }
    });
  }

  const btnQuickGallery = document.getElementById('btnQuickOpenGallery');
  if (btnQuickGallery) {
    btnQuickGallery.addEventListener('click', () => {
      window.mociUI.navigateTo('foto');
    });
  }

  const btnQuickSlideshow = document.getElementById('btnQuickSlideshow');
  if (btnQuickSlideshow) {
    btnQuickSlideshow.addEventListener('click', () => {
      window.mociUI.navigateTo('foto');
      setTimeout(() => {
        window.mociGallery.startSlideshow();
      }, 300);
    });
  }

  const btnQuickControl = document.getElementById('btnQuickOpenControl');
  if (btnQuickControl) {
    btnQuickControl.addEventListener('click', () => {
      window.mociUI.navigateTo('kontrol');
    });
  }
}

function initIdleMonitor() {
  let idleTimeoutMs = (window.mociState?.settings?.idleTimeout || 60) * 1000;
  let idleTimer;

  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // On idle, if setting is 'eyes', revert expression to neutral or happy
      if (window.mociState?.settings?.idleMode === 'eyes' && window.mociMascot) {
        window.mociMascot.setExpression('happy', false);
      }
    }, idleTimeoutMs);
  };

  ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, resetIdle, { passive: true });
  });

  resetIdle();
}
