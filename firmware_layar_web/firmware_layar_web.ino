/* ==============================================================================
 * PROJEK ROBOT MOCI — FIRMWARE KHUSUS TES LAYAR + SINKRONISASI WEB
 * Target Board: ESP32-S3 N16R8 (16MB Flash, 8MB PSRAM)
 * Komponen Terpasang: HANYA Layar TFT 1.8" ST7735 + ESP32-S3 (via kabel USB-C)
 * ==============================================================================
 * Fitur:
 *   1. Menampilkan animasi mata robot Moci lengkap (Happy, Sad, Angry, Surprised,
 *      Sleepy, Love, Wink, Singing, Talking).
 *   2. Dua Pilihan Koneksi ke Web Moci:
 *      - Opsi A: Kabel Data USB-C langsung (Web Serial API di Chrome / Edge)
 *      - Opsi B: Wi-Fi AP Hotspot "Moci-Companion-AP" (IP 192.168.4.1) / Wi-Fi Rumah
 *   3. Menampilkan teks ucapan di layar saat user berbicara/chat via Web.
 *   4. TIDAK membutuhkan Micro SD Card ataupun modul amplifier/audio (Aman dijalankan).
 *
 * Library yang dibutuhkan (Install via Arduino Library Manager):
 *   - Adafruit GFX Library (by Adafruit)
 *   - Adafruit ST7735 and ST7789 Library (by Adafruit)
 *   - ArduinoJson (by Benoit Blanchon) v6 atau v7
 * ============================================================================== */

#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ==============================================================================
// 1. PIN LAYAR TFT 1.8" ST7735 & MODUL BUZZER 3 KAKI
// ==============================================================================
#define TFT_CS    15
#define TFT_RST    4
#define TFT_DC     2
#define TFT_MOSI  35
#define TFT_SCLK  36

// Pin Modul Buzzer 3 Kaki (Kaki S / Signal)
#define PIN_BUZZER 18

// Definisi warna RGB565 tambahan (karena tidak ada di header bawaan Adafruit ST77xx)
#ifndef ST77XX_DARKGREY
#define ST77XX_DARKGREY 0x7BEF
#endif
#ifndef ST77XX_MINT
#define ST77XX_MINT     0x07E0
#endif

// Inisialisasi SPI Custom Bus untuk ESP32-S3
SPIClass tftSPI(FSPI);
Adafruit_ST7735 tft = Adafruit_ST7735(&tftSPI, TFT_CS, TFT_DC, TFT_RST);

// ==============================================================================
// 2. OBJEK SERVER & PREFERENCES
// ==============================================================================
WebServer server(80);
Preferences preferences;

const char* AP_SSID = "Moci-Companion-AP";
const char* AP_PASS = "12345678";

String currentExpression = "happy";
String lastSpokenText = "";
bool isConnectedToHomeWifi = false;
unsigned long lastBlinkTime = 0;
bool isBlinking = false;

// Fungsi Nada Efek Suara Robot Moci (Mendukung Active & Passive Buzzer)
void playBuzzerChirp(String expr) {
  if (expr == "happy") {
    tone(PIN_BUZZER, 1046, 60); delay(70);
    tone(PIN_BUZZER, 1318, 60); delay(70);
    tone(PIN_BUZZER, 1568, 90);
  } else if (expr == "sad") {
    tone(PIN_BUZZER, 659, 100); delay(110);
    tone(PIN_BUZZER, 587, 100); delay(110);
    tone(PIN_BUZZER, 523, 160);
  } else if (expr == "angry") {
    tone(PIN_BUZZER, 350, 80); delay(90);
    tone(PIN_BUZZER, 290, 140);
  } else if (expr == "surprised") {
    tone(PIN_BUZZER, 880, 50); delay(60);
    tone(PIN_BUZZER, 1760, 100);
  } else if (expr == "singing") {
    tone(PIN_BUZZER, 1046, 80); delay(90);
    tone(PIN_BUZZER, 1318, 80); delay(90);
    tone(PIN_BUZZER, 1568, 80); delay(90);
    tone(PIN_BUZZER, 2093, 120);
  } else if (expr == "love") {
    tone(PIN_BUZZER, 1318, 70); delay(80);
    tone(PIN_BUZZER, 1760, 120);
  } else if (expr == "talking") {
    tone(PIN_BUZZER, 900, 40); delay(50);
    tone(PIN_BUZZER, 1200, 40);
  } else if (expr == "boot") {
    // Nada jingle saat robot pertama kali menyala
    tone(PIN_BUZZER, 523, 80); delay(90);
    tone(PIN_BUZZER, 659, 80); delay(90);
    tone(PIN_BUZZER, 784, 80); delay(90);
    tone(PIN_BUZZER, 1046, 140);
  } else {
    tone(PIN_BUZZER, 1200, 50);
  }
}

// ==============================================================================
// 8-BIT CHIPTUNE RETRO SYNTHESIZER ENGINE (UNTUK BUZZER)
// ==============================================================================
// 1. Melodi Chime Ramah (Moci Friendly Chime) — Persis frekuensi & tempo audio.js
// Notes: C5 (523Hz), D5 (587Hz), E5 (659Hz), G5 (784Hz), A5 (880Hz), C6 (1046Hz) @ 400ms
const uint16_t MELODY_CHIME[] = {
  523, 360,   587, 360,   659, 360,   784, 360,   880, 360,  1046, 500,
    0, 150,  1046, 360,   880, 360,   784, 360,   659, 360,   587, 360,   523, 500
};

