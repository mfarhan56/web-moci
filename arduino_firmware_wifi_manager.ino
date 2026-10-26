/* ==============================================================================
 * PROJEK ROBOT MOCI — ESP32-S3 COMPANION ROBOT
 * SKETCH FIRMWARE: WI-FI PROVISIONING & WEB CONTROLLER (TANPA HARDCODE SSID/PASS)
 * ==============================================================================
 * Fitur:
 * 1. Web Wi-Fi Manager: Pindai sinyal & simpan SSID/Password langsung dari Web Moci
 * 2. Kredensial tersimpan permanen di memori flash (NVS) menggunakan Preferences.h
 * 3. Jika belum ada Wi-Fi tersimpan -> Buat SoftAP "Moci-Companion-AP" (192.168.4.1)
 * 4. Jika sudah ada Wi-Fi tersimpan -> Otomatis konek ke router rumah / hotspot
 * 5. Web Serial USB CDC & Web REST API support
 * 
 * Hardware: ESP32-S3 N16R8 (16MB Flash, 8MB PSRAM)
 * ============================================================================== */

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h> // Pastikan install ArduinoJson v6 / v7 di Library Manager

// Objek Penyimpanan NVS Flash & WebServer Port 80
Preferences preferences;
WebServer server(80);

// Nama AP Default jika belum ada Wi-Fi tersimpan
const char* AP_SSID = "Moci-Companion-AP";
const char* AP_PASS = "12345678"; // Kosongkan "" jika ingin open AP

// Status Variabel
String savedSSID = "";
String savedPass = "";
bool isConnectedToHomeWifi = false;

// Header CORS agar website di GitHub Pages / file:// bisa memanggil REST API
void setCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

void handleOptions() {
  setCorsHeaders();
  server.send(204);
}

