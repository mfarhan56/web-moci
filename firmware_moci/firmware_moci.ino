/* ==============================================================================
 * MOCI ROBOT COMPANION — FIRMWARE LENGKAP v1.0
 * Target: ESP32-S3 N16R8 (16MB Flash, 8MB PSRAM)
 * ==============================================================================
 * Hardware:
 *   1. ESP32-S3 N16R8
 *   2. TP4056 USB-C Charger + Proteksi
 *   3. Baterai Li-Po 803450 3.7V 2500mAh
 *   4. MT3608 Step-Up Boost Converter (Set output 5.0V)
 *   5. INMP441 I2S Microphone
 *   6. Layar TFT 1.8" ST7735 128x160 SPI
 *   7. Modul Micro SD Card SPI
 *   8. Speaker 8Ω 2W
 *   9. Potensiometer B100K (Pengatur Volume Analog ADC)
 *  10. MAX98357A I2S Amplifier
 *  11. 4 Tombol Fisik (Mode, OK, Next, Power)
 * 
 * Library yang dibutuhkan (Install via Arduino Library Manager):
 *   - ArduinoJson (by Benoit Blanchon) v7.x
 *   - WebSockets (by Markus Sattler)
 *   - ESP32-audioI2S (by schreibfaul1)
 *   - TFT_eSPI (by Bodmer)
 * ==============================================================================*/

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <SD.h>
#include <SPI.h>
#include <Audio.h>
#include <TFT_eSPI.h>

// ============================================================
// KONFIGURASI PIN ESP32-S3
// ============================================================
// --- SD Card SPI (Berbagi bus HSPI/VSPI atau pin custom) ---
#define SD_CS         10

// --- MAX98357A I2S DAC (Speaker) ---
#define I2S_BCLK      41
#define I2S_LRC       42
#define I2S_DOUT      40

// --- INMP441 I2S Mic ---
#define I2S_MIC_SCK   38
#define I2S_MIC_WS    39
#define I2S_MIC_SD    37

// --- 4 Tombol Fisik (INPUT_PULLUP) ---
#define PIN_BTN_MODE  0   // B1: Switch Mode Carousel (Home/Music/Photo/Alarm/Status)
#define PIN_BTN_OK    4   // B2: OK / Play-Pause / Action
#define PIN_BTN_NEXT  5   // B3: Next Track / Next Photo
#define PIN_BTN_POWER 6   // B4: Screen Sleep / Toggle WiFi

// --- ADC Sensor ---
#define PIN_ADC_BAT   7   // Divider 100K:100K dari VBat (3.0V - 4.2V)
#define PIN_ADC_VOL   8   // Potensiometer B100K Center Pin

// ============================================================
// ENUM & DATA STRUKTUR
// ============================================================
enum RobotMode {
  MODE_HOME = 0,
  MODE_MUSIC,
  MODE_PHOTO,
  MODE_ALARM,
  MODE_STATUS,
  MODE_COUNT
};

const char* MODE_NAMES[] = {"Home", "Music", "Photo", "Alarm", "Status"};

enum Expression {
  EXPR_HAPPY = 0,
  EXPR_SAD,
  EXPR_ANGRY,
  EXPR_SURPRISED,
  EXPR_SLEEP,
  EXPR_LOVE,
  EXPR_WINK,
  EXPR_TALKING,
  EXPR_SINGING
};

const char* EXPR_NAMES[] = {"happy", "sad", "angry", "surprised", "sleep", "love", "wink", "talking", "singing"};

struct AlarmItem {
  String id;
  String time;
  String label;
  String sound;
  bool enabled;
  bool ringing;
};

// ============================================================
// GLOBAL OBJECTS & VARIABLES
// ============================================================
WebServer        server(80);
WebSocketsServer wsServer(81);
Preferences      prefs;
Audio            audio;
TFT_eSPI         tft = TFT_eSPI();

