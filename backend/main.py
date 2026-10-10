import os
import sys
from pathlib import Path
import json
import time
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

# Ensure backend directory is in sys.path
sys.path.append(str(Path(__file__).parent))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from audio_generator import generate_patient_summary_wav

# Initialize FastAPI App
app = FastAPI(title="MethXAI Fusion Cold-Chain Backend", version="2.0")

# Enable CORS for Frontend React App
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directory exists & generate default patient audio WAV
OS_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(OS_STATIC_DIR, exist_ok=True)
DEFAULT_AUDIO_PATH = os.path.join(OS_STATIC_DIR, "patient_summary.wav")
generate_patient_summary_wav(DEFAULT_AUDIO_PATH)

app.mount("/static", StaticFiles(directory=OS_STATIC_DIR), name="static")

# =====================================================================
# IN-MEMORY DATA STORE & REAL-TIME STATE
# =====================================================================

PRODUCTS = {
    'Medicine M1': {'minTemp': 2, 'maxTemp': 8, 'minHumidity': 30, 'maxHumidity': 70},
    'Medicine M2': {'minTemp': -25, 'maxTemp': -15, 'minHumidity': 0, 'maxHumidity': 60},
    'Medicine M3': {'minTemp': -90, 'maxTemp': -60, 'minHumidity': 0, 'maxHumidity': 60},
    'Medicine M4': {'minTemp': 2, 'maxTemp': 8, 'minHumidity': 30, 'maxHumidity': 70},
    'Medicine M5': {'minTemp': 2, 'maxTemp': 8, 'minHumidity': 30, 'maxHumidity': 70},
    'Medicine M6': {'minTemp': 2, 'maxTemp': 8, 'minHumidity': 30, 'maxHumidity': 70},
}

CHECKPOINTS = [
    'Mumbai Cold Storage Hub', 'Pune Transit Depot', 'Nashik Distribution Center',
    'Aurangabad Regional Store', 'Nagpur Medical Warehouse', 'Pune Distribution Hub',
    'Mumbai Airport Cargo Terminal', 'Delhi Airport Cold Storage', 'Bangalore Regional Depot',
    'Hyderabad Pharma Hub', 'Chennai Port Cold Storage', 'Kolkata Distribution Center'
]

# Dispenser slot map
DISPENSER_STATUS = {
    "espConnected": True,
    "lastPing": datetime.now(timezone.utc).isoformat(),
    "ipAddress": "10.155.26.85",
    "gateStatus": "CLOSED",
    "irBeamStatus": "CLEAR",
    "currentTemp": 3.8,
    "slots": [
        {"id": 1, "product": "Medicine M1", "motor": "M3 (Spring 1)", "batch": "BTC-M1-2401", "status": "READY", "stock": 14},
        {"id": 2, "product": "Medicine M2", "motor": "M4 (Spring 2)", "batch": "BTC-M2-2403", "status": "READY", "stock": 8},
        {"id": 3, "product": "Medicine M3", "motor": "R0 (Relay 1)", "batch": "BTC-M3-2401", "status": "READY", "stock": 20},
        {"id": 4, "product": "Medicine M4", "motor": "R1 (Relay 2)", "batch": "BTC-M4-2402", "status": "QUALITY_HOLD", "stock": 5},
        {"id": 5, "product": "Medicine M5", "motor": "STEPPER FWD (+512)", "batch": "BTC-M5-2401", "status": "READY", "stock": 30},
        {"id": 6, "product": "Medicine M6", "motor": "STEPPER REV (-512)", "batch": "BTC-M6-2312", "status": "READY", "stock": 12},
    ]
}

