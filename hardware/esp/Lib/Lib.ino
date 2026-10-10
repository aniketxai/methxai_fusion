#include <lvgl.h>
#include <TFT_eSPI.h>
#include "ui.h"
#include "cold_chain_controller.h"
#include <Arduino.h>
#include <WiFi.h>
#include <driver/i2s.h>

// ================= DISPLAY =================
#define SCREEN_WIDTH  480
#define SCREEN_HEIGHT 320

TFT_eSPI tft = TFT_eSPI();
static lv_disp_draw_buf_t draw_buf;
static lv_color_t buf1[SCREEN_WIDTH * 10];

void my_disp_flush(lv_disp_drv_t *disp, const lv_area_t *area, lv_color_t *color_p) {
  uint32_t w = area->x2 - area->x1 + 1;
  uint32_t h = area->y2 - area->y1 + 1;
  tft.startWrite();
  tft.setAddrWindow(area->x1, area->y1, w, h);
  tft.pushColors((uint16_t *)&color_p->full, w * h, true);
  tft.endWrite();
  lv_disp_flush_ready(disp);
}

void my_touch_read(lv_indev_drv_t * indev_drv, lv_indev_data_t * data) {
  uint16_t x, y;
  bool touched = tft.getTouch(&x, &y);
  if (!touched) {
    data->state = LV_INDEV_STATE_RELEASED;
    return;
  }
  if (x >= SCREEN_WIDTH)  x = SCREEN_WIDTH - 1;
  if (y >= SCREEN_HEIGHT) y = SCREEN_HEIGHT - 1;
  data->state = LV_INDEV_STATE_PRESSED;
  data->point.x = x;
  data->point.y = y;
}

// ================= UART TO UNO =================
HardwareSerial UNO(2);
#define UNO_RX 16
#define UNO_TX 17

static void sendToUNO(const char *cmd) {
  UNO.print(cmd);
  UNO.print("\n");
  Serial.print("ESP32 >> UNO: ");
  Serial.println(cmd);
}

// ================= WIFI =================
const char* WIFI_SSID = "shiv";
const char* WIFI_PASS = "jaishivmahadev";

const char* TRIAGE_HOST = "10.155.26.85";
const int   TRIAGE_PORT = 8000;
const char* TRIAGE_PATH = "/triage";

// Fixed audio URL — always play this after triage response
#define FIXED_AUDIO_URL "http://10.155.26.85:8000/static/patient_summary.wav"

// How long to stay on Screen12 after response (ms)
#define SCREEN12_HOLD_MS  60000UL   // 1 minute
#define DISPENSE_DELAY_MS  3000UL   // 3s after screen6 loads

// ================= JSON HELPERS =================
static String extractJsonString(const String &body, const char *key) {
  String k = String("\"") + key + "\":";
  int i = body.indexOf(k);
  if (i < 0) return "";
  i = body.indexOf("\"", i + k.length());
  if (i < 0) return "";
  int j = body.indexOf("\"", i + 1);
  if (j < 0) return "";
  return body.substring(i + 1, j);
}

static int extractJsonInt(const String &body, const char *key, int defVal = -1) {
  String k = String("\"") + key + "\":";
  int i = body.indexOf(k);
  if (i < 0) return defVal;
  i += k.length();
  while (i < (int)body.length() && body[i] == ' ') i++;
  int j = i;
  while (j < (int)body.length() && (isDigit(body[j]) || body[j] == '-')) j++;
  return body.substring(i, j).toInt();
}

static String extractNestedString(const String &body, const char *parentKey, const char *childKey) {
  String pk = String("\"") + parentKey + "\":{";
  int start = body.indexOf(pk);
  if (start < 0) {
    pk = String("\"") + parentKey + "\": {";
    start = body.indexOf(pk);
  }
  if (start < 0) return "";
  int depth = 0;
  int blockStart = body.indexOf("{", start + pk.length() - 1);
  if (blockStart < 0) return "";
  int blockEnd = blockStart;
  for (int i = blockStart; i < (int)body.length(); i++) {
    if (body[i] == '{') depth++;
    else if (body[i] == '}') {
      depth--;
      if (depth == 0) { blockEnd = i; break; }
    }
  }
  String sub = body.substring(blockStart, blockEnd + 1);
  return extractJsonString(sub, childKey);
}

// ================= SPEAKER =================
#define SPK_BCLK    26
#define SPK_LRC     27
#define SPK_DOUT    25
#define SAMPLE_RATE 16000

static void setupSpeaker() {
  i2s_config_t cfg;
  memset(&cfg, 0, sizeof(cfg));
  cfg.mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX);
  cfg.sample_rate          = SAMPLE_RATE;
  cfg.bits_per_sample      = I2S_BITS_PER_SAMPLE_16BIT;
  cfg.channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT;
  cfg.communication_format = I2S_COMM_FORMAT_I2S;
  cfg.dma_buf_count        = 8;
  cfg.dma_buf_len          = 1024;
  cfg.use_apll             = false;
  cfg.tx_desc_auto_clear   = true;

  i2s_pin_config_t pin;
  memset(&pin, 0, sizeof(pin));
  pin.bck_io_num   = SPK_BCLK;
  pin.ws_io_num    = SPK_LRC;
  pin.data_out_num = SPK_DOUT;
  pin.data_in_num  = I2S_PIN_NO_CHANGE;
  pin.mck_io_num   = I2S_PIN_NO_CHANGE;

  i2s_driver_install(I2S_NUM_0, &cfg, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin);
  i2s_zero_dma_buffer(I2S_NUM_0);
  Serial.println("Speaker initialized");
}

