# SKEMA RANGKAIAN LENGKAP ROBOT MOCI (ESP32-S3)
*Dokumentasi Hardware & Wiring Pinout Resmi Proyek PKL*
*Target: ESP32-S3 N16R8 (16MB Flash, 8MB PSRAM)*

---

## 📋 1. DAFTAR KOMPONEN HARDWARE
1. **ESP32-S3 N16R8** (Board Microcontroller Utama)
2. **Modul TP4056 USB-C** (Charger Baterai Li-Po + Proteksi DW01A / FS8205A)
3. **Baterai Li-Po 803450** (3.7V, 2500 mAh)
4. **MT3608 Step-Up Boost Converter** (Menaikkan 3.7V menjadi 5.0V stabil)
5. **MAX98357A I2S Class-D DAC & Amplifier**
6. **Speaker Mini 8Ω 2W**
7. **INMP441 I2S Digital Microphone**
8. **Layar TFT 1.8" ST7735** (128x160 piksel, SPI Bus)
9. **Modul Micro SD Card SPI** (Slot Memori File Musik MP3 & Foto)
10. **Potensiometer B100K** (Pengatur Volume Fisik Putar)
11. **4 Tombol Push Button** (B1: Mode, B2: OK/Action, B3: Next, B4: Power/Sleep)
12. **Resistor 100kΩ (2 buah)** (Voltage Divider Pembaca Baterai ke ADC)
13. **Modul Buzzer 3 Kaki** (KY-012 Active / KY-006 Passive Buzzer untuk nada robot & alarm)

---

## ⚡ 2. SISTEM DAYA & DISTRIBUSI TEGANGAN (POWER MANAGEMENT)

```
[Port USB-C 5V Charger]
         │
         ▼
┌─────────────────┐
│     TP4056      │  (Mengisi Baterai & Melindungi dari Over-Discharge / Short-Circuit)
│ B+           B- │
└────┬─────────┬──┘
     │         │
     ▼         ▼
┌───────────────────────────┐
│ Baterai Li-Po 3.7V 2500mAh │
└───────────────────────────┘
     │         │
     ▼ (OUT+)  ▼ (OUT-)
┌─────────────────┐
│     MT3608      │  ⚠️ PENTING: Putar trimpot MT3608 sampai multimeter
│ IN+         IN- │             menunjukkan OUT = TEPAT 5.0 Volt SEBELUM
│ OUT+       OUT- │             disambungkan ke rangkaian!
└────┬─────────┬──┘
     │ 5.0V    │ GND
     ├─────────┴────────────────────────────────────────┐
     │                                                  │
     ▼                                                  ▼
┌───────────────┐                             ┌───────────────────┐
│   ESP32-S3    │ (Pin 5V / VIN)              │     MAX98357A     │ (Pin VIN / VDD)
│ (Regulator    │                             │ Amplifier Speaker │ (Membutuhkan 5V agar
│  3.3V Onboard)│                             │                   │  daya 2W maksimal)
└───────┬───────┘                             └───────────────────┘
        │ 3.3V Output Bersih
        ├────────────────────────┬──────────────────────┐
        ▼                        ▼                      ▼
┌───────────────┐        ┌───────────────┐      ┌───────────────┐
│   TFT 1.8"    │        │  Micro SD SPI │      │    INMP441    │
│  (VCC: 3.3V)  │        │  (VCC: 3.3V)  │      │  (VDD: 3.3V)  │
└───────────────┘        └───────────────┘      └───────────────┘
```

> **CATATAN PENTING DAYA:**
> - Semua pin **GND** (ESP32, TP4056 OUT-, MT3608 OUT-, MAX98357A, TFT, SD Card, INMP441, Potensio, Tombol) **WAJIB DIHUBUNGKAN MENJADI SATU (COMMON GROUND)**.
> - MAX98357A ditenagai dari **5.0V MT3608**, bukan pin 3.3V ESP32, agar suara kencang, tidak pecah, dan tidak menyebabkan drop tegangan pada ESP32.

---

## 📌 3. DETAIL PINOUT & WIRING SETIAP MODUL

### A. MAX98357A I2S Amplifier ➔ ESP32-S3
| Pin MAX98357A | Pin ESP32-S3 | Keterangan |
|---|---|---|
| **VIN** | **MT3608 5.0V** | Sumber daya 5V audio |
| **GND** | **GND** | Ground bersama |
| **BCLK** | **GPIO 41** | Bit Clock Audio I2S |
| **LRC** | **GPIO 42** | Left/Right Word Select Clock I2S |
| **DIN** | **GPIO 40** | Serial Data Audio Out |
| **SD_MODE** | *Tidak perlu disambung* / 100k ke 3.3V | Default aktif (Mix Stereo ke Mono) |
| **GAIN** | **GND** (atau tidak disambung) | Default gain +9dB atau +12dB |
| **+ / -** | **Speaker 8Ω 2W** | Terminal kabel speaker |

---

### B. Layar TFT 1.8" ST7735 (128x160 SPI) ➔ ESP32-S3
| Pin Layar TFT 1.8" | Pin ESP32-S3 | Keterangan |
|---|---|---|
| **VCC** | **3.3V** | Tegangan logika |
| **GND** | **GND** | Ground |
| **CS** | **GPIO 15** | Chip Select Display |
| **RESET / RST**| **GPIO 4** (atau 3.3V) | Reset Hardware TFT |
| **A0 / DC** | **GPIO 2** | Data / Command Select |
| **SDA / MOSI** | **GPIO 35** (atau GPIO 23) | SPI Master Out Slave In |
| **SCK / SCL** | **GPIO 36** (atau GPIO 18) | SPI Clock |
| **LED / BL** | **3.3V** (lewat resistor 100Ω) | Backlight Layar |

