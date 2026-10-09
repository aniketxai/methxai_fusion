# MethXAI — Cold Chain Integrity Monitoring & Intelligent Medicine Distribution

IoT-Enabled Cold Chain Integrity Monitoring system built for hackathon problem **IOT-03: Real-Time Cold Chain Integrity Monitoring for Vaccine Logistics**.

Built with React + Vite + JavaScript. Charts powered by Recharts. Icons by Lucide.

## Running the project

```bash
npm install
npm run dev
```

The app starts in **mock-data mode** by default — no backend required. All sensor readings, shipments, batches, alerts, and checkpoints use realistic simulated data clearly labeled as "Simulated."

## Connecting to a backend

1. Copy `.env.example` to `.env`
2. Set `VITE_API_BASE_URL` to your Node.js/Express backend URL (e.g. `http://localhost:3000`)
3. Optionally set `VITE_WS_URL` for real-time WebSocket updates
4. Restart the dev server

When `VITE_API_BASE_URL` is set, the API service (`src/services/api.js`) switches from mock data to live HTTP requests. The UI code does not change.

## Folder structure

```
src/
├── components/        # Shared UI components (Sidebar, Header, StatusBadge, state views)
├── pages/             # Page-level views (one file per route)
│   ├── Overview.jsx           # Dashboard with metrics, temp trend, alerts, shipment table
│   ├── LiveShipments.jsx      # Searchable/filterable shipment table
│   ├── ShipmentDetail.jsx     # Per-shipment temp/humidity charts, route, excursions
│   ├── TemperatureMonitoring.jsx  # Configurable temp ranges, sensor status, excursion detail
│   ├── VaccineBatches.jsx     # Batch inventory with viability-risk estimation
│   ├── CheckpointsAlerts.jsx  # Alert management + checkpoint logs
│   ├── Reports.jsx           # Summary reports + dispenser integration status
│   └── Settings.jsx          # API config, temp range editor, notification prefs
├── services/
│   ├── api.js         # Centralized API service with mock fallback
│   └── socket.js      # WebSocket/Socket.IO service stub
├── hooks/
│   └── useApi.js      # Data-loading hook (loading/error/empty states)
├── utils/
│   └── format.js      # Date/time/temp/label formatting helpers
├── data/
│   └── mockData.js    # Realistic simulated cold-chain data
└── styles/
    └── global.css     # All styling (restrained engineering-tool aesthetic)
```

## Backend API endpoints expected

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Dashboard metrics |
| GET | `/api/shipments` | All shipments |
| GET | `/api/shipments/:id` | Single shipment detail |
| GET | `/api/shipments/:id/readings` | Sensor readings for a shipment |
| GET | `/api/alerts` | All alerts |
| PATCH | `/api/alerts/:id/acknowledge` | Acknowledge an alert |
| GET | `/api/batches` | All vaccine batches |
| GET | `/api/checkpoints` | Checkpoint logs |
| GET | `/api/products` | Product temperature range config |
| GET | `/api/dispenser/status` | Dispenser controller status |
| POST | `/api/dispenser/verify` | Batch verification before dispensing |

## Key design decisions

- **Mock vs live data is never mixed.** The app shows a "MOCK DATA" indicator in the header and "Simulated" labels on data sections when running without a backend.
- **Temperature ranges are per-product.** Different vaccines have different storage requirements (e.g. Pfizer: -90°C to -60°C, AstraZeneca: 2°C to 8°C). These are configurable in Settings.
- **Viability-risk estimation is labeled as simulated.** No scientifically validated shelf-life model is claimed. Batches with significant excursions are marked "HOLD — REVIEW REQUIRED" rather than being automatically declared safe or unsafe.
- **Dispenser integration is status-only.** The frontend can request batch verification from the backend but does not claim to directly control physical hardware. The spring-based dispenser and pill-rotor mechanism is unchanged.
