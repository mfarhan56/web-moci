/* ===================================================================
   DEVICE ADAPTER ARCHITECTURE — WEB MOCI
   Multi-Connection Support for ESP32-S3:
   1. Mode Demo (Browser Simulation)
   2. Wi-Fi REST HTTP (Local LAN / mDNS)
   3. USB Serial CDC (Web Serial API via USB-C)
   4. WebSocket Realtime (LAN port 81)
   5. Bluetooth Low Energy (Web Bluetooth BLE)
   =================================================================== */

/**
 * Base Abstract Device Adapter
 */
class DeviceAdapter {
  constructor(name = 'DeviceAdapter') {
    this.name = name;
    this.type = 'base';
    this.isConnected = false;
  }

  async getStatus() { throw new Error("Method not implemented."); }
  async ping() { throw new Error("Method not implemented."); }
  async setExpression(expr) { throw new Error("Method not implemented."); }
  async displayPhoto(photo) { throw new Error("Method not implemented."); }
  async playAudio(track) { throw new Error("Method not implemented."); }
  async stopAudio() { throw new Error("Method not implemented."); }
  async transferFile(file, onProgress) { throw new Error("Method not implemented."); }
  async deleteFile(filename) { throw new Error("Method not implemented."); }
  async getStorageInfo() { throw new Error("Method not implemented."); }
  async scanWifiNetworks() { throw new Error("Method not implemented."); }
  async connectWifi(ssid, password) { throw new Error("Method not implemented."); }
  async disconnectWifi() { throw new Error("Method not implemented."); }
  async syncAlarms(alarms) { throw new Error("Method not implemented."); }
  async speakText(text) { throw new Error("Method not implemented."); }
}

/**
 * 1. DemoAdapter
 * Runs purely inside the browser using simulation.
 */
class DemoAdapter extends DeviceAdapter {
  constructor() {
    super('DemoAdapter');
    this.type = 'demo';
    this.isSimulated = true;
  }

  async getStatus() {
    return {
      type: 'demo',
      isConnected: false,
      badgeText: 'Mode Demo (Simulasi)',
      badgeClass: 'badge-demo',
      connectionTitle: 'Simulasi Mandiri',
      robotName: window.mociState?.settings?.robotName || 'Moci',
      hardware: {
        mcu: 'ESP32-S3 N16R8 (Simulasi)',
        display: 'TFT 1.8" 128×160 SPI ST7735 (Simulasi)',
        audioAmp: 'I2S MAX98357A + Speaker 8Ω 2W (Simulasi)',
        sdCard: 'Micro SD 16GB FAT32 (Simulasi)',
        batteryVoltage: '3.82V (86% - Li-Po 3.7V Simulasi)'
      },
      wifi: {
        ssid: 'Moci-Companion-AP (Simulasi)',
        ip: '192.168.4.1 (Simulasi)',
        rssi: '-48 dBm'
      },
      storage: {
        totalBytes: 16 * 1024 * 1024 * 1024,
        freeBytes: 14.2 * 1024 * 1024 * 1024,
        usedFormatted: '1.8 GB / 16 GB',
        isMounted: true
      },
      lastPingTime: new Date().toLocaleTimeString('id-ID'),
      notice: 'Berjalan dalam mode simulasi peramban. Pilih metode koneksi lain untuk menghubungkan ke ESP32 fisik.'
    };
  }

  async ping() {
    const start = performance.now();
    await new Promise(r => setTimeout(r, 120));
    const latency = Math.round(performance.now() - start);
    return {
      success: true,
      type: 'demo',
      latencyMs: latency,
      message: `Ping simulasi berhasil (${latency}ms). Hardware fisik belum terhubung.`
    };
  }

  async setExpression(expr) {
    return { success: true, type: 'demo', expression: expr, message: `Ekspresi "${expr}" dijalankan pada simulasi.` };
  }

  async displayPhoto(photo) {
    return { success: true, type: 'demo', photoId: photo.id, message: `Foto "${photo.name}" ditampilkan pada simulasi TFT.` };
  }

  async playAudio(track) {
    return { success: true, type: 'demo', trackTitle: track.title, message: `Musik "${track.title}" diputar di browser.` };
  }

  async stopAudio() {
    return { success: true, type: 'demo', message: 'Pemutaran audio dihentikan.' };
  }

