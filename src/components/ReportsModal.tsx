import React, { useState } from 'react';
import { AgentRealTimeState, DailyReportSummary, SuspiciousAlert } from '../types';
import { generateDailyPDFReport } from '../services/pdfReportGenerator';
import { FileText, Download, CheckCircle2, TrendingUp, Calendar, Clock, DollarSign, MapPin } from 'lucide-react';

interface ReportsModalProps {
  agents: AgentRealTimeState[];
  alerts: SuspiciousAlert[];
  onClose: () => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({
  agents,
  alerts,
  onClose,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.user.id || '');

  const agentState = agents.find(a => a.user.id === selectedAgentId) || agents[0];

  if (!agentState) return null;

  const completedVisits = agentState.visits.filter(v => v.status === 'completada').length;
  const totalVisits = agentState.visits.length;
  const compliancePercent = totalVisits > 0 ? (completedVisits / totalVisits) * 100 : 0;
  
  let totalSales = 0;
  let totalCollected = 0;
  let totalVisitMinutes = 0;
  let totalTravelMinutes = 0;

  agentState.visits.forEach(v => {
    if (v.status === 'completada') {
      if (v.orderAmount) totalSales += v.orderAmount;
      if (v.collectedAmount) totalCollected += v.collectedAmount;
      totalVisitMinutes += (v.durationMinutes || 25);
      totalTravelMinutes += (v.travelMinutesFromPrevious || 15);
    }
  });

  const totalRouteMinutes = totalVisitMinutes + totalTravelMinutes;
  const hoursRoute = Math.floor(totalRouteMinutes / 60);
  const minsRoute = totalRouteMinutes % 60;
  const routeDurationFormatted = `${hoursRoute}h ${minsRoute}m`;

  const agentAlerts = alerts.filter(al => al.agentId === agentState.user.id);

  const reportSummary: DailyReportSummary = {
    agentId: agentState.user.id,
    agentName: agentState.user.name,
    role: agentState.user.role,
    date: new Date().toISOString().split('T')[0],
    shiftStart: agentState.activeShiftStartTime || '08:00',
    shiftEnd: agentState.shiftEndTime || 'En Operación',
    totalHours: routeDurationFormatted,
    totalKm: agentState.todayKm,
    plannedVisits: totalVisits,
    completedVisits,
    visitCompliancePercent: compliancePercent,
    totalSalesOrders: totalSales,
    totalSalesCount: agentState.visits.filter(v => v.activityType === 'VENTA').length,
    totalCollectionsAmount: totalCollected,
    totalCollectionsCount: agentState.visits.filter(v => v.activityType === 'COBRANZA').length,
    evidencesCount: agentState.visits.filter(v => !!v.evidenceUrl).length,
    efficiencyScore: 90,
    alertsTriggered: agentAlerts.length,
    avgSpeed: 41.2,
    timeSpentInVisitsMinutes: totalVisitMinutes,
    timeSpentDrivingMinutes: totalTravelMinutes,
    supervisorSignature: 'Mariana Paredes - Jefa Regional de Ventas',
  };

  const handleDownloadPDF = () => {
    generateDailyPDFReport({
      report: reportSummary,
      visits: agentState.visits,
      alerts: agentAlerts,
      routePoints: agentState.routeHistory,
      zoneName: agentState.user.zone,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Informes de Eficiencia y Duración de Ruta</h3>
              <p className="text-xs text-slate-400">GEO LATINA • Industrial Latina S.A.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Agent Selector Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-slate-400 font-bold uppercase shrink-0">Colaborador:</span>
          {agents.map((ag) => (
            <button
              key={ag.user.id}
              onClick={() => setSelectedAgentId(ag.user.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                ag.user.id === agentState.user.id
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {ag.user.name} ({ag.user.role === 'TRANSPORTISTA' ? 'Transportista' : 'Ventas'})
            </button>
          ))}
        </div>

        {/* Modal Content Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Duración de Ruta</span>
              <div className="text-xl font-black text-amber-400 mt-1 font-mono">{routeDurationFormatted}</div>
              <span className="text-[10px] text-slate-400 font-medium">{totalVisitMinutes}m cli | {totalTravelMinutes}m tray</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Visitas Cerradas</span>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {completedVisits} / {totalVisits}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{compliancePercent.toFixed(0)}% Efectividad</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Km Recorridos</span>
              <div className="text-xl font-black text-sky-400 mt-1">{agentState.todayKm} km</div>
              <span className="text-[10px] text-slate-400 font-medium">GPS alta precisión</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Producción Total</span>
              <div className="text-xl font-black text-amber-400 mt-1">
                ${(totalSales + totalCollected).toLocaleString('es-EC', { minimumFractionDigits: 0 })}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Vtas: ${totalSales.toFixed(0)} | Cob: ${totalCollected.toFixed(0)}</span>
            </div>
          </div>

          {/* Visits Timeline Detail Table */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Auditoría de Visitas, Actividades y Tachuelas Satelitales
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                {agentState.visits.length} paradas en hoja de ruta
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Cliente / Empresa</th>
                    <th className="py-2 px-2">Actividad / N° Doc</th>
                    <th className="py-2 px-2">En Cliente</th>
                    <th className="py-2 px-2">Trayecto</th>
                    <th className="py-2 px-2">Tachuela GPS</th>
                    <th className="py-2 px-2 text-right">Monto USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {agentState.visits.map((vis, i) => {
                    const amountVal = vis.orderAmount || vis.collectedAmount || 0;
                    return (
                      <tr key={vis.id} className="hover:bg-slate-900/50">
                        <td className="py-2.5 px-2 text-slate-500">{i + 1}</td>
                        <td className="py-2.5 px-2">
                          <div className="font-bold text-white">{vis.name}</div>
                          <div className="text-[11px] text-slate-400">{vis.address}</div>
                        </td>
                        <td className="py-2.5 px-2">
                          {vis.activityType === 'VENTA' ? (
                            <span className="text-emerald-400 font-semibold">
                              🛒 Venta (Fact #{vis.invoiceOrReceiptNumber || 'S/N'})
                            </span>
                          ) : vis.activityType === 'COBRANZA' ? (
                            <span className="text-purple-400 font-semibold">
                              💵 Cobranza (Rec #{vis.invoiceOrReceiptNumber || 'S/N'})
                            </span>
                          ) : (
                            <span className="text-slate-500">Pendiente</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-amber-400">
                          ⏱️ {vis.durationMinutes || (vis.status === 'completada' ? 25 : 0)} min
                        </td>
                        <td className="py-2.5 px-2 font-mono text-slate-400">
                          🚗 {vis.travelMinutesFromPrevious || (i > 0 ? 15 : 0)} min
                        </td>
                        <td className="py-2.5 px-2">
                          {vis.status === 'completada' || vis.hasTachuelaPin ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 w-max">
                              <span>📌 Fijada</span>
                              {vis.evidenceUrl && <span>📸</span>}
                            </span>
                          ) : vis.status === 'en_visita' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              En Curso
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] text-slate-500 bg-slate-900">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-400">
                          {amountVal > 0 ? `$${amountVal.toFixed(2)}` : '$0.00'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 hidden sm:block">
            Incluye membrete institucional de Industrial Latina, firmas y sellos de supervisión.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Informe Oficial PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
