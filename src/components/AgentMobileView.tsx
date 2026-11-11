import React, { useState, useEffect } from 'react';
import { 
  AgentRealTimeState, 
  ClientVisit, 
  SuspiciousAlert,
  ActivityType,
  PaymentMethod
} from '../types';
import { 
  Play, 
  Square, 
  Navigation, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Phone, 
  DollarSign, 
  Battery, 
  TrendingUp, 
  FileText,
  ShieldAlert,
  Camera,
  Upload,
  Receipt,
  ShoppingCart,
  Image as ImageIcon,
  AlertCircle,
  Eye,
  Check,
  X,
  Timer
} from 'lucide-react';
import { MapTracker } from './MapTracker';
import { formatMinutesToHuman, getRemainingMinutesTo9Hours, calculateMinutesBetweenTimes } from '../utils/geoCalculations';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';

interface AgentMobileViewProps {
  agentState: AgentRealTimeState;
  onToggleShift: (active: boolean) => void;
  onUpdateVisitStatus: (
    visitId: string, 
    status: ClientVisit['status'], 
    activityDetails?: {
      activityType: ActivityType;
      orderAmount?: number;
      collectedAmount?: number;
      invoiceOrReceiptNumber?: string;
      paymentMethod?: PaymentMethod;
      notes?: string;
      evidenceUrl?: string;
      evidenceType?: 'photo' | 'video';
      durationMinutes?: number;
      travelMinutesFromPrevious?: number;
    }
  ) => void;
  onTriggerSOS: () => void;
  onOpenReport: () => void;
  onOpenRegisterVisitModal?: () => void;
}

