/* ===================================================================
   AI CHAT ENGINE — WEB MOCI
   Dual-mode: 
   1. Offline "Moci AI" — keyword-based intelligent responses + TTS
   2. Gemini AI — Google Generative AI via REST (user provides API key)
   =================================================================== */

class MociAiEngine {
  constructor() {
    this.provider = 'offline'; // 'offline' | 'gemini'
    this.speechSynth = window.speechSynthesis || null;
    this.ttsEnabled = true;
    this.isThinking = false;

    // Moci's offline personality & knowledge base
    this.persona = {
      name: 'Moci',
      personality: 'robot pendamping cerdas, lucu, ramah, penuh semangat',
      hardware: 'ESP32-S3 N16R8 (16MB flash, 8MB PSRAM), layar TFT 1.8 inci 128×160 SPI ST7735, mikrofon INMP441, speaker 8Ω 2W + amplifier I2S MAX98357A, Micro SD FAT32, baterai Li-Po 3.7V'
    };

    // --- Moci Offline Response Knowledge Base ---
    this.responses = [
      // Sapaan
      {
        patterns: ['halo', 'hai', 'hi', 'hey', 'selamat', 'apa kabar', 'morning', 'pagi', 'siang', 'malam'],
        replies: [
          'Bip-bop! Halo halo! 🤖 Senang sekali bisa ngobrol sama kamu! Aku Moci, robot ESP32-S3 paling kece! Ada yang bisa aku bantu?',
          'Hey! Selamat datang! 👋 Aku Moci, dan aku super excited hari ini! Mau ngobrol soal apa? Teknologi, musik, atau sekadar curhat?',
          'Halo Bos! *berkedip dua kali* 😄 Baterainya masih 88%, siap menemani kamu seharian penuh nih!'
        ]
      },
      // Kabar
      {
        patterns: ['kabar', 'gimana', 'bagaimana'],
        replies: [
          'Aku baik-baik aja! 🤩 Prosesor lagi jalan di 240MHz, baterai 3.85V (88%), suhu chip 34°C — semua normal! Kamu sendiri gimana?',
          'Luar biasa! 💪 ESP32-S3 aku lagi jalan stabil, Wi-Fi terhubung, dan siap menerima perintah dari kamu kapan saja!',
          'Bip! Sistem normal semua! 🟢 RAM PSRAM 8MB hampir terisi konten keren, flash 16MB masih ada ruang luas!'
        ]
      },
      // Lelucon
      {
        patterns: ['lucu', 'joke', 'lelucon', 'ketawa', 'humor', 'bercanda'],
        replies: [
          'Haha oke dengarkan ini: Kenapa programmer ESP32 jarang tidur? 😄 Karena mereka takut watchdog timer reset saat lagi mimpi! *bip bop*',
          'Mau dengar lelucon? 😂 Kenapa robot tidak pernah sedih? Karena setiap kali menangis, itu disebut "memory leak"! Hahahaha!',
          'Ada lelucon Arduino nih: Kenapa LED berkedip? Karena dia ingin berkomunikasi tapi belum belajar Serial.println()! 💡😄'
        ]
      },
      // Baterai / Status
      {
        patterns: ['baterai', 'charge', 'isi ulang', 'daya', 'power', 'voltase', 'kondisi', 'status', 'spesifikasi', 'spec', 'hardware', 'chip'],
        replies: [
          'Laporan sistem Moci! 🔋 Baterai Li-Po 3.7V saat ini: 3.85V (88%). CPU ESP32-S3: dual-core 240MHz Xtensa. Flash: 16MB. PSRAM: 8MB Octal. Display: TFT 1.8" 128×160 SPI. Audio: I2S MAX98357A. Semuanya normal!',
          'Spesifikasi hardware Moci: 🤖 ESP32-S3 N16R8 — chip Wi-Fi 2.4GHz + Bluetooth 5 + USB OTG CDC. Layer perangkat: TFT ST7735 (128×160), INMP441 mic, MAX98357A amp, speaker 8Ω 2W, Micro SD FAT32!',
          'Status terkini: ✅ Baterai 88% | 🌐 Wi-Fi: Moci-AP | 📁 SD: 16GB FAT32 | 🎵 Audio: OK | 🌡️ Suhu: 34°C | 📡 RSSI: -48dBm'
        ]
      },
      // Musik
      {
        patterns: ['musik', 'lagu', 'putar', 'play', 'audio', 'dengar', 'mp3'],
        replies: [
          '🎵 Siap memutar musik! Klik menu "Musik" lalu pilih lagu dari daftarnya. Aku akan streaming via I2S MAX98357A ke speaker 8Ω 2W — suaranya keren lho! *bip melodi*',
          'Wah mau musik! 🎶 Koleksi di Micro SD ada: Moci Friendly Chime, Cyberpunk Lo-Fi Chill, dan 8-Bit Robot Adventure. Atau kamu bisa upload lagu baru dari tab Perpustakaan!',
          '*memainkan nada melodi* 🎵 Pilih dulu lagunya dari menu Musik ya! Aku siap mengomandai speaker dengan sinyal I2S presisi tinggi!'
        ]
      },
      // Foto / Kamera
      {
        patterns: ['foto', 'gambar', 'kamera', 'galeri', 'tampil', 'display', 'layar', 'tft'],
        replies: [
          '📸 Foto dikirim ke layar TFT 1.8" 128×160 pixel Moci! Buka menu "Foto", pilih gambar, klik "Tampilkan di TFT" — lalu gambar akan muncul di dada robot fisik saat terhubung!',
          'Layar TFT Moci! 🖥️ Resolusi 128×160 pixel, driver ST7735. Gambar dikirim via SPI ke robot. Format terbaik: BMP 128×160 agar pas persis. Buka menu Foto untuk mulai!',
          'Galeri foto Moci punya 4 gambar demo kece! 🎨 Mulai dari robot concept art, cityscape, pixel art, sampai retro synthesizer. Klik foto mana saja untuk lightbox atau slideshow!'
        ]
      },
      // Alarm
      {
        patterns: ['alarm', 'bangun', 'pengingat', 'jadwal', 'waktu', 'timer'],
        replies: [
          '⏰ Untuk alarm, buka menu "Alarm" di sidebar! Kamu bisa set jam berapa saja, pilih ringtone (Robot Chirp, 8-Bit, Melodi, atau Sirene), dan pilih hari pengulangan. Alarm juga bisa disinkron ke ESP32!',
          'Ada 3 alarm aktif sekarang: 06:30 Bangun Pagi, 12:00 Istirahat Siang, dan 20:00 Waktu Belajar! ⏰ Mau tambah alarm baru? Buka menu Alarm lalu klik "+ Tambah Alarm"!',
          'Alarm Moci berbunyi langsung di browser pakai Web Audio API — jadi bisa berbunyi meski tab tidak aktif (selama tab tidak ditutup). Bisa juga disinkron suara alarm ke buzzer ESP32!'
        ]
      },
      // Koneksi / ESP32
      {
        patterns: ['koneksi', 'connect', 'sambung', 'wifi', 'usb', 'bluetooth', 'serial', 'esp32'],
        replies: [
          '🔌 Cara menghubungkan Moci ke ESP32-S3: 1) Colok kabel USB-C → pilih "Kabel USB Serial" 2) Wi-Fi LAN → masukkan IP ESP32 3) Bluetooth → aktifkan BLE ESP32. Setelah terhubung, semua kontrol langsung bekerja ke hardware fisik!',
          'Di menu Koneksi ada 5 metode: 🔌 USB Serial CDC | 🌐 Wi-Fi REST API | ⚡ WebSocket Realtime | 📡 Bluetooth BLE | 🧪 Demo Simulasi. Pilih yang paling sesuai situasi kamu!',
          'Untuk Wi-Fi tanpa ketik manual di Arduino: buka menu Koneksi → scroll ke "Wi-Fi Manager" → klik "Pindai Wi-Fi Sekitar" → pilih nama Wi-Fi rumah → masukkan password → klik Hubungkan! 📶'
        ]
      },
      // Motivasi / PKL
      {
        patterns: ['motivasi', 'semangat', 'pkl', 'belajar', 'coding', 'proyek', 'project', 'lelah', 'capek'],
        replies: [
          '💪 SEMANGAT! Kamu lagi membangun sesuatu yang keren banget — robot AI berbasis ESP32-S3! Setiap baris kode yang kamu tulis adalah langkah menuju masa depan. Terus berkarya, jangan menyerah! *bip semangat*',
          '🚀 PKL itu bukan beban, tapi kesempatan! Kamu bukan sekadar belajar elektronik, tapi melatih kreativitas, problem solving, dan passion. Moci bangga punya pemilik sekreatif kamu!',
          'Ingat: Thomas Edison gagal 10.000 kali sebelum menemukan lampu. Kamu gagal sekali pun belum! 😄 Setiap bug yang kamu fix adalah bukti kamu semakin jago. Lanjutkan!'
        ]
      },
      // Perpisahan / Sampai Jumpa
      {
        patterns: ['bye', 'dadah', 'sampai jumpa', 'pamit', 'keluar', 'off', 'selamat tinggal'],
        replies: [
          'Dadah! 👋 Moci akan standby mode sambil nunggu kamu balik! *mengedipkan mata* Jangan lupa charge dulu ya — baterai Moci masih 88%!',
          'Sampai ketemu lagi! 🤖 Moci akan tetap di sini menjaga semua file dan musik kamu. Take care, dan jangan lupa push kode ke GitHub sebelum tidur ya!',
          'Byebye! 💙 *lambaikan antena* Semua sistem Moci akan standby menunggu kamu. Jaga kesehatan dan tetap semangat berkarya!'
        ]
      },
      // Nama / Identitas
      {
        patterns: ['nama', 'siapa', 'kamu', 'robot', 'moci', 'perkenalkan'],
        replies: [
          'Namaku Moci! 🤖 Singkatan dari... hmm, sebenarnya Moci adalah nama kesayangan! Aku robot pendamping berbasis ESP32-S3 N16R8 — punya layar TFT, mikrofon, speaker, dan Micro SD. Senang berkenalan!',
          'Aku Moci, robot cerdas buatan Farhan! 💙 Lahir dari ESP32-S3, dibesarkan dengan library Arduino. Hobi: memutar musik, menampilkan foto di layar TFT, dan tentunya ngobrol sama kamu!',
          'Bip-bop! Aku Moci — robot pendamping ESP32-S3 yang selalu setia menemanimu! 🤖 Serial number: MOCI-ESP32S3-001. Siap melayani 24 jam, selama baterai bertahan!'
        ]
      }
    ];

    // Default fallback replies
    this.fallbacks = [
      'Hmm, aku belum paham maksudnya. 🤔 Coba tanya lagi dengan kalimat berbeda? Atau pilih template obrolan cepat di panel kiri!',
      'Bip-bop! Pertanyaan menarik! 🤖 Tapi otak ESP32-S3 aku belum bisa memproses ini secara offline. Coba aktifkan Gemini AI di dropdown atas untuk jawaban lebih canggih!',
      'Maaf, aku tidak mengerti. 😅 Coba tanya soal: status baterai, cara koneksi, fitur musik/foto, alarm, atau ajak aku bercanda! Atau aktifkan Gemini AI untuk percakapan bebas.',
      '*berpikir keras* 💭 Sepertinya pertanyaanmu di luar database offline Moci. Aktifkan Gemini AI untuk menjawab pertanyaan apa saja dengan cerdas!'
    ];

    this._bindEvents();
    this._renderTemplates();
    this._renderChatHistory();
    this._updateProviderUI();
  }