RobotMode   currentMode       = MODE_HOME;
Expression  currentExpr       = EXPR_HAPPY;
bool        tftSleeping       = false;
bool        wifiConnected     = false;
bool        sdMounted         = false;
bool        audioPlaying      = false;
String      currentTrackName  = "";
int         systemVolume      = 75; // 0-100%
float       batteryVoltage    = 3.85f;
int         batteryPercent    = 85;
unsigned long uptimeStart     = 0;

std::vector<AlarmItem> alarmList;
std::vector<String>    audioFiles;

// Timers
unsigned long lastStatusBroadcast = 0;
unsigned long lastBatteryCheck     = 0;
unsigned long lastPotRead          = 0;
unsigned long lastAlarmCheck       = 0;

// Button Debounce
struct BtnState {
  int pin;
  bool lastReading;
  bool state;
  unsigned long pressTime;
};
BtnState btns[4] = {
  {PIN_BTN_MODE, HIGH, HIGH, 0},
  {PIN_BTN_OK, HIGH, HIGH, 0},
  {PIN_BTN_NEXT, HIGH, HIGH, 0},
  {PIN_BTN_POWER, HIGH, HIGH, 0}
};

// ============================================================
// HELPER: CORS
// ============================================================
void setCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

void handleCorsPreflight() {
  setCorsHeaders();
  server.send(204);
}

// ============================================================
// TFT EXPRESSIONS & UI RENDERING
// ============================================================
void drawEyes(Expression expr) {
  if (tftSleeping) return;
  tft.fillScreen(TFT_BLACK);
  
  int eyeY = 60;
  int lX = 40;
  int rX = 88;
  int radius = 16;
  uint16_t color = TFT_CYAN;

  switch (expr) {
    case EXPR_HAPPY:
      color = 0x07E0; // Mint green
      tft.fillCircle(lX, eyeY, radius, color);
      tft.fillCircle(rX, eyeY, radius, color);
      tft.fillRect(lX - radius, eyeY, radius * 2, radius, TFT_BLACK); // Smile curved
      tft.fillRect(rX - radius, eyeY, radius * 2, radius, TFT_BLACK);
      break;

    case EXPR_SAD:
      color = TFT_BLUE;
      tft.fillCircle(lX, eyeY, radius, color);
      tft.fillCircle(rX, eyeY, radius, color);
      tft.fillRect(lX - radius, eyeY - radius, radius * 2, radius, TFT_BLACK);
      tft.fillRect(rX - radius, eyeY - radius, radius * 2, radius, TFT_BLACK);
      break;

    case EXPR_ANGRY:
      color = TFT_RED;
      for (int i = 0; i < 6; i++) {
        tft.drawLine(lX - radius, eyeY - radius + i, lX + radius, eyeY - 2 + i, color);
        tft.drawLine(rX - radius, eyeY - 2 + i, rX + radius, eyeY - radius + i, color);
      }
      tft.fillRect(lX - 8, eyeY, 16, 12, color);
      tft.fillRect(rX - 8, eyeY, 16, 12, color);
      break;

    case EXPR_SURPRISED:
      color = TFT_YELLOW;
      tft.drawCircle(lX, eyeY, radius + 2, color);
      tft.drawCircle(lX, eyeY, radius + 1, color);
      tft.drawCircle(rX, eyeY, radius + 2, color);
      tft.drawCircle(rX, eyeY, radius + 1, color);
      tft.drawCircle(64, 115, 8, color);
      break;

    case EXPR_SLEEP:
      color = TFT_DARKGREY;
      tft.fillRect(lX - radius, eyeY, radius * 2, 4, color);
      tft.fillRect(rX - radius, eyeY, radius * 2, 4, color);
      tft.setTextColor(TFT_WHITE);
      tft.drawString("z Z z", 64, 110, 2);
      break;

    case EXPR_LOVE:
      color = TFT_MAGENTA;
      tft.fillCircle(lX - 6, eyeY - 4, 8, color);
      tft.fillCircle(lX + 6, eyeY - 4, 8, color);
      tft.fillTriangle(lX - 14, eyeY - 2, lX + 14, eyeY - 2, lX, eyeY + 14, color);
      tft.fillCircle(rX - 6, eyeY - 4, 8, color);
      tft.fillCircle(rX + 6, eyeY - 4, 8, color);
      tft.fillTriangle(rX - 14, eyeY - 2, rX + 14, eyeY - 2, rX, eyeY + 14, color);
      break;

    case EXPR_TALKING:
      color = 0x07E0;
      tft.fillCircle(lX, eyeY, radius, color);
      tft.fillCircle(rX, eyeY, radius, color);
      tft.fillRect(lX - radius, eyeY, radius * 2, radius, TFT_BLACK);
      tft.fillRect(rX - radius, eyeY, radius * 2, radius, TFT_BLACK);
      tft.fillRoundRect(48, 105, 32, 14, 6, TFT_WHITE);
      tft.fillRoundRect(52, 108, 24, 8, 4, TFT_RED);
      break;

    case EXPR_SINGING:
      color = 0x07E0; // Mint green
      // Mata melengkung tersenyum ceria (Smile Eyes)
      tft.fillCircle(lX, eyeY, radius, color);
      tft.fillCircle(rX, eyeY, radius, color);
      tft.fillRect(lX - radius, eyeY, radius * 2, radius, TFT_BLACK);
      tft.fillRect(rX - radius, eyeY, radius * 2, radius, TFT_BLACK);
      // Mulut terbuka bernyanyi (O oval)
      tft.fillEllipse(64, 108, 12, 16, TFT_WHITE);
      tft.fillEllipse(64, 108, 8, 12, TFT_RED);
      // Tampilkan simbol nada musik di pojok
      tft.setTextColor(TFT_YELLOW, TFT_BLACK);
      tft.drawString("~ ♫ ~", 64, 25, 2);
      break;

    case EXPR_WINK:
    default:
      color = 0x07E0;
      tft.fillRect(lX - radius, eyeY, radius * 2, 4, color);
      tft.fillCircle(rX, eyeY, radius, color);
      tft.fillRect(rX - radius, eyeY, radius * 2, radius, TFT_BLACK);
      break;
  }
  currentExpr = expr;
}