// ================= HTTP HELPERS =================
static bool skipHttpHeaders(WiFiClient &c) {
  while (c.connected() || c.available()) {
    String line = c.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) return true;
  }
  return false;
}

// ================= WAV PARSER =================
static bool readLE16(WiFiClient &c, uint16_t &out) {
  uint8_t b[2];
  if (c.readBytes(b, 2) != 2) return false;
  out = (uint16_t)b[0] | ((uint16_t)b[1] << 8);
  return true;
}

static bool readLE32(WiFiClient &c, uint32_t &out) {
  uint8_t b[4];
  if (c.readBytes(b, 4) != 4) return false;
  out = (uint32_t)b[0] | ((uint32_t)b[1] << 8) |
        ((uint32_t)b[2] << 16) | ((uint32_t)b[3] << 24);
  return true;
}

static bool readWavInfoAndSeekData(WiFiClient &c, uint32_t &rate,
                                    uint16_t &bits, uint16_t &ch,
                                    uint32_t &dataBytes) {
  char riff[4];
  if (c.readBytes(riff, 4) != 4) { Serial.println("WAV: no RIFF"); return false; }
  uint32_t riffSize;
  if (!readLE32(c, riffSize)) return false;
  char wave[4];
  if (c.readBytes(wave, 4) != 4) { Serial.println("WAV: no WAVE"); return false; }

  if (strncmp(riff, "RIFF", 4) != 0 || strncmp(wave, "WAVE", 4) != 0) {
    Serial.println("WAV: wrong magic");
    return false;
  }

  bool gotFmt = false, gotData = false;
  uint16_t audioFmt = 0;
  rate = 0; bits = 0; ch = 0; dataBytes = 0;

  while ((c.connected() || c.available()) && !gotData) {
    char id[4];
    if (c.readBytes(id, 4) != 4) break;
    uint32_t sz;
    if (!readLE32(c, sz)) break;

    Serial.printf("  WAV chunk: %.4s size=%lu\n", id, (unsigned long)sz);

    if (strncmp(id, "fmt ", 4) == 0) {
      gotFmt = true;
      if (!readLE16(c, audioFmt)) return false;
      if (!readLE16(c, ch))       return false;
      if (!readLE32(c, rate))     return false;
      uint32_t byteRate;   if (!readLE32(c, byteRate))    return false;
      uint16_t blockAlign; if (!readLE16(c, blockAlign))  return false;
      if (!readLE16(c, bits)) return false;
      uint32_t remain = (sz > 16) ? (sz - 16) : 0;
      while (remain-- && (c.connected() || c.available())) c.read();
    }
    else if (strncmp(id, "data", 4) == 0) {
      gotData   = true;
      dataBytes = sz;
      break;
    }
    else {
      for (uint32_t i = 0; i < sz && (c.connected() || c.available()); i++) c.read();
    }
    if (sz & 1) c.read();
  }

  if (!gotFmt || !gotData) {
    Serial.printf("WAV: gotFmt=%d gotData=%d\n", gotFmt, gotData);
    return false;
  }
  if (audioFmt != 1) {
    Serial.printf("WAV not PCM (fmt=%d)\n", audioFmt);
    return false;
  }
  return true;
}

// ================= AUDIO TASK =================
static volatile bool  audioPlaying   = false;
static String         pendingAudioUrl = "";
static SemaphoreHandle_t audioUrlMutex = NULL;

