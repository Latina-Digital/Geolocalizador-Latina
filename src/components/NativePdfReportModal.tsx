/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 5: Generador de Informes PDF Estructurados y Autoajustables en HTML/CSS/JS Puro
 * Vista previa interactiva 100% responsiva (móvil, tablet, PC) sin recortes de texto
 * + contenedor A4/Carta con reglas @media print (page-break-inside: avoid, thead repetible).
 */

import React, { useState } from 'react';
import { AgentRealTimeState, SuspiciousAlert } from '../types';
import { GeoAuditLogEntry } from '../services/geoAuditLogger';
import { GpsFraudAlertRecord } from '../services/geoIntegrityGuard';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import {
  FileText,
  Printer,
  Download,
  X,
  CheckCircle2,
  ShieldAlert,
  UserCheck,
  Calendar,
} from 'lucide-react';

export type NativeReportMode = 'ACTIVIDADES_EJECUTIVO' | 'HISTORIAL_BITACORA' | 'ALERTAS_UBICACION_GPS';

interface NativePdfReportModalProps {
  isOpen: boolean;
  initialMode?: NativeReportMode;
  selectedAgentId?: string;
  agents: AgentRealTimeState[];
  alerts: SuspiciousAlert[];
  auditLogs: GeoAuditLogEntry[];
  fraudAlerts: GpsFraudAlertRecord[];
  onClose: () => void;
}

