#include <AFMotor.h>
#include <Servo.h>

// ---------------- Motors on Shield ----------------
// 28BYJ-48 stepper on M1+M2 (port 1)
AF_Stepper pillStepper(2048, 1);

// BO motors on M3 and M4
AF_DCMotor boM3(3); // M3
AF_DCMotor boM4(4); // M4

// ---------------- Relays (BO motors ON/OFF) ----------------
const int RELAY_MOTOR_A0 = A0;  // relay IN1
const int RELAY_MOTOR_A1 = A1;  // relay IN2

// Relay type: most relay boards are ACTIVE LOW (LOW=ON, HIGH=OFF)
const bool RELAY_ACTIVE_LOW = true;

// ---------------- Servos ----------------
Servo servoGate;   // main gate (stays attached)
Servo servoDrop;   // drop servo (detach after action)

const int GATE_PIN = 10;
const int DROP_PIN = 9;

// Angles
const int GATE_OPEN  = 10;
const int GATE_CLOSE = 65;

const int DROP_ANGLE = 150;
const int DROP_HOME  = 0;

// ---------------- IR sensor ----------------
const int IR_PIN = A3; // product detection (most modules: LOW = detected)

// ---------------- Settings ----------------
int stepSpeedRpm = 10;         // 28BYJ best 5–20
int m3Speed = 200;             // stored speeds (0–255)
int m4Speed = 200;

bool systemArmed = false;

// ---------------- Helpers ----------------
void relayWrite(int pin, bool on) {
  if (RELAY_ACTIVE_LOW) digitalWrite(pin, on ? LOW : HIGH);
  else                  digitalWrite(pin, on ? HIGH : LOW);
}

void stopAllBOMotors() {
  boM3.run(RELEASE);
  boM4.run(RELEASE);
  relayWrite(RELAY_MOTOR_A0, false);
  relayWrite(RELAY_MOTOR_A1, false);
}

// Kickstart DC motor so it starts reliably
void startMotorKick(AF_DCMotor &m, int speed) {
  m.run(RELEASE);
  delay(30);

  int kick = speed + 40;
  if (kick > 255) kick = 255;

  m.setSpeed(kick);
  m.run(FORWARD);
  delay(120);

  m.setSpeed(speed);
}

// Drop servo action (silent after)
void doDrop() {
  if (!servoDrop.attached()) {
    servoDrop.attach(DROP_PIN);
    delay(20);
  }

  servoDrop.write(DROP_ANGLE);
  delay(400);

  servoDrop.write(DROP_HOME);
  delay(300);

  servoDrop.detach();
}

void stepperMove(int steps, int speedRpm) {
  pillStepper.setSpeed(speedRpm);
  if (steps >= 0) pillStepper.step(steps, FORWARD, SINGLE);
  else            pillStepper.step(-steps, BACKWARD, SINGLE);
}

// Debounced IR detection
bool irDetectedStable() {
  static uint8_t cnt = 0;
  const uint8_t TH = 5;

  bool rawDetected = (digitalRead(IR_PIN) == LOW); // change to HIGH if your IR is reversed

  if (rawDetected) { if (cnt < 10) cnt++; }
  else             { if (cnt > 0) cnt--; }

  return (cnt >= TH);
}

void setup() {
  Serial.begin(115200);

  // IR (pullup avoids floating)
  pinMode(IR_PIN, INPUT_PULLUP);

  // Relays safe OFF
  pinMode(RELAY_MOTOR_A0, OUTPUT);
  pinMode(RELAY_MOTOR_A1, OUTPUT);
  relayWrite(RELAY_MOTOR_A0, false);
  relayWrite(RELAY_MOTOR_A1, false);

  // Motors safe
  boM3.setSpeed(0);
  boM4.setSpeed(0);
  boM3.run(RELEASE);
  boM4.run(RELEASE);

  // Gate servo attach + hold closed
  servoGate.attach(GATE_PIN);
  delay(50);
  servoGate.write(GATE_CLOSE);
  delay(200);

  // Drop servo to home then detach
  servoDrop.attach(DROP_PIN);
  delay(50);
  servoDrop.write(DROP_HOME);
  delay(200);
  servoDrop.detach();

  Serial.println("UNO READY (SAFE). Type: START");
}