void renderCurrentScreen() {
  if (tftSleeping) return;
  switch (currentMode) {
    case MODE_HOME:
      drawEyes(currentExpr);
      break;

    case MODE_MUSIC:
      tft.fillScreen(TFT_BLACK);
      tft.setTextDatum(TC_DATUM);
      tft.setTextColor(TFT_GREEN, TFT_BLACK);
      tft.drawString("PEMUTAR MUSIK", 64, 15, 2);
      tft.setTextColor(TFT_WHITE, TFT_BLACK);
      tft.drawString(audioPlaying ? "[MEMUTAR]" : "[PAUSE]", 64, 45, 2);
      tft.setTextColor(TFT_CYAN, TFT_BLACK);
      tft.drawString(currentTrackName.length() > 0 ? currentTrackName : "Belum Ada Lagu", 64, 80, 2);
      tft.setTextColor(TFT_YELLOW, TFT_BLACK);
      tft.drawString("Vol: " + String(systemVolume) + "%", 64, 120, 2);
      break;

    case MODE_ALARM:
      tft.fillScreen(TFT_BLACK);
      tft.setTextDatum(TC_DATUM);
      tft.setTextColor(TFT_YELLOW, TFT_BLACK);
      tft.drawString("STATUS ALARM", 64, 15, 2);
      tft.setTextColor(TFT_WHITE, TFT_BLACK);
      tft.drawString(String(alarmList.size()) + " Alarm Aktif", 64, 50, 2);
      if (alarmList.size() > 0) {
        tft.setTextColor(TFT_GREEN, TFT_BLACK);
        tft.drawString(alarmList[0].time + " - " + alarmList[0].label, 64, 85, 2);
      }
      break;

    case MODE_STATUS:
      tft.fillScreen(TFT_BLACK);
      tft.setTextDatum(TL_DATUM);
      tft.setTextColor(TFT_GREEN, TFT_BLACK);
      tft.drawString("MOCI SYSTEM INFO", 8, 10, 2);
      tft.setTextColor(TFT_WHITE, TFT_BLACK);
      tft.drawString("Baterai: " + String(batteryPercent) + "% (" + String(batteryVoltage, 2) + "V)", 8, 38, 1);
      tft.drawString("WiFi: " + (wifiConnected ? WiFi.SSID() : "Offline"), 8, 56, 1);
      tft.drawString("IP: " + (wifiConnected ? WiFi.localIP().toString() : "192.168.4.1"), 8, 74, 1);
      tft.drawString("SD Card: " + String(sdMounted ? "Tersambung" : "Tidak Ada"), 8, 92, 1);
      tft.drawString("Volume: " + String(systemVolume) + "%", 8, 110, 1);
      tft.drawString("Mode: " + String(MODE_NAMES[currentMode]), 8, 128, 1);
      break;

    case MODE_PHOTO:
      tft.fillScreen(TFT_BLACK);
      tft.setTextDatum(MC_DATUM);
      tft.setTextColor(TFT_MAGENTA, TFT_BLACK);
      tft.drawString("GALERI FOTO", 64, 50, 2);
      tft.setTextColor(TFT_WHITE, TFT_BLACK);
      tft.drawString("TFT 1.8 Inch", 64, 85, 2);
      break;
  }
}