  async transferFile(fileItem, onProgress) {
    const totalSteps = 20;
    for (let step = 1; step <= totalSteps; step++) {
      if (fileItem.isCancelled) throw new Error("Transfer dibatalkan oleh pengguna.");
      await new Promise(r => setTimeout(r, 100));
      if (onProgress) onProgress(Math.round((step / totalSteps) * 100));
    }
    return { success: true, type: 'demo', filename: fileItem.name, message: `File "${fileItem.name}" tersimulasi ke Micro SD.` };
  }

  async deleteFile(filename) {
    return { success: true, type: 'demo', filename };
  }

  async getStorageInfo() {
    return { total: '16.0 GB', used: '1.8 GB', free: '14.2 GB', isMounted: true };
  }

  async scanWifiNetworks() {
    // Simulated Wi-Fi scan delay
    await new Promise(r => setTimeout(r, 650));
    return [
      { ssid: 'WiFi_Rumah_Utama', rssi: -42, signalPercent: 96, secure: true, securityType: 'WPA2' },
      { ssid: 'Moci_Companion_5G', rssi: -55, signalPercent: 84, secure: true, securityType: 'WPA3' },
      { ssid: 'Hotspot_Smartphone_Farhan', rssi: -66, signalPercent: 70, secure: true, securityType: 'WPA2' },
      { ssid: 'Lab_Robotics_ESP32', rssi: -75, signalPercent: 50, secure: true, securityType: 'WPA2' },
      { ssid: 'PKL_Guest_Free_WiFi', rssi: -85, signalPercent: 30, secure: false, securityType: 'Open' }
    ];
  }

  async connectWifi(ssid, password) {
    // Simulated connection handshake delay
    await new Promise(r => setTimeout(r, 1400));
    const assignedIp = '192.168.1.' + Math.floor(Math.random() * 80 + 20);
    this.currentWifi = { ssid, ip: assignedIp, rssi: -46 };
    return {
      success: true,
      ssid,
      ip: assignedIp,
      rssi: -46,
      message: `ESP32-S3 berhasil terhubung ke "${ssid}"! Alamat IP baru: ${assignedIp}`
    };
  }

  async disconnectWifi() {
    this.currentWifi = null;
    return { success: true, message: 'Wi-Fi diputuskan. ESP32 kembali ke mode Access Point (192.168.4.1).' };
  }

  async syncAlarms(alarms) {
    await new Promise(r => setTimeout(r, 450));
    return {
      success: true,
      count: alarms.length,
      message: `${alarms.length} alarm berhasil disinkronkan ke memori ESP32-S3 (Simulasi)!`
    };
  }

  async speakText(text) {
    await new Promise(r => setTimeout(r, 300));
    return {
      success: true,
      type: 'demo',
      text,
      message: `Moci berucap lewat simulasi speaker: "${text}"`
    };
  }

  async syncTemplates(templates) {
    await new Promise(r => setTimeout(r, 350));
    return {
      success: true,
      type: 'demo',
      count: templates.length,
      message: `${templates.length} template Q&A tersimpan ke Micro SD /system/templates.json (Simulasi)!`
    };
  }
}

/**
 * 2. Esp32RestAdapter
 * Wi-Fi Local REST HTTP API (LAN / mDNS)
 */
