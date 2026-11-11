import React, { useState } from 'react';
import { SuspiciousAlert, AlertType } from '../types';
import { ShieldAlert, CheckCircle, Bell, X, AlertTriangle, PlusCircle } from 'lucide-react';

interface AlertsDrawerProps {
  isOpen: boolean;
  alerts: SuspiciousAlert[];
  onClose: () => void;
  onResolveAlert: (id: string) => void;
  onTriggerSimulatedAlert: (type: AlertType) => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  isOpen,
  alerts,
  onClose,
  onResolveAlert,
  onTriggerSimulatedAlert,
}) => {
  const [filter, setFilter] = useState<'todos' | 'pendientes' | 'resueltas'>('todos');

  if (!isOpen) return null;

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'pendientes') return !a.resolved;
    if (filter === 'resueltas') return a.resolved;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-950/60 border border-red-800 text-red-400 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Alertas & Actividades Sospechosas</h3>
              <p className="text-xs text-slate-400">GEO LATINA • Telemetría Satelital</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 bg-slate-950/40">
          {(['todos', 'pendientes', 'resueltas'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                filter === f
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-800/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No hay alertas en esta categoría.
            </div>
          ) : (
            filteredAlerts.map((alt) => (
              <div
                key={alt.id}
                className={`p-3.5 rounded-xl border text-xs transition-all ${
                  alt.resolved
                    ? 'bg-slate-950/50 border-slate-800 opacity-60'
                    : 'bg-red-950/20 border-red-800/80 shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${alt.resolved ? 'bg-emerald-500' : 'bg-red-500 animate-ping'}`} />
                    <strong className="text-red-400 uppercase font-bold text-[11px]">
                      {alt.type.replace(/_/g, ' ')}
                    </strong>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-red-900/60 text-red-300 border border-red-700">
                    {alt.severity}
                  </span>
                </div>

                <p className="text-slate-300 text-xs mt-2 leading-relaxed">
                  {alt.description}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Agente: <strong className="text-white">{alt.agentName}</strong></span>
                  <span>{new Date(alt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {!alt.resolved && (
                  <div className="mt-2.5 pt-2 flex justify-end">
                    <button
                      onClick={() => onResolveAlert(alt.id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Marcar como Resuelta</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Production Telemetry Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>🔒 Telemetría GPS Satelital en Producción</span>
          <span className="text-emerald-400 font-semibold">● Enlace LatinaSoft Activo</span>
        </div>
      </div>
    </div>
  );
};
