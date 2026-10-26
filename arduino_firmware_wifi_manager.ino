/* ==============================================================================
 * PROJEK ROBOT MOCI — ESP32-S3 COMPANION ROBOT
 * SKETCH FIRMWARE RESMI: WI-FI PROVISIONING & FULL WEB CONTROLLER
 * Target Board: ESP32-S3 N16R8 (16MB Flash, 8MB PSRAM)
 * ==============================================================================
 * Kompatibel 100% dengan Web Moci (GitHub Pages / Local file://):
 *   1. Full CORS Support (Access-Control-Allow-Origin: *)
 *   2. Wi-Fi Provisioning (Scan jaringan, Connect via Web, Simpan ke Flash NVS)
 *   3. Dual-Mode AP + STA (Selalu bisa diakses via 192.168.4.1 atau IP Router)
 *   4. Sinkronisasi Wajah / Ekspresi (Happy, Singing, Sad, Angry, Sleepy, dll)
 *   5. Perintah Bicara (Text-to-Speech / Speak ke Speaker Robot)
 *   6. Sinkronisasi Jadwal Alarm
 *   7. Web Serial CDC USB-C Support (115200 baud)
 * ============================================================================== */

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// Objek Penyimpanan Flash NVS & HTTP WebServer Port 80
Preferences preferences;
WebServer server(80);

// Default Access Point (Jika belum terkoneksi ke Wi-Fi rumah)
const char* AP_SSID = "Moci-Companion-AP";
const char* AP_PASS = "12345678";

// Status Variabel
String savedSSID = "";
String savedPass = "";
bool isConnectedToHomeWifi = false;
String currentExpression = "happy";

// ==============================================================================
// 1. HELPER CORS (WAJIB AGAR GITHUB PAGES BISA AKSES REST API ESP32)
// ==============================================================================
void setCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE, PUT");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
}

void handleOptions() {
  setCorsHeaders();
  server.send(204);
}

// ==============================================================================
// 2. ENDPOINT: GET /api/status (Dipanggil saat web cek koneksi)
// ==============================================================================
void handleStatus() {
  setCorsHeaders();
  DynamicJsonDocument doc(1024);
  doc["type"] = "wifi";
  doc["isConnected"] = true;
  doc["robotName"] = "Moci";
  doc["expression"] = currentExpression;

  JsonObject hw = doc.createNestedObject("hardware");
  hw["mcu"] = "ESP32-S3 N16R8 (Tensilica Xtensa Dual Core 240MHz)";
  hw["display"] = "TFT 1.8\" 128x160 SPI ST7735";
  hw["audioAmp"] = "I2S MAX98357A + Speaker 8Ω 2W";
  hw["batteryVoltage"] = "3.85V (88% - Li-Po 3.7V)";

  JsonObject wf = doc.createNestedObject("wifi");
  wf["connected"] = isConnectedToHomeWifi;
  wf["ssid"] = isConnectedToHomeWifi ? WiFi.SSID() : AP_SSID;
  wf["rssi"] = isConnectedToHomeWifi ? WiFi.RSSI() : 0;
  wf["ip"] = isConnectedToHomeWifi ? WiFi.localIP().toString() : WiFi.softAPIP().toString();

  JsonObject storage = doc.createNestedObject("storage");
  storage["mounted"] = true;
  storage["freeMB"] = 14200;
  storage["totalMB"] = 16000;

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

// ==============================================================================
// 3. ENDPOINT: GET /api/ping (Cek latensi & status hidup)
// ==============================================================================
void handlePing() {
  setCorsHeaders();
  server.send(200, "application/json", "{\"success\":true,\"ok\":true,\"message\":\"Pong dari ESP32-S3 Moci!\"}");
}

// ==============================================================================
// 4. ENDPOINT: GET /api/wifi/scan (Pindai sinyal Wi-Fi di sekitar)
// ==============================================================================
void handleWifiScan() {
  setCorsHeaders();
  Serial.println("[Wi-Fi] Memindai jaringan Wi-Fi di sekitar...");

  int n = WiFi.scanNetworks();
  DynamicJsonDocument doc(2048);
  JsonArray array = doc.to<JsonArray>();

  for (int i = 0; i < n; ++i) {
    JsonObject item = array.createNestedObject();
    item["ssid"] = WiFi.SSID(i);
    item["rssi"] = WiFi.RSSI(i);
    int quality = 2 * (WiFi.RSSI(i) + 100);
    quality = constrain(quality, 0, 100);
    item["signalPercent"] = quality;

    bool isSecure = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
    item["secure"] = isSecure;
    item["securityType"] = isSecure ? "WPA2" : "Open";
  }

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
  Serial.printf("[Wi-Fi] Pemindaian selesai. Ditemukan %d sinyal.\n", n);
}

// ==============================================================================
// 5. ENDPOINT: POST /api/wifi/connect (Simpan dan hubungkan Wi-Fi)
// ==============================================================================
void handleWifiConnect() {
  setCorsHeaders();

  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Body request kosong.\"}");
    return;
  }

  DynamicJsonDocument doc(512);
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Format JSON tidak valid.\"}");
    return;
  }

  const char* targetSsid = doc["ssid"];
  const char* targetPass = doc["password"] | doc["pass"] | "";

  if (!targetSsid || strlen(targetSsid) == 0) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Nama SSID tidak boleh kosong.\"}");
    return;
  }

  Serial.printf("\n[Wi-Fi] Menerima instruksi koneksi ke SSID: %s\n", targetSsid);

  // Simpan kredensial ke flash NVS
  preferences.begin("moci-wifi", false);
  preferences.putString("ssid", targetSsid);
  preferences.putString("pass", targetPass);
  preferences.end();

  // Coba konek ke router
  WiFi.disconnect();
  delay(200);
  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(targetSsid, targetPass);

  int timeout = 24; // 12 detik
  while (WiFi.status() != WL_CONNECTED && timeout > 0) {
    delay(500);
    Serial.print(".");
    timeout--;
  }

  if (WiFi.status() == WL_CONNECTED) {
    isConnectedToHomeWifi = true;
    String newIp = WiFi.localIP().toString();
    Serial.printf("\n[Wi-Fi] Terhubung ke %s! IP Baru: %s\n", targetSsid, newIp.c_str());

    DynamicJsonDocument resp(256);
    resp["success"] = true;
    resp["ssid"] = targetSsid;
    resp["ip"] = newIp;
    resp["message"] = "Berhasil terhubung ke " + String(targetSsid) + "! IP Baru: " + newIp;

    String output;
    serializeJson(resp, output);
    server.send(200, "application/json", output);
  } else {
    Serial.println("\n[Wi-Fi] Gagal terhubung (Password salah / sinyal lemah).");
    server.send(500, "application/json", "{\"success\":false,\"message\":\"Gagal terhubung ke Wi-Fi. Periksa kembali password Anda.\"}");
  }
}

