import React, { useState } from 'react';
import { 
  Play, ShieldAlert, Cpu, CheckCircle2, AlertTriangle, 
  RotateCw, Power, Zap, Activity, Volume2, ChevronRight, Lock, ArrowLeft, ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

const SCREENS = [
  { id: 1, name: 'Boot Loading', label: 'Screen 1: Boot Splash' },
  { id: 2, name: 'System Overview', label: 'Screen 2: Status & Cold Chain Hub' },
  { id: 3, name: 'Temp Monitoring', label: 'Screen 3: Live Temperature' },
  { id: 4, name: 'Batch Stock', label: 'Screen 4: Vaccine Matrix' },
  { id: 5, name: 'Motor Selection', label: 'Screen 5: Dispenser Control' },
  { id: 6, name: 'Dispense Chute', label: 'Screen 6: Active Delivery Chute' },
  { id: 7, name: 'GPS Telemetry', label: 'Screen 7: Location & Route' },
  { id: 8, name: 'Excursion Audit', label: 'Screen 8: Checkpoint Logs' },
  { id: 9, name: 'Diagnostics', label: 'Screen 9: Gate & Ping Test' },
  { id: 10, name: 'Quality Audit', label: 'Screen 10: Clinical Audit Protocol' },
  { id: 11, name: 'Sensor Telemetry', label: 'Screen 11: Patient Vitals' },
  { id: 12, name: 'Quality Verification', label: 'Screen 12: Automated Release Lock' },
  { id: 13, name: 'Safety Locks', label: 'Screen 13: Override Control' },
  { id: 14, name: 'Motor Test Grid', label: 'Screen 14: Hardware Diagnostics' }
];

const DEFAULT_SLOTS = [
  { id: 1, product: 'Medicine M1', motor: 'M3 (Spring 1)', cmd: 'M3 ON', batch: 'BTC-M1-2401', status: 'READY', stock: 14 },
  { id: 2, product: 'Medicine M2', motor: 'M4 (Spring 2)', cmd: 'M4 ON', batch: 'BTC-M2-2403', status: 'READY', stock: 8 },
  { id: 3, product: 'Medicine M3', motor: 'R0 (Relay 1)', cmd: 'R0 ON', batch: 'BTC-M3-2401', status: 'READY', stock: 20 },
  { id: 4, product: 'Medicine M4', motor: 'R1 (Relay 2)', cmd: 'R1 ON', batch: 'BTC-M4-2402', status: 'QUALITY_HOLD', stock: 5 },
  { id: 5, product: 'Medicine M5', motor: 'STEPPER FWD (+512)', cmd: 'STEP 512', batch: 'BTC-M5-2401', status: 'READY', stock: 30 },
  { id: 6, product: 'Medicine M6', motor: 'STEPPER REV (-512)', cmd: 'STEP -512', batch: 'BTC-M6-2312', status: 'READY', stock: 12 },
];

export default function LvglDisplayMirror({ 
  activeScreen = 14, 
  dispenserStatus = {}, 
  onScreenChange, 
  onCommandExecute 
}) {
  const [loadingAction, setLoadingAction] = useState(null);
  const [overrideLock, setOverrideLock] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const currentTemp = dispenserStatus.currentTemp ?? 3.8;
  const gateStatus = dispenserStatus.gateStatus || 'CLOSED';
  const irStatus = dispenserStatus.irBeamStatus || 'CLEAR';
  const motorState = dispenserStatus.motorState || 'IDLE';
  const lastCmd = dispenserStatus.lastCommand || 'None';
  const slotsList = (dispenserStatus.slots && dispenserStatus.slots.length > 0) ? dispenserStatus.slots : DEFAULT_SLOTS;

  const handleMotorClick = async (cmd, slotId = null) => {
    try {
      setLoadingAction(cmd);
      setActionMessage(`Executing command: ${cmd}...`);
      const res = await api.controlMotor(cmd, slotId, overrideLock);
      setActionMessage(res.message || `Command ${cmd} dispatched successfully!`);
      if (onCommandExecute) onCommandExecute(cmd, res);
    } catch (err) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSelectScreen = async (screenId) => {
    if (onScreenChange) onScreenChange(screenId);
    try {
      await api.setLvglScreen(screenId);
    } catch (e) {
      console.warn('Failed to sync screen with backend', e);
    }
  };

  return (
    <div style={{ background: '#0F172A', borderRadius: '12px', border: '1px solid #1E293B', padding: '16px', color: '#F8FAFC' }}>
      {/* Header & Screen Navigator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={20} color="#38BDF8" />
          <span style={{ fontWeight: 600, fontSize: '15px', color: '#F1F5F9' }}>LVGL TFT Display Mirror (320x480)</span>
          <span style={{ fontSize: '11px', background: '#0284C7', color: '#FFF', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
            Active Screen #{activeScreen}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: overrideLock ? '#EF4444' : '#94A3B8', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={overrideLock} 
              onChange={(e) => setOverrideLock(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <Lock size={13} color={overrideLock ? '#EF4444' : '#94A3B8'} />
            Override Safety Lock
          </label>

          <button 
            onClick={() => handleMotorClick('STOP')}
            style={{
              background: '#DC2626', color: '#FFF', border: 'none', padding: '5px 12px',
              borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <ShieldAlert size={14} /> E-STOP
          </button>
        </div>
      </div>

      {/* Screen Selector Chips */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '12px' }}>
        {SCREENS.map((s) => (
          <button
            key={s.id}
            onClick={() => handleSelectScreen(s.id)}
            style={{
              background: activeScreen === s.id ? '#0284C7' : '#1E293B',
              color: activeScreen === s.id ? '#FFFFFF' : '#94A3B8',
              border: activeScreen === s.id ? '1px solid #38BDF8' : '1px solid #334155',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: activeScreen === s.id ? 700 : 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {s.id}. {s.name}
          </button>
        ))}
      </div>

      {/* Status Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px', background: '#1E293B', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}>
        <div>
          <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>TEMP SENSOR</span>
          <span style={{ color: currentTemp >= 2 && currentTemp <= 8 ? '#10B981' : '#EF4444', fontWeight: 700 }}>{currentTemp.toFixed(1)} °C</span>
        </div>
        <div>
          <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>DELIVERY GATE</span>
          <span style={{ color: gateStatus === 'OPEN' ? '#10B981' : '#F59E0B', fontWeight: 700 }}>{gateStatus}</span>
        </div>
        <div>
          <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>IR BEAM (A3)</span>
          <span style={{ color: irStatus === 'DETECTED' ? '#F59E0B' : '#10B981', fontWeight: 700 }}>{irStatus}</span>
        </div>
        <div>
          <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>LAST UART CMD</span>
          <span style={{ color: '#38BDF8', fontWeight: 700, fontFamily: 'monospace' }}>{lastCmd}</span>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionMessage && (
        <div style={{ background: actionMessage.includes('Error') ? '#450A0A' : '#064E3B', color: actionMessage.includes('Error') ? '#FCA5A5' : '#6EE7B7', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={14} /> {actionMessage}
        </div>
      )}

      {/* 320x480 LVGL Frame Simulator */}
      <div style={{
        maxWidth: '480px',
        margin: '0 auto',
        minHeight: '340px',
        background: '#020617',
        border: '3px solid #334155',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(0,0,0,0.8)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justify: 'space-between'
      }}>
        <div>
          {/* Top LVGL Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1E293B', paddingBottom: '8px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0EA5E9' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8', letterSpacing: '0.5px' }}>METHXAI FUSION</span>
            </div>
            <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>
              {SCREENS.find(s => s.id === activeScreen)?.label}
            </span>
          </div>

          {/* SCREEN 1: BOOT LOADING */}
          {activeScreen === 1 && (
            <div style={{ textAlign: 'center', paddingTop: '30px' }}>
              <Zap size={44} color="#38BDF8" style={{ marginBottom: '12px', animation: 'pulse 1.5s infinite' }} />
              <h3 style={{ margin: '0 0 8px 0', color: '#F8FAFC' }}>MethXAI Cold-Chain Boot</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>Initializing LVGL 8.3 & ESP32 UART Mesh...</p>
              <div style={{ width: '80%', height: '8px', background: '#1E293B', borderRadius: '4px', margin: '0 auto', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #0284C7, #38BDF8)' }} />
              </div>
              <button 
                onClick={() => handleSelectScreen(2)} 
                style={{ width: '100%', marginTop: '20px', background: '#0284C7', color: '#FFF', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                Proceed to System Overview (Screen 2) →
              </button>
            </div>
          )}

          {/* SCREEN 2: SYSTEM OVERVIEW */}
          {activeScreen === 2 && (
            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#38BDF8', fontSize: '13px' }}>System Status & Cold Chain Hub</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                <div style={{ background: '#0F172A', padding: '8px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                  <div style={{ fontSize: '9px', color: '#64748B' }}>STORAGE TEMP</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#10B981' }}>{currentTemp.toFixed(1)} °C</div>
                  <div style={{ fontSize: '8px', color: '#10B981' }}>2-8°C Target OK</div>
                </div>
                <div style={{ background: '#0F172A', padding: '8px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                  <div style={{ fontSize: '9px', color: '#64748B' }}>RELEASE LOCK</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981' }}>ARMED</div>
                  <div style={{ fontSize: '8px', color: '#94A3B8' }}>Cold Chain OK</div>
                </div>
                <div style={{ background: '#0F172A', padding: '8px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                  <div style={{ fontSize: '9px', color: '#64748B' }}>ACTIVE BATCH</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#38BDF8' }}>B-7749</div>
                  <div style={{ fontSize: '8px', color: '#10B981' }}>Verified</div>
                </div>
              </div>

              <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>MODULE NAVIGATION HUB:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button onClick={() => handleSelectScreen(3)} style={screen2NavBtnStyle}>
                  📈 Live Temp Graph (#3)
                </button>
                <button onClick={() => handleSelectScreen(4)} style={screen2NavBtnStyle}>
                  📦 Vaccine Matrix (#4)
                </button>
                <button onClick={() => handleSelectScreen(5)} style={screen2CtaBtnStyle}>
                  ⚡ Dispenser Control (#5)
                </button>
                <button onClick={() => handleSelectScreen(7)} style={screen2NavBtnStyle}>
                  📍 GPS Telemetry (#7)
                </button>
                <button onClick={() => handleSelectScreen(8)} style={screen2NavBtnStyle}>
                  ⚠️ Excursion Audit (#8)
                </button>
                <button onClick={() => handleSelectScreen(9)} style={screen2NavBtnStyle}>
                  🛠 Hardware Ping (#9)
                </button>
                <button onClick={() => handleSelectScreen(10)} style={{ ...screen2NavBtnStyle, gridColumn: 'span 2', background: '#0284C7', color: '#FFF', fontWeight: 700 }}>
                  🎙 AI Clinical Quality Protocol (#10) →
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 3: LIVE TEMPERATURE MONITORING */}
          {activeScreen === 3 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#38BDF8' }}>Live Temperature Chart</h4>
              <div style={{ background: '#0F172A', height: '140px', borderRadius: '8px', border: '1px solid #1E293B', padding: '10px', position: 'relative' }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '6px' }}>Target Safe Range: 2.0°C to 8.0°C</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '90px', gap: '8px', paddingTop: '10px' }}>
                  {[3.8, 3.9, 3.7, 4.0, 3.8, 3.6, 3.9, 3.8, 3.7, currentTemp].map((t, idx) => (
                    <div key={idx} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ height: `${Math.min(100, Math.max(10, (t / 8) * 100))}%`, background: '#0EA5E9', borderRadius: '3px 3px 0 0' }} />
                      <span style={{ fontSize: '8px', color: '#64748B', display: 'block', marginTop: '2px' }}>{t.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 4: BATCH STOCK MATRIX */}
          {activeScreen === 4 && (
            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#38BDF8' }}>Vaccine Batch & Dispenser Matrix</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {slotsList.map((slot) => (
                  <div key={slot.id} style={{ background: '#0F172A', padding: '8px', borderRadius: '6px', border: '1px solid #1E293B', fontSize: '11px' }}>
                    <div style={{ fontWeight: 700, color: '#F8FAFC' }}>Slot {slot.id}: {slot.product}</div>
                    <div style={{ color: '#38BDF8', fontSize: '10px' }}>Motor: {slot.motor}</div>
                    <div style={{ color: slot.status === 'READY' ? '#10B981' : '#EF4444', fontSize: '10px', marginTop: '2px' }}>
                      Status: {slot.status} | Stock: {slot.stock}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SCREEN 5: DISPENSER MOTOR SELECTION MENU */}
          {activeScreen === 5 && (
            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#38BDF8' }}>Select Dispenser Motor to Actuate</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={() => handleMotorClick('M3 ON', 1)} style={lvglBtnStyle}>
                  M3 Motor (Spring 1)
                </button>
                <button onClick={() => handleMotorClick('M4 ON', 2)} style={lvglBtnStyle}>
                  M4 Motor (Spring 2)
                </button>
                <button onClick={() => handleMotorClick('R0 ON', 3)} style={lvglBtnStyle}>
                  Relay R0 (Chute 1)
                </button>
                <button onClick={() => handleMotorClick('R1 ON', 4)} style={lvglBtnStyle}>
                  Relay R1 (Chute 2)
                </button>
                <button onClick={() => handleMotorClick('STEP 512', 5)} style={lvglBtnStyle}>
                  Stepper Rotor FWD (+512)
                </button>
                <button onClick={() => handleMotorClick('STEP -512', 6)} style={lvglBtnStyle}>
                  Stepper Rotor REV (-512)
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 6: DISPENSING CHUTE PROGRESS */}
          {activeScreen === 6 && (
            <div style={{ textAlign: 'center', paddingTop: '16px' }}>
              <RotateCw size={36} color="#0EA5E9" style={{ animation: 'spin 2s linear infinite', marginBottom: '10px' }} />
              <h4 style={{ margin: '0 0 6px 0', color: '#F8FAFC' }}>Dispensing in Progress...</h4>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 12px 0' }}>Actuating spring motor... Awaiting optical IR drop sensor.</p>
              <div style={{ background: '#0F172A', padding: '8px 12px', borderRadius: '8px', border: '1px solid #1E293B', display: 'inline-block', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', color: '#64748B' }}>IR Optical Sensor (Pin A3): </span>
                <span style={{ fontWeight: 700, color: irStatus === 'DETECTED' ? '#F59E0B' : '#10B981' }}>{irStatus}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button 
                  onClick={() => handleSelectScreen(5)}
                  style={{ background: '#1E293B', color: '#E2E8F0', border: '1px solid #334155', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  ← Return to Motors (#5)
                </button>
                <button 
                  onClick={() => handleSelectScreen(2)}
                  style={{ background: '#10B981', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✔ Finish & Overview (#2)
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 7: GPS TELEMETRY */}
          {activeScreen === 7 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#38BDF8' }}>Shipment Location & GPS Telemetry</h4>
              <div style={{ background: '#0F172A', padding: '10px', borderRadius: '8px', border: '1px solid #1E293B', fontSize: '12px' }}>
                <div><strong>Route:</strong> Mumbai Cold Storage Hub → Pune Transit Depot</div>
                <div><strong>GPS Coordinates:</strong> 18.5204° N, 73.8567° E</div>
                <div><strong>Telemetry Stream:</strong> ESP32 WiFi Mesh (1000ms ping)</div>
              </div>
            </div>
          )}

          {/* SCREEN 8: CHECKPOINT EXCURSION LOGS */}
          {activeScreen === 8 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#38BDF8' }}>Excursion Breach Audit Logs</h4>
              <div style={{ fontSize: '11px', background: '#0F172A', padding: '8px', borderRadius: '6px', border: '1px solid #1E293B' }}>
                <div style={{ color: '#10B981' }}>✔ Batch BTC-M1-2401: Compliant (3.8°C)</div>
                <div style={{ color: '#10B981' }}>✔ Batch BTC-M3-2401: Compliant (-75.2°C)</div>
                <div style={{ color: '#EF4444', marginTop: '4px' }}>✖ Batch BTC-M4-2402: Excursion detected (+12.4°C)</div>
              </div>
            </div>
          )}

          {/* SCREEN 9: DIAGNOSTICS & PING */}
          {activeScreen === 9 && (
            <div>
              <h4 style={{ margin: '0 0 10px 0', color: '#38BDF8' }}>Diagnostics & Hardware Ping</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={() => handleMotorClick('IR?')} style={lvglBtnStyle}>
                  Poll IR Sensor (IR?)
                </button>
                <button onClick={() => handleMotorClick('GATE OPEN')} style={lvglBtnStyle}>
                  Test Gate Servo (Cycle)
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 10: CLINICAL QUALITY AUDIT TRIGGER */}
          {activeScreen === 10 && (
            <div style={{ textAlign: 'center', paddingTop: '12px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#38BDF8' }}>Clinical Protocol & Quality Audit</h4>
              <p style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '14px' }}>Click Panel below to trigger Automated Cold-Chain Quality Assessment</p>
              <button
                onClick={() => handleSelectScreen(12)}
                style={{
                  background: 'linear-gradient(135deg, #0284C7, #0369A1)',
                  color: '#FFF',
                  border: '2px solid #38BDF8',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                }}
              >
                🎙 RUN CLINICAL AUDIT PROTOCOL (Panel23)
              </button>
            </div>
          )}

          {/* SCREEN 11: PATIENT & SENSOR VITALS */}
          {activeScreen === 11 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#38BDF8' }}>Live Sensor Telemetry Vitals</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div style={{ background: '#0F172A', padding: '8px', borderRadius: '6px' }}>Temp: {currentTemp.toFixed(1)} °C</div>
                <div style={{ background: '#0F172A', padding: '8px', borderRadius: '6px' }}>Humidity: 48.0 %</div>
                <div style={{ background: '#0F172A', padding: '8px', borderRadius: '6px' }}>SpO2: 98 %</div>
                <div style={{ background: '#0F172A', padding: '8px', borderRadius: '6px' }}>Pulse: 72 bpm</div>
              </div>
            </div>
          )}

          {/* SCREEN 12: CLINICAL QUALITY AUDIT RESULTS */}
          {activeScreen === 12 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#10B981' }}>Clinical Quality Audit Complete</h4>
              <div style={{ background: '#0F172A', padding: '10px', borderRadius: '8px', border: '1px solid #10B981', fontSize: '11px', color: '#E2E8F0' }}>
                "Cold-Chain Verified: Batch B-7749 stored at {currentTemp.toFixed(1)} °C. Quality cleared for dispense."
              </div>
              <button 
                onClick={async () => {
                  await handleMotorClick('STEP 512', 5);
                  setTimeout(() => {
                    handleMotorClick('M3 ON', 1);
                  }, 2300);
                }}
                style={{ width: '100%', marginTop: '12px', background: '#10B981', color: '#FFF', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer' }}
              >
                Dispense Cleared Batch (Rotor → Spring M3) →
              </button>
            </div>
          )}

          {/* SCREEN 13: SAFETY LOCK OVERRIDES */}
          {activeScreen === 13 && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', color: '#F59E0B' }}>Manual Safety & Override Settings</h4>
              <div style={{ fontSize: '12px', background: '#0F172A', padding: '10px', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={overrideLock} onChange={(e) => setOverrideLock(e.target.checked)} />
                  Bypass Cold Chain Lock for Manual Diagnostics
                </label>
              </div>
            </div>
          )}

          {/* SCREEN 14: HARDWARE DIAGNOSTICS & MOTOR TEST MATRIX */}
          {activeScreen === 14 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, color: '#38BDF8', fontSize: '13px' }}>Hardware Motor & Sensor Test Terminal</h4>
                <button 
                  onClick={() => handleMotorClick('AUTO_TEST_ALL')}
                  style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                >
                  ▶ AUTO-TEST ALL
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <button onClick={() => handleMotorClick('M3 ON', 1)} style={lvglGridBtnStyle}>M3 Spring 1</button>
                <button onClick={() => handleMotorClick('M4 ON', 2)} style={lvglGridBtnStyle}>M4 Spring 2</button>
                <button onClick={() => handleMotorClick('R0 ON', 3)} style={lvglGridBtnStyle}>Relay R0</button>
                <button onClick={() => handleMotorClick('R1 ON', 4)} style={lvglGridBtnStyle}>Relay R1</button>
                <button onClick={() => handleMotorClick('STEP 512', 5)} style={lvglGridBtnStyle}>Step FWD</button>
                <button onClick={() => handleMotorClick('STEP -512', 6)} style={lvglGridBtnStyle}>Step REV</button>
                <button onClick={() => handleMotorClick('DROP')} style={lvglGridBtnStyle}>Drop Servo</button>
                <button onClick={() => handleMotorClick('GATE OPEN')} style={lvglGridBtnStyle}>Gate Open</button>
                <button onClick={() => handleMotorClick('GATE CLOSE')} style={lvglGridBtnStyle}>Gate Close</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '8px' }}>
                <button onClick={() => handleMotorClick('IR?')} style={{ ...lvglGridBtnStyle, background: '#334155' }}>Poll IR Sensor</button>
                <button onClick={() => handleMotorClick('START')} style={{ ...lvglGridBtnStyle, background: '#059669' }}>Arm Uno</button>
                <button onClick={() => handleMotorClick('STOP')} style={{ ...lvglGridBtnStyle, background: '#DC2626' }}>E-Stop</button>
              </div>
            </div>
          )}
        </div>

        {/* Universal Screen Navigation Bar at bottom of screen simulator */}
        {activeScreen !== 2 && (
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '1px solid #1E293B'
          }}>
            <button
              onClick={() => handleSelectScreen(2)}
              style={{
                background: '#0284C7', color: '#FFF', border: 'none',
                padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                fontWeight: 600, fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <ArrowLeft size={12} /> Overview (#2)
            </button>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => handleSelectScreen(activeScreen > 1 ? activeScreen - 1 : 14)}
                style={{
                  background: '#1E293B', color: '#94A3B8', border: '1px solid #334155',
                  padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px'
                }}
              >
                ◀ Prev
              </button>
              <button
                onClick={() => handleSelectScreen(activeScreen < 14 ? activeScreen + 1 : 1)}
                style={{
                  background: '#1E293B', color: '#94A3B8', border: '1px solid #334155',
                  padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px'
                }}
              >
                Next ▶
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const screen2NavBtnStyle = {
  background: '#1E293B',
  color: '#F8FAFC',
  border: '1px solid #334155',
  padding: '8px',
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all 0.15s ease'
};

const screen2CtaBtnStyle = {
  background: '#0284C7',
  color: '#FFFFFF',
  border: '1px solid #38BDF8',
  padding: '8px',
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all 0.15s ease'
};

const lvglBtnStyle = {
  background: '#1E293B',
  color: '#F8FAFC',
  border: '1px solid #334155',
  padding: '10px',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  textAlign: 'center'
};

const lvglGridBtnStyle = {
  background: '#0F172A',
  color: '#E2E8F0',
  border: '1px solid #334155',
  padding: '8px 4px',
  borderRadius: '6px',
  fontSize: '10px',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center'
};
