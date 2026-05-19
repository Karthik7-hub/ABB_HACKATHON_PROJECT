from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.ensemble import IsolationForest
import time
import collections
from sklearn.utils.validation import check_is_fitted
from sklearn.exceptions import NotFittedError

app = FastAPI(title="Nexus Industrial Reasoning Engine", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    import sys
    print("[AI Layer] Validation Error Details:", exc.errors(), file=sys.stderr)
    try:
        body = await request.json()
        print("[AI Layer] Failed Request Body:", body, file=sys.stderr)
    except Exception:
        pass
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

class EcosystemContext(BaseModel):
    zone_temp: Optional[float] = 25.0
    zone_vib: Optional[float] = 0.0
    coolant_temp: Optional[float] = 25.0
    power_stability: Optional[float] = 1.0
    flow_rate: Optional[float] = 1.0

class CustomThresholds(BaseModel):
    baseTemp: Optional[float] = None
    basePressure: Optional[float] = None
    baseVibration: Optional[float] = None
    warnLimit: Optional[float] = None
    critLimit: Optional[float] = None

class MachineData(BaseModel):
    id: Optional[str] = "SIM_PUM_001"
    type: Optional[str] = "Pump"
    zone: Optional[str] = "Cooling Zone"
    timestamp: Optional[str] = None
    temperature: Optional[float] = 0.0
    pressure: Optional[float] = 0.0
    vibration: Optional[float] = 0.0
    isShutdown: Optional[bool] = False
    machineState: Optional[str] = "RUNNING"
    sensors: Optional[Any] = None
    ecosystem_context: Optional[EcosystemContext] = None
    customThresholds: Optional[CustomThresholds] = None
    connections: Optional[List[Any]] = None
    
    class Config:
        extra = "ignore"


# ──────────────────────────────────────────────────────────────
# MongoDB Connection & Historical Learning
# ──────────────────────────────────────────────────────────────
import os
from pymongo import MongoClient

MONGO_URI = os.getenv('MONGO_URI', 'mongodb://127.0.0.1:27017/abb_trails')
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    db = client.get_database()
    telemetry_col = db['telemetries']
    print("[AI Layer] Connected to MongoDB for historical learning.")
except Exception as e:
    print(f"[AI Layer] MongoDB Connection failed: {e}. Running in ephemeral mode.")
    telemetry_col = None

# ──────────────────────────────────────────────────────────────
# Static COPILOT_KB & Narrative Generators
# ──────────────────────────────────────────────────────────────
COPILOT_KB = {
    'Pump': {'high_vib': 'Cavitation likely. Check suction pressure and impeller for wear.', 'high_temp': 'Bearing failure or seal friction. Inspect cooling loop.'},
    'Motor': {'high_vib': 'Rotor imbalance or bearing wear detected.', 'high_temp': 'Winding short or overload condition. Verify current draw.'},
    'Compressor': {'high_vib': 'Surge margin instability or valve failure.', 'high_temp': 'Intercooler failure or high discharge pressure.'},
    'Valve': {'high_vib': 'Stem chatter or flow-induced vibration.', 'high_temp': 'Actuator overheating or fluid temp excursion.'},
    'RoboticArm': {'high_vib': 'Joint actuator gear wear or payload imbalance.', 'high_temp': 'Servo motor overheating.'},
    'Conveyor': {'high_vib': 'Roller bearing failure or belt misalignment.', 'high_temp': 'Drive motor overload.'},
    'Boiler': {'high_vib': 'Burner resonance or flow instability.', 'high_temp': 'Thermal runaway or low water level.'},
    'Reactor': {'high_vib': 'Agitator imbalance or shaft wear.', 'high_temp': 'Exothermic runaway or cooling jacket failure.'},
    'Chiller': {'high_vib': 'Compressor scroll wear.', 'high_temp': 'Condenser fouling or refrigerant leak.'}
}

def buildSmartAlarm(severity_score, anomaly_source):
    if severity_score > 90:
        return f"CRITICAL: Imminent failure window: < 5 minutes. Source: {anomaly_source}."
    elif severity_score > 70:
        return f"URGENT: Failure window: 5-15 minutes. Source: {anomaly_source}."
    else:
        return f"WARNING: Degradation detected. Review {anomaly_source} trends."

def buildCopilotNarrative(machine_type, anomaly_source, severity_score, failure_mode, recommendation):
    kb_lookup = COPILOT_KB.get(machine_type, {})
    specific_insight = kb_lookup.get('high_vib' if anomaly_source == 'vibration' else 'high_temp', "Component degradation detected.")
    
    narrative = f"### {failure_mode.upper()} DETECTED\n"
    narrative += f"**System Diagnosis**: {specific_insight} The AI models have identified a significant deviation in {anomaly_source} with a severity of {severity_score}/100.\n\n"
    narrative += f"**Evidence**:\n- Primary anomaly in {anomaly_source}\n- Cross-correlated physical wear indicators\n\n"
    narrative += f"**Recommended Action**: {recommendation}"
    return narrative

# ──────────────────────────────────────────────────────────────
# In-Memory Temporal Graph & Reasoning States
# ──────────────────────────────────────────────────────────────
HISTORY_WINDOW = 300 # Increased window since we have DB
machine_history: Dict[str, collections.deque] = {}
detectors: Dict[str, Any] = {}

class OnlineBayesianAnomalyDetector:
    def __init__(self, alpha: float = 0.05, min_samples: int = 8):
        self.alpha = alpha  # online learning rate
        self.min_samples = min_samples
        self.count = 0
        self.mean = None
        self.cov = None
        self.eps = 1e-4

    def update(self, x: np.ndarray):
        self.count += 1
        if self.mean is None:
            self.mean = x.copy()
            self.cov = np.eye(len(x)) * self.eps
            return
        
        # Exponential moving average updates for online learning
        delta = x - self.mean
        self.mean += self.alpha * delta
        # Update covariance matrix online
        self.cov = (1.0 - self.alpha) * self.cov + self.alpha * np.outer(delta, delta)
        # Regularize for stability (avoid singular matrix)
        self.cov += np.eye(len(x)) * self.eps

    def compute_anomaly_probability(self, x: np.ndarray) -> float:
        if self.count < self.min_samples:
            return 0.0
        
        delta = x - self.mean
        try:
            inv_cov = np.linalg.inv(self.cov)
            mahalanobis_sq = np.dot(delta.T, np.dot(inv_cov, delta))
            # Chi-squared cumulative distribution approximation for 3 degrees of freedom
            prob = 1.0 - np.exp(-0.5 * mahalanobis_sq)
            return float(prob)
        except np.linalg.LinAlgError:
            # Fallback to normalized Z-score distance
            std = np.sqrt(np.diag(self.cov))
            z_scores = np.abs(delta) / (std + 1e-5)
            max_z = np.max(z_scores)
            prob = 1.0 - np.exp(-0.5 * (max_z ** 2))
            return float(prob)

def get_machine_history(machine_id: str):
    if machine_id not in machine_history:
        history_deque = collections.deque(maxlen=HISTORY_WINDOW)
        
        # Pre-load from MongoDB if available
        if telemetry_col is not None:
            try:
                records = list(telemetry_col.find({'machineId': machine_id}).sort('timestamp', -1).limit(HISTORY_WINDOW))
                records.reverse() # chronological
                for r in records:
                    history_deque.append([r['temperature'], r['pressure'], r['vibration']])
            except Exception:
                pass
                
        machine_history[machine_id] = history_deque
        
    return machine_history[machine_id]

# ──────────────────────────────────────────────────────────────
# AI Reasoning & Root Cause Inference Engine
# ──────────────────────────────────────────────────────────────
class IndustrialReasoner:
    def __init__(self, current_data: List[MachineData]):
        self.data = current_data
        
        # Analyze ecosystem health
        self.ecosystem_state = self.analyze_ecosystem()
        
    def analyze_ecosystem(self):
        """Build a graph-level understanding of the factory ecosystem."""
        zones = {}
        global_coolant = 25.0
        global_power = 1.0
        
        for item in self.data:
            eco = item.ecosystem_context
            z_temp = eco.zone_temp if eco else 25.0
            z_vib = eco.zone_vib if eco else 0.0
            if item.zone not in zones:
                zones[item.zone] = {
                    'temp': z_temp,
                    'vib': z_vib,
                    'machines': 0,
                    'anomalous_machines': 0
                }
            zones[item.zone]['machines'] += 1
            global_coolant = eco.coolant_temp if eco else 25.0
            global_power = eco.power_stability if eco else 1.0
            
        return {
            'zones': zones,
            'coolant_temp': global_coolant,
            'power_stability': global_power
        }

    def infer_root_cause(self, item: MachineData, dev_temp: float, dev_press: float, dev_vib: float) -> tuple[str, str]:
        """
        Reason about why a machine is anomalous based purely on physics, 
        temporal state, and spatial ecosystem relationships.
        """
        eco = self.ecosystem_state
        zone_data = eco['zones'][item.zone]
        
        failure_mode = "Degradation detected"
        recommendation = "Conduct standard diagnostic protocol."
        
        # 1. Check Global Network Cascades
        if dev_temp > 0.15 and eco['coolant_temp'] > 28.0:
            failure_mode = "Cascading thermal failure"
            recommendation = f"Ecosystem Reasoning: Elevated machine temperature ({item.temperature:.1f}°C) is a secondary symptom. Root cause is global cooling network degradation (Coolant: {eco['coolant_temp']:.1f}°C). Reroute flow or activate backup chillers."
            return failure_mode, recommendation
            
        if dev_vib > 0.15 and eco['power_stability'] < 0.90:
            failure_mode = "Electrical jitter"
            recommendation = f"Ecosystem Reasoning: Motor/Rotor vibration is driven by power grid brownout (Stability: {eco['power_stability']*100:.1f}%). Anomalies across connected electrical systems expected. Redistribute factory load."
            return failure_mode, recommendation

        # 2. Check Spatial Zone Cascades
        if dev_vib > 0.15 and zone_data['vib'] > 2.0:
            failure_mode = "Resonance coupling"
            recommendation = f"Spatial Reasoning: Machine is absorbing high floor vibration ({zone_data['vib']:.2f} mm/s) originating from another heavily degraded asset in {item.zone}. Isolate mounting to prevent precision drop."
            return failure_mode, recommendation
            
        if dev_temp > 0.15 and zone_data['temp'] > 30.0:
            failure_mode = "Ambient overheating"
            recommendation = f"Spatial Reasoning: Local ambient temperature in {item.zone} has pooled to {zone_data['temp']:.1f}°C, reducing the machine's thermal dissipation efficiency. Improve zone ventilation."
            return failure_mode, recommendation

        # 3. Check Local Machine Physics (No ecosystem cascade detected)
        if dev_vib > dev_temp and dev_vib > dev_press:
            failure_mode = "Bearing wear / Misalignment"
            recommendation = f"Local Physics: Asymmetric vibration growth ({item.vibration:.2f} mm/s) without grid instability suggests mechanical bearing wear. Schedule predictive maintenance within 48h."
        elif dev_temp > dev_press:
            failure_mode = "Friction / Lubrication loss"
            recommendation = f"Local Physics: Disproportionate heat generation ({item.temperature:.1f}°C) implies internal friction. Verify lubrication systems and load limits."
        else:
            failure_mode = "Seal / Flow anomaly"
            recommendation = f"Local Physics: Pressure deviation detected ({item.pressure:.1f} bar). Suggests seal leakage or flow restriction in hydraulic/pneumatic path."
            
        # 4. Check for Conveyor/Flow dependencies
        eco = item.ecosystem_context
        flow_val = eco.flow_rate if eco else 1.0
        if item.type in ['Conveyor', 'RoboticArm'] and flow_val < 0.8:
            recommendation += f" Note: Upstream flow bottleneck detected (Flow: {flow_val*100:.0f}%)."
            
        return failure_mode, recommendation

# ──────────────────────────────────────────────────────────────
# Main Evaluation Endpoint
# ──────────────────────────────────────────────────────────────
@app.post("/evaluate")
def evaluate_telemetry(data: List[MachineData]):
    evaluated_data = []
    
    reasoner = IndustrialReasoner(data)
    
    # Default design profiles for standard machine types to initialize baselines
    DEFAULT_MACHINE_PROFILES = {
        'Pump': {'temp': 60.0, 'press': 120.0, 'vib': 2.0},
        'Motor': {'temp': 70.0, 'press': 150.0, 'vib': 1.5},
        'Compressor': {'temp': 75.0, 'press': 250.0, 'vib': 3.0},
        'Conveyor': {'temp': 55.0, 'press': 800.0, 'vib': 2.5},
        'Boiler': {'temp': 250.0, 'press': 400.0, 'vib': 2.0},
        'Valve': {'temp': 25.0, 'press': 100.0, 'vib': 1.0},
        'RoboticArm': {'temp': 45.0, 'press': 80.0, 'vib': 0.01},
        'Reactor': {'temp': 92.0, 'press': 142.0, 'vib': 1.8},
        'Chiller': {'temp': 28.0, 'press': 64.0, 'vib': 1.6}
    }

    # 1. Update online Bayesian learning for all machines
    for item in data:
        hist = get_machine_history(item.id)
        
        # Get profile baselines
        profile = DEFAULT_MACHINE_PROFILES.get(item.type, {'temp': 50.0, 'press': 100.0, 'vib': 2.0})
        p_temp = profile['temp']
        p_press = profile['press']
        p_vib = profile['vib']

        # Get baseline from history, falling back to design profile
        if len(hist) < 5:
            baseline_temp = p_temp
            baseline_press = p_press
            baseline_vib = p_vib
        else:
            baseline_temp = np.median([h[0] for h in hist]) or p_temp
            baseline_press = np.median([h[1] for h in hist]) or p_press
            baseline_vib = np.median([h[2] for h in hist]) or p_vib

        # Override baseline values with custom thresholds if available
        if item.customThresholds:
            if item.customThresholds.baseTemp is not None:
                baseline_temp = item.customThresholds.baseTemp
            if item.customThresholds.basePressure is not None:
                baseline_press = item.customThresholds.basePressure
            if item.customThresholds.baseVibration is not None:
                baseline_vib = item.customThresholds.baseVibration

        # Determine if we should learn from this frame (only if machine is running normally)
        should_learn = not item.isShutdown and item.machineState not in ['STARTING', 'OFFLINE', 'MAINTENANCE', 'EMERGENCY_SHUTDOWN']

        # Perform physical deviation analysis
        # Cooler/smoother operation is physically safe, so we only flag elevated temp and vib
        dev_temp = max(0.0, item.temperature - baseline_temp) / baseline_temp if baseline_temp > 0 else 0
        dev_vib = max(0.0, item.vibration - baseline_vib) / baseline_vib if baseline_vib > 0 else 0

        # For pressure, both high and low can be anomalies, but low pressure is normal during startup or if not RUNNING
        if item.machineState in ['STARTING', 'OFFLINE', 'MAINTENANCE', 'EMERGENCY_SHUTDOWN'] or item.pressure < baseline_press:
            dev_press = max(0.0, item.pressure - baseline_press) / baseline_press if baseline_press > 0 else 0
        else:
            dev_press = abs(item.pressure - baseline_press) / baseline_press if baseline_press > 0 else 0

        if not should_learn:
            raw_severity = 0
            severity_score = 0
            phys_dev_score = 0
            max_dev = 0.0
            anomaly_source = 'temperature'
        else:
            features = np.array([item.temperature, item.pressure, item.vibration])
            hist.append(features.tolist())
            
            # Retrieve or create online Bayesian detector
            detector = detectors.get(item.id)
            if detector is None:
                detector = OnlineBayesianAnomalyDetector()
                detectors[item.id] = detector
                # Seed mean and covariance with design defaults to prevent initial spike
                detector.mean = np.array([p_temp, p_press, p_vib])
                detector.cov = np.eye(3) * 1.0
                
            detector.update(features)
            
            # Calculate Bayesian anomaly probability
            bayesian_prob = detector.compute_anomaly_probability(features)
            severity_score = int(bayesian_prob * 100)
            severity_score = max(1, min(100, severity_score))

            max_dev = max(dev_temp, dev_press, dev_vib)
            phys_dev_score = int(max_dev * 400.0)
            
            # Combine Bayesian probability and physical deviation
            raw_severity = max(severity_score, phys_dev_score)
            raw_severity = max(1, min(100, raw_severity))
            
            if max_dev == dev_temp:
                anomaly_source = 'temperature'
            elif max_dev == dev_vib:
                anomaly_source = 'vibration'
            else:
                anomaly_source = 'pressure'

        warn_level = item.customThresholds.warnLimit if (item.customThresholds and item.customThresholds.warnLimit is not None) else 45
        crit_level = item.customThresholds.critLimit if (item.customThresholds and item.customThresholds.critLimit is not None) else 70

        # Store initial raw values
        item._raw_severity = raw_severity
        item._anomaly_source = anomaly_source
        item._warn_level = warn_level
        item._crit_level = crit_level

    # ── Graph-Aware Causal Propagation via GNN-style message passing ──
    machine_dict = {m.id: m for m in data}
    prop_states = {m.id: (0.0 if m.isShutdown else float(m._raw_severity)) for m in data}
    prop_causes = {m.id: [] for m in data}
    
    for _ in range(2):
        new_states = prop_states.copy()
        for item in data:
            # Shutdown nodes do not initiate/receive propagation
            if item.isShutdown or not item.connections:
                continue
            for conn in item.connections:
                target_id = conn.get("target") if isinstance(conn, dict) else conn
                # Ignore shutdown targets
                if target_id not in machine_dict or machine_dict[target_id].isShutdown:
                    continue
                
                weight = conn.get("weight", 0.5) if isinstance(conn, dict) else 0.5
                conn_type = conn.get("type", "PRESSURE") if isinstance(conn, dict) else "PRESSURE"
                
                # Forward causal propagation
                if target_id in prop_states:
                    propagated_forward = prop_states[item.id] * weight * 0.9
                    if propagated_forward > new_states[target_id]:
                        new_states[target_id] = propagated_forward
                        # Store structural causal info instead of just strings
                        prop_causes[target_id].append({
                            "source": item.id,
                            "type": conn_type,
                            "severity": propagated_forward,
                            "weight": weight
                        })
                
                # Backward causal propagation
                if target_id in prop_states:
                    propagated_backward = prop_states[target_id] * weight * 0.4
                    if propagated_backward > new_states[item.id]:
                        new_states[item.id] = propagated_backward
                        prop_causes[item.id].append({
                            "source": target_id,
                            "type": conn_type,
                            "severity": propagated_backward,
                            "weight": weight
                        })
                        
        prop_states = new_states

    # 3. Apply final propagated risk values
    for item in data:
        propagated_val = 0.0 if item.isShutdown else prop_states[item.id]
        added_risk = max(0.0, propagated_val - item._raw_severity)
        final_severity = min(100, int(propagated_val))
        
        if final_severity >= item._crit_level:
            ai_status = 'Critical'
            severity_score = max(final_severity, item._crit_level)
        elif final_severity >= item._warn_level:
            ai_status = 'Warning'
            severity_score = max(final_severity, item._warn_level)
        else:
            ai_status = 'Normal'
            severity_score = final_severity

        if item.isShutdown:
            ai_status = 'Normal'
            severity_score = 0

        anomaly_source = item._anomaly_source

        # ── AI Reasoning & Inference (Copilot) ──
        copilot = None
        if ai_status != 'Normal' and not item.isShutdown:
            baseline_temp = item.temperature or 1.0
            baseline_press = item.pressure or 1.0
            baseline_vib = item.vibration or 1.0
            dev_temp = abs(item.temperature - baseline_temp) / baseline_temp if baseline_temp > 0 else 0
            dev_press = abs(item.pressure - baseline_press) / baseline_press if baseline_press > 0 else 0
            dev_vib = abs(item.vibration - baseline_vib) / baseline_vib if baseline_vib > 0 else 0
            
            failure_mode, recommendation = reasoner.infer_root_cause(item, dev_temp, dev_press, dev_vib)
            
            # Explicitly reason about cascading root causes from connected machines
            causes = prop_causes[item.id]
            unique_causes = {}
            for c in causes:
                src = c["source"]
                if src not in unique_causes or c["severity"] > unique_causes[src]["severity"]:
                    unique_causes[src] = c
            
            sorted_causes = sorted(unique_causes.values(), key=lambda x: x["severity"], reverse=True)
            
            if added_risk > 15 and len(sorted_causes) > 0:
                highest_cause = sorted_causes[0]
                src_id = highest_cause["source"]
                conn_type = highest_cause["type"]
                weight_val = highest_cause.get("weight", 0.5)
                
                # Map connection type to its specific physical utility/use
                edge_uses = {
                    "PRESSURE": "fluid dynamic pressure transfer and hydraulic power coupling",
                    "TEMPERATURE": "thermal dissipation pathway and conductive heat transfer",
                    "VIBRATION": "mechanical vibration transmission and structural resonance coupling"
                }
                edge_use = edge_uses.get(conn_type.upper(), "physical process interaction link")
                
                failure_mode = "Cascading Secondary Anomaly"
                recommendation = (
                    f"Ecosystem Causal Root Cause: The primary anomaly originated at connected machine **{src_id}**. "
                    f"The physical {conn_type.lower()} load spike has propagated along the topology network via the "
                    f"{edge_use} edge (weight/coupling strength: {weight_val:.2f}) to this machine (**{item.id}**), "
                    f"causing a secondary cascading physical anomaly. Please inspect and resolve the root issue at **{src_id}** "
                    f"first to stabilize this node."
                )
            
            copilot = {
                "probability": severity_score,
                "failure_mode": failure_mode,
                "recommendation": recommendation,
                "smart_alarm": buildSmartAlarm(severity_score, anomaly_source),
                "narrative": buildCopilotNarrative(item.type, anomaly_source, severity_score, failure_mode, recommendation)
            }
            
            reasoner.ecosystem_state['zones'][item.zone]['anomalous_machines'] += 1

        # Return augmented payload
        evaluated_data.append({
            "id": item.id,
            "type": item.type,
            "zone": item.zone,
            "timestamp": item.timestamp,
            "temperature": item.temperature,
            "pressure": item.pressure,
            "vibration": item.vibration,
            "ai_status": ai_status,
            "severity_score": severity_score,
            "anomaly_source": anomaly_source,
            "synthetic": False,
            "isShutdown": item.isShutdown,
            "copilot": copilot
        })
        
    # ── AI Operational Zonal Insights ──
    zonal_insights = []
    default_zones_list = ['Cooling Zone', 'High Heat Zone', 'Robotics Zone', 'Hydraulic Zone']
    
    # Pre-populate all zones
    zones_map = {z: {
        "zone": z,
        "status": "Normal",
        "severity": 0,
        "count": 0,
        "message": ""
    } for z in default_zones_list}
    
    # Aggregate data per zone
    for val in evaluated_data:
        z_name = val["zone"]
        if z_name not in zones_map:
            zones_map[z_name] = {
                "zone": z_name,
                "status": "Normal",
                "severity": 0,
                "count": 0,
                "message": ""
            }
        
        zones_map[z_name]["count"] += 1
        if val["ai_status"] != "Normal" and not val["isShutdown"]:
            zones_map[z_name]["severity"] = max(zones_map[z_name]["severity"], val["severity_score"])
            if val["ai_status"] == "Critical":
                zones_map[z_name]["status"] = "Critical"
            elif val["ai_status"] == "Warning" and zones_map[z_name]["status"] != "Critical":
                zones_map[z_name]["status"] = "Warning"
                
    # Generate dynamic, high-fidelity zonal narrative updates
    for z_name, z_info in zones_map.items():
        if z_info["status"] == "Critical":
            z_info["message"] = f"CRITICAL ANOMALY ALERT: Imminent failure risk identified in {z_name} (Max Severity: {z_info['severity']}%). Primary anomaly in mechanical/thermal assets. Immediate maintenance crew dispatch recommended."
        elif z_info["status"] == "Warning":
            z_info["message"] = f"WARNING STATE: Operating efficiency in {z_name} degraded. Vibration/thermal signatures elevated (Max Severity: {z_info['severity']}%). Schedule inspection within current shift."
        else:
            # Normal state messages depending on the zone name
            if "Cooling" in z_name:
                z_info["message"] = "NOMINAL EFFICIENCY: Cooling loop and thermal exchange systems operating within safe operating limits. All heat pumps aligned."
            elif "Heat" in z_name:
                z_info["message"] = "THERMAL STABILITY: High-temperature furnaces and reactors under nominal thermal load. Dispersal fans operating at 100% capacity."
            elif "Robotics" in z_name:
                z_info["message"] = "SYNCHRONIZATION OK: Robotic arm joints and structural paths performing at peak accuracy. Zero latency or torque errors logged."
            elif "Hydraulic" in z_name:
                z_info["message"] = "PRESSURE STABLE: Pneumatic loops and pressure valves show 100% flow consistency. Hydraulic actuators fully responsive."
            else:
                z_info["message"] = f"All {z_info['count']} active assets in {z_name} are performing within standard parameters. OEE projected at 98%."
                
        zonal_insights.append(z_info)

    return {
        "machines": evaluated_data,
        "zonal_insights": zonal_insights
    }

@app.get("/health")
def health():
    return {"status": "ok", "tracked_machines": len(machine_history), "engine": "Temporal Graph Reasoner"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
