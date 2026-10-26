/* ===================================================================
   ALARM MANAGER — WEB MOCI
   Real-time clock, alarm scheduling, multi-ringtone Web Audio synth,
   snooze/dismiss, and optional ESP32 sync via MociApiGateway
   =================================================================== */

class AlarmManager {
  constructor() {
    this.audioCtx = null;
    this.ringingInterval = null;
    this.clockInterval = null;
    this.activeRingingAlarm = null;
    this.editingAlarmId = null;
    this.selectedRepeatDays = new Set();

    // DOM refs
    this.clockEl = document.getElementById('alarmClock');
    this.dateEl = document.getElementById('alarmDate');
    this.alarmListEl = document.getElementById('alarmListContainer');
    this.alarmCountBadge = document.getElementById('alarmListCountBadge');
    this.navBadge = document.getElementById('navBadgeAlarm');
    this.alarmFormCard = document.getElementById('alarmFormCard');
    this.ringingOverlay = document.getElementById('alarmRingingOverlay');

    this._initAudioContext();
    this._bindEvents();
    this._startClock();
    this._renderAlarmList();

    // Listen for alarm changes in state
    window.mociState.on('alarms_changed', () => this._renderAlarmList());
  }

  // ---- Audio Context ----
  _initAudioContext() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[AlarmManager] Web Audio API tidak tersedia.');
    }
  }

  _ensureAudioCtx() {
    if (!this.audioCtx) this._initAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // ---- Clock ----
  _startClock() {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      if (this.clockEl) this.clockEl.textContent = `${h}:${m}:${s}`;

      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      if (this.dateEl) {
        this.dateEl.textContent = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      }

      // Check for triggered alarms every minute change (on :00 second)
      if (now.getSeconds() === 0) {
        this._checkAlarms(h, m);
      }
    };

    tick();
    this.clockInterval = setInterval(tick, 1000);
  }

  _checkAlarms(h, m) {
    const timeStr = `${h}:${m}`;
    const now = new Date();
    const dayMap = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const todayShort = dayMap[now.getDay()];

    const alarms = window.mociState.alarms;
    alarms.forEach(alarm => {
      if (!alarm.enabled) return;
      if (alarm.time !== timeStr) return;

      // Check repeat day
      const lastTriggeredDate = alarm.lastTriggered ? new Date(alarm.lastTriggered).toDateString() : null;
      const todayStr = now.toDateString();
      if (lastTriggeredDate === todayStr) return; // already rang today

      const shouldRing = alarm.repeat.length === 0 ||
        alarm.repeat.includes('Setiap Hari') ||
        alarm.repeat.includes(todayShort);

      if (shouldRing && !this.activeRingingAlarm) {
        this._triggerAlarm(alarm);
      }
    });
  }

  _triggerAlarm(alarm) {
    this.activeRingingAlarm = alarm;
    window.mociState.updateAlarm(alarm.id, { lastTriggered: new Date().toISOString() });

    // Show ringing overlay
    const overlay = this.ringingOverlay;
    if (overlay) {
      overlay.style.display = 'flex';
      const timeEl = document.getElementById('alarmRingTime');
      const labelEl = document.getElementById('alarmRingLabel');
      if (timeEl) timeEl.textContent = alarm.time;
      if (labelEl) labelEl.textContent = alarm.label;
    }

    // Animate mascot
    if (window.mociMascot) {
      window.mociMascot.setExpression('surprised');
    }

    // Play ringtone loop
    this._playRingtoneLoop(alarm.sound || 'chirp');

    // Log activity
    window.mociState.logActivity('Alarm Berbunyi! 🔔', `Alarm "${alarm.label}" (${alarm.time}) telah aktif.`);

    if (window.mociUI) {
      window.mociUI.showToast(`⏰ ALARM: ${alarm.label} (${alarm.time})`, 'warning');
    }
  }

  _playRingtoneLoop(soundType) {
    this._stopRingtone();
    const play = () => this._playOnce(soundType);
    play();
    this.ringingInterval = setInterval(play, 2200);
  }

  _stopRingtone() {
    if (this.ringingInterval) {
      clearInterval(this.ringingInterval);
      this.ringingInterval = null;
    }
  }

  _dismissAlarm() {
    this._stopRingtone();
    this.activeRingingAlarm = null;
    const overlay = this.ringingOverlay;
    if (overlay) overlay.style.display = 'none';
    if (window.mociMascot) window.mociMascot.setExpression('happy');
    if (window.mociUI) window.mociUI.showToast('✅ Alarm dimatikan!', 'success');
  }

  _snoozeAlarm() {
    this._stopRingtone();
    const alarm = this.activeRingingAlarm;
    const overlay = this.ringingOverlay;
    if (overlay) overlay.style.display = 'none';

    const snoozeMin = window.mociState.settings.alarmSnoozeMinutes || 5;
    if (alarm) {
      const snoozeEnd = Date.now() + snoozeMin * 60 * 1000;
      if (window.mociUI) window.mociUI.showToast(`💤 Alarm ditunda ${snoozeMin} menit...`, 'info');
      setTimeout(() => {
        if (!this.activeRingingAlarm) {
          this._triggerAlarm({ ...alarm, label: `(Snooze) ${alarm.label}` });
        }
      }, snoozeMin * 60 * 1000);
    }
    this.activeRingingAlarm = null;
  }

  // ---- Ringtone Synthesizer (Web Audio) ----
  _playOnce(type) {
    this._ensureAudioCtx();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const vol = (window.mociState.settings.alarmVolume || 85) / 100;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol * 0.8, ctx.currentTime + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
    gainNode.connect(ctx.destination);

    if (type === 'chirp') {
      // Robot chirp sequence
      const freqs = [880, 1100, 660, 990, 1320, 550];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        osc.connect(gainNode);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.1);
      });

    } else if (type === 'beep8bit') {
      // 8-bit style alarm
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.6, ctx.currentTime);
      g.gain.setValueAtTime(0, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(vol * 0.6, ctx.currentTime + 0.3);
      g.gain.setValueAtTime(0, ctx.currentTime + 0.45);
      g.gain.setValueAtTime(vol * 0.6, ctx.currentTime + 0.6);
      g.connect(ctx.destination);
      osc.frequency.value = 440;
      osc.connect(g);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.9);

    } else if (type === 'melody') {
      // Ascending futuristic melody
      const notes = [523, 659, 784, 1047, 784, 1047, 1319];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
        g.gain.linearRampToValueAtTime(vol * 0.5, ctx.currentTime + i * 0.15 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.14);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.15);
      });

    } else if (type === 'siren') {
      // Siren (frequency sweep)
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.5);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 1.0);
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 1.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.4, ctx.currentTime);
      g.gain.setValueAtTime(0.001, ctx.currentTime + 1.8);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.8);
    }
  }

  // ---- Alarm List Rendering ----
  _renderAlarmList() {
    const container = this.alarmListEl;
    if (!container) return;

    const alarms = window.mociState.alarms;
    const count = alarms.length;
    const activeCount = alarms.filter(a => a.enabled).length;

    if (this.alarmCountBadge) {
      this.alarmCountBadge.textContent = `${count} alarm, ${activeCount} aktif`;
    }
    if (this.navBadge) {
      this.navBadge.textContent = activeCount;
      this.navBadge.style.display = activeCount > 0 ? '' : 'none';
    }

    if (!alarms.length) {
      container.innerHTML = `
        <div class="empty-state" style="padding:24px 0;">
          <div style="font-size:2rem; margin-bottom:8px;">⏰</div>
          <div style="font-size:0.88rem; color:var(--text-muted);">Belum ada alarm. Klik <strong>"Tambah Alarm"</strong> untuk membuat alarm pertama!</div>
        </div>`;
      return;
    }

    container.innerHTML = alarms.map(alarm => `
      <div class="alarm-item ${alarm.enabled ? 'alarm-enabled' : 'alarm-disabled'}" data-id="${alarm.id}">
        <div class="alarm-item-left">
          <div class="alarm-time-display">${alarm.time}</div>
          <div>
            <div class="alarm-label">${alarm.label}</div>
            <div class="alarm-meta">
              <span class="alarm-repeat-tags">${alarm.repeat.map(d => `<span class="alarm-day-tag">${d}</span>`).join('')}</span>
              <span class="alarm-sound-tag">${this._soundIcon(alarm.sound)} ${alarm.sound}</span>
            </div>
          </div>
        </div>
        <div class="alarm-item-right">
          <label class="alarm-toggle-wrap" title="${alarm.enabled ? 'Nonaktifkan' : 'Aktifkan'} alarm">
            <input type="checkbox" class="alarm-toggle-input" ${alarm.enabled ? 'checked' : ''} data-alarm-id="${alarm.id}">
            <span class="alarm-toggle-slider"></span>
          </label>
          <button class="btn-icon-sm alarm-edit-btn" data-alarm-id="${alarm.id}" title="Edit Alarm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="btn-icon-sm alarm-delete-btn" data-alarm-id="${alarm.id}" title="Hapus Alarm" style="color:var(--accent-coral);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Bind item events
    container.querySelectorAll('.alarm-toggle-input').forEach(cb => {
      cb.addEventListener('change', (e) => {
        window.mociState.toggleAlarm(e.target.dataset.alarmId);
      });
    });
    container.querySelectorAll('.alarm-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm(`Hapus alarm ini?`)) {
          window.mociState.removeAlarm(btn.dataset.alarmId);
        }
      });
    });
    container.querySelectorAll('.alarm-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => this._openEditForm(btn.dataset.alarmId));
    });
  }

  _soundIcon(sound) {
    const icons = { chirp: '🤖', beep8bit: '🎮', melody: '🎵', siren: '🚨' };
    return icons[sound] || '🔔';
  }

  // ---- Form ----
  _openAddForm() {
    this._ensureAudioCtx();
    this.editingAlarmId = null;
    this.selectedRepeatDays = new Set(['Sen', 'Sel', 'Rab', 'Kam', 'Jum']);
    const ti = document.getElementById('inputAlarmTime');
    const li = document.getElementById('inputAlarmLabel');
    const si = document.getElementById('inputAlarmSound');
    if (ti) ti.value = '07:00';
    if (li) li.value = '';
    if (si) si.value = 'chirp';
    this._updateDayButtons();
    const card = this.alarmFormCard || document.getElementById('alarmFormCard');
    if (card) {
      card.style.display = 'block';
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  _openEditForm(alarmId) {
    this._ensureAudioCtx();
    const alarm = window.mociState.alarms.find(a => a.id === alarmId);
    if (!alarm) return;

    this.editingAlarmId = alarmId;
    this.selectedRepeatDays = new Set(alarm.repeat);
    const ti = document.getElementById('inputAlarmTime');
    const li = document.getElementById('inputAlarmLabel');
    const si = document.getElementById('inputAlarmSound');
    if (ti) ti.value = alarm.time;
    if (li) li.value = alarm.label;
    if (si) si.value = alarm.sound || 'chirp';
    this._updateDayButtons();
    const card = this.alarmFormCard || document.getElementById('alarmFormCard');
    if (card) {
      card.style.display = 'block';
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  _closeForm() {
    this.editingAlarmId = null;
    this.selectedRepeatDays = new Set();
    const card = this.alarmFormCard || document.getElementById('alarmFormCard');
    if (card) card.style.display = 'none';
  }

  _saveAlarm() {
    const time = document.getElementById('inputAlarmTime')?.value;
    const label = document.getElementById('inputAlarmLabel')?.value.trim();
    const sound = document.getElementById('inputAlarmSound')?.value;

    if (!time) {
      if (window.mociUI) window.mociUI.showToast('Pilih waktu alarm terlebih dahulu!', 'warning');
      return;
    }

    const repeatArr = this.selectedRepeatDays.size > 0 ? [...this.selectedRepeatDays] : ['Setiap Hari'];

    if (this.editingAlarmId) {
      window.mociState.updateAlarm(this.editingAlarmId, {
        time, label: label || 'Alarm', sound: sound || 'chirp', repeat: repeatArr
      });
      if (window.mociUI) window.mociUI.showToast(`✅ Alarm "${label || 'Alarm'}" diperbarui!`, 'success');
    } else {
      const newAlarm = {
        id: 'alarm_' + Date.now(),
        time, label: label || 'Alarm', sound: sound || 'chirp',
        repeat: repeatArr, enabled: true, lastTriggered: null
      };
      window.mociState.addAlarm(newAlarm);
      if (window.mociUI) window.mociUI.showToast(`✅ Alarm "${label || 'Alarm'}" berhasil dibuat!`, 'success');
    }

    this._closeForm();
  }

  _updateDayButtons() {
    document.querySelectorAll('.alarm-day-btn').forEach(btn => {
      const day = btn.dataset.day;
      if (this.selectedRepeatDays.has(day)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  // ---- ESP32 Sync ----
  async syncToEsp32() {
    const activeAlarms = window.mociState.alarms.filter(a => a.enabled);
    try {
      const res = await window.mociApi.syncAlarms(activeAlarms);
      if (window.mociUI) window.mociUI.showToast(res.message || `${activeAlarms.length} alarm disinkron ke ESP32!`, 'success');
      window.mociState.logActivity('Alarm Disinkronkan', `${activeAlarms.length} alarm aktif dikirim ke ESP32-S3.`);
    } catch (err) {
      if (window.mociUI) window.mociUI.showToast('Gagal sinkron alarm: ' + err.message, 'error');
    }
  }

  // ---- Event Binding ----
  _bindEvents() {
    // Add alarm button
    document.getElementById('btnAddAlarm')?.addEventListener('click', () => this._openAddForm());

    // Cancel form
    document.getElementById('btnCancelAlarmForm')?.addEventListener('click', () => this._closeForm());

    // Save alarm
    document.getElementById('btnSaveAlarm')?.addEventListener('click', () => this._saveAlarm());

    // Day buttons
    document.querySelectorAll('.alarm-day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = btn.dataset.day;
        if (this.selectedRepeatDays.has(day)) {
          this.selectedRepeatDays.delete(day);
          btn.classList.remove('selected');
        } else {
          this.selectedRepeatDays.add(day);
          btn.classList.add('selected');
        }
      });
    });

    // Ringing overlay buttons
    document.getElementById('btnDismissAlarm')?.addEventListener('click', () => this._dismissAlarm());
    document.getElementById('btnSnoozeAlarm')?.addEventListener('click', () => this._snoozeAlarm());

    // Sync to ESP32
    document.getElementById('btnSyncAlarmsToEsp')?.addEventListener('click', () => this.syncToEsp32());
  }
}

// Initialize alarm manager on page load
window.mociAlarm = null;
document.addEventListener('DOMContentLoaded', () => {
  window.mociAlarm = new AlarmManager();
});