export const AgentMobileView: React.FC<AgentMobileViewProps> = ({
  agentState,
  onToggleShift,
  onUpdateVisitStatus,
  onTriggerSOS,
  onOpenReport,
  onOpenRegisterVisitModal,
}) => {
  const { uiConfig } = useGeoLatinaSystem();
  const [activeTab, setActiveTab] = useState<'agenda' | 'mapa' | 'eficiencia'>('agenda');

  // Activity & Evidence Modal State
  const [selectedVisitForModal, setSelectedVisitForModal] = useState<ClientVisit | null>(null);
  const [activityType, setActivityType] = useState<ActivityType>('VENTA');
  const [amountInput, setAmountInput] = useState<string>('');
  const [docNumberInput, setDocNumberInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CREDITO');
  const [visitNotesInput, setVisitNotesInput] = useState<string>('');
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, string>>({});
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [evidenceType, setEvidenceType] = useState<'photo' | 'video'>('photo');
  const [evidenceError, setEvidenceError] = useState<string>('');

  const { user, speed, battery, visits, routeHistory, currentStatus, shiftStartTimestamp } = agentState;
  const isShiftActive = currentStatus !== 'sin_iniciar' && currentStatus !== 'finalizado' && currentStatus !== 'cerrado_auto_9h';

  // Calculate remaining time to 9h
  const remainingMinutesTo9h = shiftStartTimestamp ? getRemainingMinutesTo9Hours(shiftStartTimestamp) : 540;
  const shiftDurationMinutes = shiftStartTimestamp ? Math.floor((Date.now() - shiftStartTimestamp) / 60000) : 0;

  const completedVisits = visits.filter(v => v.status === 'completada').length;
  const totalPlannedVisits = visits.length;
  const complianceRate = totalPlannedVisits > 0 ? Math.round((completedVisits / totalPlannedVisits) * 100) : 0;

  // Open Activity Registration Modal
  const handleOpenCheckInModal = (visit: ClientVisit) => {
    setSelectedVisitForModal(visit);
    setActivityType(visit.activityType || 'VENTA');
    setAmountInput(
      visit.activityType === 'COBRANZA'
        ? (visit.collectedAmount ? visit.collectedAmount.toString() : '')
        : (visit.orderAmount ? visit.orderAmount.toString() : '')
    );
    setDocNumberInput(visit.invoiceOrReceiptNumber || `DOC-LAT-${Math.floor(1000 + Math.random() * 9000)}`);
    setPaymentMethod(visit.paymentMethod || (activityType === 'COBRANZA' ? 'TRANSFERENCIA' : 'CREDITO'));
    setVisitNotesInput(visit.notes || '');
    setCustomFieldsValues({});
    setEvidencePreview(visit.evidenceUrl || null);
    setEvidenceType(visit.evidenceType || 'photo');
    setEvidenceError('');
  };

  // Handle Photo/Video File Upload or Camera Capture
  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVid = file.type.startsWith('video');
      setEvidenceType(isVid ? 'video' : 'photo');
      const reader = new FileReader();
      reader.onload = (event) => {
        setEvidencePreview(event.target?.result as string);
        setEvidenceError('');
      };
      reader.readAsDataURL(file);
    }
  };

  // Sample Presets for Quick Testing of Photo Evidence
  const handleUsePresetEvidence = (sampleType: 'factura' | 'cobro' | 'local') => {
    let url = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=500&auto=format&fit=crop&q=80';
    if (sampleType === 'cobro') {
      url = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=500&auto=format&fit=crop&q=80';
    } else if (sampleType === 'local') {
      url = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80';
    }
    setEvidencePreview(url);
    setEvidenceType('photo');
    setEvidenceError('');
  };

  // Submit Activity & Check-out
  const handleSaveActivityAndCheckout = () => {
    if (!selectedVisitForModal) return;

    // Obligatory evidence validation
    if (!evidencePreview) {
      setEvidenceError('Es obligatorio adjuntar una fotografía o video como evidencia de la actividad.');
      return;
    }

    const numAmount = parseFloat(amountInput) || 0;
    const arrivalTime = selectedVisitForModal.actualArrivalTime || '09:00';
    const departureTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const duration = calculateMinutesBetweenTimes(arrivalTime, departureTime) || 35;

    const customEntriesText = Object.entries(customFieldsValues)
      .filter(([, val]) => val && val.trim() !== '')
      .map(([fieldId, val]) => {
        const def = uiConfig.customFormFields.find(f => f.id === fieldId);
        return `${def ? def.label : fieldId}: ${val}`;
      })
      .join(' | ');

    const combinedNotes = [
      visitNotesInput || `Gestión de ${activityType.toLowerCase()} realizada conforme a ruta.`,
      customEntriesText ? `[Campos Corporativos: ${customEntriesText}]` : '',
    ]
      .filter(Boolean)
      .join(' — ');

    onUpdateVisitStatus(selectedVisitForModal.id, 'completada', {
      activityType,
      orderAmount: activityType === 'VENTA' ? numAmount : undefined,
      collectedAmount: activityType === 'COBRANZA' ? numAmount : undefined,
      invoiceOrReceiptNumber: docNumberInput,
      paymentMethod,
      notes: combinedNotes,
      evidenceUrl: evidencePreview,
      evidenceType,
      durationMinutes: duration,
      travelMinutesFromPrevious: selectedVisitForModal.travelMinutesFromPrevious || 15,
    });

    setSelectedVisitForModal(null);
  };

  return (
    <div className="geo-workspace-shell w-full max-w-full flex-1 min-h-[calc(100dvh-118px)] flex flex-col">
      {/* Mandatory Shift Start Gate (When Shift is Inactive) */}
      {!isShiftActive && (
        <div className="w-full bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border-2 border-amber-500 rounded-3xl p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-lg">
            <Timer className="w-8 h-8 animate-pulse text-amber-400" />
          </div>

          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/30">
              Control de Asistencia & GPS Obligatorio
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
              Obligación de Inicio de Jornada Laboral
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 w-full mt-1.5 leading-relaxed">
              Para habilitar su rutero de clientes del día, activar la telemetría satelital en tiempo real y registrar ventas o cobranzas, debe iniciar formalmente su jornada.
            </p>
          </div>

          {currentStatus === 'cerrado_auto_9h' && (
            <div className="bg-red-950/80 border border-red-700/80 p-3 rounded-xl w-full text-xs text-red-200 flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>Su jornada anterior fue <b>cerrada automáticamente</b> tras alcanzar el límite reglamentario de 9 horas continuas.</span>
            </div>
          )}

          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 w-full text-xs text-slate-400 space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span>Límite Máximo Diario:</span>
              <strong className="text-amber-400">9 Horas Continuas</strong>
            </div>
            <p className="text-[11px] text-slate-500 text-left">
              * Si olvida cerrar la aplicación al terminar el día, el sistema cerrará automáticamente la jornada al cumplirse las 9 horas exactas.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onToggleShift(true)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-900/50 transition-all active:scale-95 mx-auto"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>INICIAR JORNADA LABORAL AHORA</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Shift Active Status & 9-Hour Limit Bar */}
      {isShiftActive && (
        <div className="w-full bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500 shadow-md"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 bg-emerald-500 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white">{user.name}</h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {user.role === 'TRANSPORTISTA' ? 'Logística' : 'Ventas en Ruta'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {user.assignedVehicle || 'Móvil de Operación'} • {user.zone}
                </p>
              </div>
            </div>

            {/* Shift Controls Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {onOpenRegisterVisitModal && (
                <button
                  onClick={onOpenRegisterVisitModal}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-colors shadow-lg cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>➕ Registrar / Cerrar Visita en Ubicación Actual</span>
                </button>
              )}

              <button
                onClick={() => onToggleShift(false)}
                className="px-4 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold border border-red-500 flex items-center gap-1.5 transition-colors shadow-lg shadow-red-900/30 active:scale-95"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                <span>Finalizar Jornada</span>
              </button>

              {/* Panic SOS Button */}
              <button
                onClick={onTriggerSOS}
                className="px-3 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700/80 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-90"
                title="Alerta de emergencia inmediata a supervisión"
              >
                <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                <span>SOS</span>
              </button>
            </div>
          </div>

          {/* 9-Hour Mandatory Session Bar */}
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-amber-400" />
                <span className="text-slate-300">
                  Inicio: <b>{agentState.activeShiftStartTime || '08:00'}</b> | Duración: <strong className="text-emerald-400">{formatMinutesToHuman(shiftDurationMinutes)}</strong>
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">
                Cierre automático en: <strong className={remainingMinutesTo9h <= 60 ? 'text-red-400 font-bold' : 'text-amber-400 font-bold'}>
                  {formatMinutesToHuman(remainingMinutesTo9h)}
                </strong> (Límite 9h)
              </div>
            </div>

            {/* Progress bar towards 9h limit */}
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  shiftDurationMinutes >= 510 ? 'bg-red-500' : shiftDurationMinutes >= 420 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (shiftDurationMinutes / 540) * 100)}%` }}
              />
            </div>
          </div>

          {/* Telemetry Live HUD Bar (Auto-Expanding KPI Grid: 2 cols on mobile, 4 on tablet/desktop) */}
          <div className="geo-kpi-auto-grid pt-1 border-t border-slate-800 text-xs">
            <div className="geo-fluid-card bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Velocidad Actual</span>
              <span className="geo-kpi-value font-bold text-white font-mono">{Math.round(speed)} km/h</span>
            </div>
            <div className="geo-fluid-card bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Distancia Hoy</span>
              <span className="geo-kpi-value font-bold text-amber-400 font-mono">{agentState.todayKm} km</span>
            </div>
            <div className="geo-fluid-card bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Batería & Señal GPS</span>
              <span className="text-base sm:text-lg font-bold text-emerald-400 font-mono flex items-center gap-1">
                <Battery className="w-3.5 h-3.5" /> {battery}% • {agentState.gpsSignal}
              </span>
            </div>
            <div className="geo-fluid-card bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Puntos GPS Guardados</span>
              <span className="geo-kpi-value font-bold text-sky-400 font-mono">
                {routeHistory.length + 1} pts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation Tabs */}
      <div className="w-full flex items-center gap-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800 shrink-0">
        <button
          onClick={() => setActiveTab('agenda')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'agenda' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Agenda de Clientes ({completedVisits}/{totalPlannedVisits})</span>
        </button>
        <button
          onClick={() => setActiveTab('mapa')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'mapa' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Mapa & Tachuelas</span>
        </button>
        <button
          onClick={() => setActiveTab('eficiencia')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'eficiencia' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Eficiencia ({complianceRate}%)</span>
        </button>
      </div>

      {/* Tab 1: Agenda de Visitas con Registro de Actividad y Tachuela */}
      {activeTab === 'agenda' && (
        <div className="flex-1 w-full flex flex-col space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Ruta Programada del Día
            </h3>
            <span className="text-xs text-slate-400">
              {completedVisits} de {totalPlannedVisits} visitas completadas
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 w-full">
            {visits.map((vis, idx) => {
              const isCompleted = vis.status === 'completada';
              const isInVisit = vis.status === 'en_visita';
              const isEnRoute = vis.status === 'en_camino';
              const isVenta = vis.activityType === 'VENTA';
              const isCobranza = vis.activityType === 'COBRANZA';

              return (
                <div
                  key={vis.id}
                  className={`geo-fluid-card bg-slate-900 border rounded-2xl p-4 transition-all shadow-md ${
                    isInVisit
                      ? 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-950/20'
                      : isCompleted
                      ? 'border-emerald-800/60 bg-emerald-950/15'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 h-full">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-900/30'
                          : isInVisit
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {idx + 1}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white">{vis.name}</h4>
                          
                          {/* Tachuela de actividad badge */}
                          {isCompleted && (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isVenta
                                ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600'
                                : isCobranza
                                ? 'bg-purple-900/80 text-purple-300 border border-purple-600'
                                : 'bg-sky-900/80 text-sky-300 border border-sky-600'
                            }`}>
                              <span>📌 TACHUELA:</span>
                              <span>{isVenta ? `VENTA $${(vis.orderAmount || 0).toLocaleString()}` : isCobranza ? `COBRO $${(vis.collectedAmount || 0).toLocaleString()}` : 'GESTIÓN'}</span>
                            </span>
                          )}

                          {!isCompleted && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isInVisit
                                ? 'bg-amber-900/60 text-amber-300 border border-amber-700 animate-pulse'
                                : isEnRoute
                                ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700'
                                : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isInVisit ? '● En Atención' : isEnRoute ? '🚗 En Camino' : 'Pendiente'}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{vis.address}</span>
                        </p>

                        {/* Breakdown of time spent at client and travel */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            Prog: <strong className="text-slate-100">{vis.scheduledTime}</strong>
                          </span>
                          {vis.durationMinutes && (
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                              ⏱️ En cliente: {vis.durationMinutes} min
                            </span>
                          )}
                          {vis.travelMinutesFromPrevious && (
                            <span className="flex items-center gap-1 text-sky-400 font-semibold">
                              🚗 Trayecto: {vis.travelMinutesFromPrevious} min
                            </span>
                          )}
                        </div>

                        {/* Evidence preview badge if attached */}
                        {vis.evidenceUrl && (
                          <div className="mt-2 flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                            <img
                              src={vis.evidenceUrl}
                              alt="Evidencia"
                              className="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0 cursor-pointer"
                              onClick={() => handleOpenCheckInModal(vis)}
                            />
                            <div className="text-[11px] min-w-0">
                              <span className="font-bold text-emerald-400 block">✓ Evidencia {vis.evidenceType === 'video' ? 'Video' : 'Fotográfica'}</span>
                              <span className="text-slate-400 truncate block">Doc: {vis.invoiceOrReceiptNumber || 'Registrado'}</span>
                            </div>
                          </div>
                        )}

                        {vis.notes && (
                          <p className="text-[11px] text-slate-400 italic pt-1">
                            "{vis.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex sm:flex-col gap-2 shrink-0 mt-2 sm:mt-0">
                      {!isCompleted && !isInVisit && (
                        <>
                          <button
                            disabled={!isShiftActive}
                            onClick={() => onUpdateVisitStatus(vis.id, 'en_camino')}
                            className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>En Camino</span>
                          </button>
                          <button
                            disabled={!isShiftActive}
                            onClick={() => {
                              onUpdateVisitStatus(vis.id, 'en_visita', {
                                activityType: 'VENTA',
                                travelMinutesFromPrevious: 15,
                              });
                            }}
                            className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Llegada (Check-in)</span>
                          </button>
                        </>
                      )}

                      {isInVisit && (
                        <button
                          onClick={() => handleOpenCheckInModal(vis)}
                          className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/40 animate-bounce"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Registrar Actividad & Evidencia</span>
                        </button>
                      )}

                      {isCompleted && (
                        <button
                          onClick={() => handleOpenCheckInModal(vis)}
                          className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Actividad & Evidencia</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Mapa & Tachuelas (Full-Viewport Coupled Surface with calc(100dvh - 110px) on Smartphones) */}
      {activeTab === 'mapa' && (
        <div className="geo-map-surface geo-map-surface-mobile-full w-full h-full min-h-[520px] flex-1 relative flex flex-col">
          <MapTracker
            selectedAgent={agentState}
            onOpenRegisterVisitModal={onOpenRegisterVisitModal}
          />
        </div>
      )}

      {/* Tab 3: Eficiencia y Métricas de Ruta */}
      {activeTab === 'eficiencia' && (
        <div className="flex-1 w-full flex flex-col">
          <div className="geo-fluid-card bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex-1">
            <div>
              <h3 className="geo-fluid-title font-bold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Tablero de Eficiencia de Ruta - Industrial Latina
              </h3>

              <div className="geo-kpi-auto-grid">
                <div className="geo-fluid-card bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-center">
                  <span className="text-xs text-slate-400">Score de Eficiencia</span>
                  <div className="geo-kpi-value font-black text-amber-400 mt-1">91%</div>
                  <span className="text-[11px] text-emerald-400">Excelente desempeño</span>
                </div>
                <div className="geo-fluid-card bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-center">
                  <span className="text-xs text-slate-400">Cumplimiento de Visitas</span>
                  <div className="geo-kpi-value font-black text-sky-400 mt-1">{complianceRate}%</div>
                  <span className="text-[11px] text-slate-400">{completedVisits} de {totalPlannedVisits} programadas</span>
                </div>
                <div className="geo-fluid-card bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-center col-span-2 md:col-span-1">
                  <span className="text-xs text-slate-400">Kilómetros Recorridos</span>
                  <div className="geo-kpi-value font-black text-emerald-400 mt-1">{agentState.todayKm} km</div>
                  <span className="text-[11px] text-slate-400">Ruta optimizada</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                🔒 Registro continuo en segundo plano. Datos sincronizados con base de control.
              </div>
              <button
                onClick={onOpenReport}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Exportar Informe PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Pestañas Inferiores Rápidas para Smartphones (<= 767px) */}
      <nav
        aria-label="Pestañas rápidas del ejecutivo en ruta"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 grid grid-cols-3 gap-1.5 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setActiveTab('mapa')}
          className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'mapa'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-200 border border-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate">Mapa en Vivo</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onOpenRegisterVisitModal) onOpenRegisterVisitModal();
          }}
          className="py-2 px-2 rounded-xl text-[11px] font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-1 shadow-md"
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate">Registrar Visita</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('agenda')}
          className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'agenda'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-200 border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span className="truncate">Mis Visitas / Historial</span>
        </button>
      </nav>

      {/* Modal: Activity Registration (Venta / Cobranza) + Mandatory Photo/Video Evidence */}
      {selectedVisitForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="geo-modal-fullviewport bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                  📌 REGISTRO DE TACHUELA EN RUTA
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Registro de Actividad & Evidencia en Cliente
                </h3>
                <p className="text-xs text-slate-400">{selectedVisitForModal.name}</p>
              </div>
              <button
                onClick={() => setSelectedVisitForModal(null)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Activity Type Selector: Venta vs Cobranza */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5 uppercase">
                  Tipo de Actividad Realizada en el Punto *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActivityType('VENTA');
                      setPaymentMethod('CREDITO');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      activityType === 'VENTA'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Venta de Pedido</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActivityType('COBRANZA');
                      setPaymentMethod('TRANSFERENCIA');
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      activityType === 'COBRANZA'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md ring-2 ring-purple-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Cobranza / Cobro</span>
                  </button>
                </div>
              </div>

              {/* Amount and Document # */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {activityType === 'VENTA' ? 'Monto de Venta ($ USD) *' : 'Monto Cobrado ($ USD) *'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {activityType === 'VENTA' ? 'N° Factura / Pedido' : 'N° Recibo / Comprobante'}
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: FAC-2026-0914"
                    value={docNumberInput}
                    onChange={(e) => setDocNumberInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Payment Condition */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Modalidad / Método de Pago
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="CREDITO">Crédito Comercial Industrial Latina (30 Días)</option>
                  <option value="TRANSFERENCIA">Transferencia Bancaria Inmediata</option>
                  <option value="CHEQUE">Cheque Cruzado a la Orden</option>
                  <option value="EFECTIVO">Efectivo / Contado</option>
                </select>
              </div>

              {/* Mandatory Photo/Video Evidence Section */}
              <div className="space-y-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
                    <Camera className="w-4 h-4" />
                    <span>Evidencia Obligatoria (Foto o Video) *</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Cámara o Galería
                  </span>
                </div>

                {/* Upload or Camera File Input */}
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer py-2 px-3 bg-slate-900 hover:bg-slate-850 border border-dashed border-slate-700 rounded-xl text-center text-xs text-slate-300 flex items-center justify-center gap-2 transition-colors">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Tomar o Subir Foto / Video</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      onChange={handleEvidenceFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Quick Presets for Test / Demo */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-500 font-bold block mb-1">
                    Presets de Prueba Rápida:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleUsePresetEvidence('factura')}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 rounded border border-slate-800"
                    >
                      📸 Factura Firmada
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUsePresetEvidence('cobro')}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 rounded border border-slate-800"
                    >
                      💵 Cheque / Comprobante
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUsePresetEvidence('local')}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 rounded border border-slate-800"
                    >
                      🏪 Fachada Cliente
                    </button>
                  </div>
                </div>

                {/* Evidence Preview */}
                {evidencePreview && (
                  <div className="relative mt-2 rounded-xl overflow-hidden border-2 border-emerald-500 max-h-40 bg-black flex items-center justify-center">
                    <img
                      src={evidencePreview}
                      alt="Evidencia cargada"
                      className="w-full h-36 object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-slate-950/90 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded shadow">
                      ✓ Evidencia Adjunta Lista
                    </div>
                    <button
                      type="button"
                      onClick={() => setEvidencePreview(null)}
                      className="absolute top-2 right-2 p-1 bg-red-600/90 hover:bg-red-500 text-white rounded-full text-xs shadow"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {evidenceError && (
                  <p className="text-xs text-red-400 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{evidenceError}</span>
                  </p>
                )}
              </div>

              {/* Dynamic Custom Form Fields configured in Admin UI Builder */}
              {uiConfig.customFormFields && uiConfig.customFormFields.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  {uiConfig.customFormFields.map((field) => (
                    <div key={field.id}>
                      <label className="text-[11px] font-bold text-amber-400 block mb-1">
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={customFieldsValues[field.id] || ''}
                          onChange={(e) =>
                            setCustomFieldsValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="">Seleccione...</option>
                          {(field.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          placeholder={field.placeholder || ''}
                          value={customFieldsValues[field.id] || ''}
                          onChange={(e) =>
                            setCustomFieldsValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Observaciones / Productos Entregados
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalle de productos o acuerdos alcanzados..."
                  value={visitNotesInput}
                  onChange={(e) => setVisitNotesInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Computed Times Confirmation */}
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>⏱️ Duración estimada en cliente: <b>35 min</b></span>
                <span className="text-emerald-400 font-bold">📍 Colocará Tachuela en Mapa</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedVisitForModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveActivityAndCheckout}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Guardar Actividad, Tachuela & Check-out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