BATCHES = [
    {
        "batchId": "BTC-M1-2401",
        "product": "Medicine M1",
        "manufactureDate": "2024-01-15",
        "expiryDate": "2025-01-15",
        "releaseStatus": "RELEASED",
        "shipmentId": "SHP-2410-007",
        "currentTemp": 3.8,
        "tempHistorySummary": "2.0°C - 5.2°C (Compliant)",
        "qualityPassed": True,
        "holdReason": None
    },
    {
        "batchId": "BTC-M3-2401",
        "product": "Medicine M3",
        "manufactureDate": "2024-02-01",
        "expiryDate": "2024-12-01",
        "releaseStatus": "RELEASED",
        "shipmentId": "SHP-2410-001",
        "currentTemp": -75.2,
        "tempHistorySummary": "-78°C - -72°C (Compliant)",
        "qualityPassed": True,
        "holdReason": None
    },
    {
        "batchId": "BTC-M4-2402",
        "product": "Medicine M4",
        "manufactureDate": "2024-01-20",
        "expiryDate": "2024-10-20",
        "releaseStatus": "HOLD",
        "shipmentId": "SHP-2410-004",
        "currentTemp": 12.4,
        "tempHistorySummary": "Excursion detected (+12.4°C for 2.5 hours)",
        "qualityPassed": False,
        "holdReason": "Temperature Excursion > 8.0°C threshold"
    },
    {
        "batchId": "B-7749",
        "product": "COVID-19 Vaccine (Pfizer-BioNTech)",
        "manufactureDate": "2024-03-01",
        "expiryDate": "2025-03-01",
        "releaseStatus": "RELEASED",
        "shipmentId": "SHP-2410-001",
        "currentTemp": 3.8,
        "tempHistorySummary": "3.8°C (Verified by ESP32 Triage)",
        "qualityPassed": True,
        "holdReason": None
    }
]

SHIPMENTS = [
    {
        "id": "SHP-2410-001",
        "product": "Medicine M3",
        "batch": "BTC-M3-2401",
        "origin": "Mumbai Cold Storage Hub",
        "checkpoint": "Pune Transit Depot",
        "tempRange": PRODUCTS["Medicine M3"],
        "currentTemp": -74.8,
        "currentHumidity": 44.5,
        "status": "in_transit",
        "excursionsCount": 0,
        "readings": [
            {"timestamp": datetime.now(timezone.utc).isoformat(), "temperature": -75.2, "humidity": 44.0, "isSimulated": False, "sensorId": "ESP32-SNR-01"}
        ]
    },
    {
        "id": "SHP-2410-002",
        "product": "Medicine M1",
        "batch": "BTC-M1-2308",
        "origin": "Pune Distribution Hub",
        "checkpoint": "Nashik Distribution Center",
        "tempRange": PRODUCTS["Medicine M1"],
        "currentTemp": 9.2,
        "currentHumidity": 55.0,
        "status": "warning",
        "excursionsCount": 1,
        "readings": [
            {"timestamp": datetime.now(timezone.utc).isoformat(), "temperature": 9.2, "humidity": 55.0, "isSimulated": False, "sensorId": "ESP32-SNR-02"}
        ]
    },
    {
        "id": "SHP-2410-007",
        "product": "Medicine M1",
        "batch": "BTC-M1-2401",
        "origin": "Mumbai Cold Storage Hub",
        "checkpoint": "Pune Distribution Hub",
        "tempRange": PRODUCTS["Medicine M1"],
        "currentTemp": 3.8,
        "currentHumidity": 48.0,
        "status": "in_transit",
        "excursionsCount": 0,
        "readings": [
            {"timestamp": datetime.now(timezone.utc).isoformat(), "temperature": 3.8, "humidity": 48.0, "isSimulated": False, "sensorId": "ESP32-LIVE-01"}
        ]
    }
]

ALERTS = [
    {
        "id": "ALT-1001",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "severity": "HIGH",
        "shipmentId": "SHP-2410-002",
        "batchId": "BTC-M1-2308",
        "title": "Temperature Excursion Warning",
        "message": "Temperature reading 9.2°C exceeds upper limit of 8.0°C",
        "acknowledged": False,
        "markedForReview": False
    }
]

