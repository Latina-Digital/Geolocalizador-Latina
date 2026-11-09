/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 3: "📋 Historial y Descargas Diarias" (Bitácora Diaria Automática GeoAuditLogger)
 * Filtros avanzados (Fecha, Ejecutivo, Actividad, Estado de Alerta), buscador en tiempo real,
 * y descargas inmediatas en 3 formatos: CSV (UTF-8 BOM), JSON estructurado y PDF Ejecutivo.
 */

import React, { useState, useMemo } from 'react';
import {
  GeoAuditLogEntry,
  AuditFilterCriteria,
  filterAuditLogs,
  generateAuditLogsCsvContent,
} from '../services/geoAuditLogger';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import {
  ClipboardList,
  Search,
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  X,
  PlusCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNativePdfReport: () => void;
  executiveNames: string[];
}

export const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({
  isOpen,
  onClose,
  onOpenNativePdfReport,
  executiveNames,
}) => {
  const { auditLogs, recordAuditAction } = useGeoLatinaSystem();

  const [criteria, setCriteria] = useState<AuditFilterCriteria>({
    datePreset: 'TODOS',
    customStartDate: '',
    customEndDate: '',
    executiveFilter: 'TODOS',
    eventTypeFilter: 'TODOS',
    alertStateFilter: 'TODOS',
    searchQuery: '',
  });

  const [downloadBanner, setDownloadBanner] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return filterAuditLogs(auditLogs, criteria);
  }, [auditLogs, criteria]);

  if (!isOpen) return null;

  const handleDownloadCsv = () => {
    const csvContent = generateAuditLogsCsvContent(filteredLogs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bitacora_geolatina_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    recordAuditAction({
      eventType: 'EXPORTACION_REPORTE',
      alertState: 'NORMAL',
      detail: `Descarga de Bitácora Diaria en formato CSV/Excel UTF-8 BOM (${filteredLogs.length} registros).`,
    });
    setDownloadBanner(
      `Archivo CSV compatible con Excel (${filteredLogs.length} registros con UTF-8 BOM) descargado correctamente.`
    );
    setTimeout(() => setDownloadBanner(null), 4000);
  };

  const handleDownloadJson = () => {
    const payload = {
      empresa: 'Industrial Latina S.A.',
      sistema: 'GEOLATINA - LatinaSoft',
      fechaExportacion: new Date().toISOString(),
      totalRegistros: filteredLogs.length,
      registros: filteredLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bitacora_geolatina_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    recordAuditAction({
      eventType: 'EXPORTACION_REPORTE',
      alertState: 'NORMAL',
      detail: `Descarga de respaldo estructurado JSON de Bitácora (${filteredLogs.length} registros).`,
    });
    setDownloadBanner(
      `Respaldo estructurado .JSON (${filteredLogs.length} registros) descargado correctamente.`
    );
    setTimeout(() => setDownloadBanner(null), 4000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-history-modal-title"
    >
      <div className="bg-[#1E293B] border border-slate-700 rounded-2xl max-w-6xl w-full max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A2540] px-4 sm:px-6 py-4 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 id="audit-history-modal-title" className="text-base sm:text-lg font-bold text-white">
                📋 Historial y Descargas Diarias — Bitácora Auditable (`GeoAuditLogger`)
              </h2>
              <p className="text-xs text-slate-300">
                Sincronización automática con `LatinaWebApi` + Respaldo persistente en `localStorage` e `IndexedDB` (`geolatina_audit_logs`)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Historial y Descargas Diarias"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Download Banner */}
        {downloadBanner && (
          <div className="bg-emerald-950/90 border-b border-emerald-700 px-6 py-2.5 text-xs text-emerald-200 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{downloadBanner}</span>
          </div>
        )}

        {/* Filter & Export Controls Bar */}
        <div className="bg-[#0F172A] p-4 border-b border-slate-800 space-y-3 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* Search input */}
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Buscar en bitácora histórica"
                value={criteria.searchQuery}
                onChange={(e) => setCriteria({ ...criteria, searchQuery: e.target.value })}
                placeholder="Buscar por cliente, factura, ejecutivo, coordenadas o evento..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 min-h-[40px]"
              />
            </div>

            {/* Date Range Filter */}
            <div>
              <select
                aria-label="Filtro por Rango de Fechas"
                value={criteria.datePreset}
                onChange={(e) =>
                  setCriteria({
                    ...criteria,
                    datePreset: e.target.value as AuditFilterCriteria['datePreset'],
                  })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 min-h-[40px]"
              >
                <option value="TODOS">📅 Rango: Todo el Historial</option>
                <option value="HOY">📅 Hoy</option>
                <option value="AYER">📅 Ayer</option>
                <option value="SEMANA">📅 Últimos 7 Días (Semana)</option>
                <option value="MES">📅 Últimos 30 Días (Mes)</option>
                <option value="PERSONALIZADO">📅 Rango Personalizado</option>
              </select>
            </div>

            {/* Sales Executive Filter */}
            <div>
              <select
                aria-label="Filtro por Ejecutivo de Ventas"
                value={criteria.executiveFilter}
                onChange={(e) => setCriteria({ ...criteria, executiveFilter: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 min-h-[40px]"
              >
                <option value="TODOS">👤 Ejecutivo: Todos</option>
                <option value="Roberto Alcívar">Ing. Roberto Alcívar (Admin)</option>
                <option value="Mariana Paredes">Lic. Mariana Paredes (Supervisora)</option>
                {executiveNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Alert State Filter */}
            <div>
              <select
                aria-label="Filtro por Estado de Alerta"
                value={criteria.alertStateFilter}
                onChange={(e) => setCriteria({ ...criteria, alertStateFilter: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 min-h-[40px]"
              >
                <option value="TODOS">🚦 Estado: Todos</option>
                <option value="NORMAL">Normal / Operativo</option>
                <option value="ADVERTENCIA">Advertencia</option>
                <option value="CRITICA">Crítica / Fraude GPS</option>
              </select>
            </div>
          </div>

          {criteria.datePreset === 'PERSONALIZADO' && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Desde:</span>
                <input
                  type="date"
                  value={criteria.customStartDate || ''}
                  onChange={(e) => setCriteria({ ...criteria, customStartDate: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Hasta:</span>
                <input
                  type="date"
                  value={criteria.customEndDate || ''}
                  onChange={(e) => setCriteria({ ...criteria, customEndDate: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>
          )}

          {/* Activity Type Filter + 3 Immediate Download Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Tipo de Evento:</span>
              <select
                aria-label="Filtro por Tipo de Actividad"
                value={criteria.eventTypeFilter}
                onChange={(e) => setCriteria({ ...criteria, eventTypeFilter: e.target.value })}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="TODOS">Todas las Actividades ({filteredLogs.length})</option>
                <option value="INICIO_SESION">Inicios de Sesión</option>
                <option value="VISITA_CLIENTE">Visitas y Tachuelas</option>
                <option value="PUNTO_GPS">Geolocalizaciones en Ruta</option>
                <option value="ALERTA_FRAUDE_GPS">Alertas Anti-Fraude GPS</option>
                <option value="EXPORTACION_REPORTE">Exportaciones de Reportes</option>
                <option value="CONFIG_SISTEMA">Cambios de Configuración</option>
              </select>
            </div>

            {/* 3 Immediate Export Format Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer min-h-[40px]"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>1. Descargar CSV / Excel (.csv)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-600 font-bold text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer min-h-[40px]"
              >
                <FileJson className="w-4 h-4" />
                <span>2. Descargar JSON (.json)</span>
              </button>

              <button
                type="button"
                onClick={onOpenNativePdfReport}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer min-h-[40px]"
              >
                <FileText className="w-4 h-4" />
                <span>3. Informe Ejecutivo en PDF (.pdf)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Responsive Table / Mobile Cards View */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No se encontraron registros en la bitácora con los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0F172A]">
              <table className="w-full text-left text-xs text-slate-200 border-collapse">
                <thead>
                  <tr className="bg-slate-900/95 border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                    <th className="py-3 px-3 whitespace-nowrap">Fecha / Hora</th>
                    <th className="py-3 px-3 whitespace-nowrap">Usuario & Rol</th>
                    <th className="py-3 px-3 whitespace-nowrap">Tipo de Evento</th>
                    <th className="py-3 px-3 whitespace-nowrap">Coordenadas GPS</th>
                    <th className="py-3 px-3 whitespace-nowrap">Dispositivo</th>
                    <th className="py-3 px-3">Detalle de Acción Realizada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredLogs.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        entry.alertState === 'CRITICA' ? 'bg-red-950/25' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap tabular-nums">
                        <div>{entry.timestampLocal}</div>
                        <div className="text-[10px] text-slate-500">{entry.id}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-white">{entry.nombreUsuario}</div>
                        <div className="text-[11px] text-amber-400">{entry.rol}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-bold text-slate-200 block">{entry.eventType}</span>
                        <span
                          className={`text-[10px] font-semibold ${
                            entry.alertState === 'CRITICA'
                              ? 'text-red-400'
                              : entry.alertState === 'ADVERTENCIA'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          ● {entry.alertState}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap tabular-nums">
                        {entry.lat.toFixed(4)}, {entry.lng.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                        {entry.deviceBrowser}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-200 min-w-[240px] break-words">
                        {entry.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