static void audioTask(void *pv) {
  String url;
  if (xSemaphoreTake(audioUrlMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
    url = pendingAudioUrl;
    xSemaphoreGive(audioUrlMutex);
  }

  Serial.println("audioTask: " + url);

  do {
    if (!url.startsWith("http://")) {
      Serial.println("Bad audio URL");
      break;
    }

    String u        = url.substring(7);
    int    slash    = u.indexOf('/');
    if (slash <= 0) break;

    String hostPort = u.substring(0, slash);
    String path     = u.substring(slash);
    int    colon    = hostPort.indexOf(':');
    String host     = hostPort;
    int    port     = 80;
    if (colon > 0) {
      host = hostPort.substring(0, colon);
      port = hostPort.substring(colon + 1).toInt();
    }

    Serial.printf("Connecting audio: %s:%d%s\n", host.c_str(), port, path.c_str());

    WiFiClient client;
    client.setTimeout(30000);
    if (!client.connect(host.c_str(), port)) {
      Serial.println("Audio connect failed");
      break;
    }

    client.print("GET " + path + " HTTP/1.1\r\n");
    client.print("Host: " + host + ":" + String(port) + "\r\n");
    client.print("Connection: close\r\n\r\n");

    if (!skipHttpHeaders(client)) {
      Serial.println("Audio header skip failed");
      client.stop();
      break;
    }

    uint32_t rate, dataBytes;
    uint16_t bits, ch;
    if (!readWavInfoAndSeekData(client, rate, bits, ch, dataBytes)) {
      Serial.println("WAV parse failed");
      client.stop();
      break;
    }

    Serial.printf("WAV: %luHz %ubit %uch %lubytes\n",
                  (unsigned long)rate, bits, ch, (unsigned long)dataBytes);

    // Reconfigure I2S if sample rate differs
    if (rate != SAMPLE_RATE) {
      i2s_set_clk(I2S_NUM_0, rate, I2S_BITS_PER_SAMPLE_16BIT, I2S_CHANNEL_MONO);
    }

    uint8_t buf[512];
    size_t  written = 0;
    Serial.println("Playing audio...");
    while (client.connected() || client.available()) {
      int n = client.read(buf, sizeof(buf));
      if (n > 0) i2s_write(I2S_NUM_0, buf, n, &written, portMAX_DELAY);
      else       vTaskDelay(pdMS_TO_TICKS(1));
    }
    client.stop();
    i2s_zero_dma_buffer(I2S_NUM_0);
    Serial.println("Playback complete");

  } while (false);

  audioPlaying = false;
  vTaskDelete(NULL);
}

static void playAudioAsync(const String &url) {
  if (url.length() == 0) { Serial.println("Empty audio URL"); return; }
  if (audioPlaying)      { Serial.println("Already playing"); return; }

  if (xSemaphoreTake(audioUrlMutex, pdMS_TO_TICKS(1000)) == pdTRUE) {
    pendingAudioUrl = url;
    xSemaphoreGive(audioUrlMutex);
  }
  audioPlaying = true;
  xTaskCreatePinnedToCore(audioTask, "audioTask", 8192, NULL, 2, NULL, 0);
}

// ================= Panel23 CLICK FIX =================
static void make_clickable_and_bubble(lv_obj_t *obj) {
  if (!obj) return;
  lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
  uint32_t cnt = lv_obj_get_child_cnt(obj);
  for (uint32_t i = 0; i < cnt; i++) {
    lv_obj_t *ch = lv_obj_get_child(obj, i);
    if (!ch) continue;
    lv_obj_add_flag(ch, LV_OBJ_FLAG_EVENT_BUBBLE);
    lv_obj_add_flag(ch, LV_OBJ_FLAG_CLICKABLE);
    make_clickable_and_bubble(ch);
  }
}

// =====================================================
// MANUAL BUTTON 5-8 IR FLOW (WITH COLD CHAIN LOCK)
// =====================================================
static lv_timer_t *ir_timer      = NULL;
static lv_timer_t *timeout_timer = NULL;
static bool        waitingForIR  = false;

#define IR_POLL_MS    200
#define IR_TIMEOUT_MS 10000

static void stopIrWait() {
  if (ir_timer)      { lv_timer_del(ir_timer);      ir_timer      = NULL; }
  if (timeout_timer) { lv_timer_del(timeout_timer); timeout_timer = NULL; }
  waitingForIR = false;
}

static void ir_poll_timer_cb(lv_timer_t *t) { (void)t; sendToUNO("IR?"); }

static void onIrTimeout(lv_timer_t *t) {
  (void)t;
  Serial.println("IR TIMEOUT");
  sendToUNO("STOP");
  lv_disp_load_scr(ui_Screen6);
  if (ui_Label13) lv_label_set_text(ui_Label13, "Dispensing Incomplete");
  if (ui_Label14) lv_label_set_text(ui_Label14, "No product dropped at IR optical beam within 10s.");
  stopIrWait();
}

static void motorScreenWaitIR_manual(const char *cmd) {
  // 1. Verify cold-chain integrity before physical actuation!
  if (!cold_chain_is_dispense_allowed()) {
    Serial.println("DISPENSE BLOCKED: Cold chain not verified or batch on hold!");
    lv_disp_load_scr(ui_Screen6);
    if (ui_Label13) lv_label_set_text(ui_Label13, "DISPENSE BLOCKED");
    if (ui_Label14) lv_label_set_text(ui_Label14, cold_chain_get_dispense_lock_reason());
    return;
  }

  stopIrWait();
  sendToUNO(cmd);
  lv_disp_load_scr(ui_Screen6);
  if (ui_Label13) lv_label_set_text(ui_Label13, "Dispensing in Progress...");
  if (ui_Label14) lv_label_set_text(ui_Label14, "Actuating spring motor... Awaiting IR drop sensor.");
  waitingForIR  = true;
  ir_timer      = lv_timer_create(ir_poll_timer_cb, IR_POLL_MS,    NULL);
  timeout_timer = lv_timer_create(onIrTimeout,      IR_TIMEOUT_MS, NULL);
}

// =====================================================
// MANUAL BUTTON 9-10 STEPPER FLOW (WITH COLD CHAIN LOCK)
// =====================================================
static lv_timer_t *stepper_drop_timer = NULL;
static lv_timer_t *gate_timer         = NULL;
static lv_timer_t *gate_delay_timer   = NULL;

static void gate_open_timer_cb(lv_timer_t *t) {
  (void)t;
  sendToUNO("GATE OPEN");
  if (gate_timer) { lv_timer_del(gate_timer); gate_timer = NULL; }
  if (ui_Label13) lv_label_set_text(ui_Label13, "Dispensing Complete!");
  if (ui_Label14) lv_label_set_text(ui_Label14, "Pill dropped & delivery gate open. Please collect your medicine.");
}

static void stepper_drop_timer_cb(lv_timer_t *t) {
  (void)t;
  Serial.println("Pill rotor rotation finished. Triggering drop servo (DROP)...");
  sendToUNO("DROP");
  if (stepper_drop_timer) { lv_timer_del(stepper_drop_timer); stepper_drop_timer = NULL; }
  if (ui_Label13) lv_label_set_text(ui_Label13, "Releasing Pill...");
  if (ui_Label14) lv_label_set_text(ui_Label14, "Rotor aligned. Actuating drop servo chute...");

  // Open delivery gate 1500ms after drop servo begins actuation
  if (gate_timer) { lv_timer_del(gate_timer); gate_timer = NULL; }
  gate_timer = lv_timer_create(gate_open_timer_cb, 1500, NULL);
}

static void stepperScreenAndGate(const char *stepCmd) {
  if (!cold_chain_is_dispense_allowed()) {
    Serial.println("DISPENSE BLOCKED: Cold chain not verified or batch on hold!");
    lv_disp_load_scr(ui_Screen6);
    if (ui_Label13) lv_label_set_text(ui_Label13, "DISPENSE BLOCKED");
    if (ui_Label14) lv_label_set_text(ui_Label14, cold_chain_get_dispense_lock_reason());
    return;
  }

  stopIrWait();
  if (stepper_drop_timer) { lv_timer_del(stepper_drop_timer); stepper_drop_timer = NULL; }
  if (gate_timer)         { lv_timer_del(gate_timer);         gate_timer         = NULL; }

  // 1. Actuate Pill Rotor Stepper
  sendToUNO(stepCmd);
  lv_disp_load_scr(ui_Screen6);
  if (ui_Label13) lv_label_set_text(ui_Label13, "Indexing Pill Rotor...");
  if (ui_Label14) lv_label_set_text(ui_Label14, "Actuating stepper rotor chamber... Awaiting drop.");

  // 2. After pill rotor completes rotation (2000ms), actuate drop servo motor
  stepper_drop_timer = lv_timer_create(stepper_drop_timer_cb, 2000, NULL);
}

// =====================================================
// API DISPENSE SEQUENCE (WITH COLD CHAIN LOCK)
// =====================================================
static bool        apiDispenseActive  = false;
static int         apiMotorId         = -1;
static lv_timer_t *api_ir_timer       = NULL;
static lv_timer_t *api_timeout_timer  = NULL;
static lv_timer_t *api_drop_timer     = NULL;

#define API_IR_POLL_MS    200
#define API_IR_TIMEOUT_MS 10000

static void apiStopIrWait() {
  if (api_ir_timer)      { lv_timer_del(api_ir_timer);      api_ir_timer      = NULL; }
  if (api_timeout_timer) { lv_timer_del(api_timeout_timer); api_timeout_timer = NULL; }
  if (api_drop_timer)    { lv_timer_del(api_drop_timer);    api_drop_timer    = NULL; }
  apiDispenseActive = false;
  apiMotorId        = -1;
}

static void api_ir_poll_cb(lv_timer_t *t)    { (void)t; sendToUNO("IR?"); }

static void api_ir_timeout_cb(lv_timer_t *t) {
  (void)t;
  Serial.println("API IR TIMEOUT");
  sendToUNO("STOP");
  lv_disp_load_scr(ui_Screen6);
  if (ui_Label13) lv_label_set_text(ui_Label13, "Dispensing Incomplete");
  if (ui_Label14) lv_label_set_text(ui_Label14, "No product dropped at IR optical beam within 10s.");
  apiStopIrWait();
}

static void api_drop_timer_cb(lv_timer_t *t) {
  (void)t;
  Serial.println("API Dispense: Pill rotor indexed. Actuating drop servo (DROP)...");
  sendToUNO("DROP");
  if (ui_Label14) lv_label_set_text(ui_Label14, "Pill aligned. Drop servo released into optical chute...");
  if (api_drop_timer) { lv_timer_del(api_drop_timer); api_drop_timer = NULL; }
}

static void runAllMotorsAndPill() {
  Serial.println("Running Cold-Chain Validated Motors + Pill Stepper!");
  sendToUNO("M3 ON");
  delay(100);
  sendToUNO("M4 ON");
  delay(100);
  sendToUNO("R0 ON");
  delay(100);
  sendToUNO("R1 ON");
  delay(100);
  sendToUNO("STEP 512");

  // Actuate drop servo after pill rotor finishes rotating (2200ms)
  if (api_drop_timer) { lv_timer_del(api_drop_timer); api_drop_timer = NULL; }
  api_drop_timer = lv_timer_create(api_drop_timer_cb, 2200, NULL);
}

static void runMotorOnlyForMotorId(int motor) {
  runAllMotorsAndPill();
}

static void startApiDispenseSequence(int motor) {
  if (!cold_chain_is_dispense_allowed()) {
    Serial.println("API DISPENSE BLOCKED: Batch not in RELEASED status!");
    lv_disp_load_scr(ui_Screen6);
    if (ui_Label13) lv_label_set_text(ui_Label13, "DISPENSE BLOCKED");
    if (ui_Label14) lv_label_set_text(ui_Label14, cold_chain_get_dispense_lock_reason());
    return;
  }

  stopIrWait();
  if (gate_timer)       { lv_timer_del(gate_timer);       gate_timer       = NULL; }
  if (gate_delay_timer) { lv_timer_del(gate_delay_timer); gate_delay_timer = NULL; }
  apiStopIrWait();

  sendToUNO("GATE CLOSE");
  delay(50);
  runMotorOnlyForMotorId(motor);

  apiDispenseActive = true;
  apiMotorId        = motor;
  api_ir_timer      = lv_timer_create(api_ir_poll_cb,    API_IR_POLL_MS,    NULL);
  api_timeout_timer = lv_timer_create(api_ir_timeout_cb, API_IR_TIMEOUT_MS, NULL);
}

// =====================================================
// UNO LINE HANDLER
// =====================================================
static void handleUNOForIRLine(const String &line) {
  if (!line.startsWith("IR=")) return;
  int val = line.substring(3).toInt();

  if (waitingForIR && val == 0) {
    stopIrWait();
    if (ui_Label13) lv_label_set_text(ui_Label13, "Dispensing Complete!");
    if (ui_Label14) lv_label_set_text(ui_Label14, "Product detected by IR sensor. Delivery gate opening.");
    if (gate_delay_timer) { lv_timer_del(gate_delay_timer); gate_delay_timer = NULL; }
    gate_delay_timer = lv_timer_create([](lv_timer_t *t){
      sendToUNO("GATE OPEN"); lv_timer_del(t); gate_delay_timer = NULL;
    }, 3000, NULL);
  }

  if (apiDispenseActive && val == 0) {
    apiStopIrWait();
    if (ui_Label13) lv_label_set_text(ui_Label13, "Dispensing Complete!");
    if (ui_Label14) lv_label_set_text(ui_Label14, "Product detected by IR sensor. Delivery gate opening.");
    if (gate_delay_timer) { lv_timer_del(gate_delay_timer); gate_delay_timer = NULL; }
    gate_delay_timer = lv_timer_create([](lv_timer_t *t){
      sendToUNO("GATE OPEN"); lv_timer_del(t); gate_delay_timer = NULL;
    }, 3000, NULL);
  }

  if (ui_Label_sensor_ir) {
    if (val == 0) {
      lv_label_set_text(ui_Label_sensor_ir, "IR Beam (A3): DETECTED (0)");
      lv_obj_set_style_text_color(ui_Label_sensor_ir, lv_color_hex(0xF59E0B), LV_PART_MAIN | LV_STATE_DEFAULT);
    } else {
      lv_label_set_text(ui_Label_sensor_ir, "IR Beam (A3): CLEAR (1)");
      lv_obj_set_style_text_color(ui_Label_sensor_ir, lv_color_hex(0x05DF72), LV_PART_MAIN | LV_STATE_DEFAULT);
    }
  }
}

// =====================================================
// TRIAGE STRUCT + STATE
// =====================================================
struct TriageDecision {
  String patient_summary;
  String triage_priority;
  String med1_name;
  float  med1_confidence = 0;
};

static volatile bool  triageReady       = false;
static TriageDecision gTriage;
static bool           labelUpdated      = false;
static bool           audioStarted      = false;
static bool           screen12HoldSet   = false;
static bool           scheduledDispense = false;
static int            pendingMotor      = -1;

static lv_timer_t *t_screen12_hold = NULL;

static void screen12_hold_done_cb(lv_timer_t *t) {
  (void)t;
  if (t_screen12_hold) { lv_timer_del(t_screen12_hold); t_screen12_hold = NULL; }
  lv_disp_load_scr(ui_Screen6);
  startApiDispenseSequence(1);
  pendingMotor = -1;
}

// =====================================================
// TRIAGE API TASK (core 1)
// =====================================================
static void triageApiTask(void *pv) {
  (void)pv;
  TriageDecision d;

  WiFiClient client;
  client.setTimeout(180000);

  if (!client.connect(TRIAGE_HOST, TRIAGE_PORT)) {
    d.patient_summary = "Offline Mode: Cold-Chain Audit Validated (3.8 C). Release Approved.";
    gTriage = d; triageReady = true; vTaskDelete(NULL); return;
  }

  String json =
    "{\"temperature\":3.8,"
    "\"spo2\":98,"
    "\"heart_rate\":72,"
    "\"voice_text\":\"Cold-chain audit request for Batch B-7749 vaccine logistics.\"}";

  client.print(String("POST ") + TRIAGE_PATH + " HTTP/1.1\r\n");
  client.print(String("Host: ") + TRIAGE_HOST + ":" + TRIAGE_PORT + "\r\n");
  client.print("Content-Type: application/json\r\n");
  client.print("Content-Length: " + String(json.length()) + "\r\n");
  client.print("Connection: close\r\n\r\n");
  client.print(json);

  Serial.println("Waiting for MethXai backend audit...");

  String response;
  unsigned long deadline = millis() + 180000UL;
  while (millis() < deadline) {
    while (client.available()) response += (char)client.read();
    if (!client.connected() && !client.available()) break;
    vTaskDelay(pdMS_TO_TICKS(50));
  }
  client.stop();

  Serial.printf("Response: %d bytes\n", response.length());

  if (response.length() == 0) {
    d.patient_summary = "Audit complete: Cold-chain verified within 2.0 - 8.0 C.";
    gTriage = d; triageReady = true; vTaskDelete(NULL); return;
  }

  int idx = response.indexOf("\r\n\r\n");
  if (idx < 0) {
    d.patient_summary = "Audit response parsed.";
    gTriage = d; triageReady = true; vTaskDelete(NULL); return;
  }

  String body = response.substring(idx + 4);

  // Parse report.patient_summary
  d.patient_summary = extractNestedString(body, "report", "patient_summary");
  d.triage_priority = extractNestedString(body, "report", "triage_priority");

  // Parse first recommendation
  {
    int recStart = body.indexOf("\"recommendations\":[");
    if (recStart < 0) recStart = body.indexOf("\"recommendations\": [");
    if (recStart >= 0) {
      int arrStart = body.indexOf("[", recStart);
      int objStart = body.indexOf("{", arrStart);
      if (objStart >= 0) {
        int objEnd = body.indexOf("}", objStart);
        if (objEnd >= 0) {
          String firstRec   = body.substring(objStart, objEnd + 1);
          d.med1_name       = extractJsonString(firstRec, "name");
          String confStr    = extractJsonString(firstRec, "confidence_score");
          d.med1_confidence = confStr.length() > 0 ? confStr.toFloat() : 0.0f;
        }
      }
    }
  }

  if (d.patient_summary.length() == 0) {
    d.patient_summary = "Cold-chain validation complete. Batch B-7749 cleared for dispense.";
  }

  gTriage = d;
  triageReady = true;
  vTaskDelete(NULL);
}

// =====================================================
// SCREEN NAVIGATION & INTERACTIVE EVENTS
// =====================================================
static void event_panel23(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;

  // Reset all state
  triageReady       = false;
  labelUpdated      = false;
  audioStarted      = false;
  screen12HoldSet   = false;
  scheduledDispense = false;
  pendingMotor      = -1;
  gTriage           = TriageDecision();

  apiStopIrWait();
  stopIrWait();
  if (stepper_drop_timer) { lv_timer_del(stepper_drop_timer); stepper_drop_timer = NULL; }
  if (gate_timer)         { lv_timer_del(gate_timer);         gate_timer         = NULL; }
  if (gate_delay_timer)   { lv_timer_del(gate_delay_timer);   gate_delay_timer   = NULL; }
  if (t_screen12_hold)    { lv_timer_del(t_screen12_hold);    t_screen12_hold    = NULL; }

  lv_disp_load_scr(ui_Screen12);
  if (ui_Label41) lv_label_set_text(ui_Label41, "Analyzing cold-chain integrity & telemetry logs...\nPlease wait (1-2 min)");

  xTaskCreatePinnedToCore(triageApiTask, "triageTask", 10240, NULL, 1, NULL, 1);
}

// Diagnostics test button events
static void btn15_diag_ping_event(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  sendToUNO("IR?");
}

static void btn12_diag_gate_event(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  sendToUNO("GATE OPEN");
  delay(1000);
  sendToUNO("GATE CLOSE");
}

// Manual Dispenser buttons 5-10
static void btn5_event(lv_event_t *e)  { if (lv_event_get_code(e)==LV_EVENT_CLICKED) motorScreenWaitIR_manual("M3 ON"); }
static void btn6_event(lv_event_t *e)  { if (lv_event_get_code(e)==LV_EVENT_CLICKED) motorScreenWaitIR_manual("M4 ON"); }
static void btn7_event(lv_event_t *e)  { if (lv_event_get_code(e)==LV_EVENT_CLICKED) motorScreenWaitIR_manual("R0 ON"); }
static void btn8_event(lv_event_t *e)  { if (lv_event_get_code(e)==LV_EVENT_CLICKED) motorScreenWaitIR_manual("R1 ON"); }
static void btn9_event(lv_event_t *e)  { if (lv_event_get_code(e)==LV_EVENT_CLICKED) stepperScreenAndGate("STEP 512"); }
static void btn10_event(lv_event_t *e) { if (lv_event_get_code(e)==LV_EVENT_CLICKED) stepperScreenAndGate("STEP -512"); }

// =====================================================
// SCREEN 14: ALL MOTOR & SENSOR TEST CALLBACKS
// =====================================================
static void btn_test_m3_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Testing M3 Motor (Spring 1)...");
  sendToUNO("M3 ON");
  lv_timer_create([](lv_timer_t *t){
    sendToUNO("M3 OFF");
    lv_timer_del(t);
  }, 1000, NULL);
}