// 2. Melodi Lo-Fi Santai (Cyberpunk Lo-Fi Chill) — Persis progresi akor audio.js
// Akor: Cmaj7 (262, 330, 392, 494), Am7 (220, 262, 330, 392), Fmaj7 (175, 220, 262, 330), G7 (196, 247, 294, 392)
const uint16_t MELODY_LOFI[] = {
  262, 380,   330, 380,   392, 380,   494, 550,
  220, 380,   262, 380,   330, 380,   392, 550,
  175, 380,   220, 380,   262, 380,   330, 550,
  196, 380,   247, 380,   294, 380,   392, 550
};

// 3. Melodi 8-Bit Petualangan Retro (8-Bit Robot Adventure) — Persis nada & tempo 180ms audio.js
// Melody: [440, 440, 554, 659, 880, 659, 554, 440, 392, 493, 587, 783, 587, 493]
const uint16_t MELODY_ADVENTURE[] = {
  440, 150,   440, 150,   554, 150,   659, 150,
  880, 160,   659, 150,   554, 150,   440, 160,
  392, 150,   493, 150,   587, 150,   783, 160,
  587, 150,   493, 160
};

bool isMusicPlaying = false;
bool isShowingPhoto = false;
int currentMusicNoteIndex = 0;
unsigned long nextNotePlayTime = 0;
String currentTrackTitle = "";

const uint16_t* activeMelody = MELODY_ADVENTURE;
int activeMelodyLength = sizeof(MELODY_ADVENTURE) / (sizeof(uint16_t) * 2);

void startMusicPlayback(String title) {
  isMusicPlaying = true;
  isShowingPhoto = false;
  currentMusicNoteIndex = 0;
  nextNotePlayTime = millis();
  currentTrackTitle = title;

  String tLower = title;
  tLower.toLowerCase();

  // Pilih variasi melodi 8-bit sesuai lagu yang diputar di Web Moci
  if (tLower.indexOf("chime") >= 0) {
    activeMelody = MELODY_CHIME;
    activeMelodyLength = sizeof(MELODY_CHIME) / (sizeof(uint16_t) * 2);
  } else if (tLower.indexOf("lofi") >= 0 || tLower.indexOf("lo-fi") >= 0 || tLower.indexOf("chill") >= 0) {
    activeMelody = MELODY_LOFI;
    activeMelodyLength = sizeof(MELODY_LOFI) / (sizeof(uint16_t) * 2);
  } else {
    activeMelody = MELODY_ADVENTURE;
    activeMelodyLength = sizeof(MELODY_ADVENTURE) / (sizeof(uint16_t) * 2);
  }

  currentExpression = "singing";
  drawEyes("singing");
  Serial.printf("[Music] Memutar melodi 8-bit untuk: %s\n", title.c_str());
}

void stopMusicPlayback() {
  if (isMusicPlaying) {
    isMusicPlaying = false;
    noTone(PIN_BUZZER);
    currentExpression = "happy";
    drawEyes("happy");
    Serial.println("[Music] Pemutaran musik dihentikan.");
  }
}

void updateMusicEngine() {
  if (!isMusicPlaying) return;

  unsigned long now = millis();
  if (now >= nextNotePlayTime) {
    if (currentMusicNoteIndex >= activeMelodyLength) {
      currentMusicNoteIndex = 0; // Loop melodi 8-bit berulang
    }

    uint16_t freq = activeMelody[currentMusicNoteIndex * 2];
    uint16_t dur  = activeMelody[currentMusicNoteIndex * 2 + 1];

    if (freq > 0) {
      tone(PIN_BUZZER, freq, dur);
    } else {
      noTone(PIN_BUZZER);
    }

    nextNotePlayTime = now + dur + 30; // Sedikit jeda staccato khas musik 8-bit
    currentMusicNoteIndex++;
  }
}

