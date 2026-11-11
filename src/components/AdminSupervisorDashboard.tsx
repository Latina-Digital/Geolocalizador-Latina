import React, { useState } from 'react';
import { 
  User, 
  AgentRealTimeState, 
  SuspiciousAlert, 
  DailyReportSummary, 
  ClientVisit,
  CustomGeofence,
  LatLngPoint
} from '../types';
import { 
  Users, 
  MapPin, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  FileDown, 
  Battery, 
  Navigation, 
  Filter, 
  Car, 
  Truck, 
  AlertCircle, 
  Eye, 
  PhoneCall, 
  Search,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  PenTool,
  RotateCcw,
  Check,
  X,
  Trash2,
  Layers,
  Plus,
  Camera,
  DollarSign,
  Receipt,
  ShoppingCart,
  Timer,
  Image as ImageIcon
} from 'lucide-react';
import { MapTracker } from './MapTracker';
import { VisitDetailAndStreetViewModal } from './VisitDetailAndStreetViewModal';
import { formatMinutesToHuman, getRemainingMinutesTo9Hours } from '../utils/geoCalculations';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';

interface AdminSupervisorDashboardProps {
  currentUser: User;
  agents: AgentRealTimeState[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  alerts: SuspiciousAlert[];
  onResolveAlert: (alertId: string) => void;
  onExportPDF: (agentId: string) => void;
  onOpenRegisterVisitModal?: () => void;
  onAddNewAlert: (alert: SuspiciousAlert) => void;
  customGeofences: CustomGeofence[];
  onSaveGeofence: (geofence: CustomGeofence) => void;
  onDeleteGeofence: (id: string) => void;
  onToggleGeofenceActive: (id: string, active: boolean) => void;
  onAssignGeofenceToAgent: (geofenceId: string, agentId: string) => void;
}

export const AdminSupervisorDashboard: React.FC<AdminSupervisorDashboardProps> = ({
  currentUser,
  agents,
  selectedAgentId,
  onSelectAgent,
  alerts,
  onResolveAlert,
  onExportPDF,
  onOpenRegisterVisitModal,
  customGeofences,
  onSaveGeofence,
  onDeleteGeofence,
  onToggleGeofenceActive,
  onAssignGeofenceToAgent,
}) => {
  const { user: latinaSession, auditLogs, openAuditHistoryModal } = useGeoLatinaSystem();
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('TODAS');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSideTab, setActiveSideTab] = useState<'agentes' | 'alertas' | 'geocercas' | 'visitas'>('agentes');
  const [mobileBottomMode, setMobileBottomMode] = useState<'mixto' | 'mapa' | 'visitas'>('mixto');

  // Interactive Geofence Drawing State
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [drawingVertices, setDrawingVertices] = useState<LatLngPoint[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [selectedEvidenceVisit, setSelectedEvidenceVisit] = useState<ClientVisit | null>(null);
  const [selectedInspectVisit, setSelectedInspectVisit] = useState<{
    visit: ClientVisit;
    seqIndex: number;
  } | null>(null);

  // New Geofence Form State
  const [newGeoName, setNewGeoName] = useState<string>('');
  const [newGeoZone, setNewGeoZone] = useState<string>('Zona Norte & Guayaquil Metropolitano');
  const [newGeoColor, setNewGeoColor] = useState<string>('#3b82f6');
  const [newGeoAgents, setNewGeoAgents] = useState<string[]>(['agt-1']);

  // Handle map click during drawing mode
  const handleMapClick = (point: LatLngPoint) => {
    if (!isDrawingMode) return;
    setDrawingVertices(prev => [...prev, point]);
  };

  const handleUndoPoint = () => {
    setDrawingVertices(prev => prev.slice(0, -1));
  };

  const handleClearDrawing = () => {
    setDrawingVertices([]);
  };

  const handleStartSave = () => {
    if (drawingVertices.length < 3) return;
    setNewGeoName(`Geocerca Comercial #${customGeofences.length + 1}`);
    setShowSaveModal(true);
  };

  const handleSaveGeofenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (drawingVertices.length < 3 || !newGeoName.trim()) return;

    const newGeofence: CustomGeofence = {
      id: `geo-${Date.now()}`,
      name: newGeoName.trim(),
      zone: newGeoZone,
      type: 'polygon',
      color: newGeoColor,
      coordinates: drawingVertices,
      assignedAgentIds: newGeoAgents,
      active: true,
      createdAt: new Date().toISOString(),
    };

    onSaveGeofence(newGeofence);

    // Also assign to selected agents
    newGeoAgents.forEach(agId => {
      onAssignGeofenceToAgent(newGeofence.id, agId);
    });

    // Reset drawing state
    setShowSaveModal(false);
    setIsDrawingMode(false);
    setDrawingVertices([]);
    setActiveSideTab('geocercas');
  };

