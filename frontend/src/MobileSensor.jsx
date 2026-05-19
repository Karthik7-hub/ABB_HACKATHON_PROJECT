import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { resolveBackendUrl } from './utils/helpers';
import { Smartphone, Activity, Sliders, Radio, Thermometer, Gauge, Zap } from 'lucide-react';

const BACKEND_URL = resolveBackendUrl();

export default function MobileSensor() {
    const [mode, setMode] = useState('sensor'); // 'sensor' or 'manual'
    const [status, setStatus] = useState('Disconnected');
    const [isStreaming, setIsStreaming] = useState(false);
    const [machineId, setMachineId] = useState('SIM_PUM_01');
    const [socket, setSocket] = useState(null);

    // Sensor state
    const [vibrationVal, setVibrationVal] = useState(0.0);
    const [temperatureVal, setTemperatureVal] = useState(50);
    const [pressureVal, setPressureVal] = useState(100);

    const emitIntervalRef = useRef(null);
    const lastEmitRef = useRef(0);
    const motionHandlerRef = useRef(null);

    // Initialize Socket.IO connection
    useEffect(() => {
        const s = io(BACKEND_URL);
        setSocket(s);
        s.on('connect', () => setStatus('Connected - Ready'));
        s.on('disconnect', () => setStatus('Disconnected'));

        return () => {
            s.disconnect();
        };
    }, []);

    // Handle Streaming Loop
    useEffect(() => {
        if (!socket || !isStreaming) {
            // Clean up any active intervals or event listeners
            if (emitIntervalRef.current) {
                clearInterval(emitIntervalRef.current);
                emitIntervalRef.current = null;
            }
            if (motionHandlerRef.current) {
                window.removeEventListener('devicemotion', motionHandlerRef.current);
                motionHandlerRef.current = null;
            }
            if (socket) {
                setStatus('Connected - Ready');
            }
            return;
        }

        setStatus('Streaming Active...');

        if (mode === 'sensor') {
            // Motion Accelerometer Mode
            const handleMotion = (event) => {
                if (!event.accelerationIncludingGravity) return;
                const { x, y, z } = event.accelerationIncludingGravity;
                
                // Calculate scalar magnitude for vibration (subtracting gravity)
                const mag = Math.sqrt(x * x + y * y + z * z);
                const motion = Math.abs(mag - 9.8);
                const scaled = parseFloat(Math.min(Math.max(motion * 1.5, 0), 15).toFixed(2));
                setVibrationVal(scaled);

                const now = Date.now();
                if (now - lastEmitRef.current > 200) {
                    socket.emit('mobile:sensor_data', {
                        machineId,
                        vibration: scaled
                    });
                    lastEmitRef.current = now;
                }
            };

            motionHandlerRef.current = handleMotion;

            const requestAccess = async () => {
                if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                    try {
                        const permission = await DeviceMotionEvent.requestPermission();
                        if (permission === 'granted') {
                            window.addEventListener('devicemotion', handleMotion);
                        } else {
                            setStatus('Permission Denied');
                            setIsStreaming(false);
                        }
                    } catch (e) {
                        setStatus('Permission Error');
                        setIsStreaming(false);
                    }
                } else {
                    window.addEventListener('devicemotion', handleMotion);
                }
            };

            requestAccess();
        } else {
            // Manual Sliders Mode (200ms broadcast loop)
            emitIntervalRef.current = setInterval(() => {
                socket.emit('mobile:sensor_data', {
                    machineId,
                    vibration: parseFloat(vibrationVal),
                    temperature: parseFloat(temperatureVal),
                    pressure: parseFloat(pressureVal)
                });
            }, 200);
        }

        return () => {
            if (emitIntervalRef.current) {
                clearInterval(emitIntervalRef.current);
                emitIntervalRef.current = null;
            }
            if (motionHandlerRef.current) {
                window.removeEventListener('devicemotion', motionHandlerRef.current);
                motionHandlerRef.current = null;
            }
        };
    }, [socket, isStreaming, mode, machineId, vibrationVal, temperatureVal, pressureVal]);

    const handleToggleStream = () => {
        setIsStreaming(!isStreaming);
    };

    return (
        <div style={{
            padding: '2rem 1.5rem',
            background: 'radial-gradient(circle at top, #0f172a 0%, #020617 100%)',
            minHeight: '100vh',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
            boxSizing: 'border-box'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Smartphone size={32} color="#38bdf8" />
                <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, tracking: '-0.025em', background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    NEXUS TELEMETRY BRIDGE
                </h1>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', margin: '0 0 2rem', maxWidth: '340px', lineHeight: '1.5' }}>
                Stream real-time sensor overrides to the digital-twin floorplan from your mobile device or manual dashboard console.
            </p>

            {/* Target Machine Card */}
            <div style={{
                width: '100%',
                maxWidth: '360px',
                background: 'rgba(30, 41, 59, 0.5)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(56, 189, 248, 0.15)',
                borderRadius: '16px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                boxSizing: 'border-box',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#38bdf8', letterSpacing: '0.05em', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Target Asset Identifier
                </label>
                <input 
                    value={machineId}
                    onChange={e => setMachineId(e.target.value.toUpperCase())}
                    disabled={isStreaming}
                    placeholder="e.g. SIM_PUM_01"
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        background: 'rgba(15, 23, 42, 0.8)',
                        color: '#fff',
                        fontSize: '16px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        letterSpacing: '0.05em',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        boxSizing: 'border-box',
                        opacity: isStreaming ? 0.6 : 1
                    }}
                />
            </div>

            {/* Segment Controller (Mode Switcher) */}
            <div style={{
                display: 'flex',
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '4px',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '360px',
                marginBottom: '1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxSizing: 'border-box'
            }}>
                <button
                    onClick={() => { setMode('sensor'); setIsStreaming(false); }}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: mode === 'sensor' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.2))' : 'transparent',
                        color: mode === 'sensor' ? '#38bdf8' : '#64748b',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.2s',
                        border: mode === 'sensor' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent'
                    }}
                >
                    <Radio size={14} />
                    MOTION SENSOR
                </button>
                <button
                    onClick={() => { setMode('manual'); setIsStreaming(false); }}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: mode === 'manual' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.2))' : 'transparent',
                        color: mode === 'manual' ? '#38bdf8' : '#64748b',
                        fontWeight: 'bold',
                        fontSize: '12px',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.2s',
                        border: mode === 'manual' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent'
                    }}
                >
                    <Sliders size={14} />
                    MANUAL CONSOLE
                </button>
            </div>

            {/* Main Interactive Interface Panel */}
            <div style={{
                width: '100%',
                maxWidth: '360px',
                background: 'rgba(30, 41, 59, 0.3)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '20px',
                padding: '1.5rem',
                boxSizing: 'border-box',
                marginBottom: '2rem',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)'
            }}>
                {mode === 'sensor' ? (
                    /* Sensor Mode Details */
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                        <div style={{
                            width: '90px',
                            height: '90px',
                            borderRadius: '50%',
                            background: vibrationVal > 5 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            border: `2px solid ${vibrationVal > 5 ? '#ef4444' : '#10b981'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '1rem',
                            animation: vibrationVal > 5 ? 'pulse 1s infinite' : 'none',
                            transition: 'all 0.3s'
                        }}>
                            <Activity size={36} color={vibrationVal > 5 ? '#ef4444' : '#10b981'} />
                        </div>
                        <h2 style={{ fontSize: '42px', fontWeight: '900', margin: 0, color: vibrationVal > 5 ? '#ef4444' : '#f8fafc' }}>
                            {vibrationVal}
                        </h2>
                        <span style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.1em', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px' }}>
                            Current Vibration (mm/s)
                        </span>
                        <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', margin: '1rem 0 0', lineHeight: '1.4' }}>
                            Shaking your device triggers high-g telemetry events dynamically sent to the digital twin.
                        </p>
                    </div>
                ) : (
                    /* Manual Sliders Console */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
                        {/* Slider 1: Vibration */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                                <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Activity size={12} color="#38bdf8" /> VIBRATION
                                </span>
                                <span style={{ color: vibrationVal > 5 ? '#ef4444' : '#38bdf8' }}>{vibrationVal} mm/s</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="15"
                                step="0.1"
                                value={vibrationVal}
                                onChange={(e) => setVibrationVal(parseFloat(e.target.value))}
                                style={{
                                    width: '100%',
                                    accentColor: '#38bdf8',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    height: '6px',
                                    borderRadius: '3px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            />
                        </div>

                        {/* Slider 2: Temperature */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                                <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Thermometer size={12} color="#f97316" /> TEMPERATURE
                                </span>
                                <span style={{ color: temperatureVal > 85 ? '#ef4444' : '#f97316' }}>{temperatureVal} °C</span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="150"
                                step="1"
                                value={temperatureVal}
                                onChange={(e) => setTemperatureVal(parseInt(e.target.value))}
                                style={{
                                    width: '100%',
                                    accentColor: '#f97316',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    height: '6px',
                                    borderRadius: '3px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            />
                        </div>

                        {/* Slider 3: Pressure */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                                <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Gauge size={12} color="#10b981" /> HYDRAULIC PRESSURE
                                </span>
                                <span style={{ color: pressureVal > 220 ? '#ef4444' : '#10b981' }}>{pressureVal} bar</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="300"
                                step="1"
                                value={pressureVal}
                                onChange={(e) => setPressureVal(parseInt(e.target.value))}
                                style={{
                                    width: '100%',
                                    accentColor: '#10b981',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    height: '6px',
                                    borderRadius: '3px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Broadcast Control Button */}
            <button
                onClick={handleToggleStream}
                style={{
                    width: '100%',
                    maxWidth: '360px',
                    padding: '16px',
                    borderRadius: '30px',
                    background: isStreaming 
                        ? 'linear-gradient(135deg, #ef4444, #b91c1c)' 
                        : 'linear-gradient(135deg, #38bdf8, #2563eb)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '15px',
                    fontWeight: '800',
                    letterSpacing: '0.05em',
                    boxShadow: isStreaming
                        ? '0 10px 25px rgba(239, 68, 68, 0.3)'
                        : '0 10px 25px rgba(56, 189, 248, 0.3)',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                }}
            >
                <Zap size={16} fill="#fff" />
                {isStreaming ? 'STOP STREAMING' : 'START OVERRIDE STREAM'}
            </button>

            {/* Connection Status Panel */}
            <div style={{
                marginTop: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '30px',
                border: '1px solid rgba(255, 255, 255, 0.03)'
            }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isStreaming ? '#10b981' : (status.includes('Connected') ? '#38bdf8' : '#f59e0b'),
                    boxShadow: isStreaming 
                        ? '0 0 10px #10b981' 
                        : (status.includes('Connected') ? '0 0 10px #38bdf8' : '0 0 10px #f59e0b')
                }} />
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '0.025em' }}>
                    STATUS: {status}
                </span>
            </div>
        </div>
    );
}
