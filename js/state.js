/* ===================================================================
   STATE MANAGEMENT & LOCAL STORAGE — WEB MOCI
   Manages application preferences, demo media, and activity logs
   =================================================================== */

class StateManager {
  constructor() {
    this.STORAGE_KEY_SETTINGS = 'moci_settings_v1';
    this.STORAGE_KEY_PHOTOS = 'moci_photos_v1';
    this.STORAGE_KEY_TRACKS = 'moci_tracks_v1';
    this.STORAGE_KEY_ACTIVITIES = 'moci_activities_v1';
    this.STORAGE_KEY_ALARMS = 'moci_alarms_v1';
    this.STORAGE_KEY_CHAT = 'moci_chat_v1';
    this.STORAGE_KEY_TEMPLATES = 'moci_templates_v1';
    this.listeners = {};

    this.settings = this.loadSettings();
    this.photos = this.loadPhotos();
    this.tracks = this.loadTracks();
    this.activities = this.loadActivities();
    this.alarms = this.loadAlarms();
    this.chatMessages = this.loadChat();
    this.templates = this.loadTemplates();

    // In-memory runtime state
    this.currentTrackIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'all'; // 'off', 'all', 'one'
    this.currentExpression = 'happy';
    this.activeView = 'ringkasan';
    this.isSlideshowActive = false;
    this.transferQueue = [];
    this.activeAlarmRinging = null;
  }