// -----------------------------------------------------------------------------
// 1. API: STATUS SISTEM
// -----------------------------------------------------------------------------
void handleStatus() {
  setCorsHeaders();
  DynamicJsonDocument doc(512);
  doc["type"] = "wifi";
  doc["isConnected"] = isConnectedToHomeWifi;
  doc["ssid"] = isConnectedToHomeWifi ? WiFi.SSID() : AP_SSID;
  doc["ip"] = isConnectedToHomeWifi ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  doc["rssi"] = isConnectedToHomeWifi ? WiFi.RSSI() : 0;
  doc["robotName"] = "Moci";

  JsonObject hw = doc.createNestedObject("hardware");
  hw["mcu"] = "ESP32-S3 N16R8 (Tensilica Xtensa Dual Core 240MHz)";
  hw["flash"] = "16 MB Quad-SPI";
  hw["psram"] = "8 MB Octal-SPI";
  hw["display"] = "TFT 1.8\" 128x160 SPI ST7735";
  hw["batteryVoltage"] = "3.85V (88% - Li-Po 3.7V)";

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

// -----------------------------------------------------------------------------
// 2. API: PINDAI JARINGAN WI-FI (SCAN NETWORKS)
// Dipanggil oleh tombol "Pindai Wi-Fi Sekitar" di Web Moci
// -----------------------------------------------------------------------------
void handleWifiScan() {
  setCorsHeaders();
  Serial.println("[Wi-Fi] Memulai pemindaian sinyal Wi-Fi di sekitar...");

  int n = WiFi.scanNetworks();
  DynamicJsonDocument doc(2048);
  JsonArray array = doc.to<JsonArray>();

  for (int i = 0; i < n; ++i) {
    JsonObject item = array.createNestedObject();
    item["ssid"] = WiFi.SSID(i);
    item["rssi"] = WiFi.RSSI(i);
    // Kalkulasi persentase sinyal dari RSSI (-100 dBm sampai -50 dBm)
    int quality = 2 * (WiFi.RSSI(i) + 100);
    if (quality < 0) quality = 0;
    if (quality > 100) quality = 100;
    item["signalPercent"] = quality;

    bool isSecure = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
    item["secure"] = isSecure;
    item["securityType"] = isSecure ? "WPA2" : "Open";
  }

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
  Serial.printf("[Wi-Fi] Selesai memindai. Ditemukan %d jaringan.\n", n);
}

// -----------------------------------------------------------------------------
// 3. API: HUBUNGKAN KE WI-FI PILIHAN & SIMPAN KE FLASH (NVS)
// Dipanggil saat klik tombol "Hubungkan ESP32 ke Wi-Fi Ini" di Web Moci
// -----------------------------------------------------------------------------
void handleWifiConnect() {
  setCorsHeaders();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Body request kosong!\"}");
    return;
  }

  String body = server.arg("plain");
  DynamicJsonDocument doc(512);
  DeserializationError error = deserializeJson(doc, body);

  if (error) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Format JSON tidak valid.\"}");
    return;
  }

  const char* targetSsid = doc["ssid"];
  const char* targetPass = doc["password"];

  if (!targetSsid || strlen(targetSsid) == 0) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"SSID tidak boleh kosong!\"}");
    return;
  }

  Serial.printf("[Wi-Fi] Menerima kredensial dari Web Moci -> SSID: %s\n", targetSsid);

  // Simpan kredensial secara permanen ke memori flash internal ESP32 (NVS)
  preferences.begin("moci-wifi", false);
  preferences.putString("ssid", targetSsid);
  preferences.putString("pass", targetPass ? targetPass : "");
  preferences.end();

  // Coba sambungkan ke Wi-Fi baru
  WiFi.disconnect();
  delay(100);
  WiFi.mode(WIFI_AP_STA); // Pertahankan AP sementara agar web tidak langsung putus
  WiFi.begin(targetSsid, targetPass ? targetPass : "");

  int timeout = 25; // Tunggu maksimal ~12.5 detik
  while (WiFi.status() != WL_CONNECTED && timeout > 0) {
    delay(500);
    Serial.print(".");
    timeout--;
  }

  if (WiFi.status() == WL_CONNECTED) {
    isConnectedToHomeWifi = true;
    String newIp = WiFi.localIP().toString();
    Serial.printf("\n[Wi-Fi] SUKSES! Terhubung ke %s dengan IP: %s\n", targetSsid, newIp.c_str());

    DynamicJsonDocument resp(256);
    resp["success"] = true;
    resp["ssid"] = targetSsid;
    resp["ip"] = newIp;
    resp["message"] = "ESP32-S3 berhasil terhubung ke " + String(targetSsid) + "! IP Baru: " + newIp;

    String output;
    serializeJson(resp, output);
    server.send(200, "application/json", output);
  } else {
    Serial.println("\n[Wi-Fi] Gagal terhubung ke SSID pilihan (Password salah / sinyal lemah).");
    server.send(500, "application/json", "{\"success\":false,\"message\":\"Gagal terhubung ke Wi-Fi. Periksa kembali password Anda.\"}");
  }
}

// -----------------------------------------------------------------------------
// 4. API: PUTUSKAN WI-FI & KEMBALIKAN KE MODE ACCESS POINT
// -----------------------------------------------------------------------------
void handleWifiDisconnect() {
  setCorsHeaders();
  Serial.println("[Wi-Fi] Menghapus kredensial tersimpan dan kembali ke AP mode...");

  preferences.begin("moci-wifi", false);
  preferences.remove("ssid");
  preferences.remove("pass");
  preferences.end();

  WiFi.disconnect();
  isConnectedToHomeWifi = false;

  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);

  server.send(200, "application/json", "{\"success\":true,\"message\":\"Kredensial dihapus. ESP32 kembali ke Access Point 192.168.4.1\"}");
}

// -----------------------------------------------------------------------------
// 5. API: EKSPRESI WAJAH, AUDIO, & PING
// -----------------------------------------------------------------------------
void handlePing() {
  setCorsHeaders();
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Pong dari ESP32-S3!\"}");
}

void handleExpression() {
  setCorsHeaders();
  if (server.hasArg("plain")) {
    DynamicJsonDocument doc(256);
    deserializeJson(doc, server.arg("plain"));
    const char* expr = doc["expression"];
    Serial.printf("[Moci] Ganti ekspresi layar TFT: %s\n", expr ? expr : "normal");
    // TODO: Panggil fungsi render mata pada TFT ST7735 di sini
  }
  server.send(200, "application/json", "{\"success\":true}");
}

