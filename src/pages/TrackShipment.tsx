import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:     { label: 'Pending',     color: '#94a3b8', bg: '#1e293b', icon: '🕐' },
  confirmed:   { label: 'Confirmed',   color: '#60a5fa', bg: '#1e3a5f', icon: '✅' },
  in_transit:  { label: 'In Transit',  color: '#f59e0b', bg: '#451a03', icon: '🚛' },
  delivered:   { label: 'Delivered',   color: '#34d399', bg: '#064e3b', icon: '📦' },
  cancelled:   { label: 'Cancelled',   color: '#f87171', bg: '#450a0a', icon: '❌' },
  on_hold:     { label: 'On Hold',     color: '#fb923c', bg: '#431407', icon: '⏸️' },
};

const EVENT_ICONS: Record<string, string> = {
  created: '📋', confirmed: '✅', assigned: '👤', pickup_scheduled: '📅',
  picked_up: '📤', in_transit: '🚛', out_for_delivery: '🏃', delivered: '✅',
  failed_delivery: '❌', on_hold: '⏸️', returned: '↩️', cancelled: '🚫',
  document_uploaded: '📄', status_update: '🔄',
};

export default function TrackShipment() {
  const { trackingNumber: urlParam } = useParams<{ trackingNumber?: string }>();
  const [query, setQuery]         = useState(urlParam || '');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<any>(null);
  const [error, setError]         = useState('');

  useEffect(() => {
    if (urlParam) handleTrack(urlParam);
  }, [urlParam]);

  const handleTrack = async (override?: string) => {
    const q = (override || query).trim();
    if (!q) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/shipments/track/${q}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Shipment not found' }));
        throw new Error(err.error || 'Not found');
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message || 'Shipment not found. Check the tracking number and try again.');
    } finally { setLoading(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleTrack(); };

  const shipment = result?.shipment;
  const tracking: any[] = result?.tracking || [];
  const statusCfg = shipment ? (STATUS_CONFIG[shipment.status] || STATUS_CONFIG.pending) : null;

  // Progress steps
  const STEPS = ['pending','confirmed','in_transit','delivered'];
  const stepIndex = shipment ? STEPS.indexOf(shipment.status) : -1;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #050709 0%, #0a0d14 50%, #0d1117 100%)', fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* Animated background dots */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)`,
            width: `${200 + i * 80}px`, height: `${200 + i * 80}px`,
            top: `${[10, 60, 20, 70, 5, 45][i]}%`,
            left: `${[5, 70, 40, 15, 85, 55][i]}%`,
            transform: 'translate(-50%,-50%)',
          }}/>
        ))}
      </div>

      <div style={{ position: 'relative', maxWidth: '720px', margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '50px', padding: '6px 16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '14px' }}>🚛</span>
            <span style={{ fontSize: '12px', color: '#60a5fa', fontWeight: '600', letterSpacing: '0.05em' }}>RAWABI LOGISTICS</span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'white', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Track Your Shipment
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Enter your tracking number or shipment reference to get real-time updates
          </p>
        </div>

        {/* Search box */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', marginBottom: '24px', backdropFilter: 'blur(10px)' }}>
          <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '10px' }}>
            TRACKING NUMBER / SHIPMENT NUMBER
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="e.g. RWB-2026-001 or TRK-XXXXXXXXX"
              style={{
                flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', padding: '12px 16px', fontSize: '14px', color: 'white',
                outline: 'none', letterSpacing: '0.02em',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <button
              onClick={() => handleTrack()}
              disabled={loading || !query.trim()}
              style={{
                background: loading || !query.trim() ? 'rgba(59,130,246,0.3)' : '#2563eb',
                color: 'white', border: 'none', borderRadius: '10px', padding: '12px 24px',
                fontSize: '13px', fontWeight: '700', cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                minWidth: '100px', transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (!loading && query.trim()) (e.target as HTMLElement).style.background = '#1d4ed8'; }}
              onMouseLeave={e => { if (!loading && query.trim()) (e.target as HTMLElement).style.background = '#2563eb'; }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
                  Searching
                </span>
              ) : 'Track →'}
            </button>
          </div>
          {error && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#fca5a5', fontSize: '13px' }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Result */}
        {shipment && statusCfg && (
          <>
            {/* Status card */}
            <div style={{ background: `rgba(${statusCfg.bg},0.5)`, border: `1px solid ${statusCfg.color}30`, borderRadius: '16px', padding: '24px', marginBottom: '16px', backdropFilter: 'blur(10px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '22px' }}>{statusCfg.icon}</span>
                    <span style={{ background: `${statusCfg.color}20`, color: statusCfg.color, border: `1px solid ${statusCfg.color}40`, borderRadius: '20px', padding: '3px 12px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em' }}>
                      {statusCfg.label.toUpperCase()}
                    </span>
                  </div>
                  <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '800', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                    {shipment.shipmentNumber}
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0, fontFamily: 'monospace' }}>{shipment.trackingNumber}</p>
                </div>
                {shipment.estimatedDelivery && (
                  <div style={{ textAlign: 'right', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px 16px' }}>
                    <p style={{ color: '#64748b', fontSize: '10px', margin: '0 0 4px', letterSpacing: '0.05em' }}>EST. DELIVERY</p>
                    <p style={{ color: 'white', fontSize: '16px', fontWeight: '700', margin: 0 }}>
                      {new Date(shipment.estimatedDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              {/* Route */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', padding: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <p style={{ color: '#64748b', fontSize: '10px', margin: '0 0 3px', letterSpacing: '0.05em' }}>FROM</p>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0 }}>{shipment.origin}</p>
                </div>
                <div style={{ color: '#60a5fa', fontSize: '20px', flexShrink: 0 }}>→</div>
                <div style={{ flex: 1, minWidth: '120px', textAlign: 'right' }}>
                  <p style={{ color: '#64748b', fontSize: '10px', margin: '0 0 3px', letterSpacing: '0.05em' }}>TO</p>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0 }}>{shipment.destination}</p>
                </div>
              </div>

              {/* Cargo info */}
              {shipment.cargoType && (
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 10px', color: '#94a3b8', fontSize: '11px' }}>
                    📦 {shipment.cargoType}
                  </span>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {!['cancelled','on_hold'].includes(shipment.status) && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                  {/* Progress line */}
                  <div style={{ position: 'absolute', top: '16px', left: '8%', right: '8%', height: '2px', background: 'rgba(255,255,255,0.08)' }}/>
                  <div style={{ position: 'absolute', top: '16px', left: '8%', width: `${Math.max(0, (stepIndex / (STEPS.length - 1)) * 84)}%`, height: '2px', background: '#2563eb', transition: 'width 0.5s ease' }}/>
                  {STEPS.map((step, i) => {
                    const done = i <= stepIndex;
                    const icons: Record<string, string> = { pending: '📋', confirmed: '✅', in_transit: '🚛', delivered: '🏁' };
                    const labels: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', in_transit: 'In Transit', delivered: 'Delivered' };
                    return (
                      <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: done ? '#2563eb' : 'rgba(255,255,255,0.05)', border: `2px solid ${done ? '#2563eb' : 'rgba(255,255,255,0.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', transition: 'all 0.3s' }}>
                          {done ? <span>{icons[step]}</span> : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }}/>}
                        </div>
                        <span style={{ color: done ? '#cbd5e1' : '#475569', fontSize: '10px', fontWeight: done ? '600' : '400', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {labels[step]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Timeline */}
            {tracking.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                <h3 style={{ color: 'white', fontSize: '13px', fontWeight: '700', margin: '0 0 18px', letterSpacing: '0.05em' }}>
                  SHIPMENT TIMELINE
                </h3>
                <div style={{ position: 'relative' }}>
                  {/* Vertical line */}
                  <div style={{ position: 'absolute', left: '15px', top: '8px', bottom: '8px', width: '1px', background: 'rgba(255,255,255,0.06)' }}/>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {tracking.map((event: any, i: number) => (
                      <div key={event.id || i} style={{ display: 'flex', gap: '16px', paddingBottom: i < tracking.length - 1 ? '18px' : '0' }}>
                        <div style={{ flexShrink: 0, width: '30px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: i === 0 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${i === 0 ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                            {EVENT_ICONS[event.event_type] || '•'}
                          </div>
                        </div>
                        <div style={{ flex: 1, paddingTop: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                            <div>
                              <p style={{ color: i === 0 ? 'white' : '#cbd5e1', fontSize: '13px', fontWeight: i === 0 ? '600' : '400', margin: '0 0 3px', textTransform: 'capitalize' }}>
                                {(event.event_description || event.event_type || '').replace(/_/g, ' ')}
                              </p>
                              {event.location && (
                                <p style={{ color: '#60a5fa', fontSize: '11px', margin: '0 0 2px' }}>📍 {event.location}</p>
                              )}
                              {event.notes && (
                                <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{event.notes}</p>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ color: '#475569', fontSize: '10px', margin: 0, whiteSpace: 'nowrap' }}>
                                {new Date(event.event_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              <p style={{ color: '#334155', fontSize: '10px', margin: '2px 0 0', whiteSpace: 'nowrap' }}>
                                {new Date(event.event_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tracking.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#475569', fontSize: '13px' }}>
                No tracking events yet. Check back soon.
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '48px', color: '#1e293b', fontSize: '12px' }}>
          <p style={{ margin: '0 0 4px' }}>© {new Date().getFullYear()} Rawabi Logistics · All rights reserved</p>
          <p style={{ margin: 0 }}>
            <a href="/login" style={{ color: '#334155', textDecoration: 'none' }}>Staff Portal →</a>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #334155; }
      `}</style>
    </div>
  );
}
