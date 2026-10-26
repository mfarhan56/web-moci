/* ===================================================================
   UI CONTROLLER & ROUTER — WEB MOCI
   SPA View Switching, Toast Notifications, Modals, and Library
   =================================================================== */

class MociUI {
  constructor() {
    this.currentView = 'ringkasan';
    this.confirmCallback = null;
  }

  init() {
    this.applyTheme(window.mociState?.settings?.theme || 'mint');
    this.bindNavigation();
    this.bindModals();
    this.bindSettingsForm();
    this.bindConnectionView();
    this.updateDashboard();

    // Check URL hash for direct deep linking
    const hash = window.location.hash.replace('#', '');
    if (['ringkasan', 'foto', 'musik', 'perpustakaan', 'kontrol', 'alarm', 'ngobrol', 'koneksi', 'pengaturan'].includes(hash)) {
      this.navigateTo(hash);
    } else {
      this.navigateTo('ringkasan');
    }
  }

  // --- Theme Controller ---
  applyTheme(theme) {
    if (theme === 'mint') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // --- SPA View Navigation ---
  bindNavigation() {
    document.addEventListener('click', (e) => {
      const navBtn = e.target.closest('[data-view-target]');
      if (navBtn) {
        const targetView = navBtn.getAttribute('data-view-target');
        this.navigateTo(targetView);
      }
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    if (backdrop && sidebar) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
      });
    }
  }