  // --- Event Emitter ---
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error('Event error', event, e); }
      });
    }
  }

  // --- Settings ---
  loadSettings() {
    const defaults = {
      robotName: 'Moci',
      theme: 'mint', // 'mint', 'violet', 'gold', 'emerald'
      mascotEyeSpeed: 'normal', // 'slow', 'normal', 'fast'
      mascotSoundEnabled: true,
      defaultVolume: 80,
      slideshowDuration: 5, // seconds
      idleMode: 'eyes', // 'eyes', 'clock', 'slideshow', 'off'
      idleTimeout: 60, // seconds
      deviceIp: 'http://192.168.4.1',
      connectionType: 'demo', // 'demo', 'serial', 'wifi', 'ble', 'websocket', 'mqtt'
      serialBaudRate: 115200,
      websocketUrl: 'ws://192.168.4.1:81',
      bleDeviceName: 'Moci-ESP32',
      mqttBrokerUrl: 'wss://broker.emqx.io:8084/mqtt',
      mqttTopic: 'moci/robot01',
      // AI & Chat Settings
      aiProvider: 'offline', // 'offline', 'gemini'
      geminiApiKey: '',
      ttsVoiceEnabled: true,
      // Alarm Settings
      alarmVolume: 85,
      alarmSnoozeMinutes: 5
    };

    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_SETTINGS);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch (e) {
      return defaults;
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
      this.emit('settings_changed', this.settings);
    } catch (e) {
      console.warn('Failed to save settings to localStorage', e);
    }
  }

  // --- Photos ---
  loadPhotos() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_PHOTOS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Using default demo photos');
    }
    return this.getDefaultPhotos();
  }

  savePhotos() {
    try {
      localStorage.setItem(this.STORAGE_KEY_PHOTOS, JSON.stringify(this.photos));
      this.emit('photos_changed', this.photos);
    } catch (e) {
      console.warn('Failed to save photos', e);
    }
  }

  addPhoto(photo) {
    this.photos.unshift(photo);
    this.savePhotos();
    this.logActivity('Foto Baru Ditambahkan', `Menambahkan foto "${photo.name}" ke galeri lokal browser.`);
    this.emit('photo_added', photo);
  }

  removePhoto(photoId) {
    const photo = this.photos.find(p => p.id === photoId);
    this.photos = this.photos.filter(p => p.id !== photoId);
    this.savePhotos();
    if (photo) {
      this.logActivity('Foto Dihapus', `Menghapus foto "${photo.name}".`);
    }
    this.emit('photo_removed', photoId);
  }

  togglePhotoFavorite(photoId) {
    const photo = this.photos.find(p => p.id === photoId);
    if (photo) {
      photo.isFavorite = !photo.isFavorite;
      this.savePhotos();
      this.emit('photo_updated', photo);
    }
  }

  // --- Music Tracks ---
  loadTracks() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_TRACKS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Using default demo tracks');
    }
    return this.getDefaultTracks();
  }

  saveTracks() {
    try {
      localStorage.setItem(this.STORAGE_KEY_TRACKS, JSON.stringify(this.tracks));
      this.emit('tracks_changed', this.tracks);
    } catch (e) {
      console.warn('Failed to save tracks', e);
    }
  }

  addTrack(track) {
    this.tracks.unshift(track);
    this.saveTracks();
    this.logActivity('Lagu Baru Ditambahkan', `Menambahkan lagu "${track.title}" ke daftar musik browser.`);
    this.emit('track_added', track);
  }

  removeTrack(trackId) {
    const track = this.tracks.find(t => t.id === trackId);
    this.tracks = this.tracks.filter(t => t.id !== trackId);
    this.saveTracks();
    if (track) {
      this.logActivity('Lagu Dihapus', `Menghapus lagu "${track.title}".`);
    }
    this.emit('track_removed', trackId);
  }

  toggleTrackFavorite(trackId) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.isFavorite = !track.isFavorite;
      this.saveTracks();
      this.emit('track_updated', track);
    }
  }

  // --- Activity Log ---
  loadActivities() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_ACTIVITIES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return [
      {
        id: 'act-1',
        title: 'Sistem Dimulai',
        desc: 'Web Moci aktif dalam Mode Demo simulasi.',
        timestamp: new Date(Date.now() - 1000 * 60 * 12).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'system'
      },
      {
        id: 'act-2',
        title: 'Micro SD Terdeteksi (Simulasi)',
        desc: 'Format FAT32 16GB ESP32-S3 siap digunakan.',
        timestamp: new Date(Date.now() - 1000 * 60 * 8).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'storage'
      }
    ];
  }

  logActivity(title, desc, type = 'user') {
    const act = {
      id: 'act-' + Date.now(),
      title,
      desc,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      type
    };
    this.activities.unshift(act);
    if (this.activities.length > 25) this.activities.pop();
    try {
      localStorage.setItem(this.STORAGE_KEY_ACTIVITIES, JSON.stringify(this.activities));
      this.emit('activities_changed', this.activities);
    } catch (e) {}
  }

  // --- Reset All Data ---
  resetToFactory() {
    localStorage.removeItem(this.STORAGE_KEY_SETTINGS);
    localStorage.removeItem(this.STORAGE_KEY_PHOTOS);
    localStorage.removeItem(this.STORAGE_KEY_TRACKS);
    localStorage.removeItem(this.STORAGE_KEY_ACTIVITIES);
    localStorage.removeItem(this.STORAGE_KEY_ALARMS);
    localStorage.removeItem(this.STORAGE_KEY_CHAT);
    localStorage.removeItem(this.STORAGE_KEY_TEMPLATES);
    this.settings = this.loadSettings();
    this.photos = this.getDefaultPhotos();
    this.tracks = this.getDefaultTracks();
    this.activities = this.loadActivities();
    this.alarms = this.getDefaultAlarms();
    this.chatMessages = this.getDefaultChat();
    this.templates = this.getDefaultTemplates();
    this.emit('reset_complete');
  }

  // --- Alarms Management ---
  loadAlarms() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_ALARMS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Using default demo alarms');
    }
    return this.getDefaultAlarms();
  }

  saveAlarms() {
    try {
      localStorage.setItem(this.STORAGE_KEY_ALARMS, JSON.stringify(this.alarms));
      this.emit('alarms_changed', this.alarms);
    } catch (e) {
      console.warn('Failed to save alarms', e);
    }
  }

  addAlarm(alarm) {
    this.alarms.push(alarm);
    this.saveAlarms();
    this.logActivity('Alarm Dibuat', `Alarm "${alarm.label}" disetel pada pukul ${alarm.time}.`);
    this.emit('alarm_added', alarm);
  }

  updateAlarm(alarmId, updates) {
    const idx = this.alarms.findIndex(a => a.id === alarmId);
    if (idx !== -1) {
      this.alarms[idx] = { ...this.alarms[idx], ...updates };
      this.saveAlarms();
      this.emit('alarm_updated', this.alarms[idx]);
    }
  }

  toggleAlarm(alarmId) {
    const alarm = this.alarms.find(a => a.id === alarmId);
    if (alarm) {
      alarm.enabled = !alarm.enabled;
      this.saveAlarms();
      this.logActivity('Status Alarm Diubah', `Alarm "${alarm.label}" (${alarm.time}) ${alarm.enabled ? 'diaktifkan' : 'dinonaktifkan'}.`);
      this.emit('alarm_updated', alarm);
    }
  }

  removeAlarm(alarmId) {
    const alarm = this.alarms.find(a => a.id === alarmId);
    this.alarms = this.alarms.filter(a => a.id !== alarmId);
    this.saveAlarms();
    if (alarm) {
      this.logActivity('Alarm Dihapus', `Alarm "${alarm.label}" (${alarm.time}) dihapus.`);
    }
    this.emit('alarm_removed', alarmId);
  }

  getDefaultAlarms() {
    return [
      {
        id: 'alarm_1',
        time: '06:30',
        label: 'Bangun Pagi & Sapa Moci',
        repeat: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum'],
        sound: 'chirp', // 'chirp', 'beep8bit', 'melody', 'siren'
        enabled: true,
        lastTriggered: null
      },
      {
        id: 'alarm_2',
        time: '12:00',
        label: 'Istirahat Siang & Makan',
        repeat: ['Setiap Hari'],
        sound: 'melody',
        enabled: true,
        lastTriggered: null
      },
      {
        id: 'alarm_3',
        time: '20:00',
        label: 'Waktu Belajar Coding ESP32',
        repeat: ['Sen', 'Rab', 'Jum'],
        sound: 'beep8bit',
        enabled: false,
        lastTriggered: null
      }
    ];
  }

  // --- Chat Messages Management ---
  loadChat() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_CHAT);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Using default demo chat');
    }
    return this.getDefaultChat();
  }

  saveChat() {
    try {
      localStorage.setItem(this.STORAGE_KEY_CHAT, JSON.stringify(this.chatMessages));
      this.emit('chat_changed', this.chatMessages);
    } catch (e) {}
  }

  addChatMessage(msg) {
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 60) this.chatMessages.shift();
    this.saveChat();
    this.emit('chat_message_added', msg);
  }

  clearChat() {
    this.chatMessages = this.getDefaultChat();
    this.saveChat();
    this.logActivity('Riwayat Chat Dibersihkan', 'Riwayat percakapan dengan Moci telah di-reset.');
    this.emit('chat_cleared');
  }

  getDefaultChat() {
    return [
      {
        id: 'msg_welcome',
        sender: 'moci',
        text: 'Bip-bop! Halo Farhan! 🤖 Senang bertemu denganmu. Aku Moci, robot pendamping cerdas berbasis ESP32-S3. Kamu bisa pilih template obrolan cepat di bawah atau ketik pesan apa saja untuk ngobrol denganku!',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        expression: 'happy'
      }
    ];
  }

  // --- Conversation Templates Management ---
  loadTemplates() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_TEMPLATES);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return this.getDefaultTemplates();
  }

  saveTemplates() {
    try {
      localStorage.setItem(this.STORAGE_KEY_TEMPLATES, JSON.stringify(this.templates));
      this.emit('templates_changed', this.templates);
    } catch (e) {}
  }

  addTemplate(template) {
    this.templates.push(template);
    this.saveTemplates();
    this.emit('template_added', template);
  }

  removeTemplate(id) {
    this.templates = this.templates.filter(t => t.id !== id);
    this.saveTemplates();
    this.emit('template_removed', id);
  }

  getDefaultTemplates() {
    return [
      { id: 'tpl_1', label: '👋 Sapa Moci', text: 'Halo Moci, apa kabar kamu hari ini?' },
      { id: 'tpl_2', label: '😂 Cerita Lucu', text: 'Moci, ceritakan lelucon lucu dong!' },
      { id: 'tpl_3', label: '🔋 Cek Status', text: 'Berapa sisa baterai dan kondisi kamu sekarang?' },
      { id: 'tpl_4', label: '✨ Wajah Bahagia', text: 'Moci, coba pasang muka senang dan berkedip!' },
      { id: 'tpl_5', label: '🎵 Putar Musik', text: 'Moci, putar musik santai untuk menemani belajarku!' },
      { id: 'tpl_6', label: '🧠 Spesifikasi', text: 'Moci, sebutkan spesifikasi hardware ESP32 kamu!' },
      { id: 'tpl_7', label: '⏰ Cek Alarm', text: 'Moci, apakah ada alarm aktif hari ini?' },
      { id: 'tpl_8', label: '🚀 Motivasi PKL', text: 'Beri aku kata-kata motivasi untuk proyek PKL ini!' }
    ];
  }

  // --- Seed Data ---
  getDefaultPhotos() {
    return [
      {
        id: 'photo-demo-1',
        name: 'Moci Robot Concept',
        url: this.generateSvgPhoto('Moci Explorer', '#00f5d4', '#0a0f1d', '🤖'),
        size: '142 KB',
        date: '2026-10-24',
        location: 'sd', // 'sd' = Micro SD Moci, 'local' = Browser
        isFavorite: true,
        tftCompatible: true
      },
      {
        id: 'photo-demo-2',
        name: 'Cyber City Landscape',
        url: this.generateSvgPhoto('Cyber Cityscape', '#00bbf9', '#17233d', '🌆'),
        size: '185 KB',
        date: '2026-10-25',
        location: 'sd',
        isFavorite: false,
        tftCompatible: true
      },
      {
        id: 'photo-demo-3',
        name: 'Moci Pixel Art Portrait',
        url: this.generateSvgPhoto('Pixel Moci 128x160', '#ff6b6b', '#111a2e', '👾'),
        size: '98 KB',
        date: '2026-10-25',
        location: 'local',
        isFavorite: true,
        tftCompatible: true
      },
      {
        id: 'photo-demo-4',
        name: 'Retro Synthesizer Grid',
        url: this.generateSvgPhoto('Retro Grid Sound', '#ffd166', '#090e1a', '🎛️'),
        size: '210 KB',
        date: '2026-10-26',
        location: 'local',
        isFavorite: false,
        tftCompatible: true
      }
    ];
  }

  getDefaultTracks() {
    return [
      {
        id: 'track-demo-1',
        title: 'Moci Friendly Chime',
        artist: 'ESP32 Synth Engine',
        duration: '0:32',
        durationSec: 32,
        url: 'synth:friendly_chime',
        location: 'sd', // 'sd' or 'local'
        isFavorite: true,
        coverText: 'CHIME'
      },
      {
        id: 'track-demo-2',
        title: 'Cyberpunk Lo-Fi Chill',
        artist: 'Moci Beatmaker',
        duration: '0:45',
        durationSec: 45,
        url: 'synth:lofi_chill',
        location: 'sd',
        isFavorite: true,
        coverText: 'LO-FI'
      },
      {
        id: 'track-demo-3',
        title: '8-Bit Robot Adventure',
        artist: 'Chiptune Lab',
        duration: '0:38',
        durationSec: 38,
        url: 'synth:8bit_adventure',
        location: 'local',
        isFavorite: false,
        coverText: '8-BIT'
      }
    ];
  }

  // Generates crisp SVG Data URLs that look stunning without needing internet connection
  generateSvgPhoto(title, color1, color2, icon) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 128 160">
        <defs>
          <linearGradient id="g_${color1.replace('#','')}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${color2}" />
            <stop offset="100%" stop-color="#050811" />
          </linearGradient>
          <radialGradient id="r_${color1.replace('#','')}" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stop-color="${color1}" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="128" height="160" fill="url(#g_${color1.replace('#','')})" />
        <circle cx="64" cy="65" r="50" fill="url(#r_${color1.replace('#','')})" />
        <rect x="6" y="6" width="116" height="148" rx="6" fill="none" stroke="${color1}" stroke-width="0.75" stroke-opacity="0.4" stroke-dasharray="3,2" />
        <text x="64" y="70" font-size="34" text-anchor="middle" dominant-baseline="middle">${icon}</text>
        <text x="64" y="112" font-family="monospace" font-size="7.5" font-weight="bold" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${title}</text>
        <text x="64" y="126" font-family="monospace" font-size="6" fill="${color1}" text-anchor="middle" letter-spacing="0.4">128 × 160 TFT</text>
        <text x="64" y="145" font-family="monospace" font-size="5" fill="#5e7399" text-anchor="middle">ROBOT MOCI</text>
      </svg>
    `;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
  }
}

// Export singleton instance
window.mociState = new StateManager();
