# Nexus Control System

Premium industrial HMI prototype with a React/Vite dashboard, Node.js factory simulator, Socket.IO telemetry, a FastAPI Isolation Forest AI layer, phone sensor ingestion, and engineer-mode virtual machines.

## Architecture

```text
Phone sensor page -> Node backend -> AI layer -> Socket.IO -> React dashboard
                       |             |
                       |             +-- FastAPI / scikit-learn anomaly scoring
                       +-- Simulated factory telemetry and shutdown commands
```

## Project Structure

```text
nextgen-control-system/
  ai-layer/        FastAPI anomaly engine
  backend/         Express + Socket.IO simulator and API
  frontend/        React dashboard and digital-twin UI
```

## Requirements

- Node.js 22+
- Python 3.13+
- npm
- A modern browser
- HTTPS tunnel for phone motion sensors on mobile browsers

## Local Development

Open three terminals from the project root.

### 1. AI layer

```powershell
cd ai-layer
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Health check:

```text
http://localhost:8000/health
```

### 2. Backend simulator

```powershell
cd backend
npm install
npm run dev
```

Backend URLs:

```text
http://localhost:4000
http://localhost:4000/sensor
```

### 3. Frontend dashboard

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Dashboard URL:

```text
http://localhost:5173
```

## Environment Variables

Copy the example env files when needed:

```text
frontend/.env.example
backend/.env.example
ai-layer/.env.example
```

Frontend:

```text
VITE_BACKEND_URL=http://localhost:4000
```

Backend:

```text
PORT=4000
AI_LAYER_URL=http://localhost:8000/evaluate
CORS_ORIGIN=*
```

## Production Build

Build the frontend:

```powershell
cd frontend
npm run build
```

The backend automatically serves `frontend/dist` when it exists. Then start production services:

```powershell
cd ai-layer
.\venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000
```

```powershell
cd backend
npm run start
```

Open:

```text
http://localhost:4000
```

## Tunnel / Phone Sensor Setup

Mobile motion sensors usually require HTTPS. If you tunnel the frontend, tunnel the backend too.

Example:

```powershell
cd frontend
npx localtunnel --port 5173
```

```powershell
cd backend
npx localtunnel --port 4000
```

If the frontend tunnel is:

```text
https://empty-yak-0.loca.lt
```

and the backend tunnel is:

```text
https://my-backend.loca.lt
```

open:

```text
https://empty-yak-0.loca.lt/?backend=https://my-backend.loca.lt
```

Then open this on the phone:

```text
https://my-backend.loca.lt/sensor
```

Tap `Start Sensor`. If the browser blocks physical motion data, use the built-in manual simulator.

## Engineer Mode

Switch the dashboard role to `Engineer Mode` to unlock:

- Virtual machine creation
- Simulated natural telemetry behavior
- Digital-twin ecosystem layouts
- Risk, flow, and system overlays
- Layout editing and card reordering
- Simulated shutdown and restart cycles

Virtual machines are saved in browser local storage and can be reset from the Engineer Studio panel.

## Deployment Notes

- Keep the AI layer private behind the backend in production.
- Set `CORS_ORIGIN` to the deployed frontend/backend origin instead of `*` for a stricter deployment.
- Use a process manager such as PM2, systemd, Docker, or a platform service manager.
- Put TLS/HTTPS in front of the backend if phone sensors are used.
- Use `npm run build` before serving the frontend from the backend.
- Monitor backend logs for `Error communicating with AI Layer`; if present, the dashboard falls back to `Unknown` AI status.

## Verification Commands

```powershell
cd frontend
npm run lint
npm run build
```

```powershell
cd backend
node --check server.js
```

```powershell
cd ai-layer
.\venv\Scripts\python.exe -m compileall main.py
```
