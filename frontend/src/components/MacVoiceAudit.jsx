import { useState, useEffect } from 'react';
import { Mic, MicOff, Bot, Volume2, Sparkles } from 'lucide-react';
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
      console.warn('Mac Mic recognition error:', err);
      setIsListening(false);
      setError('Microphone access note. You can also type queries below.');
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

  const sendToOllama = async (textToSend) => {
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

      // Browser Web Speech fallback if needed
      if ('speechSynthesis' in window && data?.report?.patient_summary) {
        const utterance = new SpeechSynthesisUtterance(data.report.patient_summary);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('Error calling Ollama Voice Triage:', err);
      setError('Failed to reach backend Ollama endpoint. Ensure backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ marginTop: 20, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={18} style={{ color: '#3b82f6' }} />
          Mac Mic Voice Audit (Ollama AI)
        </h2>
        <span className="badge badge-normal" style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
          <Sparkles size={11} style={{ marginRight: 4 }} /> Powered by llama3.2:1b
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => setIsListening(!isListening)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontWeight: 600 }}
          >
            {isListening ? (
              <>
                <MicOff size={16} /> Listening to Mac Mic... (Click to Stop)
              </>
            ) : (
              <>
                <Mic size={16} /> 🎤 Talk into Mac Microphone
              </>
            )}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => sendToOllama()}
            disabled={loading || !transcript.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {loading ? 'Ollama Analyzing...' : 'Send to Ollama AI'}
          </button>
        </div>

        {/* Live transcript input */}
        <div>
          <label style={{ fontSize: 12, opacity: 0.8, display: 'block', marginBottom: 4 }}>
            Voice Transcript / Audit Query:
          </label>
          <input
            type="text"
            className="input"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Click 'Talk into Mac Microphone' or type query (e.g., 'Audit cold chain status for Batch B-7749')..."
            style={{ width: '100%', padding: '8px 12px' }}
          />
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}

        {/* Ollama AI Result Card */}
        {ollamaResponse && (
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              marginTop: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}>
                <Volume2 size={14} /> Ollama AI Assessment (Speaking via Mac Speaker)
              </span>
              <span
                className={`badge ${
                  ollamaResponse.report.triage_priority === 'Normal' ? 'badge-normal' : 'badge-alert'
                }`}
                style={{ fontSize: 11 }}
              >
                {ollamaResponse.report.triage_priority} Priority
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#e2e8f0' }}>
              {ollamaResponse.report.patient_summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