// ==============================================================================
// 3. FUNGSI GAMBAR EKSPRESI DI LAYAR TFT 1.8" (128x160) PERSIS DENGAN WEB MOCI
// ==============================================================================
void drawEyes(String expr) {
  isShowingPhoto = false;
  // Latar belakang utama layar
  tft.fillScreen(ST77XX_BLACK);

  // -------------------------------------------------------------
  // A. STATUS BAR ATAS (Sama persis dengan Simulator Web)
  // -------------------------------------------------------------
  tft.setTextSize(1);
  tft.setTextColor(0xAD55, ST77XX_BLACK); // Teks abu-abu terang
  tft.setCursor(6, 6);
  tft.print("ESP32-S3");

  // Nama ekspresi aktif di pojok kanan atas (Kapital Cyan)
  String exprUpper = expr;
  exprUpper.toUpperCase();
  tft.setTextColor(0x07E0, ST77XX_BLACK); // Mint green cerah
  int nameX = 122 - (exprUpper.length() * 6);
  tft.setCursor(nameX, 6);
  tft.print(exprUpper);

  // Garis pemisah status bar
  tft.drawFastHLine(4, 18, 120, 0x2187);

  // -------------------------------------------------------------
  // B. BINGKAI BEZEL LAYAR ROBOT MOCI (moci-screen-bezel)
  // -------------------------------------------------------------
  int bX = 6, bY = 24, bW = 116, bH = 98, bR = 12;
  // Frame bezel ganda dengan aksen cyan glow
  tft.drawRoundRect(bX, bY, bW, bH, bR, 0x1A6E);
  tft.drawRoundRect(bX + 1, bY + 1, bW - 2, bH - 2, bR - 1, 0x028A);
  // Area dalam bezel hitam pekat OLED
  tft.fillRoundRect(bX + 2, bY + 2, bW - 4, bH - 4, bR - 2, ST77XX_BLACK);

  // -------------------------------------------------------------
  // C. MATA, PIPI BLUSH, & MULUT MOCI
  // -------------------------------------------------------------
  int lX = 30; // Posisi X mata kiri
  int rX = 74; // Posisi X mata kanan
  int eyeY = 46;
  int eyeW = 24;
  int eyeH = 36;
  int eyeR = 12;

  // Warna default mata mint green (#00f5d4)
  uint16_t eyeColor = 0x07E0;
  bool showCheeks = false;
  bool showMouth = true;

  if (expr == "happy") {
    eyeColor = 0x07E0;
    showCheeks = true;
    showMouth = true;

    // Mata senyum melengkung ke atas (Happy Arc Eyes)
    tft.fillRoundRect(lX, eyeY + 8, eyeW, 22, 11, eyeColor);
    tft.fillRoundRect(rX, eyeY + 8, eyeW, 22, 11, eyeColor);
    // Potong bagian bawah agar melengkung seperti senyum
    tft.fillRect(lX, eyeY + 18, eyeW, 14, ST77XX_BLACK);
    tft.fillRect(rX, eyeY + 18, eyeW, 14, ST77XX_BLACK);
    // Kilau mata
    tft.fillCircle(lX + 16, eyeY + 13, 3, ST77XX_WHITE);
    tft.fillCircle(rX + 16, eyeY + 13, 3, ST77XX_WHITE);

    // Mulut senyum manis
    tft.fillRoundRect(56, 90, 16, 3, 1, eyeColor);
  }
  else if (expr == "sad") {
    eyeColor = ST77XX_BLUE;
    showCheeks = false;

    // Mata murung melengkung ke bawah
    tft.fillRoundRect(lX, eyeY + 4, eyeW, 24, 11, eyeColor);
    tft.fillRoundRect(rX, eyeY + 4, eyeW, 24, 11, eyeColor);
    tft.fillRect(lX, eyeY + 4, eyeW, 10, ST77XX_BLACK);
    tft.fillRect(rX, eyeY + 4, eyeW, 10, ST77XX_BLACK);
    // Tetesan air mata
    tft.fillCircle(lX + 10, eyeY + 34, 3, ST77XX_CYAN);

    // Mulut melengkung sedih
    tft.fillRoundRect(58, 93, 12, 3, 1, eyeColor);
  }
  else if (expr == "angry") {
    eyeColor = ST77XX_RED;
    showCheeks = false;

    // Alis miring tajam
    for (int i = 0; i < 4; i++) {
      tft.drawLine(lX, eyeY + i, lX + eyeW, eyeY + 12 + i, eyeColor);
      tft.drawLine(rX, eyeY + 12 + i, rX + eyeW, eyeY + i, eyeColor);
    }
    // Mata merah tajam
    tft.fillRoundRect(lX + 2, eyeY + 10, eyeW - 4, 18, 5, eyeColor);
    tft.fillRoundRect(rX + 2, eyeY + 10, eyeW - 4, 18, 5, eyeColor);

    // Mulut geram datar
    tft.fillRoundRect(56, 92, 16, 3, 1, eyeColor);
  }
  else if (expr == "surprised") {
    eyeColor = ST77XX_YELLOW;
    showCheeks = false;

    // Mata bulat besar terkejut
    tft.drawRoundRect(lX, eyeY + 2, eyeW, 32, 12, eyeColor);
    tft.drawRoundRect(lX + 1, eyeY + 3, eyeW - 2, 30, 11, eyeColor);
    tft.drawRoundRect(rX, eyeY + 2, eyeW, 32, 12, eyeColor);
    tft.drawRoundRect(rX + 1, eyeY + 3, eyeW - 2, 30, 11, eyeColor);

    // Mulut bulat "O"
    tft.drawCircle(64, 91, 7, eyeColor);
    tft.drawCircle(64, 91, 6, eyeColor);
  }
  else if (expr == "sleepy" || expr == "sleep") {
    eyeColor = 0x7BEF;
    showCheeks = false;

    // Mata garis terpejam
    tft.fillRoundRect(lX, eyeY + 18, eyeW, 4, 2, eyeColor);
    tft.fillRoundRect(rX, eyeY + 18, eyeW, 4, 2, eyeColor);

    // Teks Zzz melayang
    tft.setTextSize(1);
    tft.setTextColor(ST77XX_WHITE, ST77XX_BLACK);
    tft.setCursor(56, 88);
    tft.print("z Z z");
  }
  else if (expr == "love") {
    eyeColor = ST77XX_MAGENTA;
    showCheeks = true;

    // Mata bentuk hati cinta (Kiri)
    tft.fillCircle(lX + 6, eyeY + 12, 6, eyeColor);
    tft.fillCircle(lX + 16, eyeY + 12, 6, eyeColor);
    tft.fillTriangle(lX, eyeY + 14, lX + 22, eyeY + 14, lX + 11, eyeY + 28, eyeColor);

    // Mata bentuk hati cinta (Kanan)
    tft.fillCircle(rX + 6, eyeY + 12, 6, eyeColor);
    tft.fillCircle(rX + 16, eyeY + 12, 6, eyeColor);
    tft.fillTriangle(rX, eyeY + 14, rX + 22, eyeY + 14, rX + 11, eyeY + 28, eyeColor);

    // Mulut senyum manis
    tft.fillRoundRect(57, 91, 14, 3, 1, ST77XX_WHITE);
  }
  else if (expr == "wink") {
    eyeColor = 0x07E0;
    showCheeks = true;

    // Mata kiri mengedip (garis senyum)
    tft.fillRoundRect(lX, eyeY + 18, eyeW, 4, 2, eyeColor);
    // Mata kanan terbuka ceria
    tft.fillRoundRect(rX, eyeY + 4, eyeW, eyeH - 4, eyeR, eyeColor);
    tft.fillCircle(rX + 16, eyeY + 12, 3, ST77XX_WHITE);

    // Mulut senyum
    tft.fillRoundRect(56, 91, 15, 3, 1, eyeColor);
  }
  else if (expr == "singing") {
    eyeColor = 0x07E0;
    showCheeks = true;

    // Mata melengkung senang bernyanyi
    tft.fillRoundRect(lX, eyeY + 8, eyeW, 20, 10, eyeColor);
    tft.fillRoundRect(rX, eyeY + 8, eyeW, 20, 10, eyeColor);
    tft.fillRect(lX, eyeY + 17, eyeW, 12, ST77XX_BLACK);
    tft.fillRect(rX, eyeY + 17, eyeW, 12, ST77XX_BLACK);

    // Mulut bernyanyi terbuka (oval "O")
    tft.fillRoundRect(56, 82, 16, 20, 7, ST77XX_WHITE);
    tft.fillRoundRect(59, 86, 10, 13, 5, ST77XX_RED);

    // Notasi musik di atas mata
    tft.setTextSize(1);
    tft.setTextColor(ST77XX_YELLOW, ST77XX_BLACK);
    tft.setCursor(54, 32);
    tft.print("~ * ~");
  }
  else if (expr == "talking") {
    eyeColor = 0x07E0;
    showCheeks = true;

    // Mata terbuka ramah
    tft.fillRoundRect(lX, eyeY + 4, eyeW, eyeH - 4, eyeR, eyeColor);
    tft.fillRoundRect(rX, eyeY + 4, eyeW, eyeH - 4, eyeR, eyeColor);
    tft.fillCircle(lX + 16, eyeY + 12, 3, ST77XX_WHITE);
    tft.fillCircle(rX + 16, eyeY + 12, 3, ST77XX_WHITE);

    // Mulut berbicara terbuka
    tft.fillRoundRect(53, 86, 22, 12, 4, ST77XX_WHITE);
    tft.fillRoundRect(56, 89, 16, 6, 2, ST77XX_RED);
  }
  else { // Default Neutral / Standby
    eyeColor = 0x07E0;
    showCheeks = true;
    showMouth = true;

    // Kapsul mata robot stadium shape
    tft.fillRoundRect(lX, eyeY + 2, eyeW, eyeH, eyeR, eyeColor);
    tft.fillRoundRect(rX, eyeY + 2, eyeW, eyeH, eyeR, eyeColor);

    // Kilau mata ganda (Glossy specular highlights)
    tft.fillCircle(lX + 16, eyeY + 10, 3, ST77XX_WHITE);
    tft.fillCircle(rX + 16, eyeY + 10, 3, ST77XX_WHITE);
    tft.fillCircle(lX + 6, eyeY + 24, 2, ST77XX_WHITE);
    tft.fillCircle(rX + 6, eyeY + 24, 2, ST77XX_WHITE);

    // Garis mulut netral
    tft.fillRoundRect(57, 91, 14, 2, 1, eyeColor);
  }

  // Gambar Pipi Blush Pink (Kawaii Rosy Cheeks)
  if (showCheeks) {
    uint16_t blushColor = 0xFC72; // Pink blush lembut
    tft.fillRoundRect(lX - 6, eyeY + 34, 12, 5, 2, blushColor);
    tft.fillRoundRect(rX + eyeW - 6, eyeY + 34, 12, 5, 2, blushColor);
  }

  // -------------------------------------------------------------
  // D. STATUS FOOTER BAWAH (Sama dengan Simulator Web)
  // -------------------------------------------------------------
  tft.setTextSize(1);
  tft.setTextColor(0x07E0, ST77XX_BLACK); // Mint green monospace
  tft.setCursor(18, 132);
  tft.print("STATUS: STANDBY");

  // Jika ada teks pesan dari Web, tampilkan kotak percakapan di bawah
  if (lastSpokenText.length() > 0) {
    tft.fillRoundRect(4, 144, 120, 15, 3, 0x1927);
    tft.setTextColor(ST77XX_WHITE, 0x1927);
    tft.setCursor(8, 148);
    String msg = lastSpokenText;
    if (msg.length() > 18) msg = msg.substring(0, 15) + "...";
    tft.print(msg);
  } else {
    // Info WiFi / USB di bawah
    tft.setTextColor(0x52AA, ST77XX_BLACK);
    tft.setCursor(20, 147);
    tft.print(isConnectedToHomeWifi ? "WiFi Connected" : "AP: 192.168.4.1");
  }
}