CHECKPOINT_LOGS = [
    {
        "id": "CP-501",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "location": "Mumbai Cold Storage Hub",
        "shipmentId": "SHP-2410-007",
        "batchId": "BTC-M1-2401",
        "operator": "Aniket S. (Logistics Lead)",
        "temperature": 3.8,
        "status": "VERIFIED"
    }
]

# WebSocket Manager for pushing live ESP32 telemetries to Frontend
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")

ws_manager = ConnectionManager()

# =====================================================================
# ESP32 HARDWARE INTEGRATION ENDPOINTS
# =====================================================================

def query_ollama_triage(temp: float, spo2: float, heart_rate: float, voice_text: str) -> tuple:
    """
    Queries local Ollama LLM (llama3.2:1b) for cold-chain & triage assessment.
    Returns (summary_text, priority_string).
    """
    import urllib.request
    
    prompt = (
        f"You are MethXAI AI Assistant for cold-chain vaccine monitoring. "
        f"Current sensor values: Temperature = {temp} °C (Safe margin: 2.0°C to 8.0°C), SPO2 = {spo2}%, Heart Rate = {heart_rate} bpm. "
        f"User query: '{voice_text}'. "
        f"Provide a concise, professional 2-sentence cold chain status assessment and release status."
    )
    
    try:
        env_copy = os.environ.copy()
        env_copy['NO_PROXY'] = '127.0.0.1,localhost'
        req_data = json.dumps({
            "model": "llama3.2:1b",
            "prompt": prompt,
            "stream": False
        }).encode('utf-8')
        
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/generate",
            data=req_data,
            headers={"Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            ollama_resp = data.get("response", "").strip()
            if ollama_resp:
                priority = "Normal" if 2.0 <= temp <= 8.0 else "High"
                return ollama_resp, priority
    except Exception as e:
        print(f"Ollama call note (using fallback): {e}")

    # Rule engine fallback
    if 2.0 <= temp <= 8.0:
        return f"Cold-Chain Verified: Batch B-7749 stored at {temp:.1f} °C. Quality cleared for dispense.", "Normal"
    else:
        return f"Cold-Chain WARNING: Temperature {temp:.1f} °C outside target (2.0 - 8.0 °C). Review required.", "High"


class ESP32TriageRequest(BaseModel):
    temperature: Optional[float] = 3.8
    spo2: Optional[float] = 98.0
    heart_rate: Optional[float] = 72.0
    voice_text: Optional[str] = "Cold-chain audit request for Batch B-7749 vaccine logistics."

@app.post("/triage")
async def handle_esp32_triage(req: ESP32TriageRequest):
    """
    Called directly by ESP32 or Mac Mic when cold-chain audit / triage is requested.
    Queries Ollama LLM and speaks summary out loud over Mac Speakers.
    """
    print(f"ESP32 / Mic Triage Request: Temp={req.temperature}°C, SPO2={req.spo2}%, Voice='{req.voice_text}'")
    
    DISPENSER_STATUS["currentTemp"] = req.temperature
    DISPENSER_STATUS["lastPing"] = datetime.now(timezone.utc).isoformat()
    
    # Query Ollama LLM (llama3.2:1b)
    summary, priority = query_ollama_triage(
        req.temperature, req.spo2, req.heart_rate, req.voice_text or "Audit request"
    )
    
    recommendation_name = "COVID-19 Vaccine (Pfizer-BioNTech)" if priority == "Normal" else "COVID-19 Vaccine (Quarantined)"
    confidence = "0.98" if priority == "Normal" else "0.60"

    response_payload = {
        "status": "success",
        "ollama_model": "llama3.2:1b",
        "report": {
            "patient_summary": summary,
            "triage_priority": priority,
            "recommendations": [
                {
                    "name": recommendation_name,
                    "confidence_score": confidence
                }
            ]
        }
    }

    # Speak Ollama's AI response directly through Mac Speaker
    try:
        import subprocess
        if os.path.exists(DEFAULT_AUDIO_PATH):
            subprocess.Popen(["afplay", DEFAULT_AUDIO_PATH])
        subprocess.Popen(["say", summary])
    except Exception as err:
        print(f"Mac speaker playback note: {err}")

    # Broadcast event to frontend dashboard
    await ws_manager.broadcast({
        "type": "esp32_triage_completed",
        "data": {
            "temperature": req.temperature,
            "spo2": req.spo2,
            "heart_rate": req.heart_rate,
            "summary": summary,
            "priority": priority,
            "ollama": True,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    })

    return response_payload


class VoiceTriageRequest(BaseModel):
    voice_text: str
    temperature: Optional[float] = 3.8
    spo2: Optional[float] = 98.0
    heart_rate: Optional[float] = 72.0

@app.post("/api/voice-triage")
async def handle_mac_voice_triage(req: VoiceTriageRequest):
    """
    Triggered when user speaks into Mac Microphone via Dashboard or Voice Audit.
    Evaluates with Ollama LLM and speaks output on Mac Speakers.
    """
    triage_req = ESP32TriageRequest(
        temperature=req.temperature,
        spo2=req.spo2,
        heart_rate=req.heart_rate,
        voice_text=req.voice_text
    )
    return await handle_esp32_triage(triage_req)


class ESP32TelemetryRequest(BaseModel):
    shipmentId: Optional[str] = "SHP-2410-007"
    batchId: Optional[str] = "BTC-M1-2401"
    temperature: float
    humidity: Optional[float] = 48.0
    spo2: Optional[float] = 98.0
    heart_rate: Optional[float] = 72.0
    ir_sensor: Optional[int] = 1
    gate_status: Optional[str] = "CLOSED"

@app.post("/api/telemetry")
async def receive_esp32_telemetry(telemetry: ESP32TelemetryRequest):
    """
    ESP32 streams live temperature and sensor telemetry to Backend.
    Updates live shipment history & pushes real-time WebSocket updates to Frontend Dashboard.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Update global dispenser status
    DISPENSER_STATUS["espConnected"] = True
    DISPENSER_STATUS["lastPing"] = now_iso
    DISPENSER_STATUS["currentTemp"] = telemetry.temperature
    DISPENSER_STATUS["gateStatus"] = telemetry.gate_status
    DISPENSER_STATUS["irBeamStatus"] = "DETECTED" if telemetry.ir_sensor == 0 else "CLEAR"
    
    # Find matching shipment or default to SHP-2410-007
    shipment = next((s for s in SHIPMENTS if s["id"] == telemetry.shipmentId), SHIPMENTS[2])
    shipment["currentTemp"] = telemetry.temperature
    if telemetry.humidity is not None:
        shipment["currentHumidity"] = telemetry.humidity

    new_reading = {
        "timestamp": now_iso,
        "temperature": telemetry.temperature,
        "humidity": telemetry.humidity or 48.0,
        "isSimulated": False,
        "sensorId": "ESP32-HARDWARE-01"
    }
    shipment["readings"].append(new_reading)
    if len(shipment["readings"]) > 100:
        shipment["readings"] = shipment["readings"][-100:]

    # Check for excursion
    range_info = PRODUCTS.get(shipment["product"], {'minTemp': 2, 'maxTemp': 8})
    excursion = telemetry.temperature < range_info['minTemp'] or telemetry.temperature > range_info['maxTemp']
    
    new_alert = None
    if excursion:
        shipment["status"] = "warning" if telemetry.temperature > range_info['maxTemp'] else "critical"
        new_alert = {
            "id": f"ALT-{int(time.time())}",
            "timestamp": now_iso,
            "severity": "HIGH",
            "shipmentId": shipment["id"],
            "batchId": telemetry.batchId or shipment["batch"],
            "title": "ESP32 Live Excursion Alert",
            "message": f"Hardware sensor reported temp {telemetry.temperature:.1f}°C (Allowed: {range_info['minTemp']}°C to {range_info['maxTemp']}°C)",
            "acknowledged": False,
            "markedForReview": False
        }
        ALERTS.insert(0, new_alert)
    else:
        shipment["status"] = "in_transit"

    # Broadcast live update to all WebSocket clients
    payload = {
        "type": "telemetry_update",
        "data": {
            "shipmentId": shipment["id"],
            "currentTemp": telemetry.temperature,
            "currentHumidity": telemetry.humidity,
            "reading": new_reading,
            "dispenserStatus": DISPENSER_STATUS,
            "newAlert": new_alert
        }
    }
    await ws_manager.broadcast(payload)

    return {"status": "telemetry_received", "excursion": excursion}

# =====================================================================
# REST API ENDPOINTS FOR FRONTEND DASHBOARD
# =====================================================================

@app.get("/api/dashboard/summary")
async def get_dashboard_summary():
    active_count = len([s for s in SHIPMENTS if s["status"] in ["in_transit", "warning", "critical"]])
    excursion_count = len([s for s in SHIPMENTS if s["status"] in ["warning", "critical"]])
    unack_alerts = len([a for a in ALERTS if not a["acknowledged"]])
    review_batches = len([b for b in BATCHES if b["releaseStatus"] == "HOLD"])
    
    return {
        "activeShipments": active_count,
        "deliveredShipments": 14,
        "excursionShipments": excursion_count,
        "checkpointsNotified": len(CHECKPOINT_LOGS),
        "unackAlerts": unack_alerts,
        "batchesReview": review_batches,
        "espConnected": DISPENSER_STATUS["espConnected"]
    }

@app.get("/api/shipments")
async def get_shipments():
    return SHIPMENTS

@app.get("/api/shipments/{shipment_id}")
async def get_shipment(shipment_id: str):
    s = next((x for x in SHIPMENTS if x["id"] == shipment_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return s

@app.get("/api/shipments/{shipment_id}/readings")
async def get_shipment_readings(shipment_id: str):
    s = next((x for x in SHIPMENTS if x["id"] == shipment_id), None)
    return s["readings"] if s else []

@app.get("/api/alerts")
async def get_alerts():
    return ALERTS

@app.patch("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, body: dict = Body(...)):
    alert = next((a for a in ALERTS if a["id"] == alert_id), None)
    if alert:
        alert["acknowledged"] = True
        if body.get("review"):
            alert["markedForReview"] = True
        await ws_manager.broadcast({"type": "alert_acknowledged", "alertId": alert_id})
        return {"success": True, "alert": alert}
    raise HTTPException(status_code=404, detail="Alert not found")

@app.get("/api/batches")
async def get_batches():
    return BATCHES

@app.get("/api/checkpoints")
async def get_checkpoints():
    return CHECKPOINT_LOGS

@app.get("/api/products")
async def get_products():
    return PRODUCTS

@app.get("/api/dispenser/status")
async def get_dispenser_status():
    return DISPENSER_STATUS

class VerifyBatchRequest(BaseModel):
    batchId: str

@app.post("/api/dispenser/verify")
async def verify_batch(req: VerifyBatchRequest):
    batch = next((b for b in BATCHES if b["batchId"] == req.batchId), None)
    if not batch:
        return {
            "verified": False,
            "releaseStatus": "NOT_FOUND",
            "message": f"Batch {req.batchId} not registered in cold-chain database",
            "isSimulated": False
        }
    is_cleared = (batch["releaseStatus"] == "RELEASED")
    return {
        "verified": is_cleared,
        "releaseStatus": batch["releaseStatus"],
        "message": f"Batch {req.batchId} is {batch['releaseStatus']}",
        "currentTemp": batch["currentTemp"],
        "isSimulated": False
    }

# =====================================================================
# WEBSOCKET ENDPOINT FOR FRONTEND REAL-TIME STREAMING
# =====================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial handshake & system status
        await websocket.send_json({
            "type": "init",
            "dispenserStatus": DISPENSER_STATUS,
            "activeShipments": len(SHIPMENTS),
            "alertsCount": len(ALERTS)
        })
        while True:
            # Keep connection open and receive client messages if any
            data = await websocket.receive_text()
            print(f"WebSocket client message: {data}")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