void loop() {
  // --------- LOCK UNTIL START ---------
  if (!systemArmed) {
    stopAllBOMotors();
    boM3.setSpeed(0);
    boM4.setSpeed(0);
    servoGate.write(GATE_CLOSE);
    if (servoDrop.attached()) servoDrop.detach();

    if (Serial.available()) {
      String cmd = Serial.readStringUntil('\n');
      cmd.trim(); cmd.toUpperCase();

      if (cmd == "START") {
        systemArmed = true;

        // apply stored speeds
        boM3.setSpeed(m3Speed);
        boM4.setSpeed(m4Speed);

        Serial.println("SYSTEM ARMED");
      } else {
        Serial.println("LOCKED: type START");
      }
    }
    return;
  }

  // --------- IR SAFETY ---------
  if (irDetectedStable()) {
    stopAllBOMotors();
  }

  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  cmd.toUpperCase();

  // STOP (lock again)
  if (cmd == "STOP") {
    systemArmed = false;
    stopAllBOMotors();
    boM3.setSpeed(0);
    boM4.setSpeed(0);
    servoGate.write(GATE_CLOSE);
    if (servoDrop.attached()) servoDrop.detach();
    Serial.println("SYSTEM STOPPED. Type START");
    return;
  }

  // IR read
  if (cmd == "IR?") {
    Serial.print("IR=");
    Serial.println(digitalRead(IR_PIN));
    return;
  }

  // Gate / Drop
  if (cmd == "GATE OPEN") {
    servoGate.write(GATE_OPEN);
    Serial.println("OK GATE OPEN");
  }
  else if (cmd == "GATE CLOSE") {
    servoGate.write(GATE_CLOSE);
    Serial.println("OK GATE CLOSE");
  }
  else if (cmd == "DROP") {
    doDrop();
    Serial.println("OK DROP");
  }

  // Stepper
  else if (cmd.startsWith("STEPSPEED ")) {
    stepSpeedRpm = cmd.substring(10).toInt();
    if (stepSpeedRpm < 5) stepSpeedRpm = 5;
    if (stepSpeedRpm > 20) stepSpeedRpm = 20;
    Serial.println("OK STEPSPEED");
  }
  else if (cmd.startsWith("STEP ")) {
    int steps = cmd.substring(5).toInt();
    stepperMove(steps, stepSpeedRpm);
    Serial.println("OK STEP");
  }

  // M3
  else if (cmd.startsWith("M3 SPEED ")) {
    m3Speed = constrain(cmd.substring(9).toInt(), 0, 255);
    boM3.setSpeed(m3Speed);
    Serial.println("OK M3 SPEED");
  }
  else if (cmd == "M3 ON") {
    if (irDetectedStable()) { stopAllBOMotors(); Serial.println("BLOCKED IR"); }
    else { startMotorKick(boM3, m3Speed); Serial.println("OK M3 ON"); }
  }
  else if (cmd == "M3 OFF") {
    boM3.run(RELEASE);
    Serial.println("OK M3 OFF");
  }

  // M4
  else if (cmd.startsWith("M4 SPEED ")) {
    m4Speed = constrain(cmd.substring(9).toInt(), 0, 255);
    boM4.setSpeed(m4Speed);
    Serial.println("OK M4 SPEED");
  }
  else if (cmd == "M4 ON") {
    if (irDetectedStable()) { stopAllBOMotors(); Serial.println("BLOCKED IR"); }
    else { startMotorKick(boM4, m4Speed); Serial.println("OK M4 ON"); }
  }
  else if (cmd == "M4 OFF") {
    boM4.run(RELEASE);
    Serial.println("OK M4 OFF");
  }

  // Relays
  else if (cmd == "R0 ON") {
    if (irDetectedStable()) { stopAllBOMotors(); Serial.println("BLOCKED IR"); }
    else { relayWrite(RELAY_MOTOR_A0, true); Serial.println("OK R0 ON"); }
  }
  else if (cmd == "R0 OFF") {
    relayWrite(RELAY_MOTOR_A0, false);
    Serial.println("OK R0 OFF");
  }
  else if (cmd == "R1 ON") {
    if (irDetectedStable()) { stopAllBOMotors(); Serial.println("BLOCKED IR"); }
    else { relayWrite(RELAY_MOTOR_A1, true); Serial.println("OK R1 ON"); }
  }
  else if (cmd == "R1 OFF") {
    relayWrite(RELAY_MOTOR_A1, false);
    Serial.println("OK R1 OFF");
  }

  else {
    Serial.println("ERR");
  }
} 