import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; badgeBg: string; badgeText: string; icon: string }> = {
  pending:    { label: 'Pending',    dotColor: 'bg-slate-400',  badgeBg: 'bg-slate-500/20',  badgeText: 'text-slate-300',  icon: '🕐' },
  confirmed:  { label: 'Confirmed',  dotColor: 'bg-blue-400',   badgeBg: 'bg-blue-500/20',   badgeText: 'text-blue-300',   icon: '✅' },
  in_transit: { label: 'In Transit', dotColor: 'bg-amber-400',  badgeBg: 'bg-amber-500/20',  badgeText: 'text-amber-300',  icon: '🚛' },
  delivered:  { label: 'Delivered',  dotColor: 'bg-emerald-400',badgeBg: 'bg-emerald-500/20',badgeText: 'text-emerald-300',icon: '📦' },
  cancelled:  { label: 'Cancelled',  dotColor: 'bg-red-400',    badgeBg: 'bg-red-500/20',    badgeText: 'text-red-300',    icon: '❌' },
  on_hold:    { label: 'On Hold',    dotColor: 'bg-orange-400', badgeBg: 'bg-orange-500/20', badgeText: 'text-orange-300', icon: '⏸️' },
};

const EVENT_ICONS: Record<string, string> = {
  created: '📋', confirmed: '✅', assigned: '👤', pickup_scheduled: '📅',
  picked_up: '📤', in_transit: '🚛', out_for_delivery: '🏃', delivered: '✅',
  failed_delivery: '❌', on_hold: '⏸️', returned: '↩️', cancelled: '🚫',
  document_uploaded: '📄', status_update: '🔄',
};

const STEPS = ['pending', 'confirmed', 'in_transit', 'delivered'] as const;
const STEP_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', in_transit: 'In Transit', delivered: 'Delivered',
};
const STEP_ICONS: Record<string, string> = {
  pending: '📋', confirmed: '✅', in_transit: '🚛', delivered: '🏁',
};

export default function TrackShipment() {
  const { trackingNumber: urlParam } = useParams<{ trackingNumber?: string }>();
  const [query, setQuery]     = useState(urlParam || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [error, setError]     = useState('');

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

  const shipment   = result?.shipment;
  const tracking: any[] = result?.tracking || [];
  const statusCfg  = shipment ? (STATUS_CONFIG[shipment.status] || STATUS_CONFIG.pending) : null;
  const stepIndex  = shipment ? STEPS.indexOf(shipment.status as any) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050709] via-[#0a0d14] to-[#0d1117] font-sans">

      {/* Background blobs — decorative, hidden on very small screens for perf */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none hidden sm:block" aria-hidden>
        {[
          'top-[10%] left-[5%]',
          'top-[60%] left-[70%]',
          'top-[20%] left-[40%]',
          'top-[70%] left-[15%]',
          'top-[5%] left-[85%]',
          'top-[45%] left-[55%]',
        ].map((pos, i) => (
          <div key={i} className={`absolute rounded-full opacity-60 ${pos}`}
            style={{ width: `${200 + i * 80}px`, height: `${200 + i * 80}px`, background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', transform: 'translate(-50%,-50%)' }} />
        ))}
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-10 sm:py-16 pb-20">

        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="text-sm">🚛</span>
            <span className="text-xs text-blue-400 font-semibold tracking-widest uppercase">Rawabi Logistics</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">
            Track Your Shipment
          </h1>
          <p className="text-sm text-slate-500">
            Enter your tracking number or shipment reference for real-time updates
          </p>
        </div>

        {/* Search box */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 sm:p-6 mb-6 backdrop-blur-sm">
          <label className="block text-[11px] text-slate-500 font-semibold tracking-widest uppercase mb-2.5">
            Tracking Number / Shipment Number
          </label>
          <div className="flex gap-2 sm:gap-3">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="e.g. RWB-2026-001 or TRK-XXXXXXXXX"
              className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            <button
              onClick={() => handleTrack()}
              disabled={loading || !query.trim()}
              className="px-5 py-3 min-h-[48px] bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/30 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors whitespace-nowrap flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="hidden sm:inline">Searching</span>
                </>
              ) : (
                <>Track <span className="hidden sm:inline">→</span></>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ── Results ── */}
        {shipment && statusCfg && (
          <div className="space-y-4">

            {/* Status card */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="text-xl">{statusCfg.icon}</span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${statusCfg.badgeBg} ${statusCfg.badgeText} border-current/20`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-1">
                    {shipment.shipmentNumber}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono">{shipment.trackingNumber}</p>
                </div>

                {shipment.estimatedDelivery && (
                  <div className="bg-black/30 rounded-xl px-4 py-3 sm:text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Est. Delivery</p>
                    <p className="text-base font-bold text-white">
                      {new Date(shipment.estimatedDelivery).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              {/* Route */}
              <div className="mt-4 bg-black/20 rounded-xl p-3 sm:p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">From</p>
                  <p className="text-sm font-semibold text-white truncate">{shipment.origin}</p>
                </div>
                <div className="text-blue-400 text-lg flex-shrink-0">→</div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">To</p>
                  <p className="text-sm font-semibold text-white truncate">{shipment.destination}</p>
                </div>
              </div>

              {/* Cargo type */}
              {shipment.cargoType && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-[11px] text-slate-400">
                    📦 {shipment.cargoType}
                  </span>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {!['cancelled', 'on_hold'].includes(shipment.status) && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
                <div className="relative flex justify-between">
                  {/* Track line background */}
                  <div className="absolute top-4 left-[8%] right-[8%] h-0.5 bg-white/[0.08]" />
                  {/* Track line filled */}
                  <div
                    className="absolute top-4 left-[8%] h-0.5 bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.max(0, (stepIndex / (STEPS.length - 1)) * 84)}%` }}
                  />
                  {STEPS.map((step, i) => {
                    const done = i <= stepIndex;
                    return (
                      <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                          done
                            ? 'bg-blue-600 border-blue-500'
                            : 'bg-white/5 border-white/10'
                        }`}>
                          {done
                            ? <span className="text-xs">{STEP_ICONS[step]}</span>
                            : <div className="w-2 h-2 rounded-full bg-white/20" />
                          }
                        </div>
                        <span className={`text-[10px] font-medium text-center leading-tight ${done ? 'text-slate-300' : 'text-slate-600'}`}>
                          {STEP_LABELS[step]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Timeline */}
            {tracking.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 sm:p-6">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-5">
                  Shipment Timeline
                </h3>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/[0.06]" />

                  <div className="flex flex-col">
                    {tracking.map((event: any, i: number) => (
                      <div key={event.id || i} className={`flex gap-4 ${i < tracking.length - 1 ? 'pb-5' : ''}`}>
                        {/* Icon */}
                        <div className="flex-shrink-0 w-8 flex justify-center relative z-10">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border ${
                            i === 0
                              ? 'bg-blue-500/20 border-blue-500/40'
                              : 'bg-white/5 border-white/[0.08]'
                          }`}>
                            {EVENT_ICONS[event.event_type] || '•'}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                            <div className="min-w-0">
                              <p className={`text-sm capitalize leading-snug ${i === 0 ? 'text-white font-semibold' : 'text-slate-300 font-normal'}`}>
                                {(event.event_description || event.event_type || '').replace(/_/g, ' ')}
                              </p>
                              {event.location && (
                                <p className="text-[11px] text-blue-400 mt-0.5">📍 {event.location}</p>
                              )}
                              {event.notes && (
                                <p className="text-[11px] text-slate-500 mt-0.5">{event.notes}</p>
                              )}
                            </div>
                            <div className="flex-shrink-0 sm:text-right">
                              <p className="text-[10px] text-slate-500 whitespace-nowrap">
                                {new Date(event.event_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                              <p className="text-[10px] text-slate-600 whitespace-nowrap mt-0.5">
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
              <div className="text-center py-8 text-slate-500 text-sm">
                No tracking events yet. Check back soon.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-slate-700 text-xs space-y-1">
          <p>© {new Date().getFullYear()} Rawabi Logistics · All rights reserved</p>
          <p>
            <a href="/login" className="text-slate-600 hover:text-slate-400 transition-colors">
              Staff Portal →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