// -----------------------------------------------------------------------------
// PARSER PERINTAH SERIAL USB CDC (Jika menggunakan kabel USB langsung di Web)
// -----------------------------------------------------------------------------
void processSerialCommand(String line) {
  line.trim();
  if (!line.startsWith("{")) return;

  DynamicJsonDocument doc(512);
  DeserializationError err = deserializeJson(doc, line);
  if (err) return;

  const char* cmd = doc["cmd"];
  if (!cmd) return;

  if (strcmp(cmd, "ping") == 0) {
    Serial.println("{\"type\":\"pong\",\"status\":\"ok\"}");
  } 
  else if (strcmp(cmd, "wifi_scan") == 0) {
    int n = WiFi.scanNetworks();
    Serial.printf("{\"event\":\"wifi_scan_result\",\"count\":%d}\n", n);
  }
  else if (strcmp(cmd, "wifi_connect") == 0) {
    const char* s = doc["ssid"];
    const char* p = doc["pass"];
    if (s) {
      Serial.printf("[Serial] Menyimpan kredensial Wi-Fi: %s\n", s);
      preferences.begin("moci-wifi", false);
      preferences.putString("ssid", s);
      preferences.putString("pass", p ? p : "");
      preferences.end();
      WiFi.begin(s, p ? p : "");
      Serial.println("{\"type\":\"wifi_connecting\",\"ssid\":\"" + String(s) + "\"}");
    }
  }
}

// -----------------------------------------------------------------------------
// SETUP UTAMA
// -----------------------------------------------------------------------------
void setup() {
  // Serial USB CDC pada ESP32-S3
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

  if (savedSSID.length() > 0) {
    Serial.printf("[Boot] Ditemukan Wi-Fi tersimpan di Flash: %s\n", savedSSID.c_str());
    Serial.println("[Boot] Mencoba menghubungkan ke Wi-Fi rumah/hotspot...");
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(savedSSID.c_str(), savedPass.c_str());

    int attempts = 20; // 10 detik
    while (WiFi.status() != WL_CONNECTED && attempts > 0) {
      delay(500);
      Serial.print(".");
      attempts--;
    }

    if (WiFi.status() == WL_CONNECTED) {
      isConnectedToHomeWifi = true;
      Serial.println("\n[Boot] BERHASIL! Terhubung ke Wi-Fi rumah.");
      Serial.printf("[Boot] IP Address ESP32: http://%s\n", WiFi.localIP().toString().c_str());
    } else {
      Serial.println("\n[Boot] Gagal terhubung ke Wi-Fi tersimpan. Mengaktifkan Access Point...");
    }
  }

  // Jika belum ada Wi-Fi tersimpan atau gagal konek, aktifkan SoftAP
  if (!isConnectedToHomeWifi) {
    Serial.println("[Boot] Membuka Access Point default Moci...");
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(AP_SSID, AP_PASS);
    Serial.printf("[Boot] SSID AP: %s | Sandi: %s\n", AP_SSID, AP_PASS);
    Serial.printf("[Boot] Buka Web Moci di peramban: http://%s\n", WiFi.softAPIP().toString().c_str());
  }

  // Registrasi Endpoint REST API
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/status", HTTP_OPTIONS, handleOptions);
  
  server.on("/api/ping", HTTP_GET, handlePing);
  server.on("/api/ping", HTTP_OPTIONS, handleOptions);

  server.on("/api/wifi/scan", HTTP_GET, handleWifiScan);
  server.on("/api/wifi/scan", HTTP_OPTIONS, handleOptions);

  server.on("/api/wifi/connect", HTTP_POST, handleWifiConnect);
  server.on("/api/wifi/connect", HTTP_OPTIONS, handleOptions);

  server.on("/api/wifi/disconnect", HTTP_POST, handleWifiDisconnect);
  server.on("/api/wifi/disconnect", HTTP_OPTIONS, handleOptions);

  server.on("/api/expression", HTTP_POST, handleExpression);
  server.on("/api/expression", HTTP_OPTIONS, handleOptions);

  server.begin();
  Serial.println("[Boot] WebServer HTTP Port 80 aktif!");
}

// -----------------------------------------------------------------------------
// LOOP UTAMA
// -----------------------------------------------------------------------------
void loop() {
  server.handleClient();

  // Dengarkan perintah dari Web Serial USB CDC
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    processSerialCommand(line);
  }
}
