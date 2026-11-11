/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  AgentRealTimeState, 
  SuspiciousAlert, 
  DailyReportSummary, 
  ClientVisit,
  RoutePoint,
  AlertType,
  ActivityType,
  PaymentMethod
} from './types';
import { 
  INITIAL_USERS, 
  INITIAL_AGENTS_STATE, 
  INITIAL_ALERTS, 
  INITIAL_DAILY_REPORTS,
  INITIAL_GEOFENCES
} from './data/mockData';
import { checkForAnomalies, calculateDistanceKm, hasShiftExceeded9Hours } from './utils/geoCalculations';
import { generateDailyPDFReport } from './services/pdfReportGenerator';

import { Header } from './components/Header';
import { AdminSupervisorDashboard } from './components/AdminSupervisorDashboard';
import { AgentMobileView } from './components/AgentMobileView';
import { LoginModal } from './components/LoginModal';
import { ReportsModal } from './components/ReportsModal';
import { AlertsDrawer } from './components/AlertsDrawer';
import { CorporateLoginGate } from './components/CorporateLoginGate';
import { CorporateSessionBar } from './components/CorporateSessionBar';
import { SystemConfigModal } from './components/SystemConfigModal';
import { AuditHistoryModal } from './components/AuditHistoryModal';
import { GpsAntiFraudModal } from './components/GpsAntiFraudModal';
import { AdminUiBuilderModal } from './components/AdminUiBuilderModal';
import { NativePdfReportModal, NativeReportMode } from './components/NativePdfReportModal';
import { ProductionVisitRegistrationModal } from './components/ProductionVisitRegistrationModal';
import { HierarchyCascadeBar } from './components/HierarchyCascadeBar';
import { CommercialPortfolioAnalysisView } from './components/CommercialPortfolioAnalysisView';
import { ReceivablesCollectionsView } from './components/ReceivablesCollectionsView';
import { GeoLatinaSystemProvider, useGeoLatinaSystem } from './context/GeoLatinaSystemContext';
import { canUserAccessTicConfig } from './services/latinaApiEngine';
import {
  CascadeFilterState,
  ClientPortfolioRecord,
  CollectionManagementStatus,
  ProductOpportunityRecommendation,
  ReceivableInvoiceRecord,
  applyInvoiceFollowUpToCollection,
  filterInvoicesByCascade,
  filterPortfolioByCascade,
  loadClientPortfolioFromCache,
  loadCommittedOpportunitiesFromCache,
  loadReceivableInvoicesFromCache,
  resolveEffectiveCascadeFilter,
  saveCommittedOpportunitiesToCache,
  saveReceivableInvoicesToCache,
  syncCommercialEventToLatinaWebApi,
} from './services/commercialIntelligenceEngine';
import { CustomGeofence } from './types';
import { ShieldAlert, Smartphone, Monitor, Plus, Settings, Users, CreditCard, Map as MapIcon } from 'lucide-react';

export default function App() {
  return (
    <GeoLatinaSystemProvider>
      <GeoLatinaApplicationCore />
      <SystemConfigModal />
      <AdminUiBuilderModal />
    </GeoLatinaSystemProvider>
  );
}