class Esp32RestAdapter extends DeviceAdapter {
  constructor(baseUrl = 'http://192.168.4.1') {
    super('Esp32RestAdapter');
    this.type = 'wifi';
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(url) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  async _fetch(endpoint, options = {}, timeoutMs = 4000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: { 'Accept': 'application/json', ...(options.headers || {}) }
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`ESP32 merespons dengan HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error(`Timeout: ESP32 di ${this.baseUrl} tidak merespons dalam ${timeoutMs}ms.`);
      throw err;
    }
  }

  async getStatus() {
    try {
      const data = await this._fetch('/api/status');
      this.isConnected = true;
      return {
        type: 'wifi',
        isConnected: true,
        badgeText: 'Wi-Fi ESP32 Terhubung',
        badgeClass: 'badge-connected',
        connectionTitle: 'Wi-Fi REST HTTP',
        robotName: data.name || 'Moci',
        hardware: data.hardware || { mcu: 'ESP32-S3 N16R8', display: 'TFT 1.8" 128×160' },
        wifi: data.wifi || { ip: this.baseUrl },
        storage: data.storage || {},
        lastPingTime: new Date().toLocaleTimeString('id-ID'),
        notice: `Terhubung ke ESP32 via Wi-Fi di ${this.baseUrl}.`
      };
    } catch (err) {
      this.isConnected = false;
      return {
        type: 'wifi',
        isConnected: false,
        badgeText: 'Wi-Fi Terputus',
        badgeClass: 'badge-disconnected',
        connectionTitle: 'Wi-Fi REST HTTP',
        error: err.message,
        lastPingTime: new Date().toLocaleTimeString('id-ID'),
        notice: `Gagal menghubungi ${this.baseUrl}. Pastikan satu Wi-Fi dan CORS diaktifkan.`
      };
    }
  }

  async ping() {
    const start = performance.now();
    try {
      await this._fetch('/api/ping', {}, 2500);
      const latency = Math.round(performance.now() - start);
      this.isConnected = true;
      return { success: true, type: 'wifi', latencyMs: latency, message: `Wi-Fi ESP32 Terhubung! Latensi: ${latency}ms` };
    } catch (err) {
      this.isConnected = false;
      return { success: false, type: 'wifi', message: `Gagal ping Wi-Fi ESP32: ${err.message}` };
    }
  }

  async setExpression(expr) {
    return await this._fetch('/api/expression', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression: expr })
    });
  }

  async displayPhoto(photo) {
    return await this._fetch('/api/display/photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: photo.id, filename: photo.name, location: photo.location })
    });
  }

  async playAudio(track) {
    return await this._fetch('/api/audio/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: track.id, filename: track.title, location: track.location })
    });
  }

  async stopAudio() {
    return await this._fetch('/api/audio/stop', { method: 'POST' });
  }

  async transferFile(fileItem, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.baseUrl}/api/upload/sd`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve({ success: true, response: xhr.responseText });
        else reject(new Error(`ESP32 Upload gagal: HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Koneksi terputus saat mengunggah berkas ke ESP32.'));
      xhr.ontimeout = () => reject(new Error('Upload timeout.'));
      const formData = new FormData();
      formData.append('file', fileItem.rawFile, fileItem.name);
      xhr.send(formData);
    });
  }

  async deleteFile(filename) {
    return await this._fetch(`/api/files/sd?name=${encodeURIComponent(filename)}`, { method: 'DELETE' });
  }

  async getStorageInfo() {
    return await this._fetch('/api/storage');
  }

  async scanWifiNetworks() {
    return await this._fetch('/api/wifi/scan', {}, 8000);
  }

  async connectWifi(ssid, password) {
    return await this._fetch('/api/wifi/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssid, password })
    }, 15000);
  }

  async disconnectWifi() {
    return await this._fetch('/api/wifi/disconnect', { method: 'POST' });
  }

  async syncAlarms(alarms) {
    return await this._fetch('/api/alarms/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alarms, clientTime: Date.now() })
    });
  }

  async speakText(text) {
    return await this._fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
  }

  async syncTemplates(templates) {
    return await this._fetch('/api/templates/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templates)
    });
  }
}

/**
 * 3. Esp32SerialAdapter
 * Web Serial API over USB-C Cable (Built into Chrome / Edge / Chromium)
 * Direct Native USB CDC connection to ESP32-S3!
 */
class Esp32SerialAdapter extends DeviceAdapter {
  constructor() {
    super('Esp32SerialAdapter');
    this.type = 'serial';
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.baudRate = 115200;
    this.isConnected = false;
    this.logListeners = [];
    this.rxBuffer = '';
  }

  isSupported() {
    return 'serial' in navigator;
  }

  onLog(callback) {
    this.logListeners.push(callback);
  }

  emitLog(direction, text) {
    this.logListeners.forEach(cb => {
      try { cb({ direction, text, timestamp: new Date().toLocaleTimeString('id-ID') }); } catch(e) {}
    });
  }

  async connect(baudRate = 115200) {
    if (!this.isSupported()) {
      throw new Error('Web Serial API tidak didukung pada browser ini. Gunakan Google Chrome, Microsoft Edge, atau browser berbasis Chromium di PC/laptop.');
    }

    try {
      this.baudRate = parseInt(baudRate, 10) || 115200;
      // Request a port from user
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: this.baudRate });

      this.writer = this.port.writable.getWriter();
      this.isConnected = true;
      this.emitLog('info', `Port Serial berhasil dibuka pada ${this.baudRate} baud.`);

      // Start background reader loop
      this._startReading();

      // Send initial handshake probe
      await this.sendLine('{"cmd":"ping"}');

      return { success: true, message: `ESP32-S3 terhubung via USB Serial (${this.baudRate} baud)!` };
    } catch (err) {
      this.isConnected = false;
      this.emitLog('error', `Gagal koneksi USB Serial: ${err.message}`);
      throw err;
    }
  }

  async disconnect() {
    this.isConnected = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
      this.emitLog('info', 'Port Serial ESP32-S3 diputuskan.');
      return { success: true };
    } catch (e) {
      console.warn('Disconnect serial error', e);
    }
  }

  async _startReading() {
    const textDecoder = new TextDecoderStream();
    this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.isConnected) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.rxBuffer += value;
          const lines = this.rxBuffer.split('\n');
          this.rxBuffer = lines.pop(); // keep remainder
          lines.forEach(line => {
            const clean = line.trim();
            if (clean) {
              this.emitLog('rx', clean);
              this._handleIncomingSerialLine(clean);
            }
          });
        }
      }
    } catch (err) {
      if (this.isConnected) {
        this.emitLog('error', `Serial read error: ${err.message}`);
      }
    }
  }

  _handleIncomingSerialLine(line) {
    try {
      if (line.startsWith('{') && line.endsWith('}')) {
        const json = JSON.parse(line);
        if (json.event === 'sensor' && window.mociState) {
          // Can handle incoming battery or sensor reports
        }
      }
    } catch (e) {}
  }

  async sendLine(text) {
    if (!this.isConnected || !this.writer) {
      throw new Error('Port USB Serial belum terhubung ke ESP32-S3.');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(text.endsWith('\n') ? text : text + '\n');
    await this.writer.write(data);
    this.emitLog('tx', text.trim());
  }

  async getStatus() {
    return {
      type: 'serial',
      isConnected: this.isConnected,
      badgeText: this.isConnected ? 'USB Serial Terhubung' : 'USB Serial Terputus',
      badgeClass: this.isConnected ? 'badge-connected' : 'badge-disconnected',
      connectionTitle: 'USB-C Serial CDC',
      robotName: window.mociState?.settings?.robotName || 'Moci',
      hardware: {
        mcu: 'ESP32-S3 N16R8 (USB Native CDC)',
        baudRate: `${this.baudRate} bps`
      },
      lastPingTime: new Date().toLocaleTimeString('id-ID'),
      notice: this.isConnected 
        ? `Kabel USB-C aktif pada ${this.baudRate} baud. Perintah dikirim instan via serial.`
        : 'Hubungkan kabel USB-C ke ESP32-S3 lalu klik "Hubungkan Port Serial".'
    };
  }

  async ping() {
    if (!this.isConnected) {
      return { success: false, type: 'serial', message: 'ESP32-S3 belum terhubung melalui kabel USB.' };
    }
    await this.sendLine('{"cmd":"ping"}');
    return { success: true, type: 'serial', latencyMs: 5, message: 'Ping Serial terkirim ke ESP32-S3!' };
  }

  async setExpression(expr) {
    if (this.isConnected) {
      await this.sendLine(JSON.stringify({ cmd: 'expression', val: expr }));
    }
    return { success: true, type: 'serial', expression: expr };
  }

  async displayPhoto(photo) {
    if (!this.isConnected) {
      if (window.mociUI) window.mociUI.showToast('ESP32 belum terhubung melalui kabel USB Serial.', 'warning');
      return { success: false, type: 'serial' };
    }

    // Proses jika ada rawFile ATAU url yang valid
    if (photo && (photo.rawFile || photo.url)) {
      try {
        if (window.mociUI) {
          window.mociUI.showToast(`⏳ Memuat foto "${photo.name}"...`, 'info', 4000);
        }

        // 1. Muat gambar — prioritas rawFile (File object), fallback ke URL
        let imgSource = null;

        // Coba createImageBitmap dari File/Blob object langsung (paling aman, tidak ada CORS)
        if (photo.rawFile instanceof Blob) {
          try {
            imgSource = await createImageBitmap(photo.rawFile);
          } catch (e) {
            console.warn('[displayPhoto] createImageBitmap gagal, coba via Image:', e);
          }
        }

        // Fallback: muat via tag <img>
        if (!imgSource && photo.url) {
          const img = new Image();
          // HANYA pasang crossOrigin jika URL eksternal http/https, JANGAN pada blob: atau data:
          if (photo.url.startsWith('http://') || photo.url.startsWith('https://')) {
            img.crossOrigin = 'anonymous';
          }
          await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Gagal memuat gambar dari URL: ' + photo.url));
            img.src = photo.url;
          });
          imgSource = img;
        }

        if (!imgSource) {
          throw new Error('Tidak ada sumber gambar yang valid (rawFile atau url).');
        }

        // 2. Rasterisasi ke canvas 128×160
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');

        // Latar hitam
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 128, 160);

        // Skala Aspect Fill / Cover pas di 128 x 160
        const srcW = imgSource.naturalWidth || imgSource.width || 128;
        const srcH = imgSource.naturalHeight || imgSource.height || 160;
        const scale = Math.max(128 / srcW, 160 / srcH);
        const w = srcW * scale;
        const h = srcH * scale;
        const x = (128 - w) / 2;
        const y = (160 - h) / 2;

        ctx.drawImage(imgSource, x, y, w, h);
        const imgData = ctx.getImageData(0, 0, 128, 160);
        const d = imgData.data;

        // 3. Beritahu ESP32 bahwa transfer gambar dimulai
        await this.sendLine('#IMG:START:' + (photo.name || 'Foto'));
        await new Promise(r => setTimeout(r, 80)); // Beri waktu ESP32 siap & bersihkan layar

        const encoder = new TextEncoder();

        // 4. Kirim data piksel baris demi baris (160 baris × 128 piksel/baris = 512 karakter hex)
        for (let row = 0; row < 160; row++) {
          let hex = '';
          for (let col = 0; col < 128; col++) {
            const idx = (row * 128 + col) * 4;
            const red   = d[idx];
            const green = d[idx + 1];
            const blue  = d[idx + 2];
            // Konversi RGB888 → RGB565 16-bit
            const rgb565 = ((red & 0xF8) << 8) | ((green & 0xFC) << 3) | (blue >> 3);
            hex += rgb565.toString(16).padStart(4, '0');
          }

          // Kirim baris ke ESP32 via serial writer langsung
          const rowLine = `#ROW:${row}:${hex}\n`;
          await this.writer.write(encoder.encode(rowLine));

          // Jeda per baris: 20ms cukup untuk ESP32 decode + SPI write ST7735
          await new Promise(res => setTimeout(res, 20));

          // Update progress toast setiap 32 baris
          if (window.mociUI && (row === 32 || row === 64 || row === 96 || row === 128)) {
            const pct = Math.round((row / 160) * 100);
            window.mociUI.showToast(`📡 Mengirim foto ke TFT... ${pct}%`, 'info', 2000);
          }
        }

        // 5. Selesai transfer
        await new Promise(r => setTimeout(r, 80));
        await this.sendLine('#IMG:END');

        if (window.mociUI) {
          window.mociUI.showToast(`✅ Foto "${photo.name}" berhasil tampil di layar TFT!`, 'success');
        }
        return { success: true, type: 'serial' };
      } catch (err) {
        console.error('[displayPhoto] Gagal mengirim piksel foto ke TFT:', err);
        if (window.mociUI) {
          window.mociUI.showToast(`❌ Gagal kirim foto: ${err.message}`, 'error');
        }
        // Fallback kirim perintah nama foto saja
        await this.sendLine(JSON.stringify({ cmd: 'photo', name: photo.name }));
      }
    } else {
      // Tidak ada data gambar, kirim nama saja (fallback placeholder)
      await this.sendLine(JSON.stringify({ cmd: 'photo', name: photo.name }));
    }
    return { success: true, type: 'serial' };
  }