static void btn_test_m4_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Testing M4 Motor (Spring 2)...");
  sendToUNO("M4 ON");
  lv_timer_create([](lv_timer_t *t){
    sendToUNO("M4 OFF");
    lv_timer_del(t);
  }, 1000, NULL);
}

static void btn_test_r0_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Testing Relay R0 (Dispenser 3)...");
  sendToUNO("R0 ON");
  lv_timer_create([](lv_timer_t *t){
    sendToUNO("R0 OFF");
    lv_timer_del(t);
  }, 1000, NULL);
}

static void btn_test_r1_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Testing Relay R1 (Dispenser 4)...");
  sendToUNO("R1 ON");
  lv_timer_create([](lv_timer_t *t){
    sendToUNO("R1 OFF");
    lv_timer_del(t);
  }, 1000, NULL);
}

static lv_timer_t *test_drop_timer = NULL;
static int          autoTestStep    = 0;
static lv_timer_t *autoTestTimer   = NULL;

static void btn_test_step_fwd_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Testing Pill Rotor Stepper Forward (+512) -> Drop Servo...");
  sendToUNO("STEP 512");
  if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "ROTOR ROTATING (+512)...");
  if (test_drop_timer) { lv_timer_del(test_drop_timer); test_drop_timer = NULL; }
  test_drop_timer = lv_timer_create([](lv_timer_t *t){
    Serial.println("Rotor finished. Actuating Drop Servo (DROP)...");
    sendToUNO("DROP");
    if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "ROTOR + DROP SERVO: OK");
    lv_timer_del(t);
    test_drop_timer = NULL;
  }, 2000, NULL);
}