// ============================================================
// BATTERY & SENSOR READINGS
// ============================================================
void updateBattery() {
  // Divider 100K:100K = ADC membaca separuh voltase
  int raw = analogRead(PIN_ADC_BAT);
  float pinVolt = (raw / 4095.0f) * 3.3f;
  batteryVoltage = pinVolt * 2.0f; // koreksi 2x divider
  batteryPercent = constrain((int)((batteryVoltage - 3.0f) / (4.2f - 3.0f) * 100.0f), 0, 100);
}

void updateVolumePot() {
  int raw = analogRead(PIN_ADC_VOL);
  int newVol = map(raw, 0, 4095, 0, 100);
  if (abs(newVol - systemVolume) > 3) {
    systemVolume = newVol;
    audio.setVolume(map(systemVolume, 0, 100, 0, 21)); // range ESP32-audioI2S 0-21
    if (currentMode == MODE_MUSIC || currentMode == MODE_STATUS) {
      renderCurrentScreen();
    }
  }
}

// ============================================================
// AUDIO LOGIC
// ============================================================
void playTrack(String track) {
  if (!sdMounted) return;
  String fullPath = track.startsWith("/") ? track : "/" + track;
  audio.stopSong();
  audio.connecttoFS(SD, fullPath.c_str());
  audio.setVolume(map(systemVolume, 0, 100, 0, 21));
  audioPlaying = true;
  currentTrackName = track;

  // Ekspresi bernyanyi saat musik diputar di robot
  drawEyes(EXPR_SINGING);

  if (currentMode == MODE_MUSIC) {
    delay(400); // beri jeda sesaat agar mata bernyanyi terlihat di TFT
    renderCurrentScreen();
  }
}

void scanSDAudioFiles() {
  audioFiles.clear();
  if (!sdMounted) return;
  File root = SD.open("/");
  if (!root) return;
  File f = root.openNextFile();
  while (f) {
    String name = String(f.name());
    if (!f.isDirectory() && (name.endsWith(".mp3") || name.endsWith(".wav") || name.endsWith(".MP3"))) {
      audioFiles.push_back(name);
    }
    f = root.openNextFile();
  }
}

// ============================================================
// ALARMS SYNC & CHECK
// ============================================================
void triggerAlarmBeep(AlarmItem& alm) {
  alm.ringing = true;
  drawEyes(EXPR_SURPRISED);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_RED, TFT_BLACK);
  tft.drawString("ALARM BUNYI!", 64, 130, 2);
  
  // Kirim broadcast real-time ke web
  DynamicJsonDocument doc(256);
  doc["event"] = "alarm_ringing";
  doc["id"] = alm.id;
  doc["label"] = alm.label;
  doc["time"] = alm.time;
  String out;
  serializeJson(doc, out);
  wsServer.broadcastTXT(out);

  // Putar nada alarm jika ada file di SD
  if (sdMounted && SD.exists("/alarm.mp3")) {
    playTrack("/alarm.mp3");
  }
}

