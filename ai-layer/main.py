from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from sklearn.ensemble import IsolationForest
import time

app = FastAPI(title="Nexus AI Engine", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class MachineData(BaseModel):
    id: str
    timestamp: str
    temperature: float
    pressure: float
    vibration: float

# ──────────────────────────────────────────────────────────────
# Baselines & Training Data for Isolation Forest
# ──────────────────────────────────────────────────────────────
BASELINES = {
    'PUMP_01':      {'temperature': 65, 'pressure': 120, 'vibration': 2.5},
    'VALVE_A':      {'temperature': 45, 'pressure': 80,  'vibration': 1.2},
    'MOTOR_02':     {'temperature': 80, 'pressure': 0.1, 'vibration': 5.0},
    'COMPRESSOR_B': {'temperature': 70, 'pressure': 200, 'vibration': 3.5},
}

# Pre-trained Isolation Forest models (one per machine)
# We generate synthetic "normal" data to train each model on startup
models = {}
for machine_id, bl in BASELINES.items():
    rng = np.random.default_rng(42)
    n_samples = 500
    normal_data = np.column_stack([
        rng.normal(bl['temperature'], bl['temperature'] * 0.05, n_samples),
        rng.normal(bl['pressure'],    max(bl['pressure'] * 0.05, 0.5), n_samples),
        rng.normal(bl['vibration'],   bl['vibration'] * 0.05, n_samples),
    ])
    model = IsolationForest(
        contamination=0.05,
        random_state=42,
        n_estimators=100,
    )
    model.fit(normal_data)
    models[machine_id] = model

print(f"[AI Engine] Isolation Forest models trained for {list(models.keys())}")

# ──────────────────────────────────────────────────────────────
# AI Copilot: Contextual recommendations per machine type
# ──────────────────────────────────────────────────────────────
COPILOT_KB = {
    'PUMP_01': {
        'high_temp': "Coolant flow may be restricted. Check cooling jacket and flush inlet strainer.",
        'high_vibration': "Likely cavitation or impeller imbalance. Reduce discharge pressure and inspect impeller.",
        'high_pressure': "Discharge valve may be partially closed. Verify valve position and check for blockage.",
        'low_pressure': "Possible suction leak or low reservoir level. Check NPSH and prime the pump.",
        'compound': "Multiple anomalies suggest bearing degradation. Initiate controlled shutdown of PUMP_01 and schedule bearing replacement.",
        'failure_mode': "Cavitation-induced seal failure",
        'probability': 85,
    },
    'VALVE_A': {
        'high_temp': "Excessive friction in valve stem. Inspect packing gland and apply lubrication.",
        'high_vibration': "Flow-induced vibration detected. Check for partially open position causing turbulence.",
        'high_pressure': "Downstream blockage causing back-pressure. Inspect downstream piping.",
        'low_pressure': "Valve may be stuck open. Check actuator signal and positioner feedback.",
        'compound': "Stem seizure imminent. Switch to bypass valve and schedule VALVE_A maintenance.",
        'failure_mode': "Stem seizure due to thermal expansion",
        'probability': 78,
    },
    'MOTOR_02': {
        'high_temp': "Winding insulation degrading. Reduce load by 15% and monitor stator temperature.",
        'high_vibration': "Rotor imbalance or misalignment detected. Check coupling alignment and bearing condition.",
        'high_pressure': "N/A for motor — pressure reading may be from coupled equipment.",
        'low_pressure': "N/A for motor.",
        'compound': "88% probability of bearing failure. Initiate emergency shutdown of MOTOR_02 and inspect rotor bearings immediately.",
        'failure_mode': "Bearing seizure from thermal overload",
        'probability': 88,
    },
    'COMPRESSOR_B': {
        'high_temp': "Discharge temperature exceeding limits. Check intercooler performance and gas composition.",
        'high_vibration': "Surge condition possible. Adjust inlet guide vanes and verify anti-surge control.",
        'high_pressure': "Discharge pressure above setpoint. Open blowoff valve and check pressure regulator.",
        'low_pressure': "Suction filter may be clogged. Inspect inlet filtration system.",
        'compound': "Compressor surge imminent. Reduce speed, open recirculation valve, and prepare for controlled shutdown.",
        'failure_mode': "Compressor surge leading to blade damage",
        'probability': 82,
    },
}

def generate_copilot_recommendation(machine_id: str, temp_dev: float, press_dev: float, vib_dev: float):
    """Generate contextual AI recommendation based on which metrics are deviating."""
    kb = COPILOT_KB.get(machine_id)
    if not kb:
        return {"recommendation": "No knowledge base available.", "failure_mode": "Unknown", "probability": 50}
    
    anomaly_count = sum([temp_dev > 0.15, press_dev > 0.15, vib_dev > 0.15])
    
    if anomaly_count >= 2:
        return {
            "recommendation": kb['compound'],
            "failure_mode": kb['failure_mode'],
            "probability": kb['probability'],
        }
    
    # Find the dominant anomaly
    if temp_dev > press_dev and temp_dev > vib_dev:
        baseline = BASELINES[machine_id]['temperature']
        direction = 'high_temp'
    elif vib_dev > press_dev:
        direction = 'high_vibration'
    else:
        direction = 'high_pressure' if press_dev > 0 else 'low_pressure'
    
    return {
        "recommendation": kb[direction],
        "failure_mode": kb['failure_mode'],
        "probability": min(kb['probability'], int(50 + max(temp_dev, press_dev, vib_dev) * 100)),
    }


def calculate_deviation(actual, expected):
    if expected == 0:
        expected = 0.1
    return abs(actual - expected) / expected


# ──────────────────────────────────────────────────────────────
# Main Evaluation Endpoint
# ──────────────────────────────────────────────────────────────
@app.post("/evaluate")
def evaluate_telemetry(data: List[MachineData]):
    evaluated_data = []
    
    for item in data:
        baseline = BASELINES.get(item.id)
        model = models.get(item.id)
        
        if not baseline or not model:
            evaluated_data.append({
                **item.model_dump(),
                "ai_status": "Normal",
                "severity_score": 1,
                "anomaly_source": "none",
                "copilot": None,
            })
            continue
        
        # ── Isolation Forest Anomaly Detection ──
        features = np.array([[item.temperature, item.pressure, item.vibration]])
        anomaly_score_raw = model.decision_function(features)[0]
        is_anomaly = model.predict(features)[0] == -1
        
        # Convert raw score to 1-100 severity
        # decision_function returns negative for anomalies, positive for normal
        # Typical range: -0.5 (very anomalous) to +0.3 (very normal)
        normalized = max(0, min(1, (0.3 - anomaly_score_raw) / 0.8))
        severity_score = int(1 + normalized * 99)
        severity_score = max(1, min(100, severity_score))
        
        # ── Deviation Analysis (for copilot context) ──
        dev_temp = calculate_deviation(item.temperature, baseline['temperature'])
        dev_press = calculate_deviation(item.pressure, baseline['pressure'])
        dev_vib = calculate_deviation(item.vibration, baseline['vibration'])
        max_dev = max(dev_temp, dev_press, dev_vib)
        
        # ── Status Classification ──
        if is_anomaly and severity_score >= 70:
            ai_status = 'Critical'
        elif is_anomaly or severity_score >= 45:
            ai_status = 'Warning'
        else:
            ai_status = 'Normal'
        
        # Determine which metric is the anomaly source
        if max_dev == dev_temp:
            anomaly_source = 'temperature'
        elif max_dev == dev_vib:
            anomaly_source = 'vibration'
        else:
            anomaly_source = 'pressure'
        
        # ── AI Copilot Recommendation (only for non-Normal) ──
        copilot = None
        if ai_status != 'Normal':
            copilot = generate_copilot_recommendation(item.id, dev_temp, dev_press, dev_vib)
        
        evaluated_data.append({
            **item.model_dump(),
            "ai_status": ai_status,
            "severity_score": severity_score,
            "anomaly_source": anomaly_source,
            "copilot": copilot,
        })
        
    return evaluated_data


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": list(models.keys()), "engine": "IsolationForest"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