// Efek kedip mata santai natural
void checkAutoBlink() {
  if (isShowingPhoto || isMusicPlaying || currentExpression == "sleepy" || currentExpression == "sleep") return;

  unsigned long now = millis();
  if (!isBlinking && (now - lastBlinkTime > 3800)) {
    isBlinking = true;
    lastBlinkTime = now;
    // Tutup mata sejenak
    int lX = 30; int rX = 74; int eyeW = 24; int eyeY = 46; int eyeH = 36;
    tft.fillRect(lX - 2, eyeY, eyeW + 4, eyeH + 4, ST77XX_BLACK);
    tft.fillRect(rX - 2, eyeY, eyeW + 4, eyeH + 4, ST77XX_BLACK);
    tft.fillRoundRect(lX, eyeY + 18, eyeW, 4, 2, 0x07E0);
    tft.fillRoundRect(rX, eyeY + 18, eyeW, 4, 2, 0x07E0);
  } 
  else if (isBlinking && (now - lastBlinkTime > 160)) {
    isBlinking = false;
    lastBlinkTime = now;
    drawEyes(currentExpression);
  }
}

// ==============================================================================
// 4. REST API & CORS HELPER (UNTUK KONEKSI WEB BROWSER)
// ==============================================================================
void setCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
}

void handleOptions() {
  setCorsHeaders();
  server.send(204);
}