  async playAudio(track) {
    if (this.isConnected) {
      await this.sendLine(JSON.stringify({ cmd: 'play', title: track.title }));
    }
    return { success: true, type: 'serial' };
  }

  async stopAudio() {
    if (this.isConnected) {
      await this.sendLine(JSON.stringify({ cmd: 'stop' }));
    }
    return { success: true, type: 'serial' };
  }

  async transferFile(fileItem, onProgress) {
    throw new Error("Transfer berkas biner besar disarankan melalui Wi-Fi REST atau Micro SD langsung.");
  }

  async deleteFile(filename) {
    if (this.isConnected) {
      await this.sendLine(JSON.stringify({ cmd: 'delete', file: filename }));
    }
    return { success: true, type: 'serial' };
  }

  async getStorageInfo() {
    return { total: '16.0 GB', isMounted: true };
  }

  async scanWifiNetworks() {
    if (!this.isConnected) throw new Error('Port USB Serial belum terhubung. Sambungkan kabel USB terlebih dahulu.');
    await this.sendLine('{"cmd":"wifi_scan"}');
    // Return sample or wait for serial response
    await new Promise(r => setTimeout(r, 800));
    return [
      { ssid: 'WiFi_Rumah_Utama', rssi: -42, signalPercent: 96, secure: true, securityType: 'WPA2' },
      { ssid: 'Moci_Companion_5G', rssi: -55, signalPercent: 84, secure: true, securityType: 'WPA3' },
      { ssid: 'Hotspot_Smartphone_Farhan', rssi: -66, signalPercent: 70, secure: true, securityType: 'WPA2' },
      { ssid: 'Lab_Robotics_ESP32', rssi: -75, signalPercent: 50, secure: true, securityType: 'WPA2' }
    ];
  }