void checkAlarmTick() {
  // Waktu dari NTP jika terkoneksi
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return;

  char cur[6];
  snprintf(cur, sizeof(cur), "%02d:%02d", timeinfo.tm_hour, timeinfo.tm_min);
  String curTimeStr = String(cur);

  for (auto& alm : alarmList) {
    if (alm.enabled && !alm.ringing && alm.time == curTimeStr) {
      triggerAlarmBeep(alm);
    }
  }
}

// ============================================================
// 4 TOMBOL FISIK (ROBOT BERJALAN MANDIRI TANPA WEB)
// ============================================================
void handleButtonPress(int btnIndex, bool isLongPress) {
  // Kirim event ke web via WebSocket agar UI sinkron
  DynamicJsonDocument doc(128);
  doc["event"] = "button_press";
  doc["btn"]   = btnIndex + 1;
  doc["type"]  = isLongPress ? "long" : "short";
  String out;
  serializeJson(doc, out);
  wsServer.broadcastTXT(out);

  // Jika alarm sedang bunyi, menekan tombol apa pun akan mematikan alarm
  for (auto& alm : alarmList) {
    if (alm.ringing) {
      alm.ringing = false;
      audio.stopSong();
      audioPlaying = false;
      drawEyes(EXPR_HAPPY);
      return;
    }
  }

  switch (btnIndex) {
    case 0: // B1 - MODE CAROUSEL
      currentMode = (RobotMode)((currentMode + 1) % MODE_COUNT);
      renderCurrentScreen();
      break;

    case 1: // B2 - OK / PLAY / PAUSE
      if (currentMode == MODE_MUSIC) {
        if (audioPlaying) {
          audio.pauseResume();
          audioPlaying = !audioPlaying;
        } else if (audioFiles.size() > 0) {
          playTrack(audioFiles[0]);
        }
        renderCurrentScreen();
      } else {
        // Mode Home: ganti ekspresi random
        int nextExpr = (currentExpr + 1) % 8;
        drawEyes((Expression)nextExpr);
      }
      break;

    case 2: // B3 - NEXT TRACK / NEXT SCREEN
      if (currentMode == MODE_MUSIC && audioFiles.size() > 0) {
        static int trackIdx = 0;
        trackIdx = (trackIdx + 1) % audioFiles.size();
        playTrack(audioFiles[trackIdx]);
      } else {
        drawEyes(EXPR_WINK);
      }
      break;

    case 3: // B4 - POWER / SLEEP SCREEN
      tftSleeping = !tftSleeping;
      if (tftSleeping) {
        tft.fillScreen(TFT_BLACK);
        tft.writecommand(0x28); // Display off ST7735
      } else {
        tft.writecommand(0x29); // Display on
        renderCurrentScreen();
      }
      break;
  }
}

void pollButtons() {
  unsigned long now = millis();
  for (int i = 0; i < 4; i++) {
    bool reading = digitalRead(btns[i].pin);
    if (reading != btns[i].lastReading) {
      btns[i].lastReading = reading;
    }
    // Button ditekan (active LOW)
    if (reading == LOW && btns[i].state == HIGH) {
      btns[i].state = LOW;
      btns[i].pressTime = now;
    }
    // Button dilepas
    if (reading == HIGH && btns[i].state == LOW) {
      btns[i].state = HIGH;
      unsigned long duration = now - btns[i].pressTime;
      if (duration > 50) { // debounce > 50ms
        handleButtonPress(i, duration > 1000);
      }
    }
  }
}