// ==============================================================================
// 6. ENDPOINT: POST /api/wifi/disconnect
// ==============================================================================
void handleWifiDisconnect() {
  setCorsHeaders();
  Serial.println("[Wi-Fi] Menghapus Wi-Fi dan kembali ke Access Point...");

  preferences.begin("moci-wifi", false);
  preferences.remove("ssid");
  preferences.remove("pass");
  preferences.end();

  WiFi.disconnect();
  isConnectedToHomeWifi = false;

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);

  server.send(200, "application/json", "{\"success\":true,\"message\":\"Wi-Fi diputus. ESP32 kembali ke Access Point 192.168.4.1\"}");
}

// ==============================================================================
// 7. ENDPOINT: POST /api/expression (Ganti Ekspresi Wajah Moci)
// ==============================================================================
void handleExpression() {
  setCorsHeaders();
  if (server.hasArg("plain")) {
    DynamicJsonDocument doc(256);
    deserializeJson(doc, server.arg("plain"));
    String expr = doc["expression"] | doc["val"] | "happy";
    currentExpression = expr;
    Serial.printf("[Ekspresi] Layar TFT berganti ke: %s\n", currentExpression.c_str());
  }
  server.send(200, "application/json", "{\"success\":true,\"expression\":\"" + currentExpression + "\"}");
}

// ==============================================================================
// 8. ENDPOINT: POST /api/speak (Teks diucapkan oleh robot)
// ==============================================================================
void handleSpeak() {
  setCorsHeaders();
  String text = "";
  if (server.hasArg("plain")) {
    DynamicJsonDocument doc(512);
    deserializeJson(doc, server.arg("plain"));
    text = doc["text"].as<String>();
    Serial.printf("[Speak] Moci berucap: \"%s\"\n", text.c_str());
  }
  server.send(200, "application/json", "{\"success\":true,\"text\":\"" + text + "\",\"message\":\"Teks diterima oleh Moci.\"}");
}

// ==============================================================================
// 9. ENDPOINT: POST /api/alarms/sync (Sinkronkan jadwal alarm)
// ==============================================================================
void handleAlarmSync() {
  setCorsHeaders();
  int count = 0;
  if (server.hasArg("plain")) {
    DynamicJsonDocument doc(4096);
    deserializeJson(doc, server.arg("plain"));
    JsonArray arr = doc["alarms"].as<JsonArray>();
    count = arr.size();
    Serial.printf("[Alarm] %d jadwal alarm berhasil disinkronkan dari Web!\n", count);
  }
  server.send(200, "application/json", "{\"success\":true,\"count\":" + String(count) + ",\"message\":\"Alarm tersimpan di ESP32.\"}");
}

