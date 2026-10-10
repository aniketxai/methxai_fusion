import React, { useState, useEffect } from 'react';
import { 
  Cpu, Zap, Play, ShieldAlert, CheckCircle2, AlertTriangle, 
  RotateCw, Terminal, Sliders, RefreshCw, Power, Radio
} from 'lucide-react';
import LvglDisplayMirror from '../components/LvglDisplayMirror';
import { api } from '../services/api';
import { initSocket, subscribeToSocket } from '../services/socket';

export default function LVGLMotorControl() {
  const [dispenserStatus, setDispenserStatus] = useState({});
  const [activeScreen, setActiveScreen] = useState(14);
  const [logs, setLogs] = useState([]);
  const [overrideLock, setOverrideLock] = useState(false);
  const [loadingCmd, setLoadingCmd] = useState(null);
  const [autoTestRunning, setAutoTestRunning] = useState(false);

  useEffect(() => {
    fetchStatus();

    // Connect WebSocket for real-time updates
    initSocket();
    const unsubscribe = subscribeToSocket((event) => {
      if (event.type === 'telemetry_update' && event.data?.dispenserStatus) {
        setDispenserStatus(event.data.dispenserStatus);
      }
      if (event.type === 'motor_command_executed') {
        const { command, dispenserStatus: newStatus, log } = event.data;
        if (newStatus) setDispenserStatus(newStatus);
        addLog(`UART >> ${command} | Motor: ${newStatus?.motorState || 'ACTIVE'}`);
      }
      if (event.type === 'lvgl_screen_changed') {
        setActiveScreen(event.data.screen);
        addLog(`LVGL Screen switched to #${event.data.screen}`);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const status = await api.getDispenserStatus();
      if (status) {
        setDispenserStatus(status);
        if (status.activeScreen) setActiveScreen(status.activeScreen);
      }
    } catch (err) {
      console.warn('Could not fetch dispenser status', err);
    }
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const handleExecuteCommand = async (cmd, slotId = null) => {
    setLoadingCmd(cmd);
    addLog(`Website requested command: ${cmd}`);
    try {
      const res = await api.controlMotor(cmd, slotId, overrideLock);
      if (res.dispenserStatus) setDispenserStatus(res.dispenserStatus);
      addLog(`Command '${cmd}' dispatched successfully.`);
    } catch (err) {
      addLog(`ERROR executing '${cmd}': ${err.message}`);
    } finally {
      setLoadingCmd(null);
    }
  };

  const handleAutoTestAll = async () => {
    setAutoTestRunning(true);
    addLog('Starting automated 8-step sequential motor test...');
    const testSteps = [
      'M3 ON', 'M4 ON', 'R0 ON', 'R1 ON', 
      'STEP 512', 'DROP', 'GATE OPEN', 'GATE CLOSE', 'IR?'
    ];

    for (let i = 0; i < testSteps.length; i++) {
      const step = testSteps[i];
      addLog(`[Auto-Test Step ${i + 1}/${testSteps.length}] Executing ${step}...`);
      await handleExecuteCommand(step);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    addLog('Automated 8-step motor test completed successfully!');
    setAutoTestRunning(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* Top Banner / Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={28} color="#0EA5E9" /> ESP32 LVGL Display & Website Motor Control
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94A3B8' }}>
            Bi-directional Web Actuation, LVGL 8.3 Screen Mirroring & Arduino Uno Hardware Mesh
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#1E293B', padding: '6px 14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <Radio size={14} color="#10B981" />
            <span>ESP32: <strong style={{ color: '#10B981' }}>ONLINE</strong></span>
          </div>

          <button 
            onClick={fetchStatus} 
            style={{ background: '#1E293B', color: '#94A3B8', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            <RefreshCw size={14} /> Refresh Status
          </button>
        </div>
      </div>

      {/* Main Grid: Left = LVGL Mirror | Right = Direct Motor Control Workbench */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Left Column: LVGL Interactive Screen Mirror */}
        <div>
          <LvglDisplayMirror 
            activeScreen={activeScreen}
            dispenserStatus={dispenserStatus}
            onScreenChange={(scr) => {
              setActiveScreen(scr);
              addLog(`Switched to LVGL Screen #${scr}`);
            }}
            onCommandExecute={(cmd) => {
              addLog(`LVGL Mirror triggered command: ${cmd}`);
            }}
          />
        </div>

        {/* Right Column: Direct Motor Control Panel & UART Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Master Control Banner */}
          <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} /> Website Motor Control Workbench
              </h3>
              <label style={{ fontSize: '12px', color: overrideLock ? '#EF4444' : '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={overrideLock} 
                  onChange={(e) => setOverrideLock(e.target.checked)} 
                />
                Override Cold Chain Lock
              </label>
            </div>

            {/* Quick Master Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              <button 
                onClick={handleAutoTestAll} 
                disabled={autoTestRunning}
                style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Play size={14} /> {autoTestRunning ? 'Running Test...' : 'Auto-Test All Motors'}
              </button>

              <button 
                onClick={() => handleExecuteCommand('START')} 
                style={{ background: '#059669', color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Power size={14} /> Arm Uno System
              </button>

              <button 
                onClick={() => handleExecuteCommand('STOP')} 
                style={{ background: '#DC2626', color: '#FFF', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <ShieldAlert size={14} /> EMERGENCY STOP
              </button>
            </div>

            {/* Motor Slots Matrix */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              
              {/* Slot 1: M3 Motor */}
              <div style={slotBoxStyle}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#F1F5F9' }}>Slot 1: Medicine M1</div>
                <div style={{ fontSize: '11px', color: '#38BDF8', margin: '2px 0 8px 0' }}>M3 Motor (Spring 1)</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleExecuteCommand('M3 ON', 1)} style={cmdBtnStyle}>ON</button>
                  <button onClick={() => handleExecuteCommand('M3 OFF', 1)} style={cmdBtnOffStyle}>OFF</button>
                </div>
              </div>

              {/* Slot 2: M4 Motor */}
              <div style={slotBoxStyle}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#F1F5F9' }}>Slot 2: Medicine M2</div>
                <div style={{ fontSize: '11px', color: '#38BDF8', margin: '2px 0 8px 0' }}>M4 Motor (Spring 2)</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleExecuteCommand('M4 ON', 2)} style={cmdBtnStyle}>ON</button>
                  <button onClick={() => handleExecuteCommand('M4 OFF', 2)} style={cmdBtnOffStyle}>OFF</button>
                </div>
              </div>

              {/* Slot 3: Relay R0 */}
              <div style={slotBoxStyle}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#F1F5F9' }}>Slot 3: Medicine M3</div>
                <div style={{ fontSize: '11px', color: '#38BDF8', margin: '2px 0 8px 0' }}>Relay R0 (Chute 1)</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleExecuteCommand('R0 ON', 3)} style={cmdBtnStyle}>ON</button>
                  <button onClick={() => handleExecuteCommand('R0 OFF', 3)} style={cmdBtnOffStyle}>OFF</button>
                </div>
              </div>

              {/* Slot 4: Relay R1 */}
              <div style={slotBoxStyle}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#F1F5F9' }}>Slot 4: Medicine M4</div>
                <div style={{ fontSize: '11px', color: '#38BDF8', margin: '2px 0 8px 0' }}>Relay R1 (Chute 2)</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => handleExecuteCommand('R1 ON', 4)} style={cmdBtnStyle}>ON</button>
                  <button onClick={() => handleExecuteCommand('R1 OFF', 4)} style={cmdBtnOffStyle}>OFF</button>
                </div>
              </div>

              {/* Slot 5: Stepper FWD */}
              <div style={slotBoxStyle}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#F1F5F9' }}>Slot 5: Medicine M5</div>
                <div style={{ fontSize: '11px', color: '#38BDF8', margin: '2px 0 8px 0' }}>Stepper Rotor (+512)</div>
                <button onClick={() => handleExecuteCommand('STEP 512', 5)} style={{ ...cmdBtnStyle, width: '100%' }}>Rotate FWD</button>
              </div>

              {/* Slot 6: Stepper REV */}
              <div style={slotBoxStyle}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#F1F5F9' }}>Slot 6: Medicine M6</div>
                <div style={{ fontSize: '11px', color: '#38BDF8', margin: '2px 0 8px 0' }}>Stepper Rotor (-512)</div>
                <button onClick={() => handleExecuteCommand('STEP -512', 6)} style={{ ...cmdBtnStyle, width: '100%' }}>Rotate REV</button>
              </div>
            </div>

            {/* Actuators & Servos */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #334155', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <button onClick={() => handleExecuteCommand('DROP')} style={actuatorBtnStyle}>Drop Servo</button>
              <button onClick={() => handleExecuteCommand('GATE OPEN')} style={actuatorBtnStyle}>Gate Open</button>
              <button onClick={() => handleExecuteCommand('GATE CLOSE')} style={actuatorBtnStyle}>Gate Close</button>
            </div>
          </div>

          {/* Real-time UART Log Feed Console */}
          <div style={{ background: '#090D16', border: '1px solid #1E293B', borderRadius: '12px', padding: '14px', flex: 1, minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={14} /> Live UART Serial Log Console
              </div>
              <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '11px', cursor: 'pointer' }}>Clear</button>
            </div>

            <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '11px', color: '#10B981', overflowY: 'auto', background: '#020617', padding: '10px', borderRadius: '6px', maxHeight: '160px' }}>
              {logs.length === 0 ? (
                <span style={{ color: '#475569' }}>Waiting for UART commands or telemetry events...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} style={{ marginBottom: '4px', borderBottom: '1px solid #0F172A', paddingBottom: '2px' }}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

const slotBoxStyle = {
  background: '#0F172A',
  border: '1px solid #334155',
  borderRadius: '8px',
  padding: '10px'
};

const cmdBtnStyle = {
  background: '#0284C7',
  color: '#FFF',
  border: 'none',
  padding: '6px 12px',
  borderRadius: '6px',
  fontWeight: 700,
  fontSize: '11px',
  cursor: 'pointer',
  flex: 1
};

const cmdBtnOffStyle = {
  background: '#334155',
  color: '#94A3B8',
  border: 'none',
  padding: '6px 12px',
  borderRadius: '6px',
  fontWeight: 700,
  fontSize: '11px',
  cursor: 'pointer',
  flex: 1
};

const actuatorBtnStyle = {
  background: '#1E293B',
  color: '#E2E8F0',
  border: '1px solid #334155',
  padding: '8px',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '11px',
  cursor: 'pointer',
  textAlign: 'center'
};
