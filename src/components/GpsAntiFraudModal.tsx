/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 4: Detector Anti-Fraude GPS (Mock Location) y Alertas Jerárquicas (GeoIntegrityGuard)
 * Exclusivo para cargos superiores a Ejecutivo de Ventas (SUPERVISOR, JEFE_VENTAS, GERENCIA, ADMINISTRADOR).
 * Incluye el modal emergente de alta prioridad en rojo corporativo y el panel de auditoría de las 5 heurísticas.
 */

import React from 'react';
import {
  GpsFraudAlertRecord,
  canUserAccessGpsFraudAlerts,
} from '../services/geoIntegrityGuard';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import {
  ShieldAlert,
  MapPin,
  X,
  CheckCircle2,
  Zap,
  Crosshair,
  Clock,
  Cpu,
  Globe,
  FileText,
} from 'lucide-react';

interface GpsAntiFraudModalProps {
  onFocusExecutiveOnMap: (executiveId: string, lat: number, lng: number) => void;
  onOpenFraudPdfReport: () => void;
}

export const GpsAntiFraudModal: React.FC<GpsAntiFraudModalProps> = ({
  onFocusExecutiveOnMap,
  onOpenFraudPdfReport,
}) => {
  const {
    user,
    gpsFraudAlerts,
    urgentFraudPopup,
    dismissUrgentFraudPopup,
    acknowledgeGpsFraudAlert,
    isGpsFraudDrawerOpen,
    closeGpsFraudDrawer,
    triggerSimulatedGpsFraudHeuristic,
  } = useGeoLatinaSystem();

  // REGLA ESTRICTA DE JERARQUÍA: El EJECUTIVO_VENTAS (Nivel 1) NO puede ver, borrar ni desactivar este sistema.
  if (!user || !canUserAccessGpsFraudAlerts(user.rol)) {
    return null;
  }

  return (
    <>
      {/* 1. ALERTA VISUAL EMERGENTE DESTACADA EN ROJO CORPORATIVO (MODAL DE ALTA PRIORIDAD) */}
      {urgentFraudPopup && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-2 sm:p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="urgent-fraud-modal-title"
        >
          <div className="bg-[#1E293B] border-2 border-[#D32F2F] rounded-2xl w-[96vw] max-w-[96vw] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#D32F2F] px-5 py-4 flex items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/15 border border-white/30">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-red-100">
                    SISTEMA ANTI-FRAUDE SATELITAL · GEOINTEGRITYGUARD
                  </div>
                  <h2 id="urgent-fraud-modal-title" className="text-base sm:text-lg font-black">
                    🚨 ALERTA CRÍTICA: ALTERACIÓN / FALSIFICACIÓN DE UBICACIÓN GPS DETECTADA
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissUrgentFraudPopup}
                aria-label="Cerrar alerta emergente"
                className="p-1.5 rounded-lg hover:bg-black/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
              <div className="bg-red-950/60 border border-[#D32F2F] rounded-xl p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-red-300 font-bold uppercase">
                    Ejecutivo Infractor:{' '}
                    <strong className="text-red-400 text-base underline">
                      {urgentFraudPopup.executiveName}
                    </strong>
                  </span>
                  <span className="font-mono text-xs text-red-200">
                    Hora: {urgentFraudPopup.timestampLocal}
                  </span>
                </div>

                <div className="text-red-200 font-mono text-xs">
                  Coordenadas Sospechosas Reportadas:{' '}
                  <strong className="text-red-400">
                    {urgentFraudPopup.lat.toFixed(5)}, {urgentFraudPopup.lng.toFixed(5)}
                  </strong>{' '}
                  (Precisión: {urgentFraudPopup.reportedAccuracyMeters}m)
                </div>

                <div className="pt-2 border-t border-red-800/70">
                  <div className="font-extrabold text-red-400">
                    {urgentFraudPopup.heuristicTitle} ({urgentFraudPopup.anomalyCode})
                  </div>
                  <p className="text-red-100 mt-1 leading-relaxed">
                    {urgentFraudPopup.technicalReason}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-[11px] font-mono text-slate-400">
                  Registro inborrable grabado en bitácora: {urgentFraudPopup.immutableHash}
                </span>

                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      acknowledgeGpsFraudAlert(urgentFraudPopup.id);
                      dismissUrgentFraudPopup();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Confirmar Recepción
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onFocusExecutiveOnMap(
                        urgentFraudPopup.executiveId,
                        urgentFraudPopup.lat,
                        urgentFraudPopup.lng
                      );
                      dismissUrgentFraudPopup();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>📍 Ver en el Mapa Ahora</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PANEL COMPLETO DE AUDITORÍA ANTI-FRAUDE GPS ("🚨 Alertas de Ubicación") */}
      {isGpsFraudDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gps-fraud-drawer-title"
        >
          <div className="geo-modal-fullviewport bg-[#1E293B] border border-red-800/80 rounded-2xl w-[96vw] max-w-[96vw] h-[92dvh] max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0A2540] via-red-950 to-[#0A2540] px-5 py-4 border-b border-red-800/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D32F2F]/20 border border-[#D32F2F] flex items-center justify-center text-red-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="gps-fraud-drawer-title" className="text-base sm:text-lg font-bold text-white">
                    🚨 Alertas de Ubicación & Detector Anti-Fraude GPS (`GeoIntegrityGuard`)
                  </h2>
                  <p className="text-xs text-red-200">
                    Exclusivo para Supervisores, Jefatura de Ventas y Administración · Inborrable por Ejecutivos de Ventas
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    closeGpsFraudDrawer();
                    onOpenFraudPdfReport();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Dictamen Forense PDF</span>
                </button>
                <button
                  type="button"
                  onClick={closeGpsFraudDrawer}
                  aria-label="Cerrar panel de alertas de ubicación"
                  className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Simulator Bar for the 5 Technical Heuristics */}
            <div className="bg-[#0F172A] px-5 py-3.5 border-b border-slate-800 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400">
                  Banco de Pruebas de las 5 Heurísticas Técnicas (`navigator.geolocation` Audit):
                </span>
                <span className="text-[11px] text-slate-400">
                  Dispara una anomalía en vivo sobre Carlos Vera (`EJECUTIVO_VENTAS`)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => triggerSimulatedGpsFraudHeuristic(1)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-slate-700 hover:border-red-600 text-left text-xs transition-colors cursor-pointer"
                >
                  <div className="font-bold text-red-400 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span>1. Teletransporte</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Salto Haversine &gt; 130 km/h
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => triggerSimulatedGpsFraudHeuristic(2)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-slate-700 hover:border-red-600 text-left text-xs transition-colors cursor-pointer"
                >
                  <div className="font-bold text-red-400 flex items-center gap-1">
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>2. Precisión Fija</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    accuracy=1m clavada / alt=null
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => triggerSimulatedGpsFraudHeuristic(3)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-slate-700 hover:border-red-600 text-left text-xs transition-colors cursor-pointer"
                >
                  <div className="font-bold text-red-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>3. Timestamp Alterado</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Desfase NMEA vs Date.now()
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => triggerSimulatedGpsFraudHeuristic(4)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-slate-700 hover:border-red-600 text-left text-xs transition-colors cursor-pointer"
                >
                  <div className="font-bold text-red-400 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>4. Sensores / Emulador</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    GPS rápido + Acelerómetro 0
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => triggerSimulatedGpsFraudHeuristic(5)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/60 border border-slate-700 hover:border-red-600 text-left text-xs transition-colors cursor-pointer"
                >
                  <div className="font-bold text-red-400 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    <span>5. Zona Horaria / Red</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Discrepancia TZ vs Coordenadas
                  </div>
                </button>
              </div>
            </div>

            {/* List of Indelible Anti-Fraud Infractions */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {gpsFraudAlerts.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition-all ${
                    item.acknowledgedBySupervisor
                      ? 'bg-slate-900/80 border-slate-700'
                      : 'bg-red-950/35 border-[#D32F2F]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black uppercase text-red-400">
                          🚨 {item.anomalyCode}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-bold text-white">
                          Ejecutivo: <span className="text-red-300 underline">{item.executiveName}</span>
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-mono text-slate-300">{item.timestampLocal}</span>
                      </div>
                      <div className="text-xs font-bold text-amber-300">
                        {item.heuristicTitle}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-400">
                        {item.immutableHash}
                      </span>
                      {item.acknowledgedBySupervisor ? (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Auditada por {item.acknowledgedBy}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => acknowledgeGpsFraudAlert(item.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                        >
                          Marcar Auditada
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-red-100 mt-2 leading-relaxed">
                    {item.technicalReason}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-mono text-slate-300">
                      Coordenadas Sospechosas:{' '}
                      <strong className="text-red-300">
                        {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                      </strong>{' '}
                      · Precisión reportada: <strong>{item.reportedAccuracyMeters}m</strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onFocusExecutiveOnMap(item.executiveId, item.lat, item.lng);
                        closeGpsFraudDrawer();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#D32F2F] hover:bg-red-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Ver Ubicación en el Mapa</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