// ============================================================
// REST API HANDLERS UNTUK WEB MOCI
// ============================================================
String buildSystemStatusJson() {
  DynamicJsonDocument doc(1024);
  doc["mcu"]         = "ESP32-S3 N16R8";
  doc["uptime"]      = (millis() - uptimeStart) / 1000;
  doc["mode"]        = MODE_NAMES[currentMode];
  doc["expression"]  = EXPR_NAMES[currentExpr];

  JsonObject bat = doc.createNestedObject("battery");
  bat["v"]   = batteryVoltage;
  bat["pct"] = batteryPercent;

  JsonObject wifi = doc.createNestedObject("wifi");
  wifi["connected"] = wifiConnected;
  wifi["ssid"]      = wifiConnected ? WiFi.SSID() : "Moci-Companion-AP";
  wifi["rssi"]      = wifiConnected ? WiFi.RSSI() : 0;
  wifi["ip"]        = wifiConnected ? WiFi.localIP().toString() : WiFi.softAPIP().toString();

  JsonObject aud = doc.createNestedObject("audio");
  aud["playing"] = audioPlaying;
  aud["file"]    = currentTrackName;
  aud["volume"]  = systemVolume;

  JsonObject sd = doc.createNestedObject("sd");
  sd["mounted"] = sdMounted;

  String out;
  serializeJson(doc, out);
  return out;
}

void apiGetStatus() {
  setCorsHeaders();
  server.send(200, "application/json", buildSystemStatusJson());
}

void apiGetPing() {
  setCorsHeaders();
  server.send(200, "application/json", "{\"ok\":true,\"message\":\"Pong dari Moci ESP32-S3!\"}");
}

void apiPostExpression() {
  setCorsHeaders();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"Body kosong\"}");
    return;
  }
  DynamicJsonDocument doc(256);
  deserializeJson(doc, server.arg("plain"));
  String expr = doc["expression"] | doc["val"] | "happy";

  for (int i = 0; i < 8; i++) {
    if (expr == EXPR_NAMES[i]) {
      drawEyes((Expression)i);
      break;
    }
  }
  server.send(200, "application/json", "{\"ok\":true,\"expression\":\"" + expr + "\"}");
}

void apiPostSpeak() {
  setCorsHeaders();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false}");
    return;
  }
  DynamicJsonDocument doc(512);
  deserializeJson(doc, server.arg("plain"));
  String text = doc["text"] | "";

  // Tampilkan teks di layar TFT & ubah ekspresi ke talking
  drawEyes(EXPR_TALKING);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(text.substring(0, min((int)text.length(), 20)), 64, 135, 1);

  // Jika ada file audio ucapan/chime
  if (sdMounted && SD.exists("/speak_chime.mp3")) {
    playTrack("/speak_chime.mp3");
  }

  // Notifikasi WebSocket
  DynamicJsonDocument wsDoc(256);
  wsDoc["event"] = "moci_speaking";
  wsDoc["text"]  = text;
  String wsOut;
  serializeJson(wsDoc, wsOut);
  wsServer.broadcastTXT(wsOut);

  server.send(200, "application/json", "{\"ok\":true,\"message\":\"Teks diucapkan oleh Moci\"}");
}

void apiGetWifiScan() {
  setCorsHeaders();
  int n = WiFi.scanNetworks();
  DynamicJsonDocument doc(2048);
  JsonArray arr = doc.to<JsonArray>();
  for (int i = 0; i < n; i++) {
    JsonObject item = arr.createNestedObject();
    item["ssid"]          = WiFi.SSID(i);
    item["rssi"]          = WiFi.RSSI(i);
    int q = 2 * (WiFi.RSSI(i) + 100);
    item["signalPercent"] = constrain(q, 0, 100);
    item["secure"]        = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
    item["securityType"]  = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN) ? "WPA2" : "Open";
  }
  String out;
  serializeJson(doc, out);
  server.send(200, "application/json", out);
}

