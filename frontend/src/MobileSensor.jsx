import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { resolveBackendUrl } from './utils/helpers';
import { Smartphone, Activity } from 'lucide-react';

const BACKEND_URL = resolveBackendUrl();

export default function MobileSensor() {
    const [status, setStatus] = useState('Disconnected');
    const [vibration, setVibration] = useState(0);
    const [machineId, setMachineId] = useState('PUMP_01');
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const s = io(BACKEND_URL);
        setSocket(s);
        s.on('connect', () => setStatus('Connected - Ready'));
        s.on('disconnect', () => setStatus('Disconnected'));

        let lastEmit = 0;
        const handleMotion = (event) => {
            if (!event.accelerationIncludingGravity) return;
            const { x, y, z } = event.accelerationIncludingGravity;
            
            // Calculate a scalar magnitude for vibration
            // Subtracting approx gravity (9.8) to get motion only
            const mag = Math.sqrt(x*x + y*y + z*z);
            const motion = Math.abs(mag - 9.8);
            
            // Amplify slightly for effect (0 to 10 scale)
            const scaled = Math.min(Math.max(motion * 1.5, 0), 15).toFixed(2);
            setVibration(scaled);

            const now = Date.now();
            if (now - lastEmit > 200) { // Emit every 200ms
                s.emit('mobile:sensor_data', {
                    machineId,
                    vibration: parseFloat(scaled)
                });
                lastEmit = now;
            }
        };

        const requestAccess = async () => {
            if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('devicemotion', handleMotion);
                        setStatus('Streaming Data...');
                    } else {
                        setStatus('Permission Denied');
                    }
                } catch (e) {
                    setStatus('Permission Error');
                }
            } else {
                // Non-iOS 13+ devices
                window.addEventListener('devicemotion', handleMotion);
                setStatus('Streaming Data...');
            }
        };

        // We need a user gesture to request motion permissions on modern devices
        const btn = document.getElementById('start-btn');
        if (btn) btn.addEventListener('click', requestAccess);

        return () => {
            s.disconnect();
            window.removeEventListener('devicemotion', handleMotion);
            if (btn) btn.removeEventListener('click', requestAccess);
        };
    }, [machineId]);

    return (
        <div style={{ padding: '2rem', background: '#0f172a', minHeight: '100vh', color: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
            <Smartphone size={48} color="#38bdf8" style={{ marginBottom: '1rem' }} />
            <h2 style={{ margin: '0 0 0.5rem' }}>Accelerometer Bridge</h2>
            <p style={{ color: '#94a3b8', textAlign: 'center', marginBottom: '2rem' }}>Shake your phone to override a machine's vibration sensor in real-time.</p>

            <div style={{ width: '100%', maxWidth: '300px', marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>TARGET MACHINE ID</label>
                <input 
                    value={machineId}
                    onChange={e => setMachineId(e.target.value.toUpperCase())}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #38bdf8', background: 'rgba(56,189,248,0.1)', color: '#fff', fontSize: '16px', textAlign: 'center', fontWeight: 'bold' }}
                />
            </div>

            <button id="start-btn" style={{ padding: '16px 32px', borderRadius: '30px', background: 'linear-gradient(135deg, #38bdf8, #2563eb)', color: '#fff', border: 'none', fontSize: '18px', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(56,189,248,0.4)', marginBottom: '2rem' }}>
                START STREAMING
            </button>

            <div style={{ padding: '1.5rem', borderRadius: '16px', background: 'rgba(0,0,0,0.3)', width: '100%', maxWidth: '300px', textAlign: 'center' }}>
                <Activity size={24} color={vibration > 5 ? '#ef4444' : '#10b981'} style={{ marginBottom: '8px' }} />
                <h1 style={{ fontSize: '48px', margin: 0, color: vibration > 5 ? '#ef4444' : '#10b981' }}>{vibration}</h1>
                <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '12px', textTransform: 'uppercase' }}>Current Vibration</p>
            </div>

            <p style={{ marginTop: '2rem', fontSize: '14px', color: status.includes('Streaming') ? '#10b981' : '#f59e0b', fontWeight: 'bold' }}>
                Status: {status}
            </p>
        </div>
    );
}