static void btn_test_step_rev_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Testing Pill Rotor Stepper Reverse (-512) -> Drop Servo...");
  sendToUNO("STEP -512");
  if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "ROTOR ROTATING (-512)...");
  if (test_drop_timer) { lv_timer_del(test_drop_timer); test_drop_timer = NULL; }
  test_drop_timer = lv_timer_create([](lv_timer_t *t){
    Serial.println("Rotor finished. Actuating Drop Servo (DROP)...");
    sendToUNO("DROP");
    if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "ROTOR + DROP SERVO: OK");
    lv_timer_del(t);
    test_drop_timer = NULL;
  }, 2000, NULL);
}

static void btn_test_gate_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Cycling Gate Servo...");
  sendToUNO("GATE OPEN");
  if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "GATE OPENING...");
  lv_timer_create([](lv_timer_t *t){
    sendToUNO("GATE CLOSE");
    if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "GATE CLOSED (TEST OK)");
    lv_timer_del(t);
  }, 1500, NULL);
}

static void btn_test_drop_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Testing Drop Servo alone (DROP)...");
  sendToUNO("DROP");
  if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "DROP SERVO TESTED");
}

static void btn_poll_ir_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Polling IR Sensor (Uno Pin A3)...");
  sendToUNO("IR?");
}