export const NativePdfReportModal: React.FC<NativePdfReportModalProps> = ({
  isOpen,
  initialMode = 'ACTIVIDADES_EJECUTIVO',
  selectedAgentId,
  agents,
  alerts,
  auditLogs,
  fraudAlerts,
  onClose,
}) => {
  const { user, uiConfig, recordAuditAction } = useGeoLatinaSystem();
  const [reportMode, setReportMode] = useState<NativeReportMode>(initialMode);
  const [focusedAgentId, setFocusedAgentId] = useState<string>(
    selectedAgentId || agents[0]?.user.id || 'agt-1'
  );
  const [exportStatusMsg, setExportStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetAgent = agents.find((a) => a.user.id === focusedAgentId) || agents[0];
  const emissionDate = new Date().toLocaleString('es-EC');
  const folioCode = `REP-LAT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  // Calculate Executive KPIs
  const completedVisits = targetAgent
    ? targetAgent.visits.filter((v) => v.status === 'completada').length
    : 0;
  const totalVisits = targetAgent ? targetAgent.visits.length : 0;
  const compliancePct = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;
  const totalSales = targetAgent
    ? targetAgent.visits.reduce((acc, v) => acc + (v.orderAmount || 0), 0)
    : 0;
  const totalCollected = targetAgent
    ? targetAgent.visits.reduce((acc, v) => acc + (v.collectedAmount || 0), 0)
    : 0;

  const handlePrintNativeA4 = () => {
    recordAuditAction({
      eventType: 'EXPORTACION_REPORTE',
      alertState: 'NORMAL',
      detail: `Generación e impresión de Informe Oficial PDF (${reportMode}) — Folio ${folioCode}.`,
    });
    setExportStatusMsg(
      'Preparando documento A4 autoajustable... Si su navegador bloquea el diálogo en vista embebida, se descargará además el documento PDF/HTML listo para imprimir.'
    );
    try {
      window.print();
    } catch {
      // Fallback handled below
    }
    handleDownloadStandalonePrintablePdfHtml();
    setTimeout(() => setExportStatusMsg(null), 5000);
  };

  const handleDownloadStandalonePrintablePdfHtml = () => {
    const printNode = document.getElementById('geolatina-native-a4-printable');
    if (!printNode) return;

    const htmlDoc = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Informe Oficial GEOLATINA - ${folioCode}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px;
      font-size: clamp(11px, 1.4vw, 13px);
      line-height: 1.45;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
      margin-top: 10px;
      margin-bottom: 16px;
    }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
      text-align: left;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    th {
      background-color: #0A2540 !important;
      color: #ffffff !important;
      font-weight: 700;
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      margin: 14px 0;
    }
    .kpi-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      background: #f8fafc;
      page-break-inside: avoid;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body onload="window.print()">
  ${printNode.innerHTML}
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${folioCode}_${reportMode}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="native-pdf-modal-title"
    >
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[94dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Toolbar (No-Print) */}
        <div className="bg-[#0A2540] px-4 sm:px-6 py-3.5 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 id="native-pdf-modal-title" className="text-sm sm:text-base font-bold text-white">
                Generador Nativo de Informes PDF Estructurados y Autoajustables
              </h2>
              <p className="text-[11px] text-slate-300">
                Motor HTML/CSS/JS Puro · Diagramación A4/Carta con ajuste fluido 100% sin recortes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintNativeA4}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer min-h-[40px]"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Descargar PDF A4</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar vista previa de informe PDF"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Selector Controls (No-Print) */}
        <div className="bg-[#0F172A] px-4 sm:px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setReportMode('ACTIVIDADES_EJECUTIVO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                reportMode === 'ACTIVIDADES_EJECUTIVO'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              1. Reporte Diario de Actividades
            </button>
            <button
              type="button"
              onClick={() => setReportMode('HISTORIAL_BITACORA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                reportMode === 'HISTORIAL_BITACORA'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              2. Historial de Bitácora ({auditLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setReportMode('ALERTAS_UBICACION_GPS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                reportMode === 'ALERTAS_UBICACION_GPS'
                  ? 'bg-[#D32F2F] text-white font-bold'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              3. Reporte Alertas Anti-Fraude GPS ({fraudAlerts.length})
            </button>
          </div>

          {reportMode === 'ACTIVIDADES_EJECUTIVO' && (
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="pdf-exec-select" className="text-slate-400 font-medium">
                Ejecutivo:
              </label>
              <select
                id="pdf-exec-select"
                value={focusedAgentId}
                onChange={(e) => setFocusedAgentId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                {agents.map((ag) => (
                  <option key={ag.user.id} value={ag.user.id}>
                    {ag.user.name} ({ag.user.zone})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {exportStatusMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-700 px-6 py-2 text-xs text-emerald-200 flex items-center gap-2 shrink-0 no-print">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportStatusMsg}</span>
          </div>
        )}

        {/* Interactive 100% Fluid A4 Document Preview Surface */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-900/90">
          <div
            id="geolatina-native-a4-printable"
            className="bg-white text-slate-900 rounded-xl shadow-2xl mx-auto w-full max-w-4xl p-4 sm:p-8 space-y-6 break-words [overflow-wrap:anywhere]"
          >
            {/* Corporate Document Header */}
            <div className="border-b-2 border-[#0A2540] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#D32F2F]">
                  INDUSTRIAL LATINA S.A. — SISTEMA {uiConfig.appTitle}
                </div>
                <h1 className="text-lg sm:text-2xl font-black text-[#0A2540] mt-0.5">
                  {reportMode === 'ACTIVIDADES_EJECUTIVO' &&
                    `INFORME EJECUTIVO DE ACTIVIDADES Y CUMPLIMIENTO EN RUTA`}
                  {reportMode === 'HISTORIAL_BITACORA' &&
                    `AUDITORÍA DE BITÁCORA DIARIA E HISTORIAL DE OPERACIONES`}
                  {reportMode === 'ALERTAS_UBICACION_GPS' &&
                    `DICTAMEN TÉCNICO DE INTEGRIDAD SATELITAL Y ALERTAS ANTI-FRAUDE GPS`}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Plataforma Corporativa Interconectada con LatinaSoft (LatinaWebApi IIS / SQL Server)
                </p>
              </div>

              <div className="bg-slate-100 border border-slate-300 rounded-lg p-3 text-xs font-mono space-y-0.5 shrink-0">
                <div>
                  <strong>FOLIO:</strong> {folioCode}
                </div>
                <div>
                  <strong>EMISIÓN:</strong> {emissionDate}
                </div>
                <div>
                  <strong>GENERADO POR:</strong> {user?.nombreCompleto || 'Supervisor'} ({user?.rol || 'ADMIN'})
                </div>
                <div>
                  <strong>SUCURSAL:</strong> {user?.sucursal || 'Matriz Guayaquil'}
                </div>
              </div>
            </div>

            {/* MODE 1: ACTIVIDADES DE EJECUTIVO */}
            {reportMode === 'ACTIVIDADES_EJECUTIVO' && targetAgent && (
              <div className="space-y-5">
                {/* KPI Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                      Ejecutivo Evaluado
                    </div>
                    <div className="text-sm font-black text-[#0A2540] mt-1">
                      {targetAgent.user.name}
                    </div>
                    <div className="text-[11px] text-slate-600">{targetAgent.user.zone}</div>
                  </div>

                  <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                      Efectividad Visitas
                    </div>
                    <div className="text-lg font-black text-emerald-700 mt-1 tabular-nums">
                      {compliancePct}% ({completedVisits}/{totalVisits})
                    </div>
                    <div className="text-[11px] text-slate-600">Recorrido: {targetAgent.todayKm} km</div>
                  </div>

                  <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                      Ventas Facturadas
                    </div>
                    <div className="text-lg font-black text-[#0A2540] mt-1 font-mono tabular-nums">
                      ${totalSales.toLocaleString('es-EC', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-slate-600">Pedidos confirmados</div>
                  </div>

                  <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                      Cobranzas Recaudadas
                    </div>
                    <div className="text-lg font-black text-purple-800 mt-1 font-mono tabular-nums">
                      ${totalCollected.toLocaleString('es-EC', { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-slate-600">Recibos verificados</div>
                  </div>
                </div>

                {/* Auto-fitting Visits Table */}
                <div className="overflow-x-auto">
                  <h3 className="text-xs font-extrabold uppercase text-[#0A2540] mb-2">
                    Detalle de Visitas, Tiempos de Gestión y Tachuelas GPS
                  </h3>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0A2540] text-white">
                        <th className="border border-slate-300 p-2 text-left">#</th>
                        <th className="border border-slate-300 p-2 text-left">Cliente / Dirección</th>
                        <th className="border border-slate-300 p-2 text-left">Coordenadas GPS</th>
                        <th className="border border-slate-300 p-2 text-left">Horario / Duración</th>
                        <th className="border border-slate-300 p-2 text-left">Actividad & Documento</th>
                        <th className="border border-slate-300 p-2 text-right">Monto USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetAgent.visits.map((v, idx) => {
                        const amount = v.orderAmount || v.collectedAmount || 0;
                        return (
                          <tr
                            key={v.id}
                            className="odd:bg-white even:bg-slate-50 break-inside-avoid"
                          >
                            <td className="border border-slate-300 p-2 font-bold">{idx + 1}</td>
                            <td className="border border-slate-300 p-2">
                              <div className="font-bold text-slate-900">{v.name}</div>
                              <div className="text-[11px] text-slate-600">{v.address}</div>
                              {v.notes && (
                                <div className="text-[11px] text-slate-500 italic mt-0.5">
                                  Obs: {v.notes}
                                </div>
                              )}
                            </td>
                            <td className="border border-slate-300 p-2 font-mono text-[11px] tabular-nums">
                              {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                            </td>
                            <td className="border border-slate-300 p-2 text-[11px]">
                              <div>Prog: {v.scheduledTime}</div>
                              <div>En cliente: {v.durationMinutes || 25} min</div>
                              <div>Trayecto: {v.travelMinutesFromPrevious || 15} min</div>
                            </td>
                            <td className="border border-slate-300 p-2">
                              <div className="font-bold">
                                {v.activityType || v.status.toUpperCase()}
                              </div>
                              <div className="text-[11px] font-mono text-slate-600">
                                {v.invoiceOrReceiptNumber || 'Sin doc.'}
                              </div>
                            </td>
                            <td className="border border-slate-300 p-2 text-right font-mono font-bold tabular-nums">
                              ${amount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODE 2: HISTORIAL DE BITÁCORA */}
            {reportMode === 'HISTORIAL_BITACORA' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <h3 className="text-xs font-extrabold uppercase text-[#0A2540] mb-2">
                    Registro Cronológico Auditable ({auditLogs.length} eventos registrados)
                  </h3>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0A2540] text-white">
                        <th className="border border-slate-300 p-2 text-left">Fecha / Hora</th>
                        <th className="border border-slate-300 p-2 text-left">Usuario / Rol</th>
                        <th className="border border-slate-300 p-2 text-left">Evento / Estado</th>
                        <th className="border border-slate-300 p-2 text-left">Coordenadas / Dispositivo</th>
                        <th className="border border-slate-300 p-2 text-left">Detalle Auditable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="odd:bg-white even:bg-slate-50 break-inside-avoid"
                        >
                          <td className="border border-slate-300 p-2 font-mono text-[11px] tabular-nums">
                            {log.timestampLocal}
                          </td>
                          <td className="border border-slate-300 p-2">
                            <div className="font-bold">{log.nombreUsuario}</div>
                            <div className="text-[11px] text-slate-600">{log.rol}</div>
                          </td>
                          <td className="border border-slate-300 p-2">
                            <div className="font-bold">{log.eventType}</div>
                            <div
                              className={`text-[10px] font-bold ${
                                log.alertState === 'CRITICA'
                                  ? 'text-red-700'
                                  : log.alertState === 'ADVERTENCIA'
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {log.alertState}
                            </div>
                          </td>
                          <td className="border border-slate-300 p-2 font-mono text-[11px]">
                            <div>
                              {log.lat.toFixed(4)}, {log.lng.toFixed(4)}
                            </div>
                            <div className="text-[10px] text-slate-500">{log.deviceBrowser}</div>
                          </td>
                          <td className="border border-slate-300 p-2">{log.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODE 3: ALERTAS DE UBICACIÓN Y ANTI-FRAUDE GPS */}
            {reportMode === 'ALERTAS_UBICACION_GPS' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <h3 className="text-xs font-extrabold uppercase text-[#D32F2F] mb-2">
                    Infracciones Detectadas por GeoIntegrityGuard ({fraudAlerts.length} eventos críticos)
                  </h3>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#0A2540] text-white">
                        <th className="border border-slate-300 p-2 text-left">Hora / Hash</th>
                        <th className="border border-slate-300 p-2 text-left">Ejecutivo de Ventas</th>
                        <th className="border border-slate-300 p-2 text-left">Coordenadas Sospechosas</th>
                        <th className="border border-slate-300 p-2 text-left">Heurística Violada</th>
                        <th className="border border-slate-300 p-2 text-left">Diagnóstico Técnico Forense</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fraudAlerts.map((fa) => (
                        <tr
                          key={fa.id}
                          className="odd:bg-white even:bg-red-50/40 break-inside-avoid"
                        >
                          <td className="border border-slate-300 p-2 font-mono text-[11px]">
                            <div>{fa.timestampLocal}</div>
                            <div className="text-[10px] text-slate-500">{fa.immutableHash}</div>
                          </td>
                          <td className="border border-slate-300 p-2">
                            <div className="font-bold text-red-800">{fa.executiveName}</div>
                            <div className="text-[11px] text-slate-600">{fa.sucursal}</div>
                          </td>
                          <td className="border border-slate-300 p-2 font-mono text-[11px]">
                            <div>
                              Actual: {fa.lat.toFixed(4)}, {fa.lng.toFixed(4)}
                            </div>
                            <div>Precisión: {fa.reportedAccuracyMeters}m</div>
                          </td>
                          <td className="border border-slate-300 p-2 font-bold text-red-700">
                            {fa.anomalyCode}
                          </td>
                          <td className="border border-slate-300 p-2">{fa.technicalReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Official Signatures Footer */}
            <div className="pt-8 mt-6 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs text-slate-700 break-inside-avoid">
              <div className="pt-6 border-t border-slate-400 max-w-xs mx-auto w-full">
                <div className="font-bold text-slate-900">
                  {user?.nombreCompleto || 'Supervisión Comercial'}
                </div>
                <div>Emitido desde GEOLATINA · Rol: {user?.rol || 'SUPERVISOR'}</div>
              </div>
              <div className="pt-6 border-t border-slate-400 max-w-xs mx-auto w-full">
                <div className="font-bold text-slate-900">
                  Auditoría & Control Interno — Industrial Latina S.A.
                </div>
                <div>Validación Digital LatinaSoft SQL Server</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