---

### C. Modul Micro SD Card (SPI) ➔ ESP32-S3
| Pin Micro SD Card | Pin ESP32-S3 | Keterangan |
|---|---|---|
| **VCC** | **3.3V** | Daya modul SD |
| **GND** | **GND** | Ground |
| **CS** | **GPIO 10** | Chip Select Micro SD |
| **MOSI** | **GPIO 35** (berbagi pin dengan TFT) | SPI Data Kirim |
| **MISO** | **GPIO 37** | SPI Data Terima dari Kartu SD |
| **SCK** | **GPIO 36** (berbagi pin dengan TFT) | SPI Clock |

---

### D. Mikrofon INMP441 (I2S Input) ➔ ESP32-S3
| Pin INMP441 | Pin ESP32-S3 | Keterangan |
|---|---|---|
| **VDD** | **3.3V** | Tegangan mikrofon |
| **GND** | **GND** | Ground |
| **SD** | **GPIO 37** (atau GPIO 19) | Serial Data Microphone |
| **WS / L/R** | **GPIO 39** | Word Select Clock Mic |
| **SCK** | **GPIO 38** | Bit Clock Mic |
| **L/R** | **GND** | Channel Kiri (Mono) |

---

### E. 4 Tombol Fisik (Push Button) ➔ ESP32-S3
*Semua tombol menggunakan mode internal pull-up (`INPUT_PULLUP`). Kaki 1 tombol ke GPIO, Kaki 2 tombol langsung ke **GND**.*

| Tombol | Pin ESP32-S3 | Kaki Kedua | Fungsi Utama |
|---|---|---|---|
| **B1 (Mode)** | **GPIO 0** (Boot Pin) | **GND** | Mengganti Carousel: Home ➔ Musik ➔ Foto ➔ Alarm ➔ Status |
| **B2 (OK)** | **GPIO 1** | **GND** | Konfirmasi / Play-Pause Musik / Matikan Alarm |
| **B3 (Next)** | **GPIO 5** | **GND** | Next Lagu di SD / Next Foto / Ekspresi Lucu |
| **B4 (Power)**| **GPIO 6** | **GND** | Sleep / Wakeup Layar TFT (Hemat Baterai) |

---

### F. Potensiometer B100K (Volume Analog) ➔ ESP32-S3
| Pin Potensiometer | Pin ESP32-S3 / Daya | Keterangan |
|---|---|---|
| **Kaki 1 (Pinggir)** | **GND** | Ground |
| **Kaki 2 (Tengah)** | **GPIO 8 (ADC1_CH7)** | Sinyal analog tegangan 0 - 3.3V dibaca ADC |
| **Kaki 3 (Pinggir)** | **3.3V** | Tegangan referensi maksimal |

---

### G. Pembaca Voltase Baterai (Voltage Divider) ➔ ESP32-S3
*Karena voltase baterai Li-Po mencapai 4.2V saat penuh, sedangkan pin ADC ESP32 maksimal 3.3V, digunakan 2 resistor 100kΩ sebagai pembagi tegangan 1:2 (maksimal 2.1V masuk ke ADC).*

```
Baterai (+) [3.0V - 4.2V]
      │
     [R1: 100kΩ]
      │
      ├──────────────────▶ Sambung ke GPIO 7 (ADC1_CH6) ESP32-S3
      │
     [R2: 100kΩ]
      │
Baterai (-) & GND ESP32
```
Rumus konversi firmware: `Voltase_Baterai = (ADC_Reading / 4095.0) * 3.3 * 2.0`

---

### H. Modul Buzzer 3 Kaki (KY-012 / KY-006 Beep & Alarm) ➔ ESP32-S3
| Pin Modul Buzzer | Pin ESP32-S3 | Keterangan |
|---|---|---|
| **S / I/O / Signal** | **GPIO 18** | Sinyal frekuensi nada / chirp robot |
| **+ / VCC** | **3.3V** (atau 5V) | Daya modul buzzer |
| **- / GND** | **GND** | Ground bersama |

*Catatan: Modul buzzer 3 kaki biasanya memiliki label pin `S`, `+`, dan `-` pada PCB board modul. Pastikan kabel tidak terbalik.*

---

## 💡 4. PETUNJUK PENYOLDERAN & TROUBLESHOOTING

1. **Kalibrasi MT3608:** Selalu gunakan obeng minus kecil untuk memutar trimpot kuningan berlawanan jarum jam 5-10 putaran hingga multimeter membaca 5.0V di terminal OUT+ dan OUT-. Jangan menghubungkan ESP32 sebelum tegangan 5V dipastikan!
2. **Kapasitor Tambahan (Opsional tapi Direkomendasikan):** Pasang kapasitor elektrolit 470µF - 1000µF 10V/16V paralel di kaki VIN dan GND MAX98357A. Ini akan mencegah suara "pop/kresek-kresek" dan menjaga stabilitas daya saat bass musik berdentum.
3. **Format Micro SD Card:** Gunakan kartu Micro SD berkapasitas 8GB / 16GB / 32GB dengan format **FAT32** (Cluster Size 32KB). Buat folder `/audio` untuk lagu MP3 dan `/photo` untuk file gambar BMP 128x160.