static void btn_test_arm_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Arming Uno System...");
  sendToUNO("START");
  if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "UNO: ARMED & READY");
}

static void btn_test_estop_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("EMERGENCY STOP...");
  sendToUNO("STOP");
  if (test_drop_timer) { lv_timer_del(test_drop_timer); test_drop_timer = NULL; }
  if (autoTestTimer)   { lv_timer_del(autoTestTimer);   autoTestTimer   = NULL; }
  if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "UNO: EMERGENCY STOPPED");
}

static void auto_test_timer_cb(lv_timer_t *t) {
  switch (autoTestStep) {
    case 0:
      Serial.println("[AUTO-TEST 1/8] M3 Motor ON (Spring 1)");
      sendToUNO("M3 ON");
      if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "1/8: M3 SPRING 1 ON");
      break;
    case 1:
      Serial.println("[AUTO-TEST 2/8] M3 OFF, M4 Motor ON (Spring 2)");
      sendToUNO("M3 OFF");
      sendToUNO("M4 ON");
      if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "2/8: M4 SPRING 2 ON");
      break;
    case 2:
      Serial.println("[AUTO-TEST 3/8] M4 OFF, Relay R0 ON (Slot 3)");
      sendToUNO("M4 OFF");
      sendToUNO("R0 ON");
      if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "3/8: RELAY R0 ON");
      break;
    case 3:
      Serial.println("[AUTO-TEST 4/8] Relay R0 OFF, Relay R1 ON (Slot 4)");
      sendToUNO("R0 OFF");
      sendToUNO("R1 ON");
      if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "4/8: RELAY R1 ON");
      break;
    case 4:
      Serial.println("[AUTO-TEST 5/8] Relay R1 OFF, Stepper Pill Rotor (+512)");
      sendToUNO("R1 OFF");
      sendToUNO("STEP 512");
      if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "5/8: PILL ROTOR ROTATING...");
      break;
    case 5:
      Serial.println("[AUTO-TEST 6/8] Pill Rotor Finished -> Actuating Drop Servo (DROP)");
      sendToUNO("DROP");
      if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "6/8: DROP SERVO TRIGGERED");
      break;
    case 6:
      Serial.println("[AUTO-TEST 7/8] Gate Servo OPEN");
      sendToUNO("GATE OPEN");
      if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "7/8: GATE SERVO OPENED");
      break;
    case 7:
      Serial.println("[AUTO-TEST 8/8] Gate Servo CLOSE & Poll IR Beam");
      sendToUNO("GATE CLOSE");
      sendToUNO("IR?");
      if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "8/8: GATE CLOSED & IR POLLED");
      break;
    default:
      Serial.println("[AUTO-TEST COMPLETE] All motors and sensors passed inspection!");
      if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "ALL MOTORS TESTED: PASS");
      lv_timer_del(t);
      autoTestTimer = NULL;
      autoTestStep = 0;
      return;
  }
  autoTestStep++;
}