function GeoLatinaApplicationCore() {
  const {
    user: latinaSession,
    config: latinaConfig,
    uiConfig,
    auditLogs,
    gpsFraudAlerts,
    isAuditHistoryOpen,
    closeAuditHistoryModal,
    recordAuditAction,
    evaluateAndRecordGpsSample,
    switchActiveCorporateRole,
    openSysConfigModal,
  } = useGeoLatinaSystem();

  // Google Maps Platform Demo Key Quota Exceeded state
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Current user state (Default to Director General for full power, with easy 1-click switch)
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('geo_latina_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_USERS[0]; // Director General
  });

  // Sync authenticated Syspro corporate session with GEOLATINA user profile when logging in
  useEffect(() => {
    if (!latinaSession) return;
    const matchedUser = INITIAL_USERS.find(u => u.id === latinaSession.mappedGeoLatinaUserId);
    if (matchedUser) {
      setCurrentUser({
        ...matchedUser,
        name: latinaSession.nombreCompleto || matchedUser.name,
        role: latinaSession.mappedGeoLatinaRole || matchedUser.role,
        zone: latinaSession.sucursal || matchedUser.zone,
      });
      if (matchedUser.role === 'EJECUTIVO_VENTAS' || matchedUser.role === 'TRANSPORTISTA') {
        setSelectedAgentId(matchedUser.id);
      }
    } else {
      setCurrentUser({
        id: latinaSession.mappedGeoLatinaUserId || `usr-${latinaSession.usuario.toLowerCase()}`,
        name: latinaSession.nombreCompleto || latinaSession.usuario,
        email: `${latinaSession.usuario.toLowerCase()}@industriallatina.com`,
        role: latinaSession.mappedGeoLatinaRole || 'DIRECTOR_GENERAL',
        phone: '+593 99 412 8890',
        zone: latinaSession.sucursal || 'Matriz Guayaquil',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
      });
      if (latinaSession.mappedGeoLatinaRole === 'EJECUTIVO_VENTAS' || latinaSession.mappedGeoLatinaRole === 'TRANSPORTISTA') {
        setSelectedAgentId('agt-1');
      }
    }
  }, [latinaSession?.timestamp, latinaSession?.rol]);

  // Custom Geofences state
  const [customGeofences, setCustomGeofences] = useState<CustomGeofence[]>(() => {
    const saved = localStorage.getItem('geo_latina_geofences');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_GEOFENCES;
  });

  // Agents live state
  const [agents, setAgents] = useState<Record<string, AgentRealTimeState>>(() => {
    const saved = localStorage.getItem('geo_latina_agents');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure enriched CARLOS_VISITS fields are present
        if (parsed['agt-1'] && (!parsed['agt-1'].visits?.[0]?.clientRuc)) {
          return INITIAL_AGENTS_STATE;
        }
        return parsed;
      } catch (e) { /* ignore */ }
    }
    return INITIAL_AGENTS_STATE;
  });

  // Focused agent for map/reports
  const [selectedAgentId, setSelectedAgentId] = useState<string>('agt-1');

  // Alerts
  const [alerts, setAlerts] = useState<SuspiciousAlert[]>(() => {
    const saved = localStorage.getItem('geo_latina_alerts');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return INITIAL_ALERTS;
  });

  // Latest toast alert for immediate push banner
  const [latestToastAlert, setLatestToastAlert] = useState<SuspiciousAlert | null>(null);

  // Modals
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showReportsModal, setShowReportsModal] = useState<boolean>(false);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState<boolean>(false);
  const [nativePdfMode, setNativePdfMode] = useState<NativeReportMode | null>(null);
  const [showProductionVisitModal, setShowProductionVisitModal] = useState<boolean>(false);

  // Mode override: Allow supervisor/director to preview the mobile agent experience
  const [previewMode, setPreviewMode] = useState<'auto' | 'mobile' | 'dashboard'>('auto');

  // Primary module navigation: 'MAPA_GPS' | 'CLIENTES_ANALISIS_12M' | 'COBRANZAS_CARTERA'
  const [activePrimaryModule, setActivePrimaryModule] = useState<
    'MAPA_GPS' | 'CLIENTES_ANALISIS_12M' | 'COBRANZAS_CARTERA'
  >('MAPA_GPS');

  // ERP/CRM: Filtro Jerárquico en Cascada (Nivel 1: Supervisor/Zona -> Nivel 2: Ejecutivo -> Nivel 3: Cliente)
  const [cascadeFilter, setCascadeFilter] = useState<CascadeFilterState>({
    supervisorId: 'ALL',
    executiveId: 'ALL',
    clientId: 'ALL',
  });

  // ERP/CRM: Cartera de Clientes 12M, Facturas por Vencer y Compromisos de Potencialización (con caché en localStorage)
  const [clientPortfolio] = useState<ClientPortfolioRecord[]>(() =>
    loadClientPortfolioFromCache()
  );
  const [receivableInvoices, setReceivableInvoices] = useState<ReceivableInvoiceRecord[]>(() =>
    loadReceivableInvoicesFromCache()
  );
  const [committedOpportunities, setCommittedOpportunities] = useState<Record<string, string>>(() =>
    loadCommittedOpportunitiesFromCache()
  );

  // Real GPS watchPosition ref
  const watchIdRef = useRef<number | null>(null);

  // Sync state to localStorage for offline resilience
  useEffect(() => {
    localStorage.setItem('geo_latina_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('geo_latina_agents', JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    localStorage.setItem('geo_latina_alerts', JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem('geo_latina_geofences', JSON.stringify(customGeofences));
  }, [customGeofences]);

  const handleSaveGeofence = (geofence: CustomGeofence) => {
    setCustomGeofences(prev => {
      const idx = prev.findIndex(g => g.id === geofence.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = geofence;
        return copy;
      }
      return [geofence, ...prev];
    });
    recordAuditAction({
      eventType: 'CAMBIO_RUTA',
      detail: `Geocerca corporativa guardada/actualizada: "${geofence.name}" (${geofence.type}).`,
      lat: geofence.center?.lat,
      lng: geofence.center?.lng,
    });
  };

  const handleDeleteGeofence = (id: string) => {
    setCustomGeofences(prev => prev.filter(g => g.id !== id));
    recordAuditAction({
      eventType: 'CAMBIO_RUTA',
      detail: `Geocerca eliminada (ID: ${id}).`,
    });
  };

  const handleToggleGeofenceActive = (id: string, active: boolean) => {
    setCustomGeofences(prev => prev.map(g => g.id === id ? { ...g, active } : g));
  };

  const handleAssignGeofenceToAgent = (geofenceId: string, agentId: string) => {
    const geo = customGeofences.find(g => g.id === geofenceId);
    if (!geo) return;

    setAgents(prev => {
      const ag = prev[agentId];
      if (!ag) return prev;
      return {
        ...prev,
        [agentId]: {
          ...ag,
          assignedGeofence: {
            id: geo.id,
            name: geo.name,
            center: geo.center || { lat: -2.1700, lng: -79.9000 },
            radiusKm: geo.radiusKm || 10,
            coordinates: geo.coordinates,
          },
        },
      };
    });

    setCustomGeofences(prev => prev.map(g => {
      if (g.id === geofenceId && !g.assignedAgentIds.includes(agentId)) {
        return { ...g, assignedAgentIds: [...g.assignedAgentIds, agentId] };
      }
      return g;
    }));

    recordAuditAction({
      eventType: 'CAMBIO_RUTA',
      detail: `Geocerca "${geo.name}" asignada al agente ${agentId}.`,
      lat: geo.center?.lat,
      lng: geo.center?.lng,
    });
  };

  const handleSimulateGeofenceBreach = (agentId: string) => {
    // Simulate moving agent to coordinates outside their normal zone
    const outLat = -2.3100;
    const outLng = -79.9200;
    handleRecordGPSPoint(agentId, outLat, outLng, 42, 4, 'Vía Perimetral Sur - Fuera de Zona Autorizada');
  };

  // Real GPS hardware integration when agent has active shift
  useEffect(() => {
    const isAgent = currentUser.role === 'EJECUTIVO_VENTAS' || currentUser.role === 'TRANSPORTISTA';
    const agentData = agents[currentUser.id];

    if (isAgent && agentData?.currentStatus !== 'inactivo' && 'geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed: rawSpeed, accuracy, altitudeAccuracy } = position.coords;
          const currentSpeed = rawSpeed !== null ? rawSpeed * 3.6 : 32; // m/s to km/h

          handleRecordGPSPoint(
            currentUser.id,
            latitude,
            longitude,
            currentSpeed,
            accuracy,
            undefined,
            altitudeAccuracy,
            position.timestamp
          );
        },
        (error) => {
          console.warn('GPS hardware access warning:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 3000,
        }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [currentUser, agents[currentUser.id]?.currentStatus]);

  // Handle GPS point record (called by real GPS or simulation)
  const handleRecordGPSPoint = (
    agentId: string, 
    lat: number, 
    lng: number, 
    speed: number, 
    accuracy: number = 5,
    customAddress?: string,
    altitudeAccuracy: number | null = 4,
    positionTimestampMs: number = Date.now()
  ) => {
    const targetSnapshot = agents[agentId];
    if (targetSnapshot) {
      const prevHist = targetSnapshot.routeHistory;
      const lastPt = prevHist.length > 0 ? prevHist[prevHist.length - 1] : null;
      const recentAccuracies = prevHist.slice(-3).map(p => p.accuracy ?? 5);

      // Evaluate real-time Anti-Fraud GPS Integrity Heuristics for sales executives
      evaluateAndRecordGpsSample(
        {
          lat,
          lng,
          accuracy,
          altitudeAccuracy,
          speedKmh: speed,
          positionTimestamp: positionTimestampMs,
          systemTimestamp: Date.now(),
          previousLat: lastPt ? lastPt.lat : targetSnapshot.currentLocation.lat,
          previousLng: lastPt ? lastPt.lng : targetSnapshot.currentLocation.lng,
          previousTimestamp: lastPt ? new Date(lastPt.timestamp).getTime() : Date.now() - 120000,
          recentAccuracies,
        },
        {
          id: targetSnapshot.user.id,
          name: targetSnapshot.user.name,
          role: 'EJECUTIVO_VENTAS',
          sucursal: targetSnapshot.user.zone,
        }
      );

      recordAuditAction({
        eventType: 'PUNTO_GPS',
        detail: `Punto GPS registrado para ${targetSnapshot.user.name} (${customAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}) a ${Math.round(speed)} km/h (±${accuracy.toFixed(1)}m).`,
        lat,
        lng,
        alertState: 'NORMAL',
      });
    }

    setAgents(prev => {
      const targetAgent = prev[agentId];
      if (!targetAgent) return prev;

      const newPoint: RoutePoint = {
        lat,
        lng,
        timestamp: new Date().toISOString(),
        speed,
        accuracy,
        status: speed > 5 ? 'driving' : 'stopped',
        address: customAddress || `Punto GPS Registrado (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      };

      // Calculate incremental distance from previous position
      const addedKm = calculateDistanceKm(
        targetAgent.currentLocation.lat,
        targetAgent.currentLocation.lng,
        lat,
        lng
      );

      const updatedHistory = [...targetAgent.routeHistory, newPoint];
      const updatedKm = parseFloat((targetAgent.todayKm + addedKm).toFixed(2));

      // Check for anomalies & geofence violations
      const anomaly = checkForAnomalies(
        newPoint,
        updatedHistory,
        targetAgent.assignedGeofence,
        targetAgent.user.id,
        targetAgent.user.name,
        targetAgent.user.zone
      );

      if (anomaly) {
        // Trigger alert
        setAlerts(cur => [anomaly, ...cur]);
        setLatestToastAlert(anomaly);
      }

      return {
        ...prev,
        [agentId]: {
          ...targetAgent,
          currentLocation: { lat, lng },
          speed,
          todayKm: updatedKm,
          lastPing: 'En este instante',
          routeHistory: updatedHistory,
        },
      };
    });
  };

  // Simulate a realistic movement step for demonstrations
  const handleSimulateMovement = (agentId: string) => {
    const ag = agents[agentId];
    if (!ag) return;

    // Realistic small street step (~150-300m)
    const latDelta = (Math.random() - 0.45) * 0.0035;
    const lngDelta = (Math.random() - 0.45) * 0.0035;
    const newLat = ag.currentLocation.lat + latDelta;
    const newLng = ag.currentLocation.lng + lngDelta;
    const newSpeed = 25 + Math.random() * 30; // 25-55 km/h

    handleRecordGPSPoint(agentId, newLat, newLng, newSpeed, 4.2, 'Av. Comercial en tránsito');
  };

  // Periodic check for automatic 9-hour shift closure
  useEffect(() => {
    const check9HourLimit = () => {
      setAgents(prev => {
        let changed = false;
        const next = { ...prev };

        Object.entries(next).forEach(([id, agent]) => {
          if (
            (agent.currentStatus === 'activo_ruta' || agent.currentStatus === 'en_cliente') &&
            agent.shiftStartTimestamp &&
            hasShiftExceeded9Hours(agent.shiftStartTimestamp)
          ) {
            changed = true;
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            next[id] = {
              ...agent,
              currentStatus: 'cerrado_auto_9h',
              shiftEndTime: nowTime,
            };

            const autoAlert: SuspiciousAlert = {
              id: `cierre-9h-${Date.now()}-${id}`,
              agentId: id,
              agentName: agent.user.name,
              type: 'CIERRE_AUTO_9H',
              severity: 'alta',
              timestamp: new Date().toISOString(),
              lat: agent.currentLocation.lat,
              lng: agent.currentLocation.lng,
              description: `⚠️ Cierre automático de jornada: El ejecutivo ${agent.user.name} completó el límite de 9 horas de jornada continua. Sistema procedió al cierre automático obligatorio.`,
              resolved: false,
              zone: agent.user.zone,
            };

            setAlerts(cur => [autoAlert, ...cur]);
            setLatestToastAlert(autoAlert);
          }
        });

        return changed ? next : prev;
      });
    };

    const interval = setInterval(check9HourLimit, 15000);
    return () => clearInterval(interval);
  }, []);

  // Toggle shift on/off for agent
  const handleToggleShift = (agentId: string, active: boolean) => {
    const ag = agents[agentId];
    if (ag) {
      recordAuditAction({
        eventType: 'CAMBIO_RUTA',
        detail: `${active ? 'Inicio' : 'Finalización'} de jornada laboral en ruta por ${ag.user.name}.`,
        lat: ag.currentLocation.lat,
        lng: ag.currentLocation.lng,
      });
    }
    setAgents(prev => {
      const target = prev[agentId];
      if (!target) return prev;
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        ...prev,
        [agentId]: {
          ...target,
          currentStatus: active ? 'activo_ruta' : 'finalizado',
          shiftStartTimestamp: active ? (target.shiftStartTimestamp || Date.now()) : target.shiftStartTimestamp,
          activeShiftStartTime: active ? (target.activeShiftStartTime || nowStr) : target.activeShiftStartTime,
          shiftEndTime: active ? undefined : nowStr,
        },
      };
    });
  };

  // Simulate 9-hour limit reached for testing/demonstration
  const handleSimulate9HourLimit = (agentId: string) => {
    setAgents(prev => {
      const target = prev[agentId];
      if (!target) return prev;
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const autoAlert: SuspiciousAlert = {
        id: `cierre-9h-${Date.now()}-${agentId}`,
        agentId,
        agentName: target.user.name,
        type: 'CIERRE_AUTO_9H',
        severity: 'alta',
        timestamp: new Date().toISOString(),
        lat: target.currentLocation.lat,
        lng: target.currentLocation.lng,
        description: `⚠️ Cierre automático de jornada: El ejecutivo ${target.user.name} cumplió el límite reglamentario de 9 horas continuas. La jornada se ha cerrado automáticamente.`,
        resolved: false,
        zone: target.user.zone,
      };

      setAlerts(cur => [autoAlert, ...cur]);
      setLatestToastAlert(autoAlert);

      return {
        ...prev,
        [agentId]: {
          ...target,
          currentStatus: 'cerrado_auto_9h',
          shiftEndTime: nowTime,
          shiftStartTimestamp: Date.now() - (9 * 60 * 60 * 1000 + 60000), // Exceeded by 1 minute
        },
      };
    });
  };

  // Update client visit status (check-in, check-out, activity details)
  const handleUpdateVisitStatus = (
    agentId: string,
    visitId: string, 
    status: ClientVisit['status'], 
    activityDetails?: {
      activityType?: ActivityType;
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
  ) => {
    const agSnap = agents[agentId];
    const visSnap = agSnap?.visits.find(v => v.id === visitId);
    if (agSnap && visSnap) {
      recordAuditAction({
        eventType: 'VISITA_CLIENTE',
        detail: `Cliente "${visSnap.name}" actualizado a estado [${status.toUpperCase()}] por ${agSnap.user.name}.${
          activityDetails?.orderAmount ? ` Venta: $${activityDetails.orderAmount.toLocaleString()}` : ''
        }${activityDetails?.collectedAmount ? ` Cobro: $${activityDetails.collectedAmount.toLocaleString()}` : ''}`,
        lat: visSnap.lat,
        lng: visSnap.lng,
        alertState: 'NORMAL',
      });
    }

    setAgents(prev => {
      const target = prev[agentId];
      if (!target) return prev;

      const updatedVisits = target.visits.map(v => {
        if (v.id === visitId) {
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isComplete = status === 'completada';
          return {
            ...v,
            status,
            actualArrivalTime: status === 'en_visita' ? nowStr : v.actualArrivalTime,
            departureTime: isComplete ? (v.departureTime || nowStr) : v.departureTime,
            hasTachuelaPin: isComplete ? true : v.hasTachuelaPin,
            activityType: activityDetails?.activityType || v.activityType,
            orderAmount: activityDetails?.orderAmount !== undefined ? activityDetails.orderAmount : v.orderAmount,
            collectedAmount: activityDetails?.collectedAmount !== undefined ? activityDetails.collectedAmount : v.collectedAmount,
            invoiceOrReceiptNumber: activityDetails?.invoiceOrReceiptNumber || v.invoiceOrReceiptNumber,
            paymentMethod: activityDetails?.paymentMethod || v.paymentMethod,
            notes: activityDetails?.notes !== undefined ? activityDetails.notes : v.notes,
            evidenceUrl: activityDetails?.evidenceUrl || v.evidenceUrl,
            evidenceType: activityDetails?.evidenceType || v.evidenceType,
            durationMinutes: activityDetails?.durationMinutes !== undefined ? activityDetails.durationMinutes : (v.durationMinutes || 25),
            travelMinutesFromPrevious: activityDetails?.travelMinutesFromPrevious !== undefined ? activityDetails.travelMinutesFromPrevious : (v.travelMinutesFromPrevious || 15),
          };
        }
        return v;
      });

      return {
        ...prev,
        [agentId]: {
          ...target,
          currentStatus: status === 'en_visita' ? 'en_cliente' : (target.currentStatus === 'en_cliente' && status === 'completada' ? 'activo_ruta' : target.currentStatus),
          visits: updatedVisits,
        },
      };
    });
  };

  // Trigger Panic SOS
  const handleTriggerSOS = (agentId: string) => {
    const ag = agents[agentId];
    if (!ag) return;

    const sosAlert: SuspiciousAlert = {
      id: `sos-${Date.now()}`,
      agentId,
      agentName: ag.user.name,
      type: 'PANICO_SOS',
      severity: 'critica',
      timestamp: new Date().toISOString(),
      lat: ag.currentLocation.lat,
      lng: ag.currentLocation.lng,
      description: `¡BOTÓN DE PÁNICO ACTIVADO! El agente ${ag.user.name} ha emitido señal de auxilio en ruta.`,
      resolved: false,
      zone: ag.user.zone,
    };

    recordAuditAction({
      eventType: 'ALERTA_FRAUDE_GPS',
      detail: `¡BOTÓN SOS DE EMERGENCIA ACTIVADO! Ejecutivo: ${ag.user.name} en zona ${ag.user.zone}.`,
      lat: ag.currentLocation.lat,
      lng: ag.currentLocation.lng,
      alertState: 'CRITICA',
    });

    setAlerts(prev => [sosAlert, ...prev]);
    setLatestToastAlert(sosAlert);
  };

  // Resolve alert
  const handleResolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => {
      if (a.id === alertId) {
        return {
          ...a,
          resolved: true,
          resolvedBy: currentUser.name,
          resolvedAt: new Date().toISOString(),
        };
      }
      return a;
    }));
  };

  // Trigger manual simulated alert
  const handleTriggerSimulatedAlert = (type: AlertType) => {
    const ag = agents[selectedAgentId] || agents['agt-1'];
    const newAlert: SuspiciousAlert = {
      id: `alt-sim-${Date.now()}`,
      agentId: ag.user.id,
      agentName: ag.user.name,
      type,
      severity: type === 'PANICO_SOS' ? 'critica' : 'alta',
      timestamp: new Date().toISOString(),
      lat: ag.currentLocation.lat,
      lng: ag.currentLocation.lng,
      description: type === 'PARADA_PROLONGADA'
        ? `Detención prolongada no justificada de 22 minutos en zona no comercial.`
        : `Exceso de velocidad registrado: 89 km/h en vía regulada a 60 km/h.`,
      resolved: false,
      zone: ag.user.zone,
    };

    setAlerts(prev => [newAlert, ...prev]);
    setLatestToastAlert(newAlert);
  };

  // Export PDF helper: opens native auto-fitting A4 PDF preview AND triggers existing report generator
  const handleExportPDF = (agentId: string) => {
    const ag = agents[agentId] || agents[selectedAgentId] || agents['agt-1'];
    setSelectedAgentId(ag.user.id);
    setNativePdfMode('ACTIVIDADES_EJECUTIVO');

    recordAuditAction({
      eventType: 'EXPORTACION_REPORTE',
      detail: `Generación de Reporte Ejecutivo PDF de Ruta para ${ag.user.name} (${ag.user.zone}).`,
      lat: ag.currentLocation.lat,
      lng: ag.currentLocation.lng,
      alertState: 'NORMAL',
    });

    const agentAlerts = alerts.filter(a => a.agentId === ag.user.id);
    const completed = ag.visits.filter(v => v.status === 'completada').length;
    let totalSales = 0;
    ag.visits.forEach(v => {
      if (v.status === 'completada' && v.orderAmount) totalSales += v.orderAmount;
    });

    generateDailyPDFReport({
      report: {
        agentId: ag.user.id,
        agentName: ag.user.name,
        role: ag.user.role,
        date: new Date().toISOString().split('T')[0],
        shiftStart: ag.activeShiftStartTime || '08:00',
        shiftEnd: 'Cierre de Jornada',
        totalHours: '6h 30m',
        totalKm: ag.todayKm,
        plannedVisits: ag.visits.length,
        completedVisits: completed,
        visitCompliancePercent: ag.visits.length > 0 ? (completed / ag.visits.length) * 100 : 0,
        totalSalesOrders: totalSales,
        efficiencyScore: 89,
        alertsTriggered: agentAlerts.length,
        avgSpeed: 40.5,
        timeSpentInVisitsMinutes: 130,
        timeSpentDrivingMinutes: 115,
        supervisorSignature: 'Mariana Paredes - Jefa Regional de Ventas',
      },
      visits: ag.visits,
      alerts: agentAlerts,
      routePoints: ag.routeHistory,
      zoneName: ag.user.zone,
    });
  };

  // Production Visit Registration handler (creates or closes a real field visit with GPS & Reverse Geocoding)
  const handleRegisterVisitInField = (visitRecord: ClientVisit, isNewVisit: boolean) => {
    const targetAgentId = isSupervisorRole ? selectedAgentId : currentUser.id;
    handleRecordGPSPoint(
      targetAgentId,
      visitRecord.lat,
      visitRecord.lng,
      visitRecord.arrivalSpeedKmh || 0,
      visitRecord.gpsAccuracyMeters || 4.2,
      visitRecord.reverseGeocodedAddress || visitRecord.address
    );

    setAgents((prev) => {
      const target = prev[targetAgentId];
      if (!target) return prev;

      const updatedVisits = isNewVisit
        ? [...target.visits, visitRecord]
        : target.visits.map((v) => (v.id === visitRecord.id ? visitRecord : v));

      return {
        ...prev,
        [targetAgentId]: {
          ...target,
          currentLocation: { lat: visitRecord.lat, lng: visitRecord.lng },
          visits: updatedVisits,
        },
      };
    });
  };

  // Determine which UI to show:
  const isSupervisorRole = currentUser.role === 'DIRECTOR_GENERAL' || currentUser.role === 'SUPERVISOR_REGIONAL';
  const shouldShowDashboard = previewMode === 'dashboard' || (previewMode === 'auto' && isSupervisorRole);

  const activeAgentForMobile = isSupervisorRole
    ? (agents[selectedAgentId] || agents['agt-1'])
    : (agents[currentUser.id] || agents['agt-1']);

  const allAgentsList = Object.values(agents);

  // Resolver el Filtro Jerárquico en Cascada según el rol autenticado
  const effectiveCascade = resolveEffectiveCascadeFilter(latinaSession, cascadeFilter);

  // Cartera de clientes disponible para el selector Nivel 3 (filtrada por Supervisor + Ejecutivo)
  const cascadeAvailableClients = filterPortfolioByCascade(clientPortfolio, {
    effectiveSupervisorId: effectiveCascade.effectiveSupervisorId,
    effectiveExecutiveId: effectiveCascade.effectiveExecutiveId,
    effectiveClientId: 'ALL',
  });

  // Cartera de clientes y facturas filtradas por los 3 niveles de la cascada
  const cascadeFilteredClients = filterPortfolioByCascade(clientPortfolio, {
    effectiveSupervisorId: effectiveCascade.effectiveSupervisorId,
    effectiveExecutiveId: effectiveCascade.effectiveExecutiveId,
    effectiveClientId: effectiveCascade.effectiveClientId,
  });

  const cascadeFilteredInvoices = filterInvoicesByCascade(receivableInvoices, {
    effectiveSupervisorId: effectiveCascade.effectiveSupervisorId,
    effectiveExecutiveId: effectiveCascade.effectiveExecutiveId,
    effectiveClientId: effectiveCascade.effectiveClientId,
  });

  // Filtrar la lista de ejecutivos en el mapa según la cascada activa (sin dejar vacía la lista)
  const allowedExecIds = new Set(effectiveCascade.availableExecutives.map((e) => e.id));
  const cascadeAgentsList = allAgentsList.filter((ag) => {
    if (effectiveCascade.effectiveExecutiveId !== 'ALL') {
      return ag.user.id === effectiveCascade.effectiveExecutiveId;
    }
    return allowedExecIds.has(ag.user.id);
  });
  const effectiveAgentsForMap = cascadeAgentsList.length > 0 ? cascadeAgentsList : allAgentsList;

  const handleCascadeChange = (next: CascadeFilterState) => {
    setCascadeFilter(next);
    if (next.executiveId !== 'ALL' && agents[next.executiveId]) {
      setSelectedAgentId(next.executiveId);
    }
  };

  // Agendar compromiso de potencialización (Latina / Induless) en visita y bitácora diaria
  const handleScheduleOpportunityCommitment = (
    client: ClientPortfolioRecord,
    opportunity: ProductOpportunityRecommendation
  ) => {
    const nowTime = new Date().toLocaleTimeString('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setCommittedOpportunities((prev) => {
      const updated = { ...prev, [opportunity.id]: `Hoy ${nowTime}` };
      saveCommittedOpportunitiesToCache(updated);
      return updated;
    });

    recordAuditAction({
      eventType: 'VISITA_CLIENTE',
      alertState: 'NORMAL',
      lat: client.lat,
      lng: client.lng,
      detail: `[POTENCIALIZACIÓN ${opportunity.brand}] Compromiso agendado en visita/proforma para "${client.razonSocial}" (RUC: ${client.ruc}): ${opportunity.sku} ${opportunity.productName} — Meta: ${opportunity.suggestedGoalQty} ${opportunity.unitLabel} (+$${opportunity.estimatedMonthlyExtraUsd.toLocaleString('en-US')}/mes).`,
    });

    syncCommercialEventToLatinaWebApi(
      latinaConfig.productOpportunitiesEndpoint,
      {
        clientId: client.id,
        clientRuc: client.ruc,
        opportunityId: opportunity.id,
        sku: opportunity.sku,
        brand: opportunity.brand,
        category: opportunity.category,
        suggestedGoalQty: opportunity.suggestedGoalQty,
        estimatedMonthlyExtraUsd: opportunity.estimatedMonthlyExtraUsd,
        committedBy: currentUser.name,
        timestamp: new Date().toISOString(),
      },
      latinaConfig,
      latinaSession
    );
  };

  // Registrar seguimiento de cobro de factura en cartera, bitácora y LatinaWebApi
  const handleRegisterInvoiceFollowUp = (params: {
    invoiceId: string;
    status: CollectionManagementStatus;
    promiseDate: string;
    reminderTime: string;
    receiptNumber: string;
    committedOrPaidAmountUsd: number;
    notes: string;
  }) => {
    const { updatedInvoices, createdFollowUp, targetInvoice } = applyInvoiceFollowUpToCollection(
      receivableInvoices,
      {
        ...params,
        registeredBy: currentUser.name,
        registeredRole: latinaSession?.rol || currentUser.role,
      }
    );

    setReceivableInvoices(updatedInvoices);
    saveReceivableInvoicesToCache(updatedInvoices);

    if (targetInvoice) {
      recordAuditAction({
        eventType: 'CONSULTA_CLIENTE',
        alertState: 'NORMAL',
        detail: `[GESTIÓN DE COBRO - ${targetInvoice.invoiceNumber}] Cliente "${targetInvoice.clientName}" -> Estado: ${createdFollowUp.status} | Compromiso/Abono: $${createdFollowUp.committedOrPaidAmountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Promesa: ${createdFollowUp.promiseDate} (${createdFollowUp.reminderTime}) | Comp: ${createdFollowUp.receiptNumber}.`,
      });

      syncCommercialEventToLatinaWebApi(
        latinaConfig.invoicesCollectionsEndpoint,
        {
          invoiceNumber: targetInvoice.invoiceNumber,
          clientRuc: targetInvoice.clientRuc,
          followUp: createdFollowUp,
          pendingBalanceUsd: targetInvoice.pendingBalanceUsd,
        },
        latinaConfig,
        latinaSession
      );
    }
  };

  // Navegar directamente desde la tarjeta de un cliente a Google Maps / Iniciar Visita
  const handleNavigateToClientOnMap = (client: ClientPortfolioRecord) => {
    if (agents[client.executiveId]) {
      setSelectedAgentId(client.executiveId);
    }
    setActivePrimaryModule('MAPA_GPS');
    setPreviewMode('dashboard');
    handleRecordGPSPoint(
      agents[client.executiveId] ? client.executiveId : selectedAgentId,
      client.lat,
      client.lng,
      0,
      4.0,
      `${client.razonSocial} — ${client.sector}`
    );
    setShowProductionVisitModal(true);
  };

  // Módulo 1: Login Gate Corporativo — si no existe sesión válida en geolatina_user_session, mostrar pantalla de inicio de sesión
  if (!latinaSession) {
    return <CorporateLoginGate />;
  }

  return (
    <div id="app" className="w-screen max-w-full min-h-[100dvh] bg-[var(--geo-bg-primary,#070d1e)] text-[var(--geo-text-primary,#f8fafc)] flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden m-0 p-0">
      {/* Google Maps Platform Demo Key Quota Exceeded Banner */}
      {quotaExceeded && (
        <div role="alert" className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-50 border-b border-amber-300 px-4 py-2.5 text-sm text-amber-900 w-full">
          <span>
            Google Maps quota reached — map features are paused. To keep using Maps,{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              link your Google Cloud project
            </a>
            .
          </span>
          <button onClick={() => setQuotaExceeded(false)} aria-label="Dismiss" className="text-amber-700 hover:text-amber-900">✕</button>
        </div>
      )}

      {/* Módulo 7: Barra Superior Corporativa de Sesión Activa (GEOLATINA | LatinaSoft Conectado) */}
      <CorporateSessionBar />

      {/* Top Main Navigation Header */}
      <Header
        currentUser={currentUser}
        onOpenAlerts={() => setShowAlertsDrawer(true)}
        onOpenReports={() => setShowReportsModal(true)}
        onSwitchUser={() => setShowLoginModal(true)}
        activeAlerts={alerts}
        isTrackingActive={agents[selectedAgentId]?.currentStatus !== 'inactivo'}
      />

      {/* Real-time Push Alert Banner (immediate notification) */}
      {latestToastAlert && !latestToastAlert.resolved && (
        <div className="w-full bg-gradient-to-r from-red-600 via-rose-700 to-red-800 text-white px-4 py-2.5 shadow-2xl flex items-center justify-between z-40 animate-in slide-in-from-top duration-300">
          <div className="w-full max-w-full flex flex-wrap items-center gap-3">
            <span className="p-1 bg-white/20 rounded-full animate-ping shrink-0">
              <ShieldAlert className="w-5 h-5 text-white" />
            </span>
            <div className="text-xs sm:text-sm flex-1 min-w-[200px]">
              <strong className="font-black uppercase tracking-wider">
                ⚠️ ALERTA INMEDIATA EN RUTA: {latestToastAlert.type.replace(/_/g, ' ')}
              </strong>
              <span className="ml-2 opacity-95">
                {latestToastAlert.description} — <b>{latestToastAlert.agentName}</b>
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setSelectedAgentId(latestToastAlert.agentId);
                  setActivePrimaryModule('MAPA_GPS');
                  setShowAlertsDrawer(true);
                }}
                className="px-2.5 py-1 bg-white text-slate-950 font-bold text-xs rounded-lg shadow hover:bg-slate-100 transition-colors"
              >
                Ver en Mapa
              </button>
              <button
                onClick={() => setLatestToastAlert(null)}
                className="p-1 hover:bg-white/20 rounded text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-header Mode & Primary ERP/CRM Module Switcher Bar */}
      <div className="w-full bg-slate-950/90 border-b border-slate-800/80 px-3 sm:px-4 py-2 shrink-0">
        <div className="w-full max-w-full flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex flex-wrap items-center gap-2 text-slate-400">
            <span>Sesión activa: <strong className="text-amber-400">{currentUser.name}</strong> (<code className="text-slate-200">{latinaSession.usuario}</code>)</span>
            <span className="text-slate-600">|</span>
            <span>Perfil: <strong className="text-slate-200">{latinaSession.rol}</strong> ({currentUser.role})</span>
            {canUserAccessTicConfig(latinaSession) && (
              <>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={openSysConfigModal}
                  className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Configuraciones de Conexiones — Área de TIC (Exclusivo Perfil ADMIN y Usuario XBRIONES)"
                >
                  <Settings className="w-3 h-3 text-amber-400" />
                  <span>Conexiones TIC</span>
                </button>
              </>
            )}
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="hidden md:inline text-emerald-400 font-semibold">
              Bitácora Hoy: {auditLogs.length} eventos
            </span>
          </div>

          {/* Navegación Principal de Módulos ERP/CRM + Controles de Vista */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Módulos Principales GEOLATINA ERP/CRM"
              className="flex flex-wrap items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700/80 gap-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activePrimaryModule === 'MAPA_GPS'}
                onClick={() => setActivePrimaryModule('MAPA_GPS')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activePrimaryModule === 'MAPA_GPS'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 shrink-0" />
                <span>🗺️ Mapa y Control Satelital</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activePrimaryModule === 'CLIENTES_ANALISIS_12M'}
                onClick={() => setActivePrimaryModule('CLIENTES_ANALISIS_12M')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activePrimaryModule === 'CLIENTES_ANALISIS_12M'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>👥 Mis Clientes y Análisis Comercial</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activePrimaryModule === 'COBRANZAS_CARTERA'}
                onClick={() => setActivePrimaryModule('COBRANZAS_CARTERA')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activePrimaryModule === 'COBRANZAS_CARTERA'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span>💳 Facturas por Vencer y Seguimiento de Cobros</span>
              </button>
            </div>

            <button
              onClick={() => setShowProductionVisitModal(true)}
              className="px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>➕ Registrar / Cerrar Visita</span>
            </button>
            <button
              onClick={() => setNativePdfMode('ACTIVIDADES_EJECUTIVO')}
              className="px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
            >
              📄 Vista Previa PDF A4
            </button>
            <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              <button
                onClick={() => {
                  setActivePrimaryModule('MAPA_GPS');
                  setPreviewMode('dashboard');
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  activePrimaryModule === 'MAPA_GPS' && shouldShowDashboard
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Panel Central</span>
              </button>
              <button
                onClick={() => {
                  setActivePrimaryModule('MAPA_GPS');
                  setPreviewMode('mobile');
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  activePrimaryModule === 'MAPA_GPS' && !shouldShowDashboard
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Móvil Agente</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Módulo 1 ERP/CRM: Barra Superior de Filtro Jerárquico en Cascada (Roll-Up & Drill-Down) */}
      <HierarchyCascadeBar
        roleName={latinaSession.rol}
        hierarchyLevel={effectiveCascade.hierarchyLevel}
        canSelectSupervisor={effectiveCascade.canSelectSupervisor}
        canSelectExecutive={effectiveCascade.canSelectExecutive}
        availableSupervisors={effectiveCascade.availableSupervisors}
        availableExecutives={effectiveCascade.availableExecutives}
        availableClients={cascadeAvailableClients}
        effectiveSupervisorId={effectiveCascade.effectiveSupervisorId}
        effectiveExecutiveId={effectiveCascade.effectiveExecutiveId}
        effectiveClientId={effectiveCascade.effectiveClientId}
        filteredClients={cascadeFilteredClients}
        filteredInvoices={cascadeFilteredInvoices}
        onChangeCascade={handleCascadeChange}
        onResetCascade={() =>
          setCascadeFilter({ supervisorId: 'ALL', executiveId: 'ALL', clientId: 'ALL' })
        }
      />

      {/* Main View Display (Responsive Layout supporting TOP_BAR, LEFT_SIDEBAR, RIGHT_SIDEBAR) */}
      <div
        className={`flex-1 w-full max-w-full min-h-[calc(100dvh-168px)] flex ${
          uiConfig.navPosition === 'LEFT_SIDEBAR'
            ? 'flex-col lg:flex-row'
            : uiConfig.navPosition === 'RIGHT_SIDEBAR'
            ? 'flex-col lg:flex-row-reverse'
            : 'flex-col'
        }`}
      >
        {(uiConfig.navPosition === 'LEFT_SIDEBAR' || uiConfig.navPosition === 'RIGHT_SIDEBAR') && (
          <aside className="w-full lg:w-64 bg-slate-950/90 border-b lg:border-b-0 lg:border-x border-slate-800 p-4 space-y-3 shrink-0">
            <div className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              Navegación Rápida ({uiConfig.navPosition === 'LEFT_SIDEBAR' ? 'Lateral Izq.' : 'Lateral Der.'})
            </div>
            <div className="space-y-1.5 text-xs">
              <button
                onClick={() => {
                  setActivePrimaryModule('MAPA_GPS');
                  setPreviewMode('dashboard');
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold border border-slate-800"
              >
                🖥️ Panel Central de Control
              </button>
              <button
                onClick={() => setActivePrimaryModule('CLIENTES_ANALISIS_12M')}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 font-semibold border border-slate-800"
              >
                👥 Mis Clientes y Análisis Comercial (12M)
              </button>
              <button
                onClick={() => setActivePrimaryModule('COBRANZAS_CARTERA')}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 font-semibold border border-slate-800"
              >
                💳 Facturas por Vencer y Cobranzas
              </button>
              <button
                onClick={() => {
                  setActivePrimaryModule('MAPA_GPS');
                  setPreviewMode('mobile');
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold border border-slate-800"
              >
                📱 Rutero Móvil Ejecutivo
              </button>
              <button
                onClick={() => setNativePdfMode('ACTIVIDADES_EJECUTIVO')}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold border border-slate-800"
              >
                📄 Reporte Ejecutivo PDF A4
              </button>
            </div>
          </aside>
        )}

        <main className="flex-1 w-full max-w-full min-h-[calc(100dvh-168px)] flex flex-col min-w-0 p-0 m-0">
          {activePrimaryModule === 'CLIENTES_ANALISIS_12M' ? (
            <CommercialPortfolioAnalysisView
              clients={cascadeFilteredClients}
              selectedClientId={effectiveCascade.effectiveClientId}
              onSelectClient={(clientId) =>
                setCascadeFilter((prev) => ({ ...prev, clientId }))
              }
              committedOpportunities={committedOpportunities}
              onScheduleOpportunityCommitment={handleScheduleOpportunityCommitment}
              onNavigateToClientOnMap={handleNavigateToClientOnMap}
            />
          ) : activePrimaryModule === 'COBRANZAS_CARTERA' ? (
            <ReceivablesCollectionsView
              invoices={cascadeFilteredInvoices}
              scopeLabel={`${latinaSession.rol} — ${currentUser.name}`}
              currentUserName={currentUser.name}
              currentUserRole={latinaSession.rol}
              onRegisterInvoiceFollowUp={handleRegisterInvoiceFollowUp}
            />
          ) : shouldShowDashboard ? (
            <AdminSupervisorDashboard
              currentUser={currentUser}
              agents={effectiveAgentsForMap}
              selectedAgentId={selectedAgentId}
              onSelectAgent={(id) => {
                setSelectedAgentId(id);
                const ag = agents[id];
                if (ag) {
                  recordAuditAction({
                    eventType: 'CONSULTA_CLIENTE',
                    detail: `Consulta de telemetría y rutero del ejecutivo ${ag.user.name} (${ag.user.zone}).`,
                    lat: ag.currentLocation.lat,
                    lng: ag.currentLocation.lng,
                  });
                }
              }}
              alerts={alerts}
              onResolveAlert={handleResolveAlert}
              onExportPDF={handleExportPDF}
              onOpenRegisterVisitModal={() => setShowProductionVisitModal(true)}
              onAddNewAlert={(a) => {
                setAlerts(cur => [a, ...cur]);
                setLatestToastAlert(a);
              }}
              customGeofences={customGeofences}
              onSaveGeofence={handleSaveGeofence}
              onDeleteGeofence={handleDeleteGeofence}
              onToggleGeofenceActive={handleToggleGeofenceActive}
              onAssignGeofenceToAgent={handleAssignGeofenceToAgent}
            />
          ) : (
            <AgentMobileView
              agentState={activeAgentForMobile}
              onToggleShift={(active) => handleToggleShift(activeAgentForMobile.user.id, active)}
              onUpdateVisitStatus={(vId, status, activityDetails) =>
                handleUpdateVisitStatus(activeAgentForMobile.user.id, vId, status, activityDetails)
              }
              onTriggerSOS={() => handleTriggerSOS(activeAgentForMobile.user.id)}
              onOpenReport={() => setShowReportsModal(true)}
              onOpenRegisterVisitModal={() => setShowProductionVisitModal(true)}
            />
          )}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      {showLoginModal && (
        <LoginModal
          currentUser={currentUser}
          onSelectUser={(u) => {
            setCurrentUser(u);
            if (u.role === 'EJECUTIVO_VENTAS' || u.role === 'TRANSPORTISTA') {
              setSelectedAgentId(u.id);
              switchActiveCorporateRole('EJECUTIVO_VENTAS', u.name, u.id);
            } else if (u.role === 'SUPERVISOR_REGIONAL') {
              switchActiveCorporateRole('SUPERVISOR', u.name, u.id);
            } else {
              switchActiveCorporateRole('ADMINISTRADOR', u.name, u.id);
            }
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {showReportsModal && (
        <ReportsModal
          agents={allAgentsList}
          alerts={alerts}
          onClose={() => setShowReportsModal(false)}
        />
      )}

      <AlertsDrawer
        isOpen={showAlertsDrawer}
        alerts={alerts}
        onClose={() => setShowAlertsDrawer(false)}
        onResolveAlert={handleResolveAlert}
        onTriggerSimulatedAlert={handleTriggerSimulatedAlert}
      />

      {/* Módulo 3: Bitácora Diaria Automática, Descarga y Consulta Histórica */}
      <AuditHistoryModal
        isOpen={isAuditHistoryOpen}
        onClose={closeAuditHistoryModal}
        onOpenNativePdfReport={() => {
          closeAuditHistoryModal();
          setNativePdfMode('HISTORIAL_BITACORA');
        }}
        executiveNames={allAgentsList.map((a) => a.user.name)}
      />

      {/* Módulo 4: Detector Anti-Fraude GPS y Alertas Jerárquicas (Supervisor+) */}
      <GpsAntiFraudModal
        onFocusExecutiveOnMap={(executiveId, lat, lng) => {
          if (agents[executiveId]) {
            setSelectedAgentId(executiveId);
          }
          setPreviewMode('dashboard');
          handleRecordGPSPoint(
            agents[executiveId] ? executiveId : selectedAgentId,
            lat,
            lng,
            0,
            3,
            'Coordenada auditada por Alerta Anti-Fraude GPS'
          );
        }}
        onOpenFraudPdfReport={() => setNativePdfMode('ALERTAS_UBICACION_GPS')}
      />

      {/* Módulo 5: Generador Nativo de Reportes PDF Estructurados y Autoajustables */}
      <NativePdfReportModal
        isOpen={nativePdfMode !== null}
        initialMode={nativePdfMode || 'ACTIVIDADES_EJECUTIVO'}
        selectedAgentId={selectedAgentId}
        agents={allAgentsList}
        alerts={alerts}
        auditLogs={auditLogs}
        fraudAlerts={gpsFraudAlerts}
        onClose={() => setNativePdfMode(null)}
      />

      {/* Módulo Producción: Registro Real de Visita en Ubicación Actual */}
      <ProductionVisitRegistrationModal
        isOpen={showProductionVisitModal}
        onClose={() => setShowProductionVisitModal(false)}
        currentLocation={activeAgentForMobile.currentLocation}
        existingVisits={activeAgentForMobile.visits}
        executiveId={activeAgentForMobile.user.id}
        executiveName={activeAgentForMobile.user.name}
        executiveZone={activeAgentForMobile.user.zone}
        onRegisterVisitInField={handleRegisterVisitInField}
      />
    </div>
  );
}