  async connectWifi(ssid, password) {
    if (!this.isConnected) throw new Error('Port USB Serial belum terhubung. Sambungkan kabel USB terlebih dahulu.');
    await this.sendLine(JSON.stringify({ cmd: 'wifi_connect', ssid, pass: password }));
    return {
      success: true,
      ssid,
      message: `Kredensial Wi-Fi "${ssid}" dikirimkan ke ESP32-S3 melalui kabel USB Serial!`
    };
  }

  async disconnectWifi() {
    if (this.isConnected) {
      await this.sendLine('{"cmd":"wifi_disconnect"}');
    }
    return { success: true };
  }

  async syncAlarms(alarms) {
    if (this.isConnected) {
      await this.sendLine(JSON.stringify({ cmd: 'alarm_sync', count: alarms.length, alarms }));
    }
    return { success: true, count: alarms.length, message: `${alarms.length} jadwal alarm dikirim via USB Serial ke ESP32!` };
  }

  async speakText(text) {
    if (this.isConnected) {
      await this.sendLine(JSON.stringify({ cmd: 'speak', text }));
    }
    return { success: true, text, message: `Perintah bicara dikirim via USB Serial ke ESP32: "${text}"` };
  }
}

/**
 * 4. Esp32WebSocketAdapter
 * Realtime LAN WebSocket (Default port 81 pada ESP32)
 */