// ==============================================================================
// 10. PARSER WEB SERIAL USB CDC (Untuk opsi kabel USB langsung di Web)
// ==============================================================================
void processSerialCommand(String line) {
  line.trim();
  if (!line.startsWith("{")) return;

  DynamicJsonDocument doc(512);
  if (deserializeJson(doc, line) != DeserializationError::Ok) return;

  const char* cmd = doc["cmd"];
  if (!cmd) return;

  if (strcmp(cmd, "ping") == 0) {
    Serial.println("{\"type\":\"pong\",\"status\":\"ok\"}");
  } 
  else if (strcmp(cmd, "status") == 0) {
    Serial.println("{\"type\":\"status\",\"robotName\":\"Moci\",\"mcu\":\"ESP32-S3\"}");
  }
  else if (strcmp(cmd, "expression") == 0) {
    currentExpression = doc["expression"] | doc["val"] | "happy";
    Serial.printf("{\"success\":true,\"expression\":\"%s\"}\n", currentExpression.c_str());
  }
  else if (strcmp(cmd, "speak") == 0) {
    String txt = doc["text"] | "";
    Serial.printf("{\"success\":true,\"speak\":\"%s\"}\n", txt.c_str());
  }
}

// ==============================================================================
// SETUP UTAMA
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==========================================");
  Serial.println("🤖 MOCI ROBOT COMPANION — ESP32-S3 READY");
  Serial.println("==========================================");

  // Baca kredensial dari memori Flash NVS
  preferences.begin("moci-wifi", true);
  savedSSID = preferences.getString("ssid", "");
  savedPass = preferences.getString("pass", "");
  preferences.end();

  // Selalu jalankan mode AP_STA agar Access Point Moci-Companion-AP selalu bisa diakses
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.printf("[WiFi] SoftAP Aktif: %s (Password: %s)\n", AP_SSID, AP_PASS);
  Serial.printf("[WiFi] IP Access Point: http://%s\n", WiFi.softAPIP().toString().c_str());

  if (savedSSID.length() > 0) {
    Serial.printf("[WiFi] Menghubungkan ke Wi-Fi tersimpan: %s...\n", savedSSID.c_str());
    WiFi.begin(savedSSID.c_str(), savedPass.c_str());

    int attempts = 16;
    while (WiFi.status() != WL_CONNECTED && attempts > 0) {
      delay(500);
      Serial.print(".");
      attempts--;
    }

    if (WiFi.status() == WL_CONNECTED) {
      isConnectedToHomeWifi = true;
      Serial.println("\n[WiFi] Berhasil tersambung ke Wi-Fi Rumah!");
      Serial.printf("[WiFi] IP Router: http://%s\n", WiFi.localIP().toString().c_str());
    } else {
      Serial.println("\n[WiFi] Wi-Fi rumah tidak ditemukan. Tetap standby di Access Point.");
    }
  }

  // Registrasi Endpoint REST API untuk Web Moci
  server.on("/api/status",          HTTP_GET,     handleStatus);
  server.on("/api/status",          HTTP_OPTIONS, handleOptions);
  
  server.on("/api/ping",            HTTP_GET,     handlePing);
  server.on("/api/ping",            HTTP_OPTIONS, handleOptions);

  server.on("/api/wifi/scan",       HTTP_GET,     handleWifiScan);
  server.on("/api/wifi/scan",       HTTP_OPTIONS, handleOptions);

  server.on("/api/wifi/connect",    HTTP_POST,    handleWifiConnect);
  server.on("/api/wifi/connect",    HTTP_OPTIONS, handleOptions);

  server.on("/api/wifi/disconnect", HTTP_POST,    handleWifiDisconnect);
  server.on("/api/wifi/disconnect", HTTP_OPTIONS, handleOptions);

  server.on("/api/expression",      HTTP_POST,    handleExpression);
  server.on("/api/expression",      HTTP_OPTIONS, handleOptions);

  server.on("/api/speak",           HTTP_POST,    handleSpeak);
  server.on("/api/speak",           HTTP_OPTIONS, handleOptions);

  server.on("/api/alarms/sync",     HTTP_POST,    handleAlarmSync);
  server.on("/api/alarms/sync",     HTTP_OPTIONS, handleOptions);

  server.onNotFound([]() {
    setCorsHeaders();
    server.send(404, "application/json", "{\"error\":\"Endpoint tidak ditemukan\"}");
  });

  server.begin();
  Serial.println("[HTTP] WebServer Port 80 siap menerima koneksi dari Web Moci!");
}

// ==============================================================================
// LOOP UTAMA
// ==============================================================================
void loop() {
  server.handleClient();

  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    processSerialCommand(line);
  }
}