  // Filter agents based on hierarchical access control
  const accessibleAgents = agents.filter(ag => {
    // Director General sees all
    if (currentUser.role === 'DIRECTOR_GENERAL') {
      return true;
    }
    // Supervisor sees only their subordinates
    if (currentUser.role === 'SUPERVISOR_REGIONAL') {
      return ag.user.supervisorId === currentUser.id;
    }
    // Agents see only themselves
    return ag.user.id === currentUser.id;
  });

  // Secondary filters (Zone, Role, Search)
  const filteredAgents = accessibleAgents.filter(ag => {
    const matchesZone = selectedZoneFilter === 'TODAS' || ag.user.zone.includes(selectedZoneFilter);
    const matchesRole = selectedRoleFilter === 'TODOS' || ag.user.role === selectedRoleFilter;
    const matchesSearch = 
      ag.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ag.user.assignedVehicle?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesZone && matchesRole && matchesSearch;
  });

  // Currently focused agent
  const currentAgent = agents.find(ag => ag.user.id === selectedAgentId) || filteredAgents[0] || agents[0];

  // Global KPIs calculation
  const totalSubordinates = accessibleAgents.length;
  const activeSubordinates = accessibleAgents.filter(ag => ag.currentStatus !== 'inactivo').length;
  
  let totalPlannedVisits = 0;
  let totalCompletedVisits = 0;
  let totalKmAll = 0;
  let totalSalesAll = 0;

  accessibleAgents.forEach(ag => {
    totalKmAll += ag.todayKm;
    ag.visits.forEach(v => {
      totalPlannedVisits++;
      if (v.status === 'completada') {
        totalCompletedVisits++;
        totalSalesAll += v.orderAmount || 0;
      }
    });
  });

  const globalCompliance = totalPlannedVisits > 0 
    ? Math.round((totalCompletedVisits / totalPlannedVisits) * 100) 
    : 0;