  navigateTo(viewId) {
    const validViews = ['ringkasan', 'foto', 'musik', 'perpustakaan', 'kontrol', 'alarm', 'ngobrol', 'koneksi', 'pengaturan'];
    if (!validViews.includes(viewId)) viewId = 'ringkasan';

    this.currentView = viewId;
    window.location.hash = viewId;
    if (window.mociState) window.mociState.activeView = viewId;

    // Update active nav button
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view-target') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Switch view section
    document.querySelectorAll('.view-section').forEach(section => {
      if (section.id === `view-${viewId}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Close mobile sidebar
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');

    // Update top header title & description
    this.updateHeaderMeta(viewId);

    // Refresh view data
    this.onViewActivated(viewId);
  }

  updateHeaderMeta(viewId) {
    const meta = {
      ringkasan: { title: 'Ringkasan Moci', desc: 'Pusat status robot, statistik media, dan kontrol cepat.' },
      foto: { title: 'Galeri Foto Moci', desc: 'Kelola foto, uji preview TFT 128×160, dan slideshow.' },
      musik: { title: 'Music Studio', desc: 'Pemutar musik, kelola lagu lokal, dan sinkronisasi audio.' },
      perpustakaan: { title: 'Perpustakaan Media', desc: 'Semua berkas foto dan audio tersimpan di browser & Micro SD.' },
      kontrol: { title: 'Kontrol Robot Moci', desc: 'Pengendali jarak jauh ekspresi, media, dan simulasi TFT.' },
      alarm: { title: 'Alarm & Pengingat', desc: 'Kelola jadwal alarm harian dengan ringtone Web Audio. Sinkron ke ESP32.' },
      ngobrol: { title: 'Ngobrol dengan Moci', desc: 'Chat dengan template cepat atau Gemini AI yang terkoneksi.' },
      koneksi: { title: 'Koneksi & Gateway IoT', desc: 'Status Wi-Fi, Micro SD, dan integrasi firmware ESP32-S3.' },
      pengaturan: { title: 'Pengaturan Sistem', desc: 'Kustomisasi nama robot, tema antarmuka, dan preferensi.' }
    };

    const current = meta[viewId] || meta.ringkasan;
    const titleEl = document.getElementById('currentPageTitle');
    const descEl = document.getElementById('currentPageDesc');

    if (titleEl) titleEl.textContent = current.title;
    if (descEl) descEl.textContent = current.desc;
  }

  onViewActivated(viewId) {
    switch (viewId) {
      case 'ringkasan':
        this.updateDashboard();
        break;
      case 'foto':
        if (window.mociGallery) window.mociGallery.renderGallery();
        break;
      case 'musik':
        if (window.mociAudio) window.mociAudio.renderMusicPage();
        break;
      case 'perpustakaan':
        this.renderLibrary();
        break;
      case 'kontrol':
        if (window.mociMascot) window.mociMascot.renderTftDisplay();
        break;
      case 'alarm':
        if (window.mociAlarm) window.mociAlarm._renderAlarmList();
        break;
      case 'ngobrol':
        if (window.mociAi) {
          window.mociAi._renderChatHistory();
          window.mociAi._renderTemplates();
          window.mociAi._updateProviderUI();
        }
        break;
      case 'koneksi':
        this.updateConnectionView();
        break;
      case 'pengaturan':
        this.populateSettingsForm();
        break;
    }
  }

  // --- Dashboard Data Refresh ---
  updateDashboard() {
    const photos = window.mociState?.photos || [];
    const tracks = window.mociState?.tracks || [];

    // Stats
    const totalPhotosEl = document.getElementById('dashTotalPhotos');
    const totalTracksEl = document.getElementById('dashTotalTracks');
    const robotNameEls = document.querySelectorAll('.moci-robot-name-text');

    if (totalPhotosEl) totalPhotosEl.textContent = photos.length;
    if (totalTracksEl) totalTracksEl.textContent = tracks.length;

    const robotName = window.mociState?.settings?.robotName || 'Moci';
    robotNameEls.forEach(el => el.textContent = robotName);

    // Last photo thumbnail
    const lastPhoto = photos[0];
    const lastPhotoCard = document.getElementById('dashLastPhotoCard');
    if (lastPhotoCard && lastPhoto) {
      lastPhotoCard.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="${lastPhoto.url}" alt="${lastPhoto.name}" style="width:52px; height:52px; border-radius:8px; object-fit:cover; border:1px solid var(--border-subtle);" />
          <div style="overflow:hidden;">
            <div style="font-weight:700; font-size:0.92rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${lastPhoto.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${lastPhoto.size} &bull; ${lastPhoto.location === 'sd' ? 'Micro SD' : 'Lokal Browser'}</div>
          </div>
        </div>
      `;
    }

    // Last played song
    const currentTrack = window.mociAudio?.currentTrack || tracks[0];
    const lastTrackCard = document.getElementById('dashLastTrackCard');
    if (lastTrackCard && currentTrack) {
      lastTrackCard.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:48px; height:48px; border-radius:8px; background:var(--bg-tertiary); display:flex; align-items:center; justify-content:center; color:var(--accent-mint); flex-shrink:0;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
          <div style="overflow:hidden;">
            <div style="font-weight:700; font-size:0.92rem; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${currentTrack.title}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${currentTrack.artist || 'Moci'} &bull; ${currentTrack.duration || '0:30'}</div>
          </div>
        </div>
      `;
    }

    // Recent activity list
    const actContainer = document.getElementById('dashActivitiesList');
    const activities = window.mociState?.activities || [];
    if (actContainer) {
      if (!activities.length) {
        actContainer.innerHTML = `<div class="empty-state-desc" style="text-align:center; padding:16px;">Belum ada riwayat aktivitas.</div>`;
      } else {
        actContainer.innerHTML = activities.slice(0, 5).map(act => `
          <div class="activity-timeline-item">
            <div class="activity-dot"></div>
            <div class="activity-content">
              <div class="activity-header">
                <span class="activity-title">${act.title}</span>
                <span class="activity-time">${act.timestamp}</span>
              </div>
              <div class="activity-desc">${act.desc}</div>
            </div>
          </div>
        `).join('');
      }
    }
  }

  // --- Perpustakaan / Media Library ---
  renderLibrary(activeTab = 'all') {
    const container = document.getElementById('libraryMediaList');
    if (!container) return;

    const photos = window.mociState?.photos || [];
    const tracks = window.mociState?.tracks || [];

    // Map all items
    let allMedia = [
      ...photos.map(p => ({ ...p, mediaType: 'photo' })),
      ...tracks.map(t => ({ ...t, mediaType: 'music' }))
    ];

    if (activeTab === 'photo') allMedia = allMedia.filter(m => m.mediaType === 'photo');
    if (activeTab === 'music') allMedia = allMedia.filter(m => m.mediaType === 'music');
    if (activeTab === 'favorite') allMedia = allMedia.filter(m => m.isFavorite);
    if (activeTab === 'sd') allMedia = allMedia.filter(m => m.location === 'sd');
    if (activeTab === 'local') allMedia = allMedia.filter(m => m.location === 'local');

    if (!allMedia.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <div class="empty-state-title">Tidak ada berkas media</div>
          <div class="empty-state-desc">Belum ada file yang cocok pada kategori ini.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="media-table">
          <thead>
            <tr>
              <th>Berkas</th>
              <th>Tipe</th>
              <th>Ukuran</th>
              <th>Penyimpanan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${allMedia.map(item => {
              const isPhoto = item.mediaType === 'photo';
              const isSd = item.location === 'sd';
              const name = isPhoto ? item.name : item.title;
              const size = isPhoto ? item.size : (item.sizeFormatted || '3.2 MB');

              return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <div class="media-row-icon ${isPhoto ? 'icon-photo' : 'icon-audio'}">
                        ${isPhoto 
                          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
                          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`}
                      </div>
                      <span style="font-weight:600; color:var(--text-primary); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>
                    </div>
                  </td>
                  <td><span class="badge ${isPhoto ? 'badge-local' : 'badge-demo'}">${isPhoto ? 'Foto' : 'Musik'}</span></td>
                  <td style="color:var(--text-muted); font-size:0.85rem;">${size}</td>
                  <td><span class="badge ${isSd ? 'badge-robot' : 'badge-local'}">${isSd ? 'Micro SD' : 'Lokal Browser'}</span></td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      ${isPhoto 
                        ? `<button class="btn btn-outline btn-sm" onclick="window.mociGallery.previewOnMociScreen('${item.id}')">TFT</button>`
                        : `<button class="btn btn-outline btn-sm" onclick="window.mociAudio.loadTrack(${window.mociState.tracks.findIndex(t => t.id === item.id)}, true)">Putar</button>`}
                      <button class="btn btn-outline btn-sm" onclick="window.mociTransfer.${isPhoto ? 'queuePhotoForTransfer' : 'queueTrackForTransfer'}('${item.id}')">Kirim</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // --- Multi-Connection View & Hardware Bridge ---
  bindConnectionView() {
    // 1. Connection Method Selector Cards
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.connection-select-card');
      if (card) {
        const connType = card.getAttribute('data-conn-type');
        this.selectConnectionType(connType);
      }
    });

    // 2. Global Test Ping button
    const testPingBtn = document.getElementById('btnTestPing');
    if (testPingBtn) {
      testPingBtn.addEventListener('click', async () => {
        testPingBtn.disabled = true;
        testPingBtn.innerHTML = `Menguji Ping...`;
        const res = await window.mociApi.ping();
        testPingBtn.disabled = false;
        testPingBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> <span>Uji Koneksi (Ping)</span>`;
        this.showToast(res.message, res.success ? 'success' : 'error');
        this.updateConnectionView();
      });
    }

    // --- WI-FI MANAGER & SCANNER HANDLERS ---
    const btnScanWifi = document.getElementById('btnScanWifi');
    const wifiScannedList = document.getElementById('wifiScannedList');
    const wifiScanCountBadge = document.getElementById('wifiScanCountBadge');
    const inputWifiSsid = document.getElementById('inputWifiSsid');
    const inputWifiPassword = document.getElementById('inputWifiPassword');
    const btnToggleWifiPass = document.getElementById('btnToggleWifiPass');
    const btnConnectWifiToEsp = document.getElementById('btnConnectWifiToEsp');
    const btnDisconnectWifi = document.getElementById('btnDisconnectWifi');
    const wifiConnectingBox = document.getElementById('wifiConnectingBox');
    const wifiConnectingText = document.getElementById('wifiConnectingText');

    if (btnScanWifi) {
      btnScanWifi.addEventListener('click', async () => {
        try {
          btnScanWifi.disabled = true;
          btnScanWifi.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" class="spin-icon" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line></svg> <span>Memindai...</span>`;
          if (wifiScanCountBadge) {
            wifiScanCountBadge.textContent = 'Memindai sinyal...';
            wifiScanCountBadge.className = 'badge badge-local';
          }

          const networks = await window.mociApi.scanWifiNetworks();

          btnScanWifi.disabled = false;
          btnScanWifi.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> <span>Pindai Ulang</span>`;

          if (wifiScanCountBadge) {
            wifiScanCountBadge.textContent = `${networks.length} Jaringan Ditemukan`;
            wifiScanCountBadge.className = 'badge badge-connected';
          }

          if (!networks.length) {
            if (wifiScannedList) {
              wifiScannedList.innerHTML = `<div class="empty-state-desc" style="text-align:center; padding:12px;">Tidak ada jaringan Wi-Fi terdeteksi di sekitar ESP32.</div>`;
            }
            return;
          }

          if (wifiScannedList) {
            wifiScannedList.innerHTML = networks.map(net => {
              const secureIcon = net.secure 
                ? `<span class="wifi-security-badge" title="Terkunci (${net.securityType})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> ${net.securityType}</span>` 
                : `<span class="wifi-security-badge" style="color:var(--status-connected);" title="Jaringan Terbuka">Terbuka</span>`;

              return `
                <div class="wifi-network-item" data-ssid="${net.ssid}">
                  <div class="wifi-item-left">
                    <div class="wifi-signal-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
                    </div>
                    <span class="wifi-item-ssid">${net.ssid}</span>
                  </div>
                  <div class="wifi-item-right">
                    ${secureIcon}
                    <span class="wifi-rssi-badge">${net.signalPercent}% (${net.rssi} dBm)</span>
                  </div>
                </div>
              `;
            }).join('');

            // Click on network item to select it!
            wifiScannedList.querySelectorAll('.wifi-network-item').forEach(item => {
              item.addEventListener('click', () => {
                wifiScannedList.querySelectorAll('.wifi-network-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                const selectedSsid = item.getAttribute('data-ssid');
                if (inputWifiSsid) inputWifiSsid.value = selectedSsid;
                if (inputWifiPassword) {
                  inputWifiPassword.focus();
                }
                this.showToast(`SSID "${selectedSsid}" dipilih! Silakan masukkan kata sandi.`, 'info');
              });
            });
          }

          this.showToast(`Berhasil menemukan ${networks.length} jaringan Wi-Fi di sekitar ESP32!`, 'success');
        } catch (err) {
          btnScanWifi.disabled = false;
          btnScanWifi.innerHTML = `<span>Pindai Wi-Fi Sekitar</span>`;
          this.showToast(err.message, 'error');
        }
      });
    }

    // Toggle password visibility
    if (btnToggleWifiPass && inputWifiPassword) {
      btnToggleWifiPass.addEventListener('click', () => {
        const isPass = inputWifiPassword.type === 'password';
        inputWifiPassword.type = isPass ? 'text' : 'password';
        btnToggleWifiPass.innerHTML = isPass
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      });
    }

    // Connect ESP32 to selected Wi-Fi
    if (btnConnectWifiToEsp) {
      btnConnectWifiToEsp.addEventListener('click', async () => {
        const ssid = inputWifiSsid ? inputWifiSsid.value.trim() : '';
        const password = inputWifiPassword ? inputWifiPassword.value : '';

        if (!ssid) {
          this.showToast('Silakan pilih jaringan Wi-Fi terlebih dahulu atau ketik nama SSID.', 'warning');
          if (inputWifiSsid) inputWifiSsid.focus();
          return;
        }

        try {
          btnConnectWifiToEsp.disabled = true;
          if (wifiConnectingBox) {
            wifiConnectingBox.style.display = 'flex';
            if (wifiConnectingText) wifiConnectingText.textContent = `Menghubungkan ESP32-S3 ke "${ssid}"... Menunggu IP DHCP...`;
          }

          const res = await window.mociApi.connectWifi(ssid, password);

          if (wifiConnectingBox) wifiConnectingBox.style.display = 'none';
          btnConnectWifiToEsp.disabled = false;

          const currentSsidEl = document.getElementById('currentWifiSsid');
          const currentIpEl = document.getElementById('currentWifiIp');
          if (currentSsidEl) currentSsidEl.textContent = res.ssid;
          if (currentIpEl && res.ip) currentIpEl.textContent = `IP: ${res.ip} (Terhubung)`;

          const inputDeviceIp = document.getElementById('inputDeviceIp');
          if (inputDeviceIp && res.ip) {
            inputDeviceIp.value = `http://${res.ip}`;
            window.mociState.saveSettings({ deviceIp: `http://${res.ip}` });
          }

          window.mociState.logActivity('Wi-Fi ESP32 Terhubung', `ESP32 terhubung ke "${res.ssid}" (${res.ip || 'OK'}).`);
          this.showToast(res.message, 'success');
          this.updateConnectionView();
        } catch (err) {
          if (wifiConnectingBox) wifiConnectingBox.style.display = 'none';
          btnConnectWifiToEsp.disabled = false;
          this.showToast(err.message, 'error');
        }
      });
    }

    // Disconnect Wi-Fi
    if (btnDisconnectWifi) {
      btnDisconnectWifi.addEventListener('click', () => {
        this.confirmAction(
          'Putuskan Wi-Fi ESP32',
          'Apakah kamu yakin ingin memutuskan ESP32 dari jaringan Wi-Fi saat ini? ESP32 akan kembali ke mode Access Point default (192.168.4.1).',
          async () => {
            const res = await window.mociApi.disconnectWifi();
            const currentSsidEl = document.getElementById('currentWifiSsid');
            const currentIpEl = document.getElementById('currentWifiIp');
            if (currentSsidEl) currentSsidEl.textContent = 'Moci-Companion-AP (Access Point)';
            if (currentIpEl) currentIpEl.textContent = 'IP: 192.168.4.1';
            this.showToast(res.message, 'info');
            this.updateConnectionView();
          }
        );
      });
    }

    // 3. USB Serial CDC Handlers
    const btnConnectSerial = document.getElementById('btnConnectSerial');
    const btnDisconnectSerial = document.getElementById('btnDisconnectSerial');
    const selectSerialBaud = document.getElementById('selectSerialBaud');
    const btnClearSerialLog = document.getElementById('btnClearSerialLog');
    const btnSendSerialCmd = document.getElementById('btnSendSerialCmd');
    const inputSerialCmd = document.getElementById('inputSerialCmd');

    if (btnConnectSerial) {
      btnConnectSerial.addEventListener('click', async () => {
        const baud = selectSerialBaud ? selectSerialBaud.value : 115200;
        try {
          btnConnectSerial.disabled = true;
          btnConnectSerial.innerHTML = `Membuka Port...`;
          const res = await window.mociApi.serialAdapter.connect(baud);
          btnConnectSerial.style.display = 'none';
          if (btnDisconnectSerial) btnDisconnectSerial.style.display = 'inline-flex';
          this.showToast(res.message, 'success');
          this.updateConnectionView();
        } catch (err) {
          btnConnectSerial.disabled = false;
          btnConnectSerial.innerHTML = `<span>Sambungkan Port USB Serial</span>`;
          this.showToast(err.message, 'error');
        }
      });
    }

    if (btnDisconnectSerial) {
      btnDisconnectSerial.addEventListener('click', async () => {
        await window.mociApi.serialAdapter.disconnect();
        btnDisconnectSerial.style.display = 'none';
        if (btnConnectSerial) {
          btnConnectSerial.disabled = false;
          btnConnectSerial.style.display = 'inline-flex';
          btnConnectSerial.innerHTML = `<span>Sambungkan Port USB Serial</span>`;
        }
        this.showToast('Koneksi USB Serial diputuskan.', 'info');
        this.updateConnectionView();
      });
    }

    if (btnClearSerialLog) {
      btnClearSerialLog.addEventListener('click', () => {
        const term = document.getElementById('serialTerminalLog');
        if (term) term.innerHTML = `<div class="serial-log-line serial-log-info"><span class="serial-log-time">System</span><span>Log dibersihkan.</span></div>`;
      });
    }

    const sendCmdFn = async () => {
      if (!inputSerialCmd || !inputSerialCmd.value.trim()) return;
      const cmd = inputSerialCmd.value.trim();
      inputSerialCmd.value = '';
      try {
        await window.mociApi.serialAdapter.sendLine(cmd);
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    };

    if (btnSendSerialCmd) btnSendSerialCmd.addEventListener('click', sendCmdFn);
    if (inputSerialCmd) {
      inputSerialCmd.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendCmdFn();
      });
    }

    // Attach Serial Monitor Log listener
    window.mociApi.serialAdapter.onLog((entry) => {
      const term = document.getElementById('serialTerminalLog');
      if (!term) return;
      const line = document.createElement('div');
      line.className = `serial-log-line serial-log-${entry.direction}`;
      line.innerHTML = `<span class="serial-log-time">${entry.timestamp}</span><span class="serial-log-direction">[${entry.direction.toUpperCase()}]:</span><span>${entry.text}</span>`;
      term.appendChild(line);
      term.scrollTop = term.scrollHeight;
    });

    // 4. Wi-Fi REST Handlers
    const saveIpBtn = document.getElementById('btnSaveDeviceIp');
    const pingWifiBtn = document.getElementById('btnPingWifi');
    if (saveIpBtn) {
      saveIpBtn.addEventListener('click', () => {
        const ipInput = document.getElementById('inputDeviceIp');
        if (ipInput && ipInput.value) {
          const ip = ipInput.value.trim();
          window.mociState.saveSettings({ deviceIp: ip });
          window.mociApi.restAdapter.setBaseUrl(ip);
          this.showToast(`Alamat Wi-Fi disimpan: ${ip}`, 'success');
        }
      });
    }

    if (pingWifiBtn) {
      pingWifiBtn.addEventListener('click', async () => {
        pingWifiBtn.disabled = true;
        pingWifiBtn.innerHTML = `Menguji Ping...`;
        const res = await window.mociApi.restAdapter.ping();
        pingWifiBtn.disabled = false;
        pingWifiBtn.innerHTML = `Uji Ping`;
        this.showToast(res.message, res.success ? 'success' : 'error');
        this.updateConnectionView();
      });
    }

    // 5. WebSocket Handlers
    const btnConnectWs = document.getElementById('btnConnectWs');
    const btnDisconnectWs = document.getElementById('btnDisconnectWs');
    if (btnConnectWs) {
      btnConnectWs.addEventListener('click', async () => {
        const inputWs = document.getElementById('inputWsUrl');
        const url = inputWs ? inputWs.value.trim() : 'ws://192.168.4.1:81';
        try {
          btnConnectWs.disabled = true;
          btnConnectWs.innerHTML = `Menghubungkan...`;
          const res = await window.mociApi.websocketAdapter.connect(url);
          btnConnectWs.style.display = 'none';
          if (btnDisconnectWs) btnDisconnectWs.style.display = 'inline-flex';
          this.showToast(res.message, 'success');
          this.updateConnectionView();
        } catch (e) {
          btnConnectWs.disabled = false;
          btnConnectWs.innerHTML = `Hubungkan WebSocket`;
          this.showToast(e.message, 'error');
        }
      });
    }

    if (btnDisconnectWs) {
      btnDisconnectWs.addEventListener('click', async () => {
        await window.mociApi.websocketAdapter.disconnect();
        btnDisconnectWs.style.display = 'none';
        if (btnConnectWs) {
          btnConnectWs.disabled = false;
          btnConnectWs.style.display = 'inline-flex';
          btnConnectWs.innerHTML = `Hubungkan WebSocket`;
        }
        this.showToast('WebSocket diputuskan.', 'info');
        this.updateConnectionView();
      });
    }

    // 6. Bluetooth BLE Handlers
    const btnConnectBle = document.getElementById('btnConnectBle');
    const btnDisconnectBle = document.getElementById('btnDisconnectBle');
    if (btnConnectBle) {
      btnConnectBle.addEventListener('click', async () => {
        try {
          btnConnectBle.disabled = true;
          const res = await window.mociApi.bleAdapter.connect();
          btnConnectBle.style.display = 'none';
          if (btnDisconnectBle) btnDisconnectBle.style.display = 'inline-flex';
          this.showToast(res.message, 'success');
          this.updateConnectionView();
        } catch (e) {
          btnConnectBle.disabled = false;
          this.showToast(e.message, 'error');
        }
      });
    }

    if (btnDisconnectBle) {
      btnDisconnectBle.addEventListener('click', async () => {
        await window.mociApi.bleAdapter.disconnect();
        btnDisconnectBle.style.display = 'none';
        if (btnConnectBle) {
          btnConnectBle.disabled = false;
          btnConnectBle.style.display = 'inline-flex';
        }
        this.showToast('Bluetooth BLE diputuskan.', 'info');
        this.updateConnectionView();
      });
    }
  }

  selectConnectionType(type) {
    const valid = ['serial', 'wifi', 'websocket', 'ble', 'demo'];
    if (!valid.includes(type)) type = 'demo';

    // 1. Update active card highlight
    document.querySelectorAll('.connection-select-card').forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-conn-type') === type);
    });

    // 2. Switch detail panels
    const panels = {
      serial: document.getElementById('panelConnSerial'),
      wifi: document.getElementById('panelConnWifi'),
      websocket: document.getElementById('panelConnWebsocket'),
      ble: document.getElementById('panelConnBle'),
      demo: document.getElementById('panelConnDemo')
    };

    Object.keys(panels).forEach(key => {
      if (panels[key]) {
        panels[key].style.display = key === type ? 'block' : 'none';
      }
    });

    // 3. Switch active adapter
    window.mociApi.setConnectionType(type);

    const labels = {
      serial: 'Kabel USB Serial (CDC)',
      wifi: 'Wi-Fi REST HTTP',
      websocket: 'WebSocket Realtime',
      ble: 'Bluetooth Low Energy',
      demo: 'Mode Demo (Simulasi Browser)'
    };

    this.showToast(`Saluran koneksi dialihkan ke: ${labels[type]}`, 'info');
    this.updateConnectionView();
  }

  async updateConnectionView() {
    const status = await window.mociApi.getStatus();
    const type = window.mociApi.activeType;

    // Sync active card in UI
    document.querySelectorAll('.connection-select-card').forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-conn-type') === type);
    });

    // Top Header Badge
    const headerBadge = document.getElementById('headerConnectionBadge');
    if (headerBadge) {
      headerBadge.className = `badge ${status.badgeClass || 'badge-demo'}`;
      headerBadge.textContent = status.badgeText || 'Mode Demo (Simulasi)';
    }

    // Sidebar status
    const sidebarDot = document.getElementById('sidebarStatusDot');
    if (sidebarDot) {
      sidebarDot.className = `status-indicator-dot ${status.isConnected ? 'online' : (type === 'demo' ? '' : 'offline')}`;
    }
    const sidebarTitle = document.querySelector('.compact-status-title');
    if (sidebarTitle) {
      sidebarTitle.textContent = status.connectionTitle || 'Mode Demo';
    }
    const sidebarSub = document.querySelector('.compact-status-subtitle');
    if (sidebarSub) {
      sidebarSub.textContent = status.isConnected ? 'ESP32 Terhubung' : 'ESP32 Standby';
    }

    // Connection View Stat Badges
    const badgeEl = document.getElementById('connStatusBadge');
    if (badgeEl) {
      badgeEl.className = `badge ${status.badgeClass || 'badge-demo'}`;
      badgeEl.textContent = status.badgeText || 'Mode Demo';
    }

    const noticeEl = document.getElementById('connNoticeText');
    if (noticeEl) {
      noticeEl.textContent = status.notice || '';
    }

    const lastPingEl = document.getElementById('connLastPingTime');
    if (lastPingEl) {
      lastPingEl.textContent = status.lastPingTime || '-';
    }

    // Update IP input value
    const ipInput = document.getElementById('inputDeviceIp');
    if (ipInput) {
      ipInput.value = window.mociState.settings.deviceIp || 'http://192.168.4.1';
    }

    // Update Serial Badge
    const serialBadge = document.getElementById('serialConnBadge');
    if (serialBadge) {
      const isSerConn = window.mociApi.serialAdapter.isConnected;
      serialBadge.className = `badge ${isSerConn ? 'badge-connected' : 'badge-disconnected'}`;
      serialBadge.textContent = isSerConn ? 'USB CDC Terhubung' : 'Belum Terhubung';
    }

    // Update Wi-Fi Badge
    const wifiBadge = document.getElementById('wifiConnBadge');
    if (wifiBadge) {
      const isWifiConn = window.mociApi.restAdapter.isConnected;
      wifiBadge.className = `badge ${isWifiConn ? 'badge-connected' : 'badge-demo'}`;
      wifiBadge.textContent = isWifiConn ? 'Wi-Fi Terhubung' : 'Siap Dihubungkan';
    }

    // Update WS Badge
    const wsBadge = document.getElementById('wsConnBadge');
    if (wsBadge) {
      const isWsConn = window.mociApi.websocketAdapter.isConnected;
      wsBadge.className = `badge ${isWsConn ? 'badge-connected' : 'badge-disconnected'}`;
      wsBadge.textContent = isWsConn ? 'WebSocket Open' : 'Terputus';
    }
  }

  // --- Settings Form ---
  bindSettingsForm() {
    const form = document.getElementById('settingsForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const robotName = document.getElementById('settingRobotName').value.trim() || 'Moci';
        const theme = document.getElementById('settingTheme').value;
        const mascotEyeSpeed = document.getElementById('settingEyeSpeed').value;
        const mascotSoundEnabled = document.getElementById('settingSoundToggle').checked;
        const defaultVolume = parseInt(document.getElementById('settingDefaultVolume').value, 10);
        const slideshowDuration = parseInt(document.getElementById('settingSlideshowDuration').value, 10);
        const idleMode = document.getElementById('settingIdleMode').value;
        const idleTimeout = parseInt(document.getElementById('settingIdleTimeout').value, 10);

        window.mociState.saveSettings({
          robotName,
          theme,
          mascotEyeSpeed,
          mascotSoundEnabled,
          defaultVolume,
          slideshowDuration,
          idleMode,
          idleTimeout
        });

        this.applyTheme(theme);
        if (window.mociMascot) window.mociMascot.startBlinkLoop();
        this.updateDashboard();
        this.showToast('Pengaturan berhasil disimpan!', 'success');
      });
    }

    // Reset button
    const resetBtn = document.getElementById('btnResetFactory');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.confirmAction(
          'Kembalikan ke Pengaturan Awal',
          'Tindakan ini akan mengembalikan nama robot, tema, dan preferensi media demo ke kondisi semula. Lanjutkan?',
          () => {
            window.mociState.resetToFactory();
            this.applyTheme('mint');
            this.populateSettingsForm();
            this.updateDashboard();
            if (window.mociGallery) window.mociGallery.renderGallery();
            if (window.mociAudio) window.mociAudio.renderMusicPage();
            this.showToast('Pengaturan telah direset ke awal.', 'info');
          }
        );
      });
    }
  }

  populateSettingsForm() {
    const s = window.mociState?.settings || {};
    const nameEl = document.getElementById('settingRobotName');
    const themeEl = document.getElementById('settingTheme');
    const eyeSpeedEl = document.getElementById('settingEyeSpeed');
    const soundEl = document.getElementById('settingSoundToggle');
    const volEl = document.getElementById('settingDefaultVolume');
    const volValEl = document.getElementById('settingVolumeDisplay');
    const slideEl = document.getElementById('settingSlideshowDuration');
    const idleEl = document.getElementById('settingIdleMode');
    const idleTimeEl = document.getElementById('settingIdleTimeout');

    if (nameEl) nameEl.value = s.robotName || 'Moci';
    if (themeEl) themeEl.value = s.theme || 'mint';
    if (eyeSpeedEl) eyeSpeedEl.value = s.mascotEyeSpeed || 'normal';
    if (soundEl) soundEl.checked = s.mascotSoundEnabled !== false;
    if (volEl) {
      volEl.value = s.defaultVolume || 80;
      if (volValEl) volValEl.textContent = `${volEl.value}%`;
      volEl.oninput = () => { if (volValEl) volValEl.textContent = `${volEl.value}%`; };
    }
    if (slideEl) slideEl.value = s.slideshowDuration || 5;
    if (idleEl) idleEl.value = s.idleMode || 'eyes';
    if (idleTimeEl) idleTimeEl.value = s.idleTimeout || 60;
  }

  // --- Modals System ---
  bindModals() {
    document.addEventListener('click', (e) => {
      // Open modal trigger
      const openTrigger = e.target.closest('[data-open-modal]');
      if (openTrigger) {
        const modalId = openTrigger.getAttribute('data-open-modal');
        this.openModal(modalId);
      }

      // Close modal trigger
      const closeTrigger = e.target.closest('[data-close-modal]');
      if (closeTrigger) {
        const modal = closeTrigger.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      }

      // Backdrop click
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
      }
    });

    // Confirm dialog button
    const confirmBtn = document.getElementById('btnConfirmActionOk');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (this.confirmCallback) {
          this.confirmCallback();
          this.confirmCallback = null;
        }
        this.closeModal('confirmActionModal');
      });
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  confirmAction(title, message, onConfirm) {
    this.confirmCallback = onConfirm;
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    this.openModal('confirmActionModal');
  }

  // --- Toast System ---
  showToast(message, type = 'info', title = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const titles = {
      success: 'Berhasil',
      error: 'Peringatan',
      warning: 'Perhatian',
      info: 'Informasi'
    };

    const icons = {
      success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
      error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        <div class="toast-title">${title || titles[type]}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    // Auto dismiss after 3.5s
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 3500);
  }
}

// Global UI coordinator singleton
window.mociUI = new MociUI();
