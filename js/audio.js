/* ===================================================================
   AUDIO ENGINE & MUSIC STUDIO — WEB MOCI
   HTMLAudioElement player, Synthesizer audio generator, and Visualizer
   =================================================================== */

class MociAudioEngine {
  constructor() {
    this.audioEl = new Audio();
    this.currentTrack = null;
    this.currentIndex = 0;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'all'; // 'off', 'all', 'one'
    this.volume = 0.8;
    this.isMuted = false;
    this.synthCache = {}; // Cache generated procedural WAV audio blobs

    this.audioContext = null;
    this.analyser = null;
    this.visualizerInterval = null;
  }

  init() {
    const defaultVol = (window.mociState?.settings?.defaultVolume || 80) / 100;
    this.setVolume(defaultVol);

    this.bindAudioEvents();
    this.bindDomControls();

    // Select initial track from state
    const tracks = window.mociState?.tracks || [];
    if (tracks.length > 0) {
      this.loadTrack(0, false);
    }
  }

  // --- HTMLAudioElement Events ---
  bindAudioEvents() {
    this.audioEl.addEventListener('timeupdate', () => {
      this.updateProgressBar();
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      this.updateDurationDisplay();
    });

    this.audioEl.addEventListener('ended', () => {
      this.onTrackEnded();
    });

    this.audioEl.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayStateUI();
      this.startVisualizer();
      document.body.classList.add('music-is-playing');

      // Animasi ekspresi menyanyi pada robot Moci
      if (window.mociMascot) {
        window.mociMascot.setExpression('singing', false);
      }
      if (window.mociApi) {
        window.mociApi.setExpression('singing').catch(() => {});
      }
    });

    this.audioEl.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayStateUI();
      this.stopVisualizer();
      document.body.classList.remove('music-is-playing');

      // Kembalikan ke ekspresi normal ceria
      if (window.mociMascot && window.mociMascot.currentExpression === 'singing') {
        window.mociMascot.setExpression('happy', false);
      }
      if (window.mociApi) {
        window.mociApi.setExpression('happy').catch(() => {});
      }
    });

    this.audioEl.addEventListener('error', (e) => {
      console.warn('Audio playback error', e);
      if (window.mociUI) {
        window.mociUI.showToast('Gagal memutar audio. Pastikan file kompatibel.', 'error');
      }
    });
  }

  // --- Track Loading & Playback ---
  async loadTrack(index, autoPlay = true) {
    const tracks = window.mociState?.tracks || [];
    if (!tracks.length || index < 0 || index >= tracks.length) return;

    this.currentIndex = index;
    this.currentTrack = tracks[index];
    if (window.mociState) {
      window.mociState.currentTrackIndex = index;
    }

    let audioSrc = this.currentTrack.url;

    // If procedural synth track, generate WAV blob dynamically
    if (audioSrc.startsWith('synth:')) {
      audioSrc = await this.getOrCreateSynthTrack(audioSrc);
    }

    this.audioEl.src = audioSrc;
    this.audioEl.load();

    this.updateTrackMetaUI();

    if (autoPlay) {
      try {
        await this.audioEl.play();
        window.mociApi.playAudio(this.currentTrack);
        window.mociState.logActivity('Musik Diputar', `Memutar "${this.currentTrack.title}".`);
      } catch (err) {
        // Autoplay may need user gesture
        console.log('Autoplay gesture required');
      }
    }
  }

  async play() {
    if (!this.currentTrack) {
      const tracks = window.mociState?.tracks || [];
      if (tracks.length > 0) {
        await this.loadTrack(0, true);
        return;
      }
    }
    try {
      await this.audioEl.play();
      window.mociApi.playAudio(this.currentTrack);
    } catch (e) {
      console.warn('Play interrupted', e);
    }
  }

  pause() {
    this.audioEl.pause();
    window.mociApi.stopAudio();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  nextTrack() {
    const tracks = window.mociState?.tracks || [];
    if (!tracks.length) return;

    let nextIndex;
    if (this.isShuffle) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    } else {
      nextIndex = (this.currentIndex + 1) % tracks.length;
    }
    this.loadTrack(nextIndex, true);
  }

  prevTrack() {
    const tracks = window.mociState?.tracks || [];
    if (!tracks.length) return;

    // If played more than 3 sec, replay current track
    if (this.audioEl.currentTime > 3) {
      this.audioEl.currentTime = 0;
      return;
    }

    let prevIndex = (this.currentIndex - 1 + tracks.length) % tracks.length;
    this.loadTrack(prevIndex, true);
  }

  onTrackEnded() {
    if (this.repeatMode === 'one') {
      this.audioEl.currentTime = 0;
      this.audioEl.play();
    } else if (this.repeatMode === 'all') {
      this.nextTrack();
    } else {
      // Repeat off
      const tracks = window.mociState?.tracks || [];
      if (this.currentIndex < tracks.length - 1) {
        this.nextTrack();
      } else {
        this.pause();
        this.audioEl.currentTime = 0;
      }
    }
  }

  seek(percentage) {
    if (this.audioEl.duration && !isNaN(this.audioEl.duration)) {
      this.audioEl.currentTime = (percentage / 100) * this.audioEl.duration;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.audioEl.volume = this.isMuted ? 0 : this.volume;
    this.updateVolumeUI();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audioEl.volume = this.isMuted ? 0 : this.volume;
    this.updateVolumeUI();
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    document.querySelectorAll('.btn-shuffle-toggle').forEach(btn => {
      btn.classList.toggle('active', this.isShuffle);
    });
    if (window.mociUI) {
      window.mociUI.showToast(`Acak Lagu (Shuffle): ${this.isShuffle ? 'Aktif' : 'Mati'}`, 'info');
    }
  }

  cycleRepeat() {
    const modes = ['off', 'all', 'one'];
    const idx = modes.indexOf(this.repeatMode);
    this.repeatMode = modes[(idx + 1) % modes.length];

    document.querySelectorAll('.btn-repeat-toggle').forEach(btn => {
      btn.classList.remove('repeat-off', 'repeat-all', 'repeat-one', 'active');
      btn.classList.add(`repeat-${this.repeatMode}`);
      if (this.repeatMode !== 'off') btn.classList.add('active');
    });

    const labels = { off: 'Mati', all: 'Semua Lagu', one: 'Ulangi Satu Lagu' };
    if (window.mociUI) {
      window.mociUI.showToast(`Mode Ulang (Repeat): ${labels[this.repeatMode]}`, 'info');
    }
  }

  // --- Procedural Synth Music Generator (Web Audio API to WAV Blob) ---
  // Generates real, delightful retro robot chiptunes so audio plays without external files!
  async getOrCreateSynthTrack(synthType) {
    if (this.synthCache[synthType]) {
      return this.synthCache[synthType];
    }

    try {
      const sampleRate = 44100;
      let durationSec = 30;
      if (synthType === 'synth:lofi_chill') durationSec = 35;
      if (synthType === 'synth:8bit_adventure') durationSec = 28;

      const numSamples = sampleRate * durationSec;
      const audioBuffer = new Float32Array(numSamples);

      // Procedural sound generators
      if (synthType === 'synth:friendly_chime') {
        // Pentatonic robot melody
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; // C5, D5, E5, G5, A5, C6
        const stepSamples = sampleRate * 0.4;
        for (let i = 0; i < numSamples; i++) {
          const step = Math.floor(i / stepSamples);
          const noteFreq = notes[step % notes.length];
          const env = Math.exp(-((i % stepSamples) / (sampleRate * 0.25)));
          // Triangle + sine harmonic
          const t = i / sampleRate;
          const osc1 = Math.sin(2 * Math.PI * noteFreq * t);
          const osc2 = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * (noteFreq * 2) * t));
          audioBuffer[i] = (osc1 * 0.6 + osc2 * 0.3) * env * 0.35;
        }
      } else if (synthType === 'synth:lofi_chill') {
        // Mellow electric piano chords with soft rhythmic thud
        const chordProgressions = [
          [261.63, 329.63, 392.00, 493.88], // Cmaj7
          [220.00, 261.63, 329.63, 392.00], // Am7
          [174.61, 220.00, 261.63, 329.63], // Fmaj7
          [196.00, 246.94, 293.66, 392.00]  // G7
        ];
        const chordLength = sampleRate * 2.0;
        for (let i = 0; i < numSamples; i++) {
          const chordIdx = Math.floor(i / chordLength) % chordProgressions.length;
          const chord = chordProgressions[chordIdx];
          const t = i / sampleRate;
          let sum = 0;
          chord.forEach(freq => {
            const decay = Math.exp(-((i % (sampleRate * 0.5)) / (sampleRate * 0.4)));
            sum += Math.sin(2 * Math.PI * freq * t) * decay;
          });
          // Soft kick beat on each beat
          const beatSample = i % (sampleRate * 0.5);
          const kick = Math.sin(2 * Math.PI * 65 * Math.exp(-beatSample / (sampleRate * 0.08)) * (beatSample / sampleRate)) * Math.exp(-beatSample / (sampleRate * 0.1));
          audioBuffer[i] = (sum * 0.08 + kick * 0.25);
        }
      } else {
        // 8-bit adventure fast chiptune square wave
        const melody = [440, 440, 554, 659, 880, 659, 554, 440, 392, 493, 587, 783, 587, 493];
        const noteLen = sampleRate * 0.18;
        for (let i = 0; i < numSamples; i++) {
          const step = Math.floor(i / noteLen) % melody.length;
          const freq = melody[step];
          const t = i / sampleRate;
          // Square wave
          const sq = Math.sin(2 * Math.PI * freq * t) > 0 ? 0.2 : -0.2;
          const bass = Math.sin(2 * Math.PI * (freq / 2) * t) * 0.15;
          audioBuffer[i] = (sq + bass) * 0.4;
        }
      }

      // Convert Float32Array to 16-bit PCM WAV Blob
      const wavBlob = this.encodeWAV(audioBuffer, sampleRate);
      const blobUrl = URL.createObjectURL(wavBlob);
      this.synthCache[synthType] = blobUrl;
      return blobUrl;
    } catch (e) {
      console.warn('Synth generation fallback', e);
      return '';
    }
  }

  // Pure JS WAV encoder
  encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count (mono) */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    // Write PCM samples (clamp -1 to 1)
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // --- Visualizer Animation ---
  startVisualizer() {
    this.stopVisualizer();
    const bars = document.querySelectorAll('.viz-bar');
    if (!bars.length) return;

    this.visualizerInterval = setInterval(() => {
      bars.forEach((bar, idx) => {
        const height = Math.floor(Math.random() * 24) + 4;
        bar.style.height = `${height}px`;
      });
    }, 120);
  }

  stopVisualizer() {
    if (this.visualizerInterval) {
      clearInterval(this.visualizerInterval);
      this.visualizerInterval = null;
    }
    const bars = document.querySelectorAll('.viz-bar');
    bars.forEach(bar => {
      bar.style.height = '4px';
    });
  }

  // --- UI Update Helpers ---
  updateTrackMetaUI() {
    if (!this.currentTrack) return;

    // Bottom dock player
    document.querySelectorAll('.dock-track-title').forEach(el => el.textContent = this.currentTrack.title);
    document.querySelectorAll('.dock-track-artist').forEach(el => el.textContent = this.currentTrack.artist || 'Moci Music');
    
    // Music page hero card
    document.querySelectorAll('.now-playing-title').forEach(el => el.textContent = this.currentTrack.title);
    document.querySelectorAll('.now-playing-artist').forEach(el => el.textContent = this.currentTrack.artist || 'Moci Music');
    document.querySelectorAll('.now-playing-source').forEach(el => {
      const isSd = this.currentTrack.location === 'sd';
      el.className = `badge ${isSd ? 'badge-robot' : 'badge-local'}`;
      el.textContent = isSd ? 'Micro SD Moci' : 'Lokal Browser';
    });

    // Update active row in track list
    document.querySelectorAll('.track-row').forEach((row, idx) => {
      if (idx === this.currentIndex) {
        row.classList.add('playing');
      } else {
        row.classList.remove('playing');
      }
    });
  }

  updatePlayStateUI() {
    // Play/Pause buttons
    const playIcons = document.querySelectorAll('.btn-play-pause-icon');
    playIcons.forEach(icon => {
      if (this.isPlaying) {
        icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
      } else {
        icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      }
    });
  }

  updateProgressBar() {
    const current = this.audioEl.currentTime || 0;
    const duration = this.audioEl.duration || this.currentTrack?.durationSec || 0;

    const percent = duration > 0 ? (current / duration) * 100 : 0;

    document.querySelectorAll('.player-progress-slider').forEach(slider => {
      slider.value = percent;
    });

    document.querySelectorAll('.player-current-time').forEach(el => {
      el.textContent = this.formatTime(current);
    });
  }

  updateDurationDisplay() {
    const duration = this.audioEl.duration || this.currentTrack?.durationSec || 0;
    document.querySelectorAll('.player-total-time').forEach(el => {
      el.textContent = this.formatTime(duration);
    });
  }

  updateVolumeUI() {
    document.querySelectorAll('.player-volume-slider').forEach(slider => {
      slider.value = this.isMuted ? 0 : this.volume * 100;
    });

    document.querySelectorAll('.btn-mute-toggle').forEach(btn => {
      btn.innerHTML = this.isMuted || this.volume === 0
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`;
    });
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // --- DOM Controls Binding ---
  bindDomControls() {
    // Play/Pause buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn-play-pause-toggle')) {
        this.togglePlay();
      }
      if (e.target.closest('.btn-next-track')) {
        this.nextTrack();
      }
      if (e.target.closest('.btn-prev-track')) {
        this.prevTrack();
      }
      if (e.target.closest('.btn-shuffle-toggle')) {
        this.toggleShuffle();
      }
      if (e.target.closest('.btn-repeat-toggle')) {
        this.cycleRepeat();
      }
      if (e.target.closest('.btn-mute-toggle')) {
        this.toggleMute();
      }
    });

    // Seek sliders
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('player-progress-slider')) {
        this.seek(parseFloat(e.target.value));
      }
      if (e.target.classList.contains('player-volume-slider')) {
        this.setVolume(parseFloat(e.target.value) / 100);
      }
    });

    // Upload audio files handler
    document.addEventListener('change', (e) => {
      if (e.target.id === 'audioFileInput') {
        const files = Array.from(e.target.files);
        files.forEach(file => this.handleAudioUpload(file));
        e.target.value = '';
      }
    });
  }

  handleAudioUpload(file) {
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
      if (window.mociUI) {
        window.mociUI.showToast('Format file bukan audio yang valid.', 'error');
      }
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const track = {
      id: 'track-local-' + Date.now() + Math.random().toString(36).substr(2, 4),
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: 'File Lokal Browser',
      duration: 'Tersedia',
      durationSec: 180,
      url: objectUrl,
      location: 'local',
      isFavorite: false,
      sizeFormatted: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
    };

    window.mociState.addTrack(track);

    if (window.mociUI) {
      window.mociUI.showToast(`Lagu "${track.title}" berhasil diunggah ke browser!`, 'success');
      this.renderMusicPage();
    }
  }

  renderMusicPage(filterQuery = '', filterCategory = 'all') {
    const listContainer = document.getElementById('musicTrackList');
    if (!listContainer) return;

    let tracks = window.mociState?.tracks || [];

    // Filter by category
    if (filterCategory === 'favorite') {
      tracks = tracks.filter(t => t.isFavorite);
    } else if (filterCategory === 'local') {
      tracks = tracks.filter(t => t.location === 'local');
    } else if (filterCategory === 'sd') {
      tracks = tracks.filter(t => t.location === 'sd');
    }

    // Filter by search query
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      tracks = tracks.filter(t => t.title.toLowerCase().includes(q) || (t.artist && t.artist.toLowerCase().includes(q)));
    }

    if (!tracks.length) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          </div>
          <div class="empty-state-title">Tidak ada lagu yang cocok</div>
          <div class="empty-state-desc">Unggah file lagu MP3/WAV atau bersihkan filter pencarian.</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = tracks.map((track, idx) => {
      const isCur = this.currentTrack?.id === track.id;
      const isSd = track.location === 'sd';

      return `
        <div class="track-row ${isCur ? 'playing' : ''}" data-track-id="${track.id}">
          <div class="track-play-cell">
            <button class="btn-play-row" onclick="window.mociAudio.loadTrack(${window.mociState.tracks.findIndex(t => t.id === track.id)}, true)" title="Putar">
              ${isCur && this.isPlaying 
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`}
            </button>
          </div>
          <div class="track-main-info">
            <div class="track-row-title">${track.title}</div>
            <div class="track-row-artist">${track.artist || 'Moci Music'}</div>
          </div>
          <div class="track-badge-cell">
            <span class="badge ${isSd ? 'badge-robot' : 'badge-local'}">${isSd ? 'SD Moci' : 'Lokal'}</span>
          </div>
          <div class="track-duration-cell">${track.duration || '0:30'}</div>
          <div class="track-actions-cell">
            <button class="btn-icon-subtle ${track.isFavorite ? 'active-fav' : ''}" onclick="window.mociState.toggleTrackFavorite('${track.id}'); window.mociAudio.renderMusicPage('${filterQuery}', '${filterCategory}');" title="Favorit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${track.isFavorite ? '#ff6b6b' : 'none'}" stroke="${track.isFavorite ? '#ff6b6b' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <button class="btn-icon-subtle" onclick="window.mociTransfer.queueTrackForTransfer('${track.id}')" title="Kirim ke Micro SD Moci">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </button>
            <button class="btn-icon-subtle btn-delete-row" onclick="window.mociUI.confirmAction('Hapus Lagu', 'Apakah kamu yakin ingin menghapus lagu ${track.title}?', () => { window.mociState.removeTrack('${track.id}'); window.mociAudio.renderMusicPage('${filterQuery}', '${filterCategory}'); });" title="Hapus">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Global audio engine singleton
window.mociAudio = new MociAudioEngine();