  const unresolvedAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="geo-workspace-shell w-full max-w-full flex-1 min-h-[calc(100dvh-118px)] flex flex-col">
      {/* Hierarchy Banner & Zone Indicator */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="geo-fluid-title font-bold text-white tracking-wide">
              Centro de Monitoreo Satelital & Control de Rutas
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Supervisión centralizada de personal en ruta | Nivel de Acceso:{' '}
            <strong className="text-slate-200">
              {currentUser.role === 'DIRECTOR_GENERAL' ? 'Supervisión Nacional Completa' : `Jurisdicción ${currentUser.zone}`}
            </strong>
          </p>
        </div>

        {/* Global Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenRegisterVisitModal && (
            <button
              onClick={onOpenRegisterVisitModal}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Registrar o cerrar una visita comercial real con coordenadas GPS y Geocodificación Inversa"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>➕ Registrar / Cerrar Visita en Ubicación Actual</span>
            </button>
          )}

          <button
            onClick={() => onExportPDF(currentAgent?.user.id || '')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            title="Exportar informe en formato PDF con membrete oficial"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid (Auto-Expanding Edge-to-Edge: 2 cols Mobile, 4 cols Tablet Portrait, Fluid Desktop/4K) */}
      <div className={`geo-kpi-auto-grid w-full shrink-0 ${mobileBottomMode === 'mapa' ? 'hidden md:grid' : ''}`}>
        <div className="geo-fluid-card bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Equipo en Ruta</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="geo-kpi-value font-black text-white">{activeSubordinates}</span>
            <span className="text-xs text-slate-400">/ {totalSubordinates} activos</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 font-medium">
            ● GPS en transmisión directa
          </div>
        </div>

        <div className="geo-fluid-card bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Cumplimiento Visitas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="geo-kpi-value font-black text-emerald-400">{globalCompliance}%</span>
            <span className="text-xs text-slate-400">({totalCompletedVisits}/{totalPlannedVisits})</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${globalCompliance}%` }} />
          </div>
        </div>

        <div className="geo-fluid-card bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Km Totales Flota</span>
            <TrendingUp className="w-4 h-4 text-sky-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="geo-kpi-value font-black text-sky-400">{totalKmAll.toFixed(1)}</span>
            <span className="text-xs text-slate-400">km hoy</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Trazado continuo calle a calle
          </div>
        </div>

        <div className="geo-fluid-card bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Ventas Facturadas</span>
            <span className="text-xs font-bold text-amber-500">$ USD</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="geo-kpi-value font-black text-amber-400">
              ${totalSalesAll.toLocaleString('es-EC', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            En visitas cerradas hoy
          </div>
        </div>

        <div className="geo-fluid-card bg-slate-900 border border-slate-800 p-3.5 rounded-xl col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Alertas Operativas</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`geo-kpi-value font-black ${unresolvedAlerts.length > 0 ? 'text-red-500 animate-pulse' : 'text-slate-200'}`}>
              {unresolvedAlerts.length}
            </span>
            <span className="text-xs text-slate-400">pendientes</span>
          </div>
          <div className="mt-1 text-[11px] text-red-400 font-medium truncate">
            {unresolvedAlerts.length > 0 ? 'Requiere atención' : 'Sin incidencias graves'}
          </div>
        </div>
      </div>

      {/* Main Split Layout: Adaptive Multi-Device Grid (Smartphone Stack/Tabs | Tablet 60/40 | Desktop 8/4 | Ultrawide 2.5fr/1fr/1fr) */}
      <div className="geo-main-split-grid flex-1 w-full h-full min-h-[540px]">
        {/* Column 1: Interactive Google Maps & Telemetry HUD */}
        <div
          className={`w-full h-full min-h-[520px] flex flex-col ${
            mobileBottomMode === 'visitas' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="geo-fluid-card bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl flex-1">
            {/* Map Header Status & Geofence Drawing Toolbar */}
            <div className="flex flex-wrap items-center justify-between px-2 py-1.5 mb-2 border-b border-slate-800 gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-white">
                  Cartografía Google Maps: {currentAgent.user.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {currentAgent.currentLocation.lat.toFixed(4)}, {currentAgent.currentLocation.lng.toFixed(4)}
                </span>
              </div>

              {/* Drawing Toolbar Controls */}
              <div className="flex items-center gap-1.5">
                {!isDrawingMode ? (
                  <button
                    onClick={() => {
                      setIsDrawingMode(true);
                      setDrawingVertices([]);
                    }}
                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    title="Dibujar polígono de geocerca en el mapa para zona de ventas"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Dibujar Geocerca</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-amber-500/50">
                    <span className="text-[11px] font-bold text-amber-400 px-1.5">
                      {drawingVertices.length} pts
                    </span>
                    <button
                      onClick={handleUndoPoint}
                      disabled={drawingVertices.length === 0}
                      className="p-1 text-slate-300 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                      title="Deshacer último vértice"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleStartSave}
                      disabled={drawingVertices.length < 3}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[11px] rounded flex items-center gap-1 transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      <span>Guardar ({drawingVertices.length}/3 mín)</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsDrawingMode(false);
                        setDrawingVertices([]);
                      }}
                      className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-slate-800"
                      title="Cancelar dibujo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Official Google Maps Surface (Coupled to 100% height & width) */}
            <div
              className={`geo-map-surface w-full h-full min-h-[500px] flex-1 relative flex flex-col ${
                mobileBottomMode === 'mapa' ? 'geo-map-surface-mobile-full' : ''
              }`}
            >
              <MapTracker
                selectedAgent={currentAgent}
                allAgents={accessibleAgents}
                onSelectAgent={onSelectAgent}
                onOpenRegisterVisitModal={onOpenRegisterVisitModal}
                activeAlerts={alerts}
                customGeofences={customGeofences}
                isDrawingGeofence={isDrawingMode}
                drawingPoints={drawingVertices}
                onMapClick={handleMapClick}
              />
            </div>

            {/* Breadcrumb Info Bar */}
            <div className="mt-2.5 px-2 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>{currentAgent.routeHistory.length + 1} puntos registrados en recorrido continuo</span>
              </div>
              <div className="text-[11px] text-slate-500">
                🛡️ {customGeofences.filter(g => g.active).length} geocercas de protección activas
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Subordinates List, Alerts, Geofences and Visits */}
        <div
          className={`w-full h-full min-h-[520px] flex flex-col ${
            mobileBottomMode === 'mapa' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="geo-fluid-card bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 min-h-[520px]">
            {/* Tabs Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-3 overflow-x-auto">
              <button
                onClick={() => setActiveSideTab('agentes')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shrink-0 ${
                  activeSideTab === 'agentes' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Equipo</span>
              </button>
              <button
                onClick={() => setActiveSideTab('geocercas')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shrink-0 ${
                  activeSideTab === 'geocercas' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Geocercas ({customGeofences.length})</span>
              </button>
              <button
                onClick={() => setActiveSideTab('alertas')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 relative shrink-0 ${
                  activeSideTab === 'alertas' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Alertas</span>
                {unresolvedAlerts.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-red-600 text-[10px] text-white rounded-full font-black">
                    {unresolvedAlerts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveSideTab('visitas')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shrink-0 ${
                  activeSideTab === 'visitas' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Rutero ({currentAgent.visits.length})</span>
              </button>
            </div>

            {/* TAB 1: AGENTS LIST */}
            {activeSideTab === 'agentes' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Search & Role Filters */}
                <div className="space-y-2 mb-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar agente o vehículo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {currentUser.role === 'DIRECTOR_GENERAL' && (
                    <div className="flex items-center gap-1 text-[11px] overflow-x-auto pb-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold shrink-0">Zona:</span>
                      {['TODAS', 'Norte', 'Sur'].map((zone) => (
                        <button
                          key={zone}
                          onClick={() => setSelectedZoneFilter(zone)}
                          className={`px-2 py-0.5 rounded-md font-semibold transition-colors shrink-0 ${
                            selectedZoneFilter === zone
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {zone}
                        </button>
                      ))}
                      <span className="text-slate-500 text-[10px] uppercase font-bold shrink-0 ml-1">Rol:</span>
                      {['TODOS', 'EJECUTIVO_VENTAS', 'TRANSPORTISTA'].map((role) => (
                        <button
                          key={role}
                          onClick={() => setSelectedRoleFilter(role)}
                          className={`px-2 py-0.5 rounded-md font-semibold transition-colors shrink-0 ${
                            selectedRoleFilter === role
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {role === 'TODOS' ? 'Todos' : role === 'EJECUTIVO_VENTAS' ? 'Ejecutivos' : 'Transportistas'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subordinates List Scrollable */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {filteredAgents.map((ag) => {
                    const isSelected = ag.user.id === currentAgent.user.id;
                    const completed = ag.visits.filter(v => v.status === 'completada').length;
                    const total = ag.visits.length;
                    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                    const isTruck = ag.user.role === 'TRANSPORTISTA';

                    return (
                      <div
                        key={ag.user.id}
                        onClick={() => onSelectAgent(ag.user.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-amber-950/20 border-amber-500/80 shadow-md ring-1 ring-amber-500/40'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <img
                                src={ag.user.avatar}
                                alt={ag.user.name}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                              />
                              <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
                                ag.currentStatus === 'inactivo' ? 'bg-slate-500' : 'bg-emerald-500'
                              }`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold text-white">{ag.user.name}</h4>
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-slate-800 text-amber-400">
                                  {isTruck ? 'Transportista' : 'Ventas'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                {ag.user.assignedVehicle || 'Vehículo asignado'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-white block">
                              {Math.round(ag.speed)} km/h
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {ag.todayKm} km hoy
                            </span>
                          </div>
                        </div>

                        {/* Progress and status footer */}
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2 text-slate-400">
                            <span>Visitas: <strong className="text-emerald-400">{completed}/{total}</strong></span>
                            <span>• Batería: <strong className="text-slate-300">{ag.battery}%</strong></span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onExportPDF(ag.user.id);
                            }}
                            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5"
                          >
                            <FileDown className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: GEOCERCAS GESTIÓN */}
            {activeSideTab === 'geocercas' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-300">
                      Zonas & Geocercas de Ventas
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Delimitación de áreas comerciales permitidas
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsDrawingMode(true);
                      setDrawingVertices([]);
                    }}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nueva</span>
                  </button>
                </div>

                {/* Geofences list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {customGeofences.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-500">
                      No hay geocercas configuradas. Usa el botón "Dibujar Geocerca" en el mapa.
                    </div>
                  ) : (
                    customGeofences.map((geo) => (
                      <div
                        key={geo.id}
                        className={`p-3 rounded-xl border text-xs transition-all ${
                          geo.active
                            ? 'bg-slate-950/70 border-slate-800'
                            : 'bg-slate-950/30 border-slate-900 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white/40 shadow-sm"
                              style={{ backgroundColor: geo.color }}
                            />
                            <div>
                              <h5 className="font-bold text-white text-xs">{geo.name}</h5>
                              <p className="text-[10px] text-slate-400">{geo.zone}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onToggleGeofenceActive(geo.id, !geo.active)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                                geo.active
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800'
                              }`}
                            >
                              {geo.active ? 'Activa' : 'Pausada'}
                            </button>
                            <button
                              onClick={() => onDeleteGeofence(geo.id)}
                              className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                              title="Eliminar geocerca"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Details and agents */}
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            {geo.coordinates ? `${geo.coordinates.length} vértices poligonales` : `Radio ${geo.radiusKm} km`}
                          </span>
                          <span className="font-medium text-slate-300">
                            {geo.assignedAgentIds.length} agentes protegidos
                          </span>
                        </div>

                        {/* Quick Action: Assign to Current Executive */}
                        <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                          <button
                            onClick={() => onAssignGeofenceToAgent(geo.id, currentAgent.user.id)}
                            className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span>Asignar a {currentAgent.user.name}</span>
                          </button>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            ● Perímetro Satelital Activo
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ALERTS & INCIDENTS */}
            {activeSideTab === 'alertas' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-300">
                    Incidencias & Actividades Sospechosas
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {unresolvedAlerts.length} pendientes
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {alerts.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-500">
                      No se han reportado actividades sospechosas.
                    </div>
                  ) : (
                    alerts.map((alt) => (
                      <div
                        key={alt.id}
                        className={`p-3 rounded-xl border text-xs transition-all ${
                          alt.resolved
                            ? 'bg-slate-950/40 border-slate-800 opacity-60'
                            : 'bg-red-950/20 border-red-800/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                            <strong className="text-red-400 uppercase font-bold text-[11px]">
                              {alt.type.replace(/_/g, ' ')}
                            </strong>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            alt.severity === 'alta' || alt.severity === 'critica'
                              ? 'bg-red-900/60 text-red-300 border border-red-700'
                              : 'bg-amber-900/60 text-amber-300 border border-amber-700'
                          }`}>
                            {alt.severity}
                          </span>
                        </div>

                        <p className="text-slate-300 text-[11px] mt-1.5">
                          {alt.description}
                        </p>

                        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Agente: <strong className="text-slate-200">{alt.agentName}</strong></span>
                          {!alt.resolved ? (
                            <button
                              onClick={() => onResolveAlert(alt.id)}
                              className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded transition-colors"
                            >
                              Resolver
                            </button>
                          ) : (
                            <span className="text-emerald-400 font-semibold">✓ Resuelta</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: CURRENT AGENT RUTERO & VISITAS */}
            {activeSideTab === 'visitas' && (() => {
              const completedVisits = currentAgent.visits.filter(v => v.status === 'completada');
              const totalVisitMinutes = currentAgent.visits.reduce((acc, v) => acc + (v.durationMinutes || (v.status === 'completada' ? 25 : 0)), 0);
              const totalTravelMinutes = currentAgent.visits.reduce((acc, v) => acc + (v.travelMinutesFromPrevious || (v.status === 'completada' ? 15 : 0)), 0);
              const totalRouteMinutes = totalVisitMinutes + totalTravelMinutes;

              const totalSalesAmount = currentAgent.visits.reduce((acc, v) => acc + (v.orderAmount || 0), 0);
              const totalCollectedAmount = currentAgent.visits.reduce((acc, v) => acc + (v.collectedAmount || 0), 0);

              const isAuto9h = currentAgent.currentStatus === 'cerrado_auto_9h';
              const isShiftActive = currentAgent.currentStatus === 'activo_ruta' || currentAgent.currentStatus === 'en_cliente';
              const remaining9hMin = currentAgent.shiftStartTimestamp ? getRemainingMinutesTo9Hours(currentAgent.shiftStartTimestamp) : 540;

              return (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Rutero Header & Duration Banner */}
                  <div className="mb-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Rutero Operativo: {currentAgent.user.name}</span>
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {currentAgent.user.zone} • {currentAgent.user.assignedVehicle || 'Vehículo asignado'}
                        </p>
                      </div>
                      <span className="text-[11px] text-amber-400 font-bold px-2 py-0.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        {completedVisits.length} / {currentAgent.visits.length} visitas
                      </span>
                    </div>

                    {/* Route Duration & Metric Badges */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[10px]">
                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block font-medium">⏱️ Duración Total Ruta</span>
                        <span className="text-amber-400 font-bold font-mono text-xs">
                          {formatMinutesToHuman(totalRouteMinutes)}
                        </span>
                        <span className="text-[9px] text-slate-500 block">
                          ({totalVisitMinutes}m cliente + {totalTravelMinutes}m trayecto)
                        </span>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block font-medium">💰 Producción del Día</span>
                        <div className="text-emerald-400 font-bold text-xs">
                          Vtas: ${totalSalesAmount.toFixed(0)}
                        </div>
                        <div className="text-purple-400 font-bold text-[10px]">
                          Cobros: ${totalCollectedAmount.toFixed(0)}
                        </div>
                      </div>
                    </div>

                    {/* 9-Hour Limit Status Bar */}
                    <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      {isAuto9h ? (
                        <div className="flex items-center gap-1.5 text-red-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span>Cerrado automático (9h cumplidas)</span>
                        </div>
                      ) : isShiftActive ? (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1.5 text-slate-300 text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span>Jornada activa (Límite 9h: <b>{formatMinutesToHuman(remaining9hMin)}</b>)</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Jornada no iniciada</span>
                      )}
                    </div>
                  </div>

                  {/* Sequential Timeline of Stops and Travel Duration */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {currentAgent.visits.map((vis, idx) => {
                      const isComplete = vis.status === 'completada';
                      const isInVisit = vis.status === 'en_visita';

                      return (
                        <div key={vis.id} className="space-y-1.5">
                          {/* Inter-Stop Transit Duration */}
                          {idx > 0 && (
                            <div className="flex items-center gap-2 pl-4 py-0.5">
                              <div className="w-0.5 h-4 bg-slate-800" />
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-800">
                                <Car className="w-3 h-3 text-sky-400" />
                                <span>Trayecto: {vis.travelMinutesFromPrevious || 15} min</span>
                              </div>
                            </div>
                          )}

                          {/* Client Visit Card */}
                          <div
                            onClick={() => setSelectedInspectVisit({ visit: vis, seqIndex: idx + 1 })}
                            className={`p-3 rounded-xl border text-xs transition-all cursor-pointer hover:border-amber-500/70 ${
                              vis.hasFraudAlert
                                ? 'bg-red-950/30 border-red-600/80'
                                : isComplete
                                ? 'bg-slate-950/80 border-slate-800'
                                : isInVisit
                                ? 'bg-amber-950/20 border-amber-600/60 shadow-md'
                                : 'bg-slate-950/40 border-slate-800/60 opacity-85'
                            }`}
                          >
                            {/* Card Top: Stop # and Tachuela Pin Badge */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-xs">
                                  #{idx + 1} {vis.name}
                                </span>
                              </div>

                              {/* Tachuela Pushpin indicator */}
                              {vis.hasFraudAlert ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-600 text-white animate-pulse">
                                  🚨 Alerta GPS
                                </span>
                              ) : isComplete ? (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border ${
                                  vis.activityType === 'COBRANZA'
                                    ? 'bg-purple-950 text-purple-300 border-purple-800'
                                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                }`}>
                                  <MapPin className="w-3 h-3" />
                                  <span>📌 Tachuela {vis.activityType === 'COBRANZA' ? 'Cobro' : 'Venta'}</span>
                                </span>
                              ) : isInVisit ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700 flex items-center gap-1">
                                  <Clock className="w-3 h-3 animate-spin" />
                                  <span>En atención</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] text-slate-500 bg-slate-900 border border-slate-800">
                                  Pendiente
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {vis.reverseGeocodedAddress || vis.address}
                            </p>

                            {/* Timing Details: Scheduled, Arrival, Duration in Client */}
                            <div className="mt-2 pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <span className="text-slate-500 block">Horario:</span>
                                <span className="text-slate-300 font-mono">
                                  Prog: {vis.scheduledTime} | Lleg: {vis.actualArrivalTime || '--:--'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-500 block">Tiempo en Cliente:</span>
                                <span className="text-amber-400 font-mono font-bold">
                                  ⏱️ {vis.durationMinutes || (isComplete ? 25 : 0)} min
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-mono">
                                RUC: {vis.clientRuc || '0992348192001'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInspectVisit({ visit: vis, seqIndex: idx + 1 });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#0A2540] hover:bg-slate-800 text-amber-400 font-bold text-[10px] flex items-center gap-1 border border-slate-700"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Ficha Completa & Street View</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Column 3 (Exclusivo Monitores Ultrawide y 4K > 1920px): Panel de Detalle / Auditoría en Paralelo (1fr) */}
        <div className="geo-ultrawide-third-panel min-h-[520px]">
          <div className="geo-fluid-card bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex-1 min-h-[520px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Auditoría & Telemetría en Vivo (Vista 4K)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Bitácora de {currentAgent.user.name} · {auditLogs.length} eventos
                </p>
              </div>
              <button
                type="button"
                onClick={openAuditHistoryModal}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold border border-slate-700 cursor-pointer"
              >
                📋 Bitácora Completa
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {auditLogs.slice(0, 12).map((entry) => (
                <div
                  key={entry.id}
                  className={`p-2.5 rounded-xl border text-xs ${
                    entry.alertState === 'CRITICA'
                      ? 'bg-red-950/30 border-red-700/80'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="font-bold text-amber-400">{entry.eventType}</span>
                    <span>{entry.timestampLocal}</span>
                  </div>
                  <p className="text-[11px] text-slate-200 mt-1 leading-snug">{entry.detail}</p>
                  <div className="mt-1 text-[10px] font-mono text-slate-500">
                    GPS: {entry.lat.toFixed(4)}, {entry.lng.toFixed(4)} · {entry.nombreUsuario}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Pestañas Inferiores Rápidas para Smartphones (<= 767px) */}
      <nav
        aria-label="Navegación rápida móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 grid grid-cols-3 gap-1.5 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setMobileBottomMode(mobileBottomMode === 'mapa' ? 'mixto' : 'mapa')}
          className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
            mobileBottomMode === 'mapa'
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
          <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
          <span className="truncate">Registrar Visita</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileBottomMode('visitas');
            setActiveSideTab('visitas');
          }}
          className={`py-2 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
            mobileBottomMode === 'visitas'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'bg-slate-900 text-slate-200 border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span className="truncate">Mis Visitas / Historial</span>
        </button>
      </nav>

      {/* Modal: Save Drawn Geofence */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="geo-modal-fullviewport bg-slate-900 border border-slate-700 rounded-2xl w-[96vw] max-w-[96vw] h-[92dvh] max-h-[92dvh] p-5 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Guardar Nueva Geocerca</h3>
                  <p className="text-xs text-slate-400">GEO LATINA • Delimitación Territorial</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGeofenceSubmit} className="space-y-3 flex-1 flex flex-col justify-between mt-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nombre de la Geocerca / Área Comercial
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Zona Norte - Alborada y Tarqui"
                  value={newGeoName}
                  onChange={(e) => setNewGeoName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Jurisdicción / Zona
                </label>
                <select
                  value={newGeoZone}
                  onChange={(e) => setNewGeoZone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Zona Norte & Guayaquil Metropolitano">Zona Norte & Guayaquil Metropolitano</option>
                  <option value="Zona Sur & Costa Austral">Zona Sur & Costa Austral</option>
                  <option value="Zona Centro Mayorista">Zona Centro Mayorista</option>
                  <option value="Corredor Logístico Nacional">Corredor Logístico Nacional</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Color del Perímetro en Mapa
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { color: '#3b82f6', label: 'Azul' },
                    { color: '#10b981', label: 'Verde' },
                    { color: '#f59e0b', label: 'Ámbar' },
                    { color: '#8b5cf6', label: 'Púrpura' },
                    { color: '#ef4444', label: 'Rojo' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setNewGeoColor(c.color)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        newGeoColor === c.color ? 'scale-110 border-white ring-2 ring-white/50' : 'border-transparent opacity-70'
                      }`}
                      style={{ backgroundColor: c.color }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Asignar a Vendedores / Transportistas en Ruta
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {accessibleAgents.map((ag) => {
                    const isChecked = newGeoAgents.includes(ag.user.id);
                    return (
                      <label key={ag.user.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewGeoAgents(cur => [...cur, ag.user.id]);
                            } else {
                              setNewGeoAgents(cur => cur.filter(id => id !== ag.user.id));
                            }
                          }}
                          className="rounded text-amber-500 bg-slate-900 border-slate-700"
                        />
                        <span>{ag.user.name} ({ag.user.role === 'TRANSPORTISTA' ? 'Transporte' : 'Ventas'})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                🛡️ <b>Vértices poligonales:</b> {drawingVertices.length} puntos capturados. El sistema supervisará automáticamente las coordenadas GPS y emitirá alarmas push inmediatas si cualquier agente asignado sale de los límites.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all"
                >
                  Guardar y Activar Geocerca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Supervisor Evidence Inspector (Photo/Video & Receipt) */}
      {selectedEvidenceVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
          <div className="geo-modal-fullviewport bg-slate-900 border border-slate-700 rounded-2xl w-[96vw] max-w-[96vw] h-[92dvh] max-h-[92dvh] p-5 shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border ${
                  selectedEvidenceVisit.activityType === 'COBRANZA'
                    ? 'bg-purple-950/60 text-purple-400 border-purple-800'
                    : 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                }`}>
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Evidencia de Visita #{selectedEvidenceVisit.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedEvidenceVisit.companyName} • {selectedEvidenceVisit.address}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvidenceVisit(null)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Evidence Image Display */}
            {selectedEvidenceVisit.evidenceUrl ? (
              <div className="rounded-xl overflow-hidden border border-slate-700 bg-black/60 max-h-72 flex items-center justify-center">
                <img
                  src={selectedEvidenceVisit.evidenceUrl}
                  alt="Evidencia capturada"
                  className="w-full h-auto max-h-72 object-contain"
                />
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                Sin imagen adjunta
              </div>
            )}

            {/* Evidence Details Breakdown */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Tipo de Gestión:</span>
                  <span className={`font-bold uppercase ${
                    selectedEvidenceVisit.activityType === 'COBRANZA' ? 'text-purple-400' : 'text-emerald-400'
                  }`}>
                    {selectedEvidenceVisit.activityType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Comprobante / Documento:</span>
                  <span className="text-white font-mono font-bold">
                    #{selectedEvidenceVisit.invoiceOrReceiptNumber || 'S/N'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Monto Transacción:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    ${(selectedEvidenceVisit.orderAmount || selectedEvidenceVisit.collectedAmount || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tiempo en Cliente:</span>
                  <span className="text-amber-400 font-bold font-mono">
                    ⏱️ {selectedEvidenceVisit.durationMinutes || 25} minutos
                  </span>
                </div>
              </div>

              {selectedEvidenceVisit.notes && (
                <div className="pt-2 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-500 block">Observaciones del Ejecutivo:</span>
                  <p className="text-slate-300 italic">"{selectedEvidenceVisit.notes}"</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-500">
                📌 Tachuela GPS y evidencia auditada satelitalmente
              </span>
              <button
                onClick={() => setSelectedEvidenceVisit(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5-Section Complete Visit Detail & Street View */}
      <VisitDetailAndStreetViewModal
        visit={selectedInspectVisit?.visit || null}
        visitSequenceIndex={selectedInspectVisit?.seqIndex || 1}
        totalVisitsInRoute={currentAgent.visits.length}
        executiveUser={currentAgent.user}
        viewerRole={latinaSession?.rol || 'ADMINISTRADOR'}
        onClose={() => setSelectedInspectVisit(null)}
      />
    </div>
  );
};