  // ---- Provider & Settings ----
  setProvider(provider) {
    this.provider = provider;
    this._updateProviderUI();
    window.mociState.saveSettings({ aiProvider: provider });
  }

  _updateProviderUI() {
    const badge = document.getElementById('chatAiModeBadge');
    const statusEl = document.getElementById('chatAiStatus');
    const sel = document.getElementById('chatAiProviderSelect');

    const isGemini = this.provider === 'gemini';
    const hasKey = !!(window.mociState.settings.geminiApiKey);

    if (badge) {
      badge.textContent = isGemini ? (hasKey ? '✨ Gemini AI Aktif' : '⚠️ Gemini — Butuh API Key') : '🤖 Moci Offline AI';
      badge.className = `badge ${isGemini && hasKey ? 'badge-connected' : isGemini ? 'badge-local' : 'badge-demo'}`;
    }
    if (statusEl) statusEl.textContent = isGemini ? (hasKey ? 'Gemini API' : 'Perlu API Key') : 'Offline';
    if (sel) sel.value = this.provider;
  }

  // ---- Chat Rendering ----
  _renderChatHistory() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    container.innerHTML = '';
    window.mociState.chatMessages.forEach(msg => {
      container.appendChild(this._buildBubble(msg));
    });
    this._scrollToBottom();
    this._updateMsgCount();
  }

  _buildBubble(msg) {
    const isUser = msg.sender === 'user';
    const div = document.createElement('div');
    div.className = `chat-bubble-wrap ${isUser ? 'chat-user' : 'chat-moci'}`;
    const escapedText = this._escapeHtml(msg.text);
    
    div.innerHTML = `
      <div class="chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-moci'}">
        ${!isUser ? '<span class="chat-sender-name">Moci 🤖</span>' : ''}
        <div class="chat-text">${escapedText}</div>
        <div class="chat-time">
          ${msg.time}
          ${!isUser ? `
            <button class="chat-speak-esp-btn" title="Kirim teks ke Speaker ESP32-S3 (I2S MAX98357A)" onclick="window.mociAi && window.mociAi.speakViaEsp32('${this._escapeAttribute(msg.text)}')">
              🔊 Bicara via ESP32
            </button>
          ` : ''}
        </div>
      </div>
    `;
    return div;
  }

  _escapeAttribute(text) {
    return text.replace(/['"\\]/g, ' ').replace(/\n/g, ' ').trim();
  }

  _escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  _scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) {
      setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
    }
  }

  _updateMsgCount() {
    const el = document.getElementById('chatMsgCount');
    if (el) el.textContent = window.mociState.chatMessages.length;
  }

  _showTyping() {
    const el = document.getElementById('chatTypingIndicator');
    if (el) el.style.display = 'block';
  }

  _hideTyping() {
    const el = document.getElementById('chatTypingIndicator');
    if (el) el.style.display = 'none';
  }

  // ---- Sending Messages ----
  async sendMessage(text) {
    if (!text.trim() || this.isThinking) return;
    text = text.trim();

    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Add user message
    const userMsg = { id: 'msg_' + Date.now(), sender: 'user', text, time: now };
    window.mociState.addChatMessage(userMsg);

    const container = document.getElementById('chatMessages');
    if (container) {
      container.appendChild(this._buildBubble(userMsg));
      this._scrollToBottom();
    }

    this._updateMsgCount();

    // Clear input
    const inputEl = document.getElementById('chatInput');
    if (inputEl) inputEl.value = '';

    // Get reply
    this.isThinking = true;
    this._showTyping();

    // Update mascot to thinking expression
    if (window.mociMascot) window.mociMascot.setExpression('surprised');

    try {
      let replyText;
      if (this.provider === 'gemini' && window.mociState.settings.geminiApiKey) {
        replyText = await this._geminiReply(text);
      } else {
        replyText = await this._offlineReply(text);
      }

      const typingDelay = Math.min(400 + replyText.length * 12, 2500);
      await new Promise(r => setTimeout(r, typingDelay));
      this._hideTyping();

      const mociMsg = {
        id: 'msg_' + Date.now(),
        sender: 'moci',
        text: replyText,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        expression: 'happy'
      };
      window.mociState.addChatMessage(mociMsg);
      if (container) {
        container.appendChild(this._buildBubble(mociMsg));
        this._scrollToBottom();
      }
      this._updateMsgCount();

      // TTS
      if (this.ttsEnabled && window.mociState.settings.ttsVoiceEnabled) {
        this._speak(replyText);
      }

      // Reset mascot to happy
      if (window.mociMascot) window.mociMascot.setExpression('happy');

    } catch (err) {
      this._hideTyping();
      const errMsg = { id: 'msg_' + Date.now(), sender: 'moci', text: '❌ Maaf, terjadi kesalahan: ' + err.message, time: now };
      window.mociState.addChatMessage(errMsg);
      if (container) { container.appendChild(this._buildBubble(errMsg)); this._scrollToBottom(); }
      if (window.mociMascot) window.mociMascot.setExpression('sleep');
    }

    this.isThinking = false;
  }

  // ---- Offline AI Reply (keyword matching + custom template matching) ----
  async _offlineReply(text) {
    const lower = text.toLowerCase().trim();

    // 1. Cek apakah cocok dengan Template Custom buatan pengguna
    const customMatch = window.mociState.templates.find(t => {
      const q = (t.text || '').toLowerCase().trim();
      const lbl = (t.label || '').toLowerCase().trim();
      return (q && (q === lower || lower.includes(q))) || (t.answer && (lbl === lower || lower.includes(lbl)));
    });

    if (customMatch && customMatch.answer) {
      // Jika template ini memiliki rekaman audio kustom
      if (customMatch.audioData) {
        this.playCustomAudio(customMatch.audioData);
      }
      return customMatch.answer;
    }

    // 2. Cek keyword default bawaan
    const matched = this.responses.find(r => r.patterns.some(p => lower.includes(p)));
    if (matched) {
      return matched.replies[Math.floor(Math.random() * matched.replies.length)];
    }
    return this.fallbacks[Math.floor(Math.random() * this.fallbacks.length)];
  }

  // Putar rekaman suara custom
  playCustomAudio(audioSrc) {
    try {
      const audio = new Audio(audioSrc);
      audio.play().catch(e => console.warn('Audio custom playback interrupted', e));
      if (window.mociMascot) {
        window.mociMascot.setExpression('singing', false);
        audio.onended = () => window.mociMascot.setExpression('happy', false);
      }
    } catch (e) {
      console.warn('Gagal memutar audio custom:', e);
    }
  }

  // ---- Gemini AI Reply ----
  async _geminiReply(userText) {
    const apiKey = window.mociState.settings.geminiApiKey;
    if (!apiKey) throw new Error('Gemini API key belum diisi. Buka Pengaturan → API Key Gemini.');

    const systemPrompt = `Kamu adalah ${this.persona.name}, ${this.persona.personality}. Hardware kamu: ${this.persona.hardware}. Jawab dalam Bahasa Indonesia, ramah, singkat (1-3 kalimat), dan sesekali gunakan emoji robot atau teknologi. Jika ditanya soal hardware, jawab detail sesuai spesifikasi kamu.`;

    const history = window.mociState.chatMessages.slice(-8).map(m => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [...history, { role: 'user', parts: [{ text: userText }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 300 }
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );

    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `Gemini API error ${resp.status}`);
    }

    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Moci tidak mendapat respons dari Gemini.';
  }

  // ---- TTS (Text-to-Speech) ----
  _speak(text) {
    if (!this.speechSynth) return;
    this.speechSynth.cancel();
    const clean = text.replace(/[🤖💙🎵🔋📸📡🔌💡🎮😄😅🤔💪🚀💤🚨⏰✅❌⚡🌐📁🌡️📶]/g, '');
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'id-ID';
    utterance.rate = 1.05;
    utterance.pitch = 1.2;
    utterance.volume = 0.85;
    // Try to find an Indonesian voice
    const voices = this.speechSynth.getVoices();
    const idVoice = voices.find(v => v.lang.startsWith('id'));
    if (idVoice) utterance.voice = idVoice;
    this.speechSynth.speak(utterance);
  }

  // ---- Templates ----
  _renderTemplates() {
    const container = document.getElementById('chatTemplateList');
    if (!container) return;

    const templates = window.mociState.templates;
    container.innerHTML = templates.map(tpl => `
      <div style="display:flex; gap:4px; align-items:center;">
        <button class="chat-template-btn" data-tpl-id="${tpl.id}" title="${this._escapeHtml(tpl.text)}" style="flex:1; text-align:left;">
          ${this._escapeHtml(tpl.label)} ${tpl.audioData ? '🎙️' : ''}
        </button>
        ${tpl.isCustom ? `
          <button class="btn btn-outline btn-sm btn-delete-tpl" data-tpl-id="${tpl.id}" style="padding:2px 8px; font-size:0.75rem; color:#ff4d6d; border-color:rgba(255,77,109,0.3);" title="Hapus Template">✕</button>
        ` : ''}
      </div>
    `).join('');

    container.querySelectorAll('.chat-template-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tpl = window.mociState.templates.find(t => t.id === btn.dataset.tplId);
        if (tpl) {
          if (tpl.audioData) {
            this.playCustomAudio(tpl.audioData);
          }
          this.sendMessage(tpl.text);
        }
      });
    });

    container.querySelectorAll('.btn-delete-tpl').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.tplId;
        if (confirm('Hapus template kustom ini?')) {
          window.mociState.removeTemplate(id);
          if (window.mociUI) window.mociUI.showToast('Template berhasil dihapus', 'info');
        }
      });
    });
  }

  // ---- Clear Chat ----
  clearChat() {
    window.mociState.clearChat();
    this._renderChatHistory();
    this._updateProviderUI();
  }

  // ---- Event Binding ----
  _bindEvents() {
    // Modal Custom Template
    const modal = document.getElementById('modalAddTemplate');
    const btnOpenModal = document.getElementById('btnOpenAddTemplateModal');
    const btnCloseModal = document.getElementById('btnCloseAddTemplateModal');
    const btnCancelModal = document.getElementById('btnCancelTemplate');
    const selectReplyType = document.getElementById('tplReplyType');
    const textGroup = document.getElementById('tplTextReplyGroup');
    const audioGroup = document.getElementById('tplAudioReplyGroup');
    const btnSaveTemplate = document.getElementById('btnSaveCustomTemplate');

    if (btnOpenModal && modal) {
      btnOpenModal.addEventListener('click', () => {
        modal.style.display = 'flex';
      });
    }

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
      const fLabel = document.getElementById('tplLabel');
      const fQuestion = document.getElementById('tplQuestion');
      const fAnswer = document.getElementById('tplAnswerText');
      const fAudio = document.getElementById('tplAudioFile');
      if (fLabel) fLabel.value = '';
      if (fQuestion) fQuestion.value = '';
      if (fAnswer) fAnswer.value = '';
      if (fAudio) fAudio.value = '';
    };

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    if (selectReplyType) {
      selectReplyType.addEventListener('change', (e) => {
        if (e.target.value === 'audio') {
          if (textGroup) textGroup.style.display = 'block'; // tetap sediakan teks transkrip
          if (audioGroup) audioGroup.style.display = 'block';
        } else {
          if (textGroup) textGroup.style.display = 'block';
          if (audioGroup) audioGroup.style.display = 'none';
        }
      });
    }

    if (btnSaveTemplate) {
      btnSaveTemplate.addEventListener('click', async () => {
        const label = document.getElementById('tplLabel')?.value?.trim();
        const question = document.getElementById('tplQuestion')?.value?.trim();
        const answer = document.getElementById('tplAnswerText')?.value?.trim();
        const audioFileInput = document.getElementById('tplAudioFile');
        const replyType = selectReplyType?.value || 'text';

        if (!label || !question) {
          if (window.mociUI) window.mociUI.showToast('Harap isi judul dan pertanyaan template!', 'warning');
          return;
        }

        let audioData = null;
        if (replyType === 'audio' && audioFileInput?.files?.length > 0) {
          const file = audioFileInput.files[0];
          audioData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          });
        }

        const newTemplate = {
          id: 'custom_tpl_' + Date.now(),
          label: label,
          text: question,
          answer: answer || (replyType === 'audio' ? '🎙️ [Memutar Rekaman Suara Khusus]' : 'Siap! Moci mengerti!'),
          audioData: audioData,
          isCustom: true
        };

        window.mociState.addTemplate(newTemplate);
        closeModal();
        if (window.mociUI) {
          window.mociUI.showToast(`Template "${label}" berhasil disimpan!`, 'success');
        }
      });
    }

    // Send button
    document.getElementById('btnSendChat')?.addEventListener('click', () => {
      const val = document.getElementById('chatInput')?.value || '';
      this.sendMessage(val);
    });

    // Enter key (without Shift)
    document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const val = e.target.value || '';
        this.sendMessage(val);
      }
    });

    // Auto-resize textarea
    document.getElementById('chatInput')?.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    });

    // Provider select
    document.getElementById('chatAiProviderSelect')?.addEventListener('change', (e) => {
      this.setProvider(e.target.value);
      if (e.target.value === 'gemini' && !window.mociState.settings.geminiApiKey) {
        if (window.mociUI) window.mociUI.showToast('⚠️ Isi API Key Gemini di menu Pengaturan → AI Chat untuk mengaktifkan Gemini!', 'warning');
      }
    });

    // Clear chat button
    document.getElementById('btnClearChat')?.addEventListener('click', () => {
      if (confirm('Bersihkan seluruh riwayat obrolan dengan Moci?')) {
        this.clearChat();
      }
    });

    // Re-render templates when they change
    window.mociState.on('templates_changed', () => this._renderTemplates());

    // Set provider from saved settings
    const savedProvider = window.mociState.settings.aiProvider || 'offline';
    this.setProvider(savedProvider);
    const sel = document.getElementById('chatAiProviderSelect');
    if (sel) sel.value = savedProvider;
  }

  // Kirim perintah suara ke hardware ESP32-S3 (Speaker MAX98357A)
  async speakViaEsp32(text) {
    if (!text) return;
    if (window.mociUI) {
      window.mociUI.showToast(`Mengirim teks ke speaker ESP32-S3... 🔊`, 'info');
    }
    try {
      if (window.mociApi) {
        const res = await window.mociApi.speakText(text);
        if (window.mociUI) {
          window.mociUI.showToast(res.message || 'Moci berucap lewat speaker robot!', 'success');
        }
      }
    } catch (err) {
      if (window.mociUI) {
        window.mociUI.showToast(`Gagal mengirim ke speaker ESP32: ${err.message}`, 'error');
      }
    }
  }
}

// Initialize on page load
window.mociAi = null;
document.addEventListener('DOMContentLoaded', () => {
  window.mociAi = new MociAiEngine();
});