void handleStatus() {
  setCorsHeaders();
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  DynamicJsonDocument doc(1024);
#endif
  doc["type"] = "wifi";
  doc["isConnected"] = true;
  doc["robotName"] = "Moci";
  doc["expression"] = currentExpression;

  JsonObject hw = doc["hardware"].to<JsonObject>();
  hw["mcu"] = "ESP32-S3 N16R8";
  hw["display"] = "TFT 1.8\" 128x160 ST7735 (Aktif)";
  hw["batteryVoltage"] = "5.0V USB Power";

  JsonObject wf = doc["wifi"].to<JsonObject>();
  wf["connected"] = isConnectedToHomeWifi;
  wf["ssid"] = isConnectedToHomeWifi ? WiFi.SSID() : AP_SSID;
  wf["ip"] = isConnectedToHomeWifi ? WiFi.localIP().toString() : WiFi.softAPIP().toString();

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

void handlePing() {
  setCorsHeaders();
  server.send(200, "application/json", "{\"success\":true,\"ok\":true,\"message\":\"Pong dari Layar ESP32-S3 Moci!\"}");
}

void handleExpression() {
  setCorsHeaders();
  if (server.hasArg("plain")) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    DynamicJsonDocument doc(256);
#endif
    deserializeJson(doc, server.arg("plain"));
    String expr = doc["expression"] | doc["val"] | "happy";
    currentExpression = expr;
    drawEyes(currentExpression);
    playBuzzerChirp(currentExpression);
    Serial.printf("[Web REST] Ekspresi layar berganti ke: %s\n", currentExpression.c_str());
  }
  server.send(200, "application/json", "{\"success\":true,\"expression\":\"" + currentExpression + "\"}");
}

void handleSpeak() {
  setCorsHeaders();
  if (server.hasArg("plain")) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    DynamicJsonDocument doc(512);
#endif
    deserializeJson(doc, server.arg("plain"));
    lastSpokenText = doc["text"].as<String>();
    currentExpression = "talking";
    drawEyes(currentExpression);
    playBuzzerChirp("talking");
    Serial.printf("[Web REST Speak] \"%s\"\n", lastSpokenText.c_str());
  }
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Pesan tampil di layar TFT!\"}");
}