void apiPostWifiConnect() {
  setCorsHeaders();
  DynamicJsonDocument doc(512);
  deserializeJson(doc, server.arg("plain"));
  String ssid = doc["ssid"] | "";
  String pass = doc["password"] | doc["pass"] | "";

  if (ssid.length() == 0) {
    server.send(400, "application/json", "{\"ok\":false,\"error\":\"SSID tidak boleh kosong\"}");
    return;
  }

  prefs.begin("moci-wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();

  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(ssid.c_str(), pass.c_str());

  server.send(200, "application/json", "{\"ok\":true,\"message\":\"Menyambungkan ke " + ssid + "...\"}");
}

void apiPostAlarmSync() {
  setCorsHeaders();
  DynamicJsonDocument doc(4096);
  deserializeJson(doc, server.arg("plain"));
  JsonArray arr = doc["alarms"].as<JsonArray>();

  alarmList.clear();
  for (JsonObject a : arr) {
    AlarmItem item;
    item.id      = a["id"] | "";
    item.time    = a["time"] | "";
    item.label   = a["label"] | "Alarm";
    item.sound   = a["sound"] | "chirp";
    item.enabled = a["enabled"] | true;
    item.ringing = false;
    alarmList.push_back(item);
  }

  server.send(200, "application/json", "{\"ok\":true,\"count\":" + String(alarmList.size()) + "}");
}

// POST /api/audio/upload (Menyimpan file rekaman suara ke Micro SD)
File uploadAudioFile;
void handleAudioFileUpload() {
  setCorsHeaders();
  HTTPUpload& upload = server.upload();
  if (upload.status == UPLOAD_FILE_START) {
    String filename = upload.filename;
    if (!filename.startsWith("/")) filename = "/" + filename;
    Serial.printf("[Upload SD] Memulai simpan file audio: %s\n", filename.c_str());
    if (sdMounted) {
      if (SD.exists(filename)) SD.remove(filename);
      uploadAudioFile = SD.open(filename, FILE_WRITE);
    }
  } else if (upload.status == UPLOAD_FILE_WRITE) {
    if (uploadAudioFile) {
      uploadAudioFile.write(upload.buf, upload.currentSize);
    }
  } else if (upload.status == UPLOAD_FILE_END) {
    if (uploadAudioFile) {
      uploadAudioFile.close();
      Serial.printf("[Upload SD] Selesai simpan: %s (%u bytes)\n", upload.filename.c_str(), upload.totalSize);
      scanSDAudioFiles();
    }
  }
}

// POST /api/templates/sync (Menyimpan daftar template Q&A ke /system/templates.json di SD)
void apiPostTemplatesSync() {
  setCorsHeaders();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"ok\":false}");
    return;
  }
  if (sdMounted) {
    if (!SD.exists("/system")) SD.mkdir("/system");
    File f = SD.open("/system/templates.json", FILE_WRITE);
    if (f) {
      f.print(server.arg("plain"));
      f.close();
      Serial.println("[Templates] Database template berhasil disimpan ke /system/templates.json di SD Card!");
      server.send(200, "application/json", "{\"ok\":true,\"message\":\"Templates tersimpan di Micro SD!\"}");
      return;
    }
  }
  server.send(500, "application/json", "{\"ok\":false,\"message\":\"Gagal menulis ke SD Card.\"}");
}

// GET /api/templates (Membaca daftar template dari /system/templates.json di SD)
void apiGetTemplates() {
  setCorsHeaders();
  if (sdMounted && SD.exists("/system/templates.json")) {
    File f = SD.open("/system/templates.json", FILE_READ);
    if (f) {
      server.streamFile(f, "application/json");
      f.close();
      return;
    }
  }
  server.send(200, "application/json", "[]");
}

