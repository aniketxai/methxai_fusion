import wave
import struct
import math
import os

def generate_patient_summary_wav(filepath: str, duration_sec: float = 3.0, sample_rate: int = 16000):
    """
    Generates a clean 16kHz mono 16-bit PCM WAV audio file with standard audio feedback tone
    for ESP32 playback over I2S DAC speaker.
    """
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    num_samples = int(sample_rate * duration_sec)
    
    with wave.open(filepath, 'wb') as wav_file:
        wav_file.setnchannels(1)      # Mono
        wav_file.setsampwidth(2)      # 16-bit = 2 bytes per sample
        wav_file.setframerate(sample_rate)
        
        # Simple pleasant 440Hz / 880Hz chime sequence for audio feedback
        samples = []
        for i in range(num_samples):
            t = i / sample_rate
            # 2 tones: 523.25 Hz (C5) for first half, 659.25 Hz (E5) for second half
            freq = 523.25 if t < (duration_sec / 2) else 659.25
            
            # Envelope to avoid clicks
            envelope = math.sin(math.pi * (t / duration_sec))
            val = int(32767.0 * 0.4 * envelope * math.sin(2.0 * math.pi * freq * t))
            samples.append(struct.pack('<h', val))
            
        wav_file.writeframes(b''.join(samples))
    print(f"Generated WAV audio file at: {filepath}")

if __name__ == "__main__":
    generate_patient_summary_wav("static/patient_summary.wav")