// Menampilkan Mode Foto di Layar TFT (Sama Persis dengan Foto di Web Moci)
void displayPhotoFrame(String photoName) {
  isShowingPhoto = true;

  String pLower = photoName;
  pLower.toLowerCase();

  // 1. FOTO 1: Moci Robot Concept / Moci Explorer (Warna Mint Cyan #00f5d4, Ikon 🤖)
  if (pLower.indexOf("concept") >= 0 || pLower.indexOf("explorer") >= 0 || pLower.indexOf("robot") >= 0 && pLower.indexOf("pixel") < 0) {
    tft.fillScreen(0x0864); // Dark Navy BG #0a0f1d
    uint16_t accent = 0x07E0; // Mint Cyan

    // Glow lingkaran tengah
    tft.fillCircle(64, 60, 34, 0x0248);
    // Bingkai luar (Dashed border di web)
    tft.drawRoundRect(6, 6, 116, 148, 6, accent);

    // Gambar Robot Moci (🤖)
    // Antena
    tft.drawFastVLine(64, 30, 8, accent);
    tft.fillCircle(64, 28, 3, accent);
    // Kepala
    tft.fillRoundRect(42, 38, 44, 34, 8, 0x1A8D);
    tft.drawRoundRect(42, 38, 44, 34, 8, accent);
    // Layar muka hitam
    tft.fillRoundRect(46, 42, 36, 26, 5, ST77XX_BLACK);
    // Sepasang mata mint
    tft.fillRoundRect(50, 48, 8, 12, 4, accent);
    tft.fillRoundRect(70, 48, 8, 12, 4, accent);
    // Pipi pink blush
    tft.fillCircle(48, 62, 2, 0xFC72);
    tft.fillCircle(80, 62, 2, 0xFC72);
    // Senyum manis
    tft.drawFastHLine(60, 62, 8, accent);

    // Teks Informasi Foto (Persis dengan SVG Web)
    tft.setTextSize(1);
    tft.setTextColor(ST77XX_WHITE, 0x0864);
    tft.setCursor(20, 102);
    tft.print("MOCI EXPLORER");

    tft.setTextColor(accent, 0x0864);
    tft.setCursor(26, 118);
    tft.print("128 x 160 TFT");

    tft.setTextColor(0x5A75, 0x0864);
    tft.setCursor(32, 136);
    tft.print("ROBOT MOCI");
  }
  // 2. FOTO 2: Cyber City Landscape / Cyber Cityscape (Warna Sky Blue #00bbf9, Ikon 🌆)
  else if (pLower.indexOf("cyber") >= 0 || pLower.indexOf("city") >= 0 || pLower.indexOf("landscape") >= 0) {
    tft.fillScreen(0x1116); // Dark Slate Blue #17233d
    uint16_t accent = 0x05DF; // Sky Blue

    // Glow tengah
    tft.fillCircle(64, 55, 34, 0x0A57);
    tft.drawRoundRect(6, 6, 116, 148, 6, accent);

    // Gambar Pemandangan Kota Malam (🌆)
    // Bulan sabit kuning
    tft.fillCircle(30, 36, 8, ST77XX_YELLOW);
    tft.fillCircle(33, 34, 6, 0x1116);

    // Gedung-gedung pencakar langit
    tft.fillRect(22, 54, 18, 38, 0x08CD); // Gedung 1
    tft.fillRect(44, 38, 22, 54, 0x028A); // Gedung 2 utama
    tft.drawFastVLine(55, 28, 10, ST77XX_RED);
    tft.fillCircle(55, 27, 2, ST77XX_RED); // Lampu puncak menara
    tft.fillRect(70, 48, 20, 44, 0x0A6E); // Gedung 3
    tft.fillRect(94, 60, 16, 32, 0x08CD); // Gedung 4

    // Jendela-jendela kota menyala
    tft.fillRect(48, 44, 3, 3, ST77XX_YELLOW);
    tft.fillRect(58, 44, 3, 3, ST77XX_YELLOW);
    tft.fillRect(48, 54, 3, 3, ST77XX_CYAN);
    tft.fillRect(76, 54, 3, 3, ST77XX_YELLOW);
    tft.fillRect(76, 64, 3, 3, ST77XX_CYAN);
    tft.fillRect(26, 62, 3, 3, ST77XX_YELLOW);

    // Teks Informasi Foto
    tft.setTextSize(1);
    tft.setTextColor(ST77XX_WHITE, 0x1116);
    tft.setCursor(16, 102);
    tft.print("CYBER CITYSCAPE");

    tft.setTextColor(accent, 0x1116);
    tft.setCursor(26, 118);
    tft.print("128 x 160 TFT");

    tft.setTextColor(0x5A75, 0x1116);
    tft.setCursor(32, 136);
    tft.print("ROBOT MOCI");
  }
  // 3. FOTO 3: Moci Pixel Art Portrait (Warna Coral Red #ff6b6b, Ikon 👾)
  else if (pLower.indexOf("pixel") >= 0 || pLower.indexOf("portrait") >= 0) {
    tft.fillScreen(0x10E7); // Dark Indigo #111a2e
    uint16_t accent = 0xFB6D; // Coral Red

    tft.fillCircle(64, 60, 34, 0x3867);
    tft.drawRoundRect(6, 6, 116, 148, 6, accent);

    // Gambar Karakter Pixel Art Retro (👾)
    // Blok-blok pixel art (skala 4x4)
    int pX = 40, pY = 38;
    // Antena pixel
    tft.fillRect(pX + 8, pY, 6, 6, accent);
    tft.fillRect(pX + 34, pY, 6, 6, accent);
    // Kepala pixel
    tft.fillRect(pX + 10, pY + 8, 28, 28, accent);
    tft.fillRect(pX + 4, pY + 14, 40, 16, accent);
    // Mata pixel putih
    tft.fillRect(pX + 12, pY + 18, 6, 8, ST77XX_WHITE);
    tft.fillRect(pX + 30, pY + 18, 6, 8, ST77XX_WHITE);
    // Mulut pixel hitam
    tft.fillRect(pX + 18, pY + 28, 12, 4, ST77XX_BLACK);

    // Teks Informasi Foto
    tft.setTextSize(1);
    tft.setTextColor(ST77XX_WHITE, 0x10E7);
    tft.setCursor(22, 102);
    tft.print("PIXEL MOCI ART");

    tft.setTextColor(accent, 0x10E7);
    tft.setCursor(26, 118);
    tft.print("128 x 160 TFT");

    tft.setTextColor(0x5A75, 0x10E7);
    tft.setCursor(32, 136);
    tft.print("ROBOT MOCI");
  }
  // 4. FOTO 4: Retro Synthesizer Grid (Warna Golden Yellow #ffd166, Ikon 🎛️)
  else if (pLower.indexOf("synth") >= 0 || pLower.indexOf("grid") >= 0) {
    tft.fillScreen(0x0884); // Deep Dark BG #090e1a
    uint16_t accent = ST77XX_YELLOW;

    tft.fillCircle(64, 60, 34, 0x2964);
    tft.drawRoundRect(6, 6, 116, 148, 6, accent);

    // Gambar Equalizer Spectrum Synthesizer (🎛️)
    tft.fillRect(26, 62, 8, 26, ST77XX_GREEN);
    tft.fillRect(38, 48, 8, 40, ST77XX_GREEN);
    tft.fillRect(50, 34, 8, 54, ST77XX_YELLOW);
    tft.fillRect(62, 40, 8, 48, ST77XX_YELLOW);
    tft.fillRect(74, 52, 8, 36, ST77XX_GREEN);
    tft.fillRect(86, 66, 8, 22, ST77XX_GREEN);

    // Garis base grid
    tft.drawFastHLine(20, 90, 88, accent);

    // Teks Informasi Foto
    tft.setTextSize(1);
    tft.setTextColor(ST77XX_WHITE, 0x0884);
    tft.setCursor(14, 102);
    tft.print("RETRO GRID SOUND");

    tft.setTextColor(accent, 0x0884);
    tft.setCursor(26, 118);
    tft.print("128 x 160 TFT");

    tft.setTextColor(0x5A75, 0x0884);
    tft.setCursor(32, 136);
    tft.print("ROBOT MOCI");
  }
  // 5. FOTO KUSTOM / UMUM LAINNYA
  else {
    tft.fillScreen(0x08A3);
    uint16_t accent = ST77XX_CYAN;

    tft.drawRoundRect(6, 6, 116, 148, 6, accent);
    tft.drawRoundRect(8, 24, 112, 70, 5, ST77XX_WHITE);
    tft.fillRect(10, 26, 108, 66, ST77XX_BLACK);

    // Ikon Kamera
    tft.drawRoundRect(46, 44, 36, 24, 4, ST77XX_CYAN);
    tft.fillCircle(64, 56, 7, ST77XX_CYAN);
    tft.fillCircle(64, 56, 4, ST77XX_BLACK);
    tft.fillRect(58, 40, 12, 4, ST77XX_CYAN);

    // Label nama foto
    tft.setTextSize(1);
    tft.setTextColor(ST77XX_WHITE, 0x08A3);
    tft.setCursor(14, 104);
    String cleanName = photoName;
    if (cleanName.length() > 16) cleanName = cleanName.substring(0, 13) + "...";
    tft.print(cleanName);

    tft.setTextColor(accent, 0x08A3);
    tft.setCursor(26, 118);
    tft.print("128 x 160 TFT");

    tft.setTextColor(0x5A75, 0x08A3);
    tft.setCursor(32, 136);
    tft.print("ROBOT MOCI");
  }
}

