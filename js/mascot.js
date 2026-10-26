/* ===================================================================
   MASCOT & ROBOT DISPLAY CONTROLLER — WEB MOCI
   Interactive eyes, expressions, sound chirps, and 128x160 TFT preview
   =================================================================== */

class MociMascotController {
  constructor() {
    this.currentExpression = 'happy';
    this.blinkTimer = null;
    this.audioCtx = null;
    this.isBlinking = false;
    this.idleTimer = null;

    this.speechPhrases = {
      happy: ["Halo, Moci siap menemani!", "Hari yang cerah untuk bertualang!", "Moci merasa senang!"],
      sleepy: ["Hoaaam... Moci mulai mengantuk.", "Mode hemat daya segera aktif...", "Zzz... 3.7V tetap stabil."],
      sad: ["Moci sedikit sedih... Ada lagu ceria?", "Jangan lupa ajak Moci main!", "Koneksi terasa sepi..."],
      neutral: ["Sistem ESP32-S3 normal.", "Menunggu perintah dari kamu.", "Sensor INMP441 & SD Card standby."],
      surprised: ["Wah! Ada foto baru ya?", "Perintah diterima dengan cepat!", "Kapasitas Micro SD sangat lega!"],
      excited: ["Horeee! Ayo putar lagu favorit!", "Moci bersemangat sekali!", "Visualizer musik sedang aktif!"],
      singing: ["🎶 La la la~ lagunya enak banget! 🎵", "Tra-la-la! Moci suka lagu ini! 🎤", "Bip bop~ yuk nyanyi bareng Moci! 🎶"]
    };
  }

  init() {
    this.bindEvents();
    this.setExpression(window.mociState?.currentExpression || 'happy', false);
    this.startBlinkLoop();
    this.renderTftDisplay();
  }

  // --- Sound Chirp Synthesizer (Web Audio API) ---
  playRobotChirp(type = 'happy') {
    if (!window.mociState?.settings?.mascotSoundEnabled) return;

    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      gain.gain.setValueAtTime(0.08, now);

      switch (type) {
        case 'happy':
        case 'excited':
          // Cheerful two-tone chirp
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(587.33, now); // D5
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.22);
          break;

        case 'sleepy':
          // Low sleepy pitch bend
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(220, now + 0.35);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
          break;

        case 'sad':
          // Downward minor chirp
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.04, now);
          osc.frequency.setValueAtTime(415.3, now);
          osc.frequency.exponentialRampToValueAtTime(293.66, now + 0.3);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;

        case 'surprised':
          // Fast high ascending beep
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
          break;

        default:
          // Standard blip
          osc.type = 'sine';
          osc.frequency.setValueAtTime(659.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
      }
    } catch (e) {
      // AudioContext may require user gesture on some browsers
    }
  }

  // --- Expression Logic ---
  setExpression(exprName, playSound = true) {
    const validExpressions = ['happy', 'sleepy', 'sad', 'neutral', 'surprised', 'excited', 'singing'];
    if (!validExpressions.includes(exprName)) exprName = 'happy';

    this.currentExpression = exprName;
    if (window.mociState) {
      window.mociState.currentExpression = exprName;
    }

    // Update Mascot Dom Elements
    const mascotWrappers = document.querySelectorAll('.moci-robot-wrapper, .moci-robot-unit');
    mascotWrappers.forEach(el => {
      validExpressions.forEach(v => el.classList.remove(`expression-${v}`));
      el.classList.add(`expression-${exprName}`);
    });

    // Update speech bubble
    this.updateSpeechBubble(exprName);

    // Update TFT mini display preview
    this.renderTftDisplay();

    // Active state on expression buttons
    document.querySelectorAll('[data-moci-expression]').forEach(btn => {
      if (btn.getAttribute('data-moci-expression') === exprName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (playSound) {
      this.playRobotChirp(exprName);
    }
  }

  updateSpeechBubble(exprName) {
    const bubbles = document.querySelectorAll('.moci-speech-text');
    const phrases = this.speechPhrases[exprName] || this.speechPhrases.happy;
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    bubbles.forEach(b => {
      b.textContent = randomPhrase;
    });
  }

  startBlinkLoop() {
    if (this.blinkTimer) clearInterval(this.blinkTimer);

    const speed = window.mociState?.settings?.mascotEyeSpeed || 'normal';
    const intervalMap = { slow: 6000, normal: 3800, fast: 2200 };
    const interval = intervalMap[speed] || 3800;

    this.blinkTimer = setInterval(() => {
      this.blink();
    }, interval);
  }

  blink() {
    if (this.isBlinking) return;
    this.isBlinking = true;
    const wrappers = document.querySelectorAll('.moci-robot-wrapper, .moci-robot-unit');
    wrappers.forEach(w => w.classList.add('moci-blinking'));

    setTimeout(() => {
      wrappers.forEach(w => w.classList.remove('moci-blinking'));
      this.isBlinking = false;
    }, 150);
  }

  // --- Render TFT 1.8" (128x160) Screen Simulator ---
  renderTftDisplay(customPhotoUrl = null) {
    const tftContents = document.querySelectorAll('.tft-display-content');
    if (!tftContents.length) return;

    tftContents.forEach(container => {
      if (customPhotoUrl) {
        container.innerHTML = `
          <div class="tft-status-bar">
            <span>MOCI TFT 1.8"</span>
            <span>128×160</span>
          </div>
          <img src="${customPhotoUrl}" alt="TFT Display Preview" style="width:100%; height:100%; object-fit:cover;" />
          <div class="tft-scanlines"></div>
        `;
      } else {
        // Render current expression face in TFT
        container.innerHTML = `
          <div class="tft-status-bar">
            <span>ESP32-S3</span>
            <span>${this.currentExpression.toUpperCase()}</span>
          </div>
          <div class="moci-robot-unit expression-${this.currentExpression}" style="transform: scale(0.72); margin-top: 10px;">
            <div class="moci-screen-bezel" style="width: 120px; height: 95px;">
              <div class="moci-eyes-container">
                <div class="moci-eye"></div>
                <div class="moci-eye"></div>
              </div>
            </div>
          </div>
          <div style="font-size: 0.68rem; font-family: monospace; color: var(--accent-mint); margin-top: 6px;">
            STATUS: STANDBY
          </div>
          <div class="tft-scanlines"></div>
        `;
      }
    });
  }

  bindEvents() {
    // Click on mascot head to rotate expressions & chirp
    document.addEventListener('click', (e) => {
      const mascot = e.target.closest('.moci-robot-wrapper');
      if (mascot) {
        const expressions = ['happy', 'excited', 'surprised', 'sleepy', 'neutral'];
        const nextIndex = (expressions.indexOf(this.currentExpression) + 1) % expressions.length;
        this.setExpression(expressions[nextIndex], true);
      }
    });

    // Listen to expression buttons in Control Moci
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-moci-expression]');
      if (btn) {
        const expr = btn.getAttribute('data-moci-expression');
        this.setExpression(expr, true);
        window.mociApi.setExpression(expr);
        window.mociState.logActivity('Ekspresi Moci Diubah', `Mengatur ekspresi robot ke "${expr}".`);
        if (window.mociUI) {
          window.mociUI.showToast(`Ekspresi Moci diubah ke: ${expr.toUpperCase()}`, 'info');
        }
      }
    });
  }
}

// Global mascot instance
window.mociMascot = new MociMascotController();
