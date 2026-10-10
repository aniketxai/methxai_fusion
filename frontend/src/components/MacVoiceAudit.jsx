import { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, ShieldCheck, Activity, CheckCircle2 } from 'lucide-react';
import { getStoredConfig } from '../utils/productStore.js';

export default function MacVoiceAudit() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [ollamaResponse, setOllamaResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Setup Web Speech API (Mac Microphone)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
    };

    recognition.onerror = (err) => {
      console.warn('Mac Mic recognition note:', err);
      setIsListening(false);
      setError('Microphone status note. You can also type queries below.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    if (isListening) {
      setError('');
      recognition.start();
    } else {
      try { recognition.stop(); } catch (e) { /* ignore */ }
    }

    return () => {
      try { recognition.stop(); } catch (e) { /* ignore */ }
    };
  }, [isListening]);

  const sendToAuditEngine = async (textToSend) => {
    const queryText = textToSend || transcript;
    if (!queryText || !queryText.trim()) return;

    setLoading(true);
    setError('');
    const config = getStoredConfig();
    const defaultHost = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : 'localhost';
    const apiBase = config.apiBaseUrl || `http://${defaultHost}:8000`;

    try {
      const res = await fetch(`${apiBase}/api/voice-triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_text: queryText,
          temperature: 3.8,
          spo2: 98,
          heart_rate: 72,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOllamaResponse(data);

      if ('speechSynthesis' in window && data?.report?.patient_summary) {
        const utterance = new SpeechSynthesisUtterance(data.report.patient_summary);
        window.speechSynthesis.speak(utterance);
      }

      // Automatically trigger hardware dispense sequence (M3 + Pill Rotor) if quality cleared
      if (data?.report?.triage_priority === 'Normal') {
        try {
          await fetch(`${apiBase}/api/dispenser/control-motor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'VOICE_DISPENSE' }),
          });
        } catch (e) {
          console.warn('Voice dispense trigger note:', e);
        }
      }
    } catch (err) {
      console.error('Error calling Clinical Audit Engine:', err);
      setError('Failed to reach backend Quality Assurance endpoint. Ensure backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ marginTop: 20, border: '1px solid #0EA5E9', background: '#0F172A', color: '#F8FAFC' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F8FAFC', fontSize: '15px' }}>
          <ShieldCheck size={18} style={{ color: '#38BDF8' }} />
          Voice Dispatch & Clinical Quality Console
        </h2>
        <span className="badge badge-normal" style={{ fontSize: 11, background: '#0284C7', color: '#FFFFFF', fontWeight: 600 }}>
          <Activity size={11} style={{ marginRight: 4 }} /> Clinical Audit Protocol v3.2
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => setIsListening(!isListening)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontWeight: 600, borderRadius: '6px' }}
          >
            {isListening ? (
              <>
                <MicOff size={16} /> Listening... (Click to Stop)
              </>
            ) : (
              <>
                <Mic size={16} /> Activate Microphone Dispatch
              </>
            )}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => sendToAuditEngine()}
            disabled={loading || !transcript.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0284C7', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? 'Evaluating Quality Protocol...' : 'Run Clinical Audit'}
          </button>
        </div>

        {/* Live transcript input */}
        <div>
          <label style={{ fontSize: 12, color: '#94A3B8', display: 'block', marginBottom: 4, fontWeight: 500 }}>
            Voice Transcript / Quality Audit Input:
          </label>
          <input
            type="text"
            className="input"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Activate microphone or type audit query (e.g., 'Audit cold chain status for Batch B-7749')..."
            style={{ width: '100%', padding: '9px 12px', background: '#020617', border: '1px solid #334155', color: '#F8FAFC', borderRadius: '6px', fontSize: '13px' }}
          />
        </div>

        {error && <div style={{ color: '#EF4444', fontSize: 12 }}>{error}</div>}

        {/* Clinical Quality Audit Result Card */}
        {ollamaResponse && (
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              background: '#020617',
              border: '1px solid #1E293B',
              marginTop: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: '#38BDF8' }}>
                <Volume2 size={14} /> Clinical Audit Decision & Audio Dispatch
              </span>
              <span
                className={`badge ${
                  ollamaResponse.report.triage_priority === 'Normal' ? 'badge-normal' : 'badge-alert'
                }`}
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}
              >
                {ollamaResponse.report.triage_priority} Status
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#E2E8F0' }}>
              {ollamaResponse.report.patient_summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