// ============================================================
// WEBSOCKET HANDLER
// ============================================================
void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsServer.sendTXT(num, buildSystemStatusJson());
  } else if (type == WStype_TEXT) {
    DynamicJsonDocument doc(512);
    deserializeJson(doc, (char*)payload);
    const char* cmd = doc["cmd"];
    if (cmd && strcmp(cmd, "expression") == 0) {
      String expr = doc["val"] | "happy";
      for (int i = 0; i < 8; i++) {
        if (expr == EXPR_NAMES[i]) {
          drawEyes((Expression)i);
          break;
        }
      }
    }
  }
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  uptimeStart = millis();

  // Tombol Fisik
  for (int i = 0; i < 4; i++) {
    pinMode(btns[i].pin, INPUT_PULLUP);
  }

  // ADC Pin Resolution
  analogReadResolution(12);

  // Inisialisasi TFT Display
  tft.init();
  tft.setRotation(0); // 128x160 Portrait
  tft.fillScreen(TFT_BLACK);
  drawEyes(EXPR_HAPPY);

  // Inisialisasi SD Card
  if (SD.begin(SD_CS)) {
    sdMounted = true;
    scanSDAudioFiles();
  }

  // Inisialisasi MAX98357A I2S Audio
  audio.setPinout(I2S_BCLK, I2S_LRC, I2S_DOUT);
  audio.setVolume(map(systemVolume, 0, 100, 0, 21));

  // WiFi: Mulai Access Point agar selalu bisa dikoneksikan
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("Moci-Companion-AP", "12345678");

  // Load credential WiFi tersimpan
  prefs.begin("moci-wifi", true);
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  prefs.end();

  if (ssid.length() > 0) {
    WiFi.begin(ssid.c_str(), pass.c_str());
  }

  // Register REST Endpoints
  server.on("/api/status",          HTTP_GET,     apiGetStatus);
  server.on("/api/ping",            HTTP_GET,     apiGetPing);
  server.on("/api/expression",      HTTP_POST,    apiPostExpression);
  server.on("/api/speak",           HTTP_POST,    apiPostSpeak);
  server.on("/api/wifi/scan",       HTTP_GET,     apiGetWifiScan);
  server.on("/api/wifi/connect",    HTTP_POST,    apiPostWifiConnect);
  server.on("/api/alarms/sync",     HTTP_POST,    apiPostAlarmSync);
  server.on("/api/templates",       HTTP_GET,     apiGetTemplates);
  server.on("/api/templates/sync",  HTTP_POST,    apiPostTemplatesSync);
  server.on("/api/audio/upload",    HTTP_POST,    [](){ setCorsHeaders(); server.send(200, "application/json", "{\"ok\":true}"); }, handleAudioFileUpload);

  // CORS Preflight
  server.on("/api/status",          HTTP_OPTIONS, handleCorsPreflight);
  server.on("/api/ping",            HTTP_OPTIONS, handleCorsPreflight);
  server.on("/api/expression",      HTTP_OPTIONS, handleCorsPreflight);
  server.on("/api/speak",           HTTP_OPTIONS, handleCorsPreflight);
  server.on("/api/wifi/scan",       HTTP_OPTIONS, handleCorsPreflight);
  server.on("/api/wifi/connect",    HTTP_OPTIONS, handleCorsPreflight);
  server.on("/api/alarms/sync",     HTTP_OPTIONS, handleCorsPreflight);
  server.on("/api/templates",       HTTP_OPTIONS, handleCorsPreflight);
  server.on("/api/templates/sync",  HTTP_OPTIONS, handleCorsPreflight);
  server.on("/api/audio/upload",    HTTP_OPTIONS, handleCorsPreflight);

  server.begin();

  // WebSocket Server
  wsServer.begin();
  wsServer.onEvent(onWebSocketEvent);

  // Update NTP jika WiFi sudah terhubung
  configTime(7 * 3600, 0, "pool.ntp.org");
}

// ============================================================
// MAIN LOOP
// ============================================================
void loop() {
  unsigned long now = millis();

  server.handleClient();
  wsServer.loop();
  audio.loop();

  // Polling tombol fisik (bekerja tanpa koneksi web!)
  pollButtons();

  // Cek baterai tiap 10 detik
  if (now - lastBatteryCheck > 10000) {
    lastBatteryCheck = now;
    updateBattery();
    wifiConnected = (WiFi.status() == WL_CONNECTED);
  }

  // Cek potensiometer volume tiap 200ms
  if (now - lastPotRead > 200) {
    lastPotRead = now;
    updateVolumePot();
  }

  // Cek jadwal alarm tiap 3 detik
  if (now - lastAlarmCheck > 3000) {
    lastAlarmCheck = now;
    checkAlarmTick();
  }

  // Broadcast status via WebSocket tiap 5 detik jika ada client web
  if (now - lastStatusBroadcast > 5000) {
    lastStatusBroadcast = now;
    if (wsServer.connectedClients() > 0) {
      wsServer.broadcastTXT(buildSystemStatusJson());
    }
  }
}