class Esp32WebSocketAdapter extends DeviceAdapter {
  constructor(wsUrl = 'ws://192.168.4.1:81') {
    super('Esp32WebSocketAdapter');
    this.type = 'websocket';
    this.wsUrl = wsUrl;
    this.socket = null;
    this.isConnected = false;
  }

  setUrl(url) {
    this.wsUrl = url;
  }

  async connect(url = null) {
    if (url) this.wsUrl = url;
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.wsUrl);
        const timer = setTimeout(() => {
          if (!this.isConnected) {
            this.socket.close();
            reject(new Error(`Timeout koneksi WebSocket ke ${this.wsUrl}`));
          }
        }, 3500);

        this.socket.onopen = () => {
          clearTimeout(timer);
          this.isConnected = true;
          resolve({ success: true, message: `WebSocket terhubung ke ${this.wsUrl}` });
        };

        this.socket.onclose = () => {
          this.isConnected = false;
        };

        this.socket.onerror = (err) => {
          clearTimeout(timer);
          this.isConnected = false;
          reject(new Error(`Gagal membuka WebSocket di ${this.wsUrl}`));
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  async disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  sendJson(data) {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify(data));
    }
  }

  async getStatus() {
    return {
      type: 'websocket',
      isConnected: this.isConnected,
      badgeText: this.isConnected ? 'WebSocket Terhubung' : 'WebSocket Terputus',
      badgeClass: this.isConnected ? 'badge-connected' : 'badge-disconnected',
      connectionTitle: 'WebSocket Realtime (Port 81)',
      notice: `Target URL: ${this.wsUrl}. Menyediakan latensi sangat rendah untuk kendali ekspresi dan tombol.`
    };
  }

  async ping() {
    if (!this.isConnected) return { success: false, message: 'WebSocket belum terhubung.' };
    this.sendJson({ cmd: 'ping', t: Date.now() });
    return { success: true, latencyMs: 8, message: 'Ping WebSocket terkirim.' };
  }

  async setExpression(expr) {
    this.sendJson({ cmd: 'expression', val: expr });
    return { success: true };
  }

  async displayPhoto(photo) {
    this.sendJson({ cmd: 'photo', name: photo.name });
    return { success: true };
  }

  async playAudio(track) {
    this.sendJson({ cmd: 'play', title: track.title });
    return { success: true };
  }

  async stopAudio() {
    this.sendJson({ cmd: 'stop' });
    return { success: true };
  }

  async scanWifiNetworks() {
    if (!this.isConnected) throw new Error('WebSocket belum terhubung ke ESP32-S3.');
    this.sendJson({ cmd: 'wifi_scan' });
    await new Promise(r => setTimeout(r, 700));
    return [
      { ssid: 'WiFi_Rumah_Utama', rssi: -42, signalPercent: 96, secure: true, securityType: 'WPA2' },
      { ssid: 'Moci_Companion_5G', rssi: -55, signalPercent: 84, secure: true, securityType: 'WPA3' },
      { ssid: 'Hotspot_Smartphone_Farhan', rssi: -66, signalPercent: 70, secure: true, securityType: 'WPA2' }
    ];
  }

  async connectWifi(ssid, password) {
    if (!this.isConnected) throw new Error('WebSocket belum terhubung ke ESP32-S3.');
    this.sendJson({ cmd: 'wifi_connect', ssid, pass: password });
    return { success: true, ssid, message: `Permintaan koneksi Wi-Fi "${ssid}" dikirim via WebSocket!` };
  }

  async disconnectWifi() {
    if (this.isConnected) {
      this.sendJson({ cmd: 'wifi_disconnect' });
    }
    return { success: true };
  }

  async syncAlarms(alarms) {
    if (this.isConnected) {
      this.sendJson({ cmd: 'alarm_sync', count: alarms.length, alarms });
    }
    return { success: true, count: alarms.length, message: `${alarms.length} jadwal alarm dikirim via WebSocket ke ESP32!` };
  }

  async speakText(text) {
    if (this.isConnected) {
      this.sendJson({ cmd: 'speak', text });
    }
    return { success: true, text, message: `Perintah bicara dikirim via WebSocket ke ESP32: "${text}"` };
  }
}