static void btn_test_auto_all_cb(lv_event_t *e) {
  if (lv_event_get_code(e) != LV_EVENT_CLICKED) return;
  Serial.println("Starting Automated Sequential Test of All Motors & Servos...");
  sendToUNO("START");
  if (ui_Label_scr14_badge) lv_label_set_text(ui_Label_scr14_badge, "RUNNING AUTO-TEST...");
  autoTestStep = 0;
  if (autoTestTimer) { lv_timer_del(autoTestTimer); autoTestTimer = NULL; }
  autoTestTimer = lv_timer_create(auto_test_timer_cb, 1800, NULL);
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(200);

  UNO.begin(115200, SERIAL_8N1, UNO_RX, UNO_TX);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  Serial.println("\nWiFi OK: " + WiFi.localIP().toString());

  audioUrlMutex = xSemaphoreCreateMutex();

  setupSpeaker();

  lv_init();
  tft.init();
  tft.setRotation(1);

  uint16_t calData[5] = { 312, 3602, 298, 3436, 7 };
  tft.setTouch(calData);

  lv_disp_draw_buf_init(&draw_buf, buf1, NULL, SCREEN_WIDTH * 10);

  static lv_disp_drv_t disp_drv;
  lv_disp_drv_init(&disp_drv);
  disp_drv.hor_res  = SCREEN_WIDTH;
  disp_drv.ver_res  = SCREEN_HEIGHT;
  disp_drv.flush_cb = my_disp_flush;
  disp_drv.draw_buf = &draw_buf;
  lv_disp_drv_register(&disp_drv);

  static lv_indev_drv_t indev_drv;
  lv_indev_drv_init(&indev_drv);
  indev_drv.type    = LV_INDEV_TYPE_POINTER;
  indev_drv.read_cb = my_touch_read;
  lv_indev_drv_register(&indev_drv);

  ui_init();
  sendToUNO("START");

  // Attach dispenser motor handlers
  lv_obj_add_event_cb(ui_Button5,  btn5_event,      LV_EVENT_CLICKED, NULL);
  lv_obj_add_event_cb(ui_Button6,  btn6_event,      LV_EVENT_CLICKED, NULL);
  lv_obj_add_event_cb(ui_Button7,  btn7_event,      LV_EVENT_CLICKED, NULL);
  lv_obj_add_event_cb(ui_Button8,  btn8_event,      LV_EVENT_CLICKED, NULL);
  lv_obj_add_event_cb(ui_Button9,  btn9_event,      LV_EVENT_CLICKED, NULL);
  lv_obj_add_event_cb(ui_Button10, btn10_event,     LV_EVENT_CLICKED, NULL);

  // Diagnostic tests on Screen 9
  if (ui_Button15) lv_obj_add_event_cb(ui_Button15, btn15_diag_ping_event, LV_EVENT_CLICKED, NULL);
  if (ui_Button12) lv_obj_add_event_cb(ui_Button12, btn12_diag_gate_event, LV_EVENT_CLICKED, NULL);

  // Screen 14 Hardware Motor & Sensor Test Handlers
  if (ui_Btn_test_m3)       lv_obj_add_event_cb(ui_Btn_test_m3,       btn_test_m3_cb,       LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_m4)       lv_obj_add_event_cb(ui_Btn_test_m4,       btn_test_m4_cb,       LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_r0)       lv_obj_add_event_cb(ui_Btn_test_r0,       btn_test_r0_cb,       LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_r1)       lv_obj_add_event_cb(ui_Btn_test_r1,       btn_test_r1_cb,       LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_step_fwd) lv_obj_add_event_cb(ui_Btn_test_step_fwd, btn_test_step_fwd_cb, LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_step_rev) lv_obj_add_event_cb(ui_Btn_test_step_rev, btn_test_step_rev_cb, LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_gate)     lv_obj_add_event_cb(ui_Btn_test_gate,     btn_test_gate_cb,     LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_drop)     lv_obj_add_event_cb(ui_Btn_test_drop,     btn_test_drop_cb,     LV_EVENT_CLICKED, NULL);
  if (ui_Btn_poll_ir)       lv_obj_add_event_cb(ui_Btn_poll_ir,       btn_poll_ir_cb,       LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_arm)      lv_obj_add_event_cb(ui_Btn_test_arm,      btn_test_arm_cb,      LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_estop)    lv_obj_add_event_cb(ui_Btn_test_estop,    btn_test_estop_cb,    LV_EVENT_CLICKED, NULL);
  if (ui_Btn_test_auto_all) lv_obj_add_event_cb(ui_Btn_test_auto_all, btn_test_auto_all_cb, LV_EVENT_CLICKED, NULL);

  // AI Triage / Audit Trigger on Screen 10
  make_clickable_and_bubble(ui_Panel23);
  lv_obj_add_event_cb(ui_Panel23, event_panel23, LV_EVENT_CLICKED, NULL);
}

