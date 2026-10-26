# 🤖 Web Moci — Personal Robot Companion

Website pendamping (*companion web application*) untuk robot cerdas **Moci** berbasis mikrokontroler **ESP32-S3 N16R8**, layar **TFT 1,8 inci 128×160 piksel SPI**, **Micro SD FAT32**, mikrofon **I2S INMP441**, modul DAC/amplifier **MAX98357A**, speaker **8Ω 2W**, dan baterai **Li-Po 3,7V**.

Website ini dirancang menggunakan arsitektur statis murni (**HTML5, CSS3, Vanilla JavaScript**) agar dapat langsung di-host di **GitHub Pages** tanpa memerlukan server PHP, Node.js, atau framework Laravel.

---

## 📑 Daftar Isi
1. [Cara Menjalankan Secara Lokal](#1-cara-menjalankan-secara-lokal)
2. [Cara Mengunggah ke GitHub](#2-cara-mengunggah-ke-github)
3. [Cara Mengaktifkan GitHub Pages](#3-cara-mengaktifkan-github-pages)
4. [Daftar Fitur yang Sudah Berfungsi Penuh](#4-daftar-fitur-yang-sudah-berfungsi-penuh)
5. [Fitur yang Masih Berupa Demo / Simulasi](#5-fitur-yang-masih-berupa-demo--simulasi)
6. [Fitur Pemilih Jaringan Wi-Fi ESP32-S3 (Wi-Fi Manager Tanpa Ketik Manual)](#6-fitur-pemilih-jaringan-wi-fi-esp32-s3-wi-fi-manager)
7. [Panduan 5 Saluran Koneksi ke ESP32-S3](#7-panduan-5-saluran-koneksi-ke-esp32-s3)
8. [Batasan Teknis (Koneksi, Micro SD, & Musik Online)](#8-batasan-teknis)
9. [Panduan Struktur File & Tempat Mengedit Fitur Baru](#9-panduan-struktur-file--pengembangan)

---

## 1. Cara Menjalankan Secara Lokal

Karena aplikasi ini 100% berbasis client-side statis, Anda dapat menjalankannya dengan beberapa cara mudah:

### Opsi A: Menggunakan VS Code Live Server (Direkomendasikan)
1. Buka folder `robot moci` di Visual Studio Code.
2. Pasang ekstensi **Live Server** (oleh Ritwick Dey) jika belum terpasang.
3. Klik kanan pada berkas `index.html` lalu pilih **"Open with Live Server"**.
4. Browser akan otomatis terbuka di `http://127.0.0.1:5500`.

### Opsi B: Menggunakan Python HTTP Server
Buka terminal (PowerShell / Command Prompt) di dalam direktori proyek:
```bash
python -m http.server 8000
```
Buka browser di: [http://localhost:8000](http://localhost:8000).

### Opsi C: Membuka Langsung Berkas File
Klik dua kali berkas `index.html` untuk membukanya langsung di browser (Chrome, Edge, Firefox, Safari).

---

## 2. Cara Mengunggah ke GitHub

Pastikan Anda telah memasang [Git](https://git-scm.com/) di komputer Anda dan memiliki akun GitHub.

1. Buka terminal di folder proyek:
   ```bash
   git init
   git add .
   git commit -m "Inisialisasi Web Moci Companion"
   ```
2. Buat repositori baru di GitHub (misalnya dengan nama `web-moci`).
3. Hubungkan repositori lokal ke GitHub:
   ```bash
   git branch -M main
   git remote add origin https://github.com/USERNAME_ANDA/web-moci.git
   git push -u origin main
   ```
*(Ganti `USERNAME_ANDA` dengan username GitHub Anda).*

---

## 3. Cara Mengaktifkan GitHub Pages

Setelah kode berhasil di-*push* ke GitHub:
1. Masuk ke halaman repositori Anda di **GitHub.com**.
2. Klik tab **Settings** di menu atas repositori.
3. Pada sidebar kiri, pilih menu **Pages**.
4. Di bagian **Build and deployment**:
   - **Source**: Pilih `Deploy from a branch`.
   - **Branch**: Pilih `main`, folder `/ (root)`.
   - Klik tombol **Save**.
5. Tunggu sekitar 1–2 menit hingga GitHub Actions selesai memproses.
6. URL website Anda akan muncul, misalnya:
   `https://USERNAME_ANDA.github.io/web-moci/`

---

## 4. Daftar Fitur yang Sudah Berfungsi Penuh

Antarmuka ini dibuat interaktif dan fungsional secara langsung:
- ✅ **Sistem Navigasi SPA (Single Page Application)**: Berpindah antar 7 halaman tanpa memuat ulang browser (*zero reload*).
- ✅ **Maskot Robot Moci Interaktif**:
  - Animasi kedip mata otomatis dan ekspresi dinamis (Senang, Semangat, Kaget, Mengantuk, Sedih, Netral).
  - Generator efek suara chirp/bleep robot 8-bit sintetis menggunakan Web Audio API saat maskot diklik.
  - Balon percakapan kontekstual yang berubah mengikuti emosi Moci.
- ✅ **Simulator Layar TFT 1,8" (128×160)**:
  - Pratinjau rasio tepat layar fisik ESP32 dengan efek *scanline CRT*.
  - Menampilkan ekspresi wajah aktif atau pratinjau foto yang dipilih.
- ✅ **Music Studio & Pemutar Audio HTML5**:
  - Memutar sampel lagu chiptune/lo-fi procedural sintetis tanpa perlu download berkas eksternal.
  - Unggah berkas audio lokal (MP3, WAV, OGG, M4A) via file picker dan drag & drop.
  - Kontrol pemutaran: Play, Pause, Next, Previous, Progress bar scrub, Volume slider, Mute, Shuffle, dan Repeat (Off, All, One).
  - Audio Visualizer animasi batang frekuensi.
  - Persistent Audio Dock Player di bagian bawah layar.
- ✅ **Galeri Foto Interaktif**:
  - Unggah foto lokal via file picker dan drag-and-drop.
  - Tampilan grid responsif dengan rasio TFT 128×160.
  - Filter (Semua, Favorit, Lokal, Micro SD) dan pencarian nama foto real-time.
  - Pengurutan foto (Terbaru, Terlama, Nama A-Z).
  - Lightbox modal dengan navigasi foto sebelumnya/berikutnya dan kontrol keyboard (⬅️ ➡️ Esc).
  - Mode Slideshow otomatis dengan interval yang bisa disesuaikan (3s, 5s, 10s).
- ✅ **Perpustakaan Media**: Arsip berkas foto dan audio terpadu dengan penyortiran kategori, ukuran, serta lokasi penyimpanan.
- ✅ **Antrean Transfer Micro SD**: Pemilihan banyak berkas, visualisasi progress transfer dinamis, status antrean, dan pembatalan transfer.
- ✅ **Pengaturan & Kustomisasi**:
  - Ganti nama robot (default "Moci").
  - 4 Pilihan tema warna: Dark Navy Mint (Bawaan), Cyber Violet, Cyber Gold, dan Emerald Wave.
  - Pengaturan kecepatan kedip mata, durasi slideshow, dan volume default.
  - Penyimpanan preferensi aman di `localStorage` peramban.
  - Tombol reset ke pengaturan pabrik demo.
- ✅ **Sistem Toast & Modal Konfirmasi**: Notifikasi interaktif untuk setiap aksi pengguna serta konfirmasi hapus data.
- ✅ **Desain Responsif**: Sidebar desktop dan drawer navigasi mobile ramah sentuhan.

---

## 5. Fitur yang Masih Berupa Demo / Simulasi

Sebagai transparansi teknis produk, berikut fitur yang saat ini berjalan dalam mode simulasi browser:
1. **Penyimpanan Micro SD**: Data foto dan musik demo tersimpan di memori lokal peramban (`localStorage` & Object URL memory), bukan di kartu Micro SD fisik ESP32.
2. **Koneksi ESP32**: Status berlabel badge **"Mode Demo (Simulasi)"**. Nilai baterai 3.82V, Wi-Fi RSSI, dan latensi ping merupakan simulasi antarmuka.
3. **Pengiriman Foto/Audio ke Robot**: Antrean transfer menyimulasikan transfer berkas melalui `DemoAdapter` tanpa menyentuh chip keras sampai firmware Anda dihubungkan.
4. **Speaker Robot**: Musik diputar menggunakan speaker internal komputer/HP Anda, belum dialirkan ke amplifier I2S MAX98357A pada robot Moci.

---

## 6. Fitur Pemilih Jaringan Wi-Fi ESP32-S3 (Wi-Fi Manager)

Anda **TIDAK PERLU mengetik manual SSID dan password Wi-Fi di dalam program Arduino (`.ino`)**.

### Cara Kerja Provisioning Wi-Fi Tanpa Hardcode:
1. **Mode Awal (Access Point)**:
   - Saat ESP32-S3 pertama kali menyala dan belum memiliki Wi-Fi yang tersimpan di flash memori, ESP32 otomatis menyalakan SoftAP bernama `Moci-Companion-AP` (IP `192.168.4.1`).
   - Hubungkan HP atau laptop Anda ke Wi-Fi `Moci-Companion-AP` tersebut (atau hubungkan kabel USB-C ke laptop).
2. **Pindai Sinyal Langsung dari Web**:
   - Buka menu **Koneksi** di Web Moci.
   - Klik tombol **"Pindai Wi-Fi Sekitar"**.
   - ESP32 menjalankan fungsi `WiFi.scanNetworks()` dan mengirim daftar sinyal Wi-Fi yang terdeteksi beserta kekuatan sinyal (dBm) dan status keamanan (WPA2/Open).
3. **Pilih & Masukkan Kata Sandi di Web**:
   - Klik salah satu nama Wi-Fi rumah atau hotspot yang muncul pada daftar.
   - Masukkan kata sandi Wi-Fi pada formulir input.
   - Klik tombol **"Hubungkan ESP32 ke Wi-Fi Ini"**.
4. **Penyimpanan Permanen di Flash NVS**:
   - Website mengirim data SSID & Password ke ESP32 melalui HTTP POST `/api/wifi/connect` (atau melalui perintah serial JSON).
   - ESP32 menyimpan SSID dan password tersebut ke memori flash internal permanen (*Non-Volatile Storage*) menggunakan library bawaan `Preferences.h`.
   - ESP32 menyambung ke router rumah Anda dan mendapatkan alamat IP baru via DHCP.
   - Mulai saat itu, setiap kali robot dinyalakan ulang, ESP32 otomatis menyambung ke router rumah tanpa perlu membuka kodingan Arduino lagi!

> 📄 **Kode Firmware Siap Pakai:** File sketch Arduino lengkap siap upload telah disediakan di berkas [`arduino_firmware_wifi_manager.ino`](file:///d:/PKL/PROJEK/robot%20moci/arduino_firmware_wifi_manager.ino).

---

## 7. Panduan 5 Saluran Koneksi ke ESP32-S3

Halaman **Koneksi** kini menyediakan **5 pilihan saluran komunikasi** yang dapat dipilih langsung sesuai kebutuhan:

### 1. 🔌 Kabel USB Serial (Web Serial API — Paling Direkomendasikan untuk Pemula)
- **Kelebihan**: Langsung colok kabel data USB-C dari laptop/PC ke port ESP32-S3. **Bebas masalah CORS**, **bebas batasan Mixed Content HTTPS**, dan **tidak butuh router Wi-Fi**.
- **Fitur**: Dilengkapi **Live Serial Monitor Console** (melihat data TX/RX log langsung di web), Baud Rate picker (115200 bps), dan tombol kirim perintah manual JSON/teks.
- **Dukungan Browser**: Google Chrome, Microsoft Edge, Opera, dan peramban berbasis Chromium.
- **Cara Pakai**:
  1. Pilih kartu **Kabel USB Serial**.
  2. Sambungkan kabel USB-C ke ESP32-S3.
  3. Klik tombol **"Sambungkan Port USB Serial"** dan pilih port COM perangkat Anda pada jendela pop-up peramban.

### 2. 🌐 Wi-Fi REST API (Local LAN / Access Point)
- **Kelebihan**: Komunikasi nirkabel standar melalui protokol HTTP JSON.
- **Cara Pakai**:
  1. Hubungkan HP/laptop ke Access Point Moci (misal: `Moci-Companion-AP` IP `192.168.4.1`) atau Wi-Fi rumah yang sama.
  2. Pilih kartu **Wi-Fi REST API**, masukkan alamat IP (misal `http://192.168.4.1` atau `http://moci.local`), lalu klik **Simpan Alamat** dan **Uji Ping**.

### 3. ⚡ WebSocket Realtime (Port 81 LAN)
- **Kelebihan**: Jalur data *full-duplex* dua arah dengan latensi sangat rendah (<10ms). Sangat cocok untuk menggerakkan ekspresi mata Moci secara real-time dan menerima telemetri tombol/sensor.
- **Cara Pakai**:
  1. Masukkan URL socket (misal: `ws://192.168.4.1:81`).
  2. Klik **Hubungkan WebSocket**.

### 4. 📡 Bluetooth Low Energy (Web Bluetooth API)
- **Kelebihan**: Nirkabel murni tanpa Wi-Fi router menggunakan modul radio Bluetooth 5 bawaan ESP32-S3.
- **Dukungan**: Chrome di Android dan PC/laptop dengan adapter Bluetooth.
- **Cara Pakai**:
  1. Klik kartu **Bluetooth Nirkabel**.
  2. Klik **"Pindai & Pasangkan Bluetooth Moci"** lalu pilih perangkat `Moci-ESP32`.

### 5. 🧪 Mode Demo (Simulasi Browser)
- Mode bawaan tanpa perangkat keras fisik untuk mengeksplorasi seluruh tampilan dan interaksi.
---

## 8. Batasan Teknis

### A. Hosting GitHub Pages & HTTPS vs HTTP (Mixed Content)
- GitHub Pages berjalan pada protokol aman `HTTPS` (`https://username.github.io`).
- ESP32 lokal umumnya berjalan pada protokol `HTTP` (`http://192.168.x.x`).
- Browser modern (seperti Chrome/Edge) memblokir request HTTP dari halaman HTTPS (*Mixed Content restriction*).
- **Solusi Praktis**:
  1. Jika ingin koneksi langsung ke ESP32 di rumah, jalankan Web Moci secara lokal melalui `http://localhost` atau server HTTP lokal (misal host file web langsung dari SPIFFS/Micro SD ESP32).
  2. Atau gunakan perantara aman seperti **Cloudflare Tunnel**, **ngrok**, atau **MQTT Broker over TLS/WSS**.

### B. Penyimpanan Micro SD & Kecepatan SPI
- ESP32-S3 N16R8 mengakses Micro SD via SPI atau SDMMC 1-bit/4-bit.
- Pengunggahan berkas besar (seperti lagu MP3 berukuran 5MB–10MB) via Wi-Fi ke Micro SD membutuhkan buffer stream yang efisien agar watchdog timer ESP32 tidak terpicu (*reset*). Disarankan mengunggah foto dalam format BMP 128×160 atau MP3 ber-bitrate 128 kbps.

### C. Pemutaran Musik YouTube
- URL video YouTube **tidak dapat diputar langsung** pada elemen `<audio>` browser karena pembatasan DRM, format video MP4/WebM, dan aturan CORS YouTube.
- Mengunduh audio YouTube secara otomatis di browser melanggar YouTube Terms of Service.
- Disarankan menggunakan berkas audio lokal MP3/WAV milik sendiri atau audio berlisensi Creative Commons.

### D. Keamanan Kredensial
- Password Wi-Fi rumah atau token rahasia tidak pernah disimpan di repository GitHub Pages.
- ESP32 menyimpan kredensial di flash internal ESP32 (NVS) saat Anda mengaturnya dari antarmuka Web Moci.

---

## 9. Panduan Struktur File & Pengembangan

Struktur kode dirancang terpisah dan modular agar Anda mudah menambah fitur baru:

```
robot moci/
├── index.html                        <- Halaman utama (struktur SPA, modal, audio dock)
├── README.md                         <- Dokumentasi lengkap proyek
├── arduino_firmware_wifi_manager.ino <- Sketch Arduino ESP32-S3 (Wi-Fi Manager & REST API)
├── css/
│   ├── variables.css                 <- Palet warna (Navy, Mint, Cyan, Coral) & variabel tema
│   ├── base.css                      <- Layout aplikasi (sidebar, header, reset tipografi)
│   ├── components.css                <- Komponen: Cards, Buttons, Inputs, Badges, Modals, Toasts
│   ├── mascot.css                    <- Desain kepala robot Moci, animasi mata, dan layar TFT 128x160
│   └── responsive.css                <- Aturan tampilan HP, tablet, dan drawer mobile
└── js/
    ├── state.js                      <- Penyimpanan data, localStorage, dan event bus
    ├── adapter.js                    <- Multi-Connection Adapter (Demo, Serial, REST, WS, BLE)
    ├── mascot.js                     <- Pengendali ekspresi mata, synthesizer suara chirp Web Audio
    ├── audio.js                      <- Pemutar musik HTMLAudioElement, synth generator WAV, visualizer
    ├── gallery.js                    <- Manajemen foto, unggah, lightbox modal, dan slideshow
    ├── transfer.js                   <- Logika antrean transfer file Micro SD
    ├── ui.js                         <- Pengendali router navigasi SPA, Wi-Fi picker, modal, toast
    └── app.js                        <- File pembuka (bootstrapper) yang menghubungkan seluruh modul
```

### File Mana yang Perlu Anda Edit untuk Menambah Fitur?

| Ingin Menambahkan Apa? | Edit File Ini: |
|---|---|
| **Menambah ekspresi wajah robot baru** (misal: "marah", "cinta") | Tambahkan style mata di [`css/mascot.css`](file:///d:/PKL/PROJEK/robot%20moci/css/mascot.css), logika di [`js/mascot.js`](file:///d:/PKL/PROJEK/robot%20moci/js/mascot.js), dan tombolnya di [`index.html`](file:///d:/PKL/PROJEK/robot%20moci/index.html). |
| **Menghubungkan endpoint API ESP32 baru** | Edit method pada `Esp32Adapter` di [`js/adapter.js`](file:///d:/PKL/PROJEK/robot%20moci/js/adapter.js). |
| **Mengubah warna tema / aksen tampilan** | Edit variabel CSS di [`css/variables.css`](file:///d:/PKL/PROJEK/robot%20moci/css/variables.css). |
| **Menambah efek suara synthesizer baru** | Edit fungsi `playRobotChirp()` di [`js/mascot.js`](file:///d:/PKL/PROJEK/robot%20moci/js/mascot.js). |
| **Menambah lagu atau foto bawaan baru** | Tambahkan item di `getDefaultPhotos()` atau `getDefaultTracks()` pada [`js/state.js`](file:///d:/PKL/PROJEK/robot%20moci/js/state.js). |
| **Menambah halaman menu baru** | Tambahkan tombol navigasi di sidebar [`index.html`](file:///d:/PKL/PROJEK/robot%20moci/index.html), buat section `<section id="view-namamenu">`, dan daftarkan di [`js/ui.js`](file:///d:/PKL/PROJEK/robot%20moci/js/ui.js). |

---

*Dikembangkan dengan ❤️ untuk Moci — Personal Robot Companion.*