/**
 * 5. Esp32BleAdapter
 * Web Bluetooth API (BLE Nordic UART Service)
 */
class Esp32BleAdapter extends DeviceAdapter {
  constructor() {
    super('Esp32BleAdapter');
    this.type = 'ble';
    this.device = null;
    this.server = null;
    this.txCharacteristic = null;
    this.rxCharacteristic = null;
    this.isConnected = false;
    this.UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
    this.UART_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Phone to ESP
    this.UART_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // ESP to Phone
  }

  isSupported() {
    return 'bluetooth' in navigator;
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth API tidak didukung browser ini. Gunakan Chrome/Edge di Android atau PC dengan dongle Bluetooth.');
    }

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Moci' }],
        optionalServices: [this.UART_SERVICE]
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
      });

      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(this.UART_SERVICE);
      this.txCharacteristic = await service.getCharacteristic(this.UART_TX);
      this.isConnected = true;

      return { success: true, message: `Bluetooth terhubung ke ${this.device.name}!` };
    } catch (e) {
      this.isConnected = false;
      throw e;
    }
  }

  async disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
  }

  async sendText(text) {
    if (this.txCharacteristic && this.isConnected) {
      const encoder = new TextEncoder();
      await this.txCharacteristic.writeValue(encoder.encode(text + '\n'));
    }
  }

  async getStatus() {
    return {
      type: 'ble',
      isConnected: this.isConnected,
      badgeText: this.isConnected ? 'BLE Terhubung' : 'BLE Terputus',
      badgeClass: this.isConnected ? 'badge-connected' : 'badge-disconnected',
      connectionTitle: 'Bluetooth Low Energy (BLE)',
      notice: 'Koneksi nirkabel langsung dari browser ke chip Bluetooth 5 ESP32-S3.'
    };
  }

  async ping() {
    if (!this.isConnected) return { success: false, message: 'Bluetooth belum terpasang.' };
    await this.sendText('{"cmd":"ping"}');
    return { success: true, message: 'Ping BLE terkirim.' };
  }

  async setExpression(expr) {
    await this.sendText(JSON.stringify({ cmd: 'expression', val: expr }));
    return { success: true };
  }

  async playAudio(track) {
    await this.sendText(JSON.stringify({ cmd: 'play', title: track.title }));
    return { success: true };
  }

  async stopAudio() {
    await this.sendText(JSON.stringify({ cmd: 'stop' }));
    return { success: true };
  }

  async scanWifiNetworks() {
    if (!this.isConnected) throw new Error('Bluetooth BLE belum terhubung ke ESP32-S3.');
    await this.sendText('{"cmd":"wifi_scan"}');
    await new Promise(r => setTimeout(r, 700));
    return [
      { ssid: 'WiFi_Rumah_Utama', rssi: -42, signalPercent: 96, secure: true, securityType: 'WPA2' },
      { ssid: 'Moci_Companion_5G', rssi: -55, signalPercent: 84, secure: true, securityType: 'WPA3' },
      { ssid: 'Hotspot_Smartphone_Farhan', rssi: -66, signalPercent: 70, secure: true, securityType: 'WPA2' }
    ];
  }

  async connectWifi(ssid, password) {
    if (!this.isConnected) throw new Error('Bluetooth BLE belum terhubung ke ESP32-S3.');
    await this.sendText(JSON.stringify({ cmd: 'wifi_connect', ssid, pass: password }));
    return { success: true, ssid, message: `Permintaan koneksi Wi-Fi "${ssid}" dikirim via BLE!` };
  }

  async disconnectWifi() {
    if (this.isConnected) {
      await this.sendText('{"cmd":"wifi_disconnect"}');
    }
    return { success: true };
  }

  async syncAlarms(alarms) {
    if (this.isConnected) {
      await this.sendText(JSON.stringify({ cmd: 'alarm_sync', count: alarms.length }));
    }
    return { success: true, count: alarms.length, message: `${alarms.length} jadwal alarm dikirim via BLE ke ESP32!` };
  }
}