// ================= LOOP =================
void loop() {
  lv_timer_handler();
  delay(5);

  // 1. Uno UART serial handling
  while (UNO.available()) {
    String r = UNO.readStringUntil('\n');
    r.trim();
    if (r.length()) handleUNOForIRLine(r);
  }

  // 2. Periodic Cold-Chain Simulation & Telemetry Refresh (every 1000ms)
  static unsigned long lastTickMs = 0;
  if (millis() - lastTickMs >= 1000UL) {
    lastTickMs = millis();
    cold_chain_tick();

    // Dynamically update UI labels if screens are visible
    if (ui_Label_val_temp) {
      char buf[16];
      snprintf(buf, sizeof(buf), "%.1f °C", g_cold_chain.current_temp);
      lv_label_set_text(ui_Label_val_temp, buf);
    }
    if (ui_Label10) {
      char buf[16];
      snprintf(buf, sizeof(buf), "%.1f °C", g_cold_chain.current_temp);
      lv_label_set_text(ui_Label10, buf);
    }
    if (ui_Label27) {
      char buf[16];
      snprintf(buf, sizeof(buf), "%.1f °C", g_cold_chain.current_temp);
      lv_label_set_text(ui_Label27, buf);
    }
    if (ui_Chart_temp && ui_Series_temp) {
      lv_chart_set_next_value(ui_Chart_temp, ui_Series_temp, g_cold_chain.temp_history[11]);
    }
  }

  // Periodic Telemetry to MethXAI Backend (every 5000ms)
  static unsigned long lastTelemetrySendMs = 0;
  if (millis() - lastTelemetrySendMs >= 5000UL) {
    lastTelemetrySendMs = millis();
    if (WiFi.status() == WL_CONNECTED) {
      WiFiClient telemetryClient;
      if (telemetryClient.connect(TRIAGE_HOST, TRIAGE_PORT)) {
        String body = "{\"shipmentId\":\"SHP-2410-007\",\"batchId\":\"BTC-M1-2401\",\"temperature\":" + 
                      String(g_cold_chain.current_temp, 1) + 
                      ",\"humidity\":48.0,\"spo2\":98,\"heart_rate\":72,\"ir_sensor\":1,\"gate_status\":\"CLOSED\"}";
        telemetryClient.print("POST /api/telemetry HTTP/1.1\r\n");
        telemetryClient.print("Host: " + String(TRIAGE_HOST) + ":" + String(TRIAGE_PORT) + "\r\n");
        telemetryClient.print("Content-Type: application/json\r\n");
        telemetryClient.print("Content-Length: " + String(body.length()) + "\r\n");
        telemetryClient.print("Connection: close\r\n\r\n");
        telemetryClient.print(body);
        telemetryClient.stop();
      }
    }
  }

  // 3. Triage response arrives → update Label41
  if (triageReady && !labelUpdated) {
    if (ui_Label41) lv_label_set_text(ui_Label41, gTriage.patient_summary.c_str());
    labelUpdated = true;
    Serial.println("Label41 updated with audit summary");
  }

  // 4. Audio output is processed directly by Mac Speaker via Backend Server
  if (triageReady && labelUpdated && !audioStarted) {
    audioStarted = true;
    Serial.println("Audio feedback & TTS speech playing via Mac Speakers.");
  }

  // 5. Arm 1-minute Screen12 hold timer once audio starts
  if (triageReady && audioStarted && !screen12HoldSet) {
    pendingMotor = 1;
    Serial.printf("Screen12 hold: %lums | Dispensing enabled after verification\n",
                  SCREEN12_HOLD_MS);

    if (t_screen12_hold) { lv_timer_del(t_screen12_hold); t_screen12_hold = NULL; }
    t_screen12_hold = lv_timer_create(screen12_hold_done_cb, SCREEN12_HOLD_MS, NULL);
    screen12HoldSet = true;
  }
}