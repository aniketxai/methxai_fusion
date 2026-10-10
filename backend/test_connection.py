import os
import asyncio
import json
import urllib.request
import websockets

# Bypass system proxies for local loopback
os.environ["NO_PROXY"] = "localhost,127.0.0.1"

async def test_full_pipeline():
    print("=== Testing ESP32 -> Backend -> Frontend WebSocket Pipeline ===")
    
    # 1. Connect WebSocket client (simulating Frontend Dashboard)
    uri = "ws://127.0.0.1:8000/ws"
    async with websockets.connect(uri) as websocket:
        print("[Frontend WS] Connected to backend WebSocket!")
        init_msg = await websocket.recv()
        print(f"[Frontend WS] Received init message: {init_msg}")

        # 2. Simulate ESP32 sending POST /api/telemetry to Backend
        print("[ESP32] Sending live temperature telemetry (3.6 °C)...")
        payload = json.dumps({
            "shipmentId": "SHP-2410-007",
            "batchId": "BTC-M1-2401",
            "temperature": 3.6,
            "humidity": 47.5,
            "spo2": 98.0,
            "heart_rate": 72.0,
            "ir_sensor": 1,
            "gate_status": "CLOSED"
        }).encode('utf-8')
        
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/telemetry",
            data=payload,
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req) as resp:
            print(f"[ESP32] Backend HTTP Response: {resp.status} -> {resp.read().decode('utf-8')}")

        # 3. Receive real-time broadcast message on Frontend WebSocket
        ws_msg = await websocket.recv()
        print(f"[Frontend WS] Received real-time update over WebSocket:\n{ws_msg}")
        msg_data = json.loads(ws_msg)
        assert msg_data["type"] == "telemetry_update"
        assert msg_data["data"]["currentTemp"] == 3.6

        # 4. Simulate ESP32 requesting AI Triage & Cold Chain Audit POST /triage
        print("\n[ESP32] Requesting Cold Chain Triage Audit POST /triage...")
        triage_payload = json.dumps({
            "temperature": 3.8,
            "spo2": 98.0,
            "heart_rate": 72.0,
            "voice_text": "Cold-chain audit request for Batch B-7749"
        }).encode('utf-8')
        
        triage_req = urllib.request.Request(
            "http://127.0.0.1:8000/triage",
            data=triage_payload,
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(triage_req) as triage_resp:
            print(f"[ESP32] Triage HTTP Response: {triage_resp.status} -> {triage_resp.read().decode('utf-8')}")

        # 5. Receive triage broadcast event on Frontend WebSocket
        triage_ws_msg = await websocket.recv()
        print(f"[Frontend WS] Received triage event over WebSocket:\n{triage_ws_msg}")
        triage_data = json.loads(triage_ws_msg)
        assert triage_data["type"] == "esp32_triage_completed"

    print("\nSUCCESS: All pipeline integration tests passed! ESP32, Backend, and Frontend Dashboard communication verified.")

if __name__ == "__main__":
    asyncio.run(test_full_pipeline())