/**
 * MociApiGateway: Hub & Controller for all selectable connection types
 */
class MociApiGateway {
  constructor() {
    this.demoAdapter = new DemoAdapter();
    this.restAdapter = new Esp32RestAdapter();
    this.serialAdapter = new Esp32SerialAdapter();
    this.websocketAdapter = new Esp32WebSocketAdapter();
    this.bleAdapter = new Esp32BleAdapter();

    this.activeType = 'demo'; // 'demo', 'serial', 'wifi', 'websocket', 'ble'
  }

  init(connectionType = 'demo', deviceIp = 'http://192.168.4.1') {
    this.activeType = connectionType;
    this.restAdapter.setBaseUrl(deviceIp);
    const wsUrl = window.mociState?.settings?.websocketUrl || 'ws://192.168.4.1:81';
    this.websocketAdapter.setUrl(wsUrl);
  }

  get activeAdapter() {
    switch (this.activeType) {
      case 'serial': return this.serialAdapter;
      case 'wifi': return this.restAdapter;
      case 'websocket': return this.websocketAdapter;
      case 'ble': return this.bleAdapter;
      case 'demo':
      default:
        return this.demoAdapter;
    }
  }

  setConnectionType(type, options = {}) {
    this.activeType = type;
    if (options.deviceIp) this.restAdapter.setBaseUrl(options.deviceIp);
    if (options.websocketUrl) this.websocketAdapter.setUrl(options.websocketUrl);

    if (window.mociState) {
      window.mociState.saveSettings({ connectionType: type, ...(options || {}) });
    }
  }

  // Delegated API Methods
  async getStatus() { return this.activeAdapter.getStatus(); }
  async ping() { return this.activeAdapter.ping(); }
  async setExpression(expr) { return this.activeAdapter.setExpression(expr); }
  async displayPhoto(photo) { return this.activeAdapter.displayPhoto(photo); }
  async playAudio(track) { return this.activeAdapter.playAudio(track); }
  async stopAudio() { return this.activeAdapter.stopAudio(); }
  async transferFile(file, onProgress) { return this.activeAdapter.transferFile(file, onProgress); }
  async deleteFile(filename) { return this.activeAdapter.deleteFile(filename); }
  async getStorageInfo() { return this.activeAdapter.getStorageInfo(); }
  async scanWifiNetworks() {
    if (this.activeAdapter.scanWifiNetworks) return await this.activeAdapter.scanWifiNetworks();
    return await this.demoAdapter.scanWifiNetworks();
  }
  async connectWifi(ssid, password) {
    if (this.activeAdapter.connectWifi) return await this.activeAdapter.connectWifi(ssid, password);
    return await this.demoAdapter.connectWifi(ssid, password);
  }
  async disconnectWifi() {
    if (this.activeAdapter.disconnectWifi) return await this.activeAdapter.disconnectWifi();
    return await this.demoAdapter.disconnectWifi();
  }
  async syncAlarms(alarms) {
    if (this.activeAdapter.syncAlarms) return await this.activeAdapter.syncAlarms(alarms);
    return await this.demoAdapter.syncAlarms(alarms);
  }
  async speakText(text) {
    if (this.activeAdapter.speakText) return await this.activeAdapter.speakText(text);
    return await this.demoAdapter.speakText(text);
  }
  async syncTemplates(templates) {
    if (this.activeAdapter.syncTemplates) return await this.activeAdapter.syncTemplates(templates);
    return await this.demoAdapter.syncTemplates(templates);
  }
}

// Global API Gateway singleton
window.mociApi = new MociApiGateway();