void handleDisplayPhoto() {
  setCorsHeaders();
  String pName = "Foto Moci";
  if (server.hasArg("plain")) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    DynamicJsonDocument doc(512);
#endif
    deserializeJson(doc, server.arg("plain"));
    pName = doc["filename"] | doc["name"] | "Foto Moci";
  }
  displayPhotoFrame(pName);
  playBuzzerChirp("happy");
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Foto ditampilkan di TFT!\"}");
}

void handleAudioPlay() {
  setCorsHeaders();
  String trackTitle = "8-Bit Track";
  if (server.hasArg("plain")) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
#else
    DynamicJsonDocument doc(512);
#endif
    deserializeJson(doc, server.arg("plain"));
    trackTitle = doc["filename"] | doc["trackId"] | "8-Bit Track";
  }
  startMusicPlayback(trackTitle);
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Musik 8-bit diputar di buzzer!\"}");
}

void handleAudioStop() {
  setCorsHeaders();
  stopMusicPlayback();
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Musik dihentikan.\"}");
}

// ==============================================================================
// 5. PARSER WEB SERIAL USB CDC (KONEKSI KABEL USB LANGSUNG DI CHROME / EDGE)
// ==============================================================================
void processSerialCommand(String line) {
  line.trim();
  if (!line.startsWith("{")) return;

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  DynamicJsonDocument doc(512);
#endif
  if (deserializeJson(doc, line) != DeserializationError::Ok) return;

  const char* cmd = doc["cmd"];
  if (!cmd) return;

  if (strcmp(cmd, "ping") == 0) {
    playBuzzerChirp("chirp");
    Serial.println("{\"type\":\"pong\",\"status\":\"ok\"}");
  } 
  else if (strcmp(cmd, "status") == 0) {
    Serial.printf("{\"type\":\"status\",\"robotName\":\"Moci\",\"expression\":\"%s\",\"screen\":\"ST7735\"}\n", currentExpression.c_str());
  }
  else if (strcmp(cmd, "expression") == 0) {
    if (isMusicPlaying) stopMusicPlayback();
    currentExpression = doc["expression"] | doc["val"] | "happy";
    drawEyes(currentExpression);
    playBuzzerChirp(currentExpression);
    Serial.printf("{\"success\":true,\"expression\":\"%s\"}\n", currentExpression.c_str());
  }
  else if (strcmp(cmd, "speak") == 0) {
    lastSpokenText = doc["text"] | "";
    currentExpression = "talking";
    drawEyes(currentExpression);
    playBuzzerChirp("talking");
    Serial.printf("{\"success\":true,\"speak\":\"%s\"}\n", lastSpokenText.c_str());
  }
  else if (strcmp(cmd, "photo") == 0) {
    if (isMusicPlaying) stopMusicPlayback();
    String pName = doc["name"] | doc["filename"] | "Foto Moci";
    displayPhotoFrame(pName);
    playBuzzerChirp("happy");
    Serial.printf("{\"success\":true,\"photo\":\"%s\"}\n", pName.c_str());
  }
  else if (strcmp(cmd, "play") == 0) {
    String trackTitle = doc["title"] | doc["filename"] | "8-Bit Robot Track";
    startMusicPlayback(trackTitle);
    Serial.printf("{\"success\":true,\"play\":\"%s\"}\n", trackTitle.c_str());
  }
  else if (strcmp(cmd, "stop") == 0) {
    stopMusicPlayback();
    Serial.println("{\"success\":true,\"stop\":true}");
  }
}

// ==============================================================================
// 6. SETUP & LOOP
// ==============================================================================
// Buffer manual untuk menerima baris Serial yang panjang (maks ~640 karakter untuk #ROW:)
#define SERIAL_BUF_SIZE 660
char serialBuf[SERIAL_BUF_SIZE];
int  serialBufPos = 0;

void setup() {
  Serial.setRxBufferSize(4096);  // Buffer besar agar data foto tidak overflow
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==========================================");
  Serial.println("   MOCI ROBOT — TES LAYAR + WEB SYNC");
  Serial.println("==========================================");

  // Inisialisasi Pin Buzzer
  pinMode(PIN_BUZZER, OUTPUT);
  playBuzzerChirp("boot"); // Bunyikan nada jingle pembuka

  // Inisialisasi SPI & Layar ST7735
  tftSPI.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.initR(INITR_BLACKTAB); // Standar TFT ST7735 1.8" (128x160)
  tft.setRotation(0);        // Orientasi Potret (128x160)
  
  // Tampilkan layar awal
  drawEyes("happy");
  Serial.println("[TFT] Layar ST7735 aktif.");
  Serial.println("[Buzzer] Modul Buzzer 3 Kaki di GPIO 18 aktif.");

  // Aktifkan Wi-Fi Access Point agar web bisa terhubung via Wi-Fi juga
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.printf("[WiFi] Access Point aktif: %s (IP: 192.168.4.1)\n", AP_SSID);

  // Daftarkan Endpoint Web Server REST API
  server.on("/api/status",         HTTP_OPTIONS, handleOptions);
  server.on("/api/status",         HTTP_GET,     handleStatus);
  server.on("/api/ping",           HTTP_OPTIONS, handleOptions);
  server.on("/api/ping",           HTTP_GET,     handlePing);
  server.on("/api/expression",     HTTP_OPTIONS, handleOptions);
  server.on("/api/expression",     HTTP_POST,    handleExpression);
  server.on("/api/speak",          HTTP_OPTIONS, handleOptions);
  server.on("/api/speak",          HTTP_POST,    handleSpeak);
  server.on("/api/display/photo",  HTTP_OPTIONS, handleOptions);
  server.on("/api/display/photo",  HTTP_POST,    handleDisplayPhoto);
  server.on("/api/audio/play",     HTTP_OPTIONS, handleOptions);
  server.on("/api/audio/play",     HTTP_POST,    handleAudioPlay);
  server.on("/api/audio/stop",     HTTP_OPTIONS, handleOptions);
  server.on("/api/audio/stop",     HTTP_POST,    handleAudioStop);

  server.begin();
  Serial.println("[Server] HTTP REST Server aktif di port 80.");
  Serial.println("[Siap] Silakan buka Web Moci di browser!");
}

// Proses satu baris lengkap yang sudah diterima
void processSerialLine(char* buf, int len) {
  // Trim trailing \r\n
  while (len > 0 && (buf[len-1] == '\r' || buf[len-1] == '\n')) len--;
  buf[len] = '\0';
  if (len == 0) return;

  // 1. Penerima Streaming Foto Nyata dari Browser Web Moci
  if (strncmp(buf, "#IMG:START", 10) == 0) {
    isShowingPhoto = true;
    if (isMusicPlaying) stopMusicPlayback();
    tft.fillScreen(ST77XX_BLACK);
    Serial.println("{\"success\":true,\"img\":\"receiving\"}");
    return;
  }
  else if (strncmp(buf, "#ROW:", 5) == 0) {
    isShowingPhoto = true;
    // Format: #ROW:y:xxxxxxxx...
    char* p = buf + 5;
    int y = 0;
    while (*p && *p != ':') { y = y * 10 + (*p - '0'); p++; }
    if (*p == ':') p++; // lewati ':' kedua
    if (y >= 0 && y < 160) {
      uint16_t rowPixels[128];
      int x = 0;
      while (*p && *(p+1) && *(p+2) && *(p+3) && x < 128) {
        auto hv = [](char c) -> uint8_t {
          if (c >= '0' && c <= '9') return c - '0';
          if (c >= 'a' && c <= 'f') return c - 'a' + 10;
          if (c >= 'A' && c <= 'F') return c - 'A' + 10;
          return 0;
        };
        rowPixels[x++] = ((uint16_t)hv(p[0]) << 12) | ((uint16_t)hv(p[1]) << 8) | ((uint16_t)hv(p[2]) << 4) | hv(p[3]);
        p += 4;
      }
      tft.drawRGBBitmap(0, y, rowPixels, x, 1);
    }
    return;
  }
  else if (strncmp(buf, "#IMG:END", 8) == 0) {
    isShowingPhoto = true;
    playBuzzerChirp("happy");
    Serial.println("{\"success\":true,\"img\":\"rendered\"}");
    return;
  }

  // 2. Perintah Serial JSON Normal
  String strLine(buf);
  processSerialCommand(strLine);
}

void loop() {
  // Layani koneksi Wi-Fi REST
  server.handleClient();

  // Layani koneksi Web Serial USB CDC — baca karakter per karakter ke buffer manual
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      // Baris lengkap diterima — proses sekarang
      processSerialLine(serialBuf, serialBufPos);
      serialBufPos = 0; // Reset buffer
    } else if (c != '\r') {
      // Tambahkan karakter ke buffer (jangan simpan \r)
      if (serialBufPos < SERIAL_BUF_SIZE - 1) {
        serialBuf[serialBufPos++] = c;
      }
      // Jika buffer penuh (seharusnya tidak terjadi), proses paksa
      else {
        processSerialLine(serialBuf, serialBufPos);
        serialBufPos = 0;
      }
    }
  }

  // Engine pemutar musik 8-bit retro di buzzer (non-blocking)
  updateMusicEngine();

  // Efek kedip mata alami jika tidak sedang memutar musik atau menampilkan foto
  if (!isMusicPlaying && !isShowingPhoto) {
    checkAutoBlink();
  }
}
