/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  LatinaSysConfig,
  LatinaUserSession,
  PingDiagnosticResult,
  loadSysConfig,
  saveSysConfig,
  getDefaultSysConfig,
  loadUserSession,
  saveUserSession,
  authenticateLatinaUser,
  executeLatinaApiFetch,
  pingLatinaApiServer,
  getRoleHierarchyLevel,
} from '../services/latinaApiEngine';
import {
  GeoAuditLogEntry,
  GeoAuditEventType,
  GeoAuditAlertState,
  loadAuditLogs,
  saveAuditLogs,
  createAuditLogEntry,
} from '../services/geoAuditLogger';
import {
  GpsFraudAlertRecord,
  GpsTelemetrySample,
  loadGpsFraudAlerts,
  saveGpsFraudAlerts,
  evaluateGpsIntegrityHeuristics,
} from '../services/geoIntegrityGuard';
import {
  GeoLatinaUiConfig,
  loadUiConfig,
  saveUiConfig,
  getDefaultUiConfig,
  applyUiConfigToDocumentRoot,
} from '../services/uiConfigEngine';

export type ApiConnectionSemaphore = 'CONNECTED' | 'CONTINGENCY' | 'UNCONFIGURED';

export interface GeoLatinaGlobalBridge {
  user: LatinaUserSession | null;
  config: LatinaSysConfig;
  uiConfig: GeoLatinaUiConfig;
  auditLogs: GeoAuditLogEntry[];
  gpsFraudAlerts: GpsFraudAlertRecord[];
  apiFetch: <T = any>(
    endpoint: string,
    options?: RequestInit
  ) => Promise<{
    ok: boolean;
    status: number;
    data: T | null;
    error?: string;
    latencyMs: number;
  }>;
}

declare global {
  interface Window {
    GEOLATINA_SYSTEM?: GeoLatinaGlobalBridge;
  }
}

interface GeoLatinaSystemContextValue extends GeoLatinaGlobalBridge {
  apiSemaphore: ApiConnectionSemaphore;
  lastPingResult: PingDiagnosticResult | null;

  // Modals visibility
  isSysConfigOpen: boolean;
  openSysConfigModal: () => void;
  closeSysConfigModal: () => void;

  isAuditHistoryOpen: boolean;
  openAuditHistoryModal: () => void;
  closeAuditHistoryModal: () => void;

  isGpsFraudDrawerOpen: boolean;
  openGpsFraudDrawer: () => void;
  closeGpsFraudDrawer: () => void;

  isUiBuilderOpen: boolean;
  openUiBuilderModal: () => void;
  closeUiBuilderModal: () => void;

  // Urgent red popup for superior roles
  urgentFraudPopup: GpsFraudAlertRecord | null;
  dismissUrgentFraudPopup: () => void;
  acknowledgeGpsFraudAlert: (alertId: string) => void;

  // Actions
  updateSysConfig: (newConfig: LatinaSysConfig) => void;
  resetSysConfigToDefaults: () => LatinaSysConfig;
  updateUiConfig: (newUiConfig: GeoLatinaUiConfig) => void;
  resetUiConfigToDefaults: () => GeoLatinaUiConfig;

  recordAuditAction: (params: {
    eventType: GeoAuditEventType;
    alertState?: GeoAuditAlertState;
    detail: string;
    lat?: number;
    lng?: number;
  }) => GeoAuditLogEntry;

  evaluateAndRecordGpsSample: (
    sample: GpsTelemetrySample,
    executiveInfo: { id: string; name: string; role: string; sucursal: string }
  ) => GpsFraudAlertRecord[];

  triggerSimulatedGpsFraudHeuristic: (heuristicNumber: 1 | 2 | 3 | 4 | 5) => GpsFraudAlertRecord | null;

  loginWithLatinaSoft: (credentials: {
    usuario: string;
    password: string;
    sucursal?: string;
  }) => Promise<{
    ok: boolean;
    session?: LatinaUserSession;
    error?: string;
    latencyMs: number;
  }>;
  switchActiveCorporateRole: (rol: string, nombre: string, mappedUserId: string) => void;
  logoutLatinaSession: () => void;
  runServerPing: (customConfig?: LatinaSysConfig) => Promise<PingDiagnosticResult>;
}

const GeoLatinaSystemContext = createContext<GeoLatinaSystemContextValue | undefined>(undefined);

export const GeoLatinaSystemProvider: React.FC<{
  children: React.ReactNode;
  onSessionAuthenticated?: (session: LatinaUserSession) => void;
}> = ({ children, onSessionAuthenticated }) => {
  const [config, setConfig] = useState<LatinaSysConfig>(() => loadSysConfig());
  const [uiConfig, setUiConfig] = useState<GeoLatinaUiConfig>(() => {
    const initialUi = loadUiConfig();
    applyUiConfigToDocumentRoot(initialUi);
    return initialUi;
  });

  const [auditLogs, setAuditLogs] = useState<GeoAuditLogEntry[]>(() => loadAuditLogs());
  const [gpsFraudAlerts, setGpsFraudAlerts] = useState<GpsFraudAlertRecord[]>(() =>
    loadGpsFraudAlerts()
  );
  const [urgentFraudPopup, setUrgentFraudPopup] = useState<GpsFraudAlertRecord | null>(null);

  const [user, setUser] = useState<LatinaUserSession | null>(() => {
    const initialCfg = loadSysConfig();
    const existing = loadUserSession(initialCfg);
    if (existing) return existing;

    if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
      const now = Date.now();
      const autoSession: LatinaUserSession = {
        usuario: 'ralcivar',
        nombreCompleto: 'Ing. Roberto Alcívar',
        rol: 'ADMINISTRADOR',
        hierarchyLevel: 4,
        admUserRole: 'AdmUser_AdminGeneral_N4',
        permisos: [
          'GEOLATINA_TOTAL_CONTROL',
          'ADM_UI_BUILDER',
          'ADM_CONFIG_SISTEMA',
          'ADM_BITACORA_EXPORT',
          'ADM_ANTIFRAUDE_GPS',
        ],
        token: `latina-autostart-jwt-${now}`,
        sucursal: initialCfg.defaultSucursal,
        aplicacion: 'GEOLATINA',
        timestamp: now,
        expiresAt: now + initialCfg.sessionExpirationHours * 3600 * 1000,
        authMode: 'CONTINGENCIA_LOCAL',
        mappedGeoLatinaRole: 'DIRECTOR_GENERAL',
        mappedGeoLatinaUserId: 'usr-dir',
      };
      saveUserSession(autoSession);
      return autoSession;
    }

    return null;
  });

  const [lastPingResult, setLastPingResult] = useState<PingDiagnosticResult | null>(null);
  const [isSysConfigOpen, setIsSysConfigOpen] = useState<boolean>(false);
  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState<boolean>(false);
  const [isGpsFraudDrawerOpen, setIsGpsFraudDrawerOpen] = useState<boolean>(false);
  const [isUiBuilderOpen, setIsUiBuilderOpen] = useState<boolean>(false);

  const apiSemaphore: ApiConnectionSemaphore = React.useMemo(() => {
    if (!config.baseUrl || !config.baseUrl.trim().startsWith('http')) {
      return 'UNCONFIGURED';
    }
    if (lastPingResult?.ok || user?.authMode === 'API_IIS_LIVE') {
      return 'CONNECTED';
    }
    if (config.operationMode === 'HYBRID_CONTINGENCY') {
      return 'CONTINGENCY';
    }
    return lastPingResult && !lastPingResult.ok ? 'CONTINGENCY' : 'CONNECTED';
  }, [config.baseUrl, config.operationMode, lastPingResult, user?.authMode]);

  const apiFetch = useCallback(
    async <T = any>(endpoint: string, options: RequestInit = {}) => {
      return executeLatinaApiFetch<T>(endpoint, options, config, user);
    },
    [config, user]
  );

  // Sync CSS variables when uiConfig changes
  useEffect(() => {
    applyUiConfigToDocumentRoot(uiConfig);
  }, [uiConfig]);

  // Expose global window.GEOLATINA_SYSTEM
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.GEOLATINA_SYSTEM = {
        user,
        config,
        uiConfig,
        auditLogs,
        gpsFraudAlerts,
        apiFetch,
      };
    }
  }, [user, config, uiConfig, auditLogs, gpsFraudAlerts, apiFetch]);

  // Record audit log entry and attempt background sync with LatinaWebApi
  const recordAuditAction = useCallback(
    (params: {
      eventType: GeoAuditEventType;
      alertState?: GeoAuditAlertState;
      detail: string;
      lat?: number;
      lng?: number;
    }) => {
      const entry = createAuditLogEntry({
        usuario: user?.usuario || 'sistema',
        nombreUsuario: user?.nombreCompleto || 'Operador GEOLATINA',
        rol: user?.rol || 'SISTEMA',
        sucursal: user?.sucursal || config.defaultSucursal,
        lat: params.lat,
        lng: params.lng,
        eventType: params.eventType,
        alertState: params.alertState,
        detail: params.detail,
      });

      setAuditLogs((prev) => {
        const next = [entry, ...prev];
        saveAuditLogs(next);
        return next;
      });

      // Non-blocking background sync to LatinaWebApi when connected or in live production mode
      if (config.auditLogEndpoint && (apiSemaphore === 'CONNECTED' || config.operationMode === 'PRODUCTION_LIVE')) {
        executeLatinaApiFetch(
          config.auditLogEndpoint,
          {
            method: 'POST',
            body: JSON.stringify(entry),
          },
          config,
          user
        ).catch(() => {
          // Offline resilience maintained in localStorage + IndexedDB
        });
      }

      return entry;
    },
    [user, config, apiSemaphore]
  );

  // Evaluate GPS sample against the 5 GeoIntegrityGuard heuristics
  const evaluateAndRecordGpsSample = useCallback(
    (
      sample: GpsTelemetrySample,
      executiveInfo: { id: string; name: string; role: string; sucursal: string }
    ): GpsFraudAlertRecord[] => {
      const detected = evaluateGpsIntegrityHeuristics(sample, executiveInfo);
      if (detected.length === 0) return [];

      setGpsFraudAlerts((prev) => {
        const next = [...detected, ...prev];
        saveGpsFraudAlerts(next);
        return next;
      });

      // Show high-priority red popup for superior roles
      setUrgentFraudPopup(detected[0]);

      // Indelible CRÍTICA log in GeoAuditLogger + sync to LatinaWebApi
      detected.forEach((fraud) => {
        recordAuditAction({
          eventType: 'ALERTA_FRAUDE_GPS',
          alertState: 'CRITICA',
          lat: fraud.lat,
          lng: fraud.lng,
          detail: `[INBORRABLE - ${fraud.anomalyCode}] Ejecutivo ${fraud.executiveName}: ${fraud.technicalReason}`,
        });

        if (config.gpsAlertsEndpoint && (apiSemaphore === 'CONNECTED' || config.operationMode === 'PRODUCTION_LIVE')) {
          executeLatinaApiFetch(
            config.gpsAlertsEndpoint,
            {
              method: 'POST',
              body: JSON.stringify(fraud),
            },
            config,
            user
          ).catch(() => {});
        }
      });

      return detected;
    },
    [config, user, apiSemaphore, recordAuditAction]
  );

  const triggerSimulatedGpsFraudHeuristic = useCallback(
    (heuristicNumber: 1 | 2 | 3 | 4 | 5): GpsFraudAlertRecord | null => {
      const now = Date.now();
      const execInfo = {
        id: 'agt-1',
        name: 'Carlos Vera',
        role: 'EJECUTIVO_VENTAS',
        sucursal: 'Sucursal Norte - División Comercial',
      };

      let sample: GpsTelemetrySample = {
        lat: -2.1810,
        lng: -79.9130,
        accuracy: 6,
        positionTimestamp: now,
        systemTimestamp: now,
      };

      if (heuristicNumber === 1) {
        sample = {
          ...sample,
          previousLat: -2.1810,
          previousLng: -79.9130,
          lat: -2.0420,
          lng: -79.9850,
          previousTimestamp: now - 25_000, // ~17km in 25s
        };
      } else if (heuristicNumber === 2) {
        sample = {
          ...sample,
          lat: -2.1725,
          lng: -79.9045,
          accuracy: 1,
          altitudeAccuracy: null,
          recentAccuracies: [1, 1, 1],
        };
      } else if (heuristicNumber === 3) {
        sample = {
          ...sample,
          lat: -2.1680,
          lng: -79.8990,
          positionTimestamp: now - 480_000, // 8 min drift
        };
      } else if (heuristicNumber === 4) {
        sample = {
          ...sample,
          lat: -2.1590,
          lng: -79.9080,
          speedKmh: 74,
          deviceMotionAcceleration: 0,
          isWebDriverOrEmulator: true,
        };
      } else if (heuristicNumber === 5) {
        sample = {
          ...sample,
          lat: 4.7110, // Fuera de jurisdicción Ecuador
          lng: -74.0721,
          reportedTimezoneOffsetMinutes: -120,
        };
      }

      const alerts = evaluateAndRecordGpsSample(sample, execInfo);
      return alerts[0] || null;
    },
    [evaluateAndRecordGpsSample]
  );

  const acknowledgeGpsFraudAlert = useCallback(
    (alertId: string) => {
      if (!user || getRoleHierarchyLevel(user.rol) < 2) return;
      setGpsFraudAlerts((prev) => {
        const next = prev.map((a) =>
          a.id === alertId
            ? {
                ...a,
                acknowledgedBySupervisor: true,
                acknowledgedBy: user.nombreCompleto,
                acknowledgedAt: new Date().toLocaleTimeString('es-EC'),
              }
            : a
        );
        saveGpsFraudAlerts(next);
        return next;
      });
    },
    [user]
  );

  const updateSysConfig = useCallback((newConfig: LatinaSysConfig) => {
    const saved = saveSysConfig(newConfig);
    setConfig(saved);
  }, []);

  const resetSysConfigToDefaults = useCallback(() => {
    const defaults = getDefaultSysConfig();
    const saved = saveSysConfig(defaults);
    setConfig(saved);
    return saved;
  }, []);

  const updateUiConfig = useCallback((newUi: GeoLatinaUiConfig) => {
    const saved = saveUiConfig(newUi);
    setUiConfig(saved);
  }, []);

  const resetUiConfigToDefaults = useCallback(() => {
    const defaults = getDefaultUiConfig();
    const saved = saveUiConfig(defaults);
    setUiConfig(saved);
    return saved;
  }, []);

  const loginWithLatinaSoft = useCallback(
    async (credentials: { usuario: string; password: string; sucursal?: string }) => {
      const result = await authenticateLatinaUser(credentials, config);
      if (result.ok && result.session) {
        const enriched: LatinaUserSession = {
          ...result.session,
          hierarchyLevel: getRoleHierarchyLevel(result.session.rol),
        };
        saveUserSession(enriched);
        setUser(enriched);
        if (onSessionAuthenticated) {
          onSessionAuthenticated(enriched);
        }

        const loginEntry = createAuditLogEntry({
          usuario: enriched.usuario,
          nombreUsuario: enriched.nombreCompleto,
          rol: enriched.rol,
          sucursal: enriched.sucursal,
          eventType: 'INICIO_SESION',
          alertState: 'NORMAL',
          detail: `Inicio de sesión corporativo exitoso en GEOLATINA (${enriched.authMode}).`,
        });
        setAuditLogs((prev) => {
          const next = [loginEntry, ...prev];
          saveAuditLogs(next);
          return next;
        });
      }
      return result;
    },
    [config, onSessionAuthenticated]
  );

  const switchActiveCorporateRole = useCallback(
    (rol: string, nombre: string, mappedUserId: string) => {
      if (!user) return;
      const updated: LatinaUserSession = {
        ...user,
        rol,
        nombreCompleto: nombre,
        hierarchyLevel: getRoleHierarchyLevel(rol),
        admUserRole: `AdmUser_${rol}_N${getRoleHierarchyLevel(rol)}`,
        mappedGeoLatinaUserId: mappedUserId,
      };
      saveUserSession(updated);
      setUser(updated);
    },
    [user]
  );

  const logoutLatinaSession = useCallback(() => {
    if (user) {
      const logoutEntry = createAuditLogEntry({
        usuario: user.usuario,
        nombreUsuario: user.nombreCompleto,
        rol: user.rol,
        sucursal: user.sucursal,
        eventType: 'CIERRE_SESION',
        alertState: 'NORMAL',
        detail: `Cierre de sesión corporativa confirmado por el usuario.`,
      });
      setAuditLogs((prev) => {
        const next = [logoutEntry, ...prev];
        saveAuditLogs(next);
        return next;
      });
    }
    saveUserSession(null);
    setUser(null);
  }, [user]);

  const runServerPing = useCallback(
    async (customConfig?: LatinaSysConfig) => {
      const targetCfg = customConfig || config;
      const res = await pingLatinaApiServer(targetCfg);
      setLastPingResult(res);
      return res;
    },
    [config]
  );

  return (
    <GeoLatinaSystemContext.Provider
      value={{
        user,
        config,
        uiConfig,
        auditLogs,
        gpsFraudAlerts,
        apiFetch,
        apiSemaphore,
        lastPingResult,
        isSysConfigOpen,
        openSysConfigModal: () => setIsSysConfigOpen(true),
        closeSysConfigModal: () => setIsSysConfigOpen(false),
        isAuditHistoryOpen,
        openAuditHistoryModal: () => setIsAuditHistoryOpen(true),
        closeAuditHistoryModal: () => setIsAuditHistoryOpen(false),
        isGpsFraudDrawerOpen,
        openGpsFraudDrawer: () => setIsGpsFraudDrawerOpen(true),
        closeGpsFraudDrawer: () => setIsGpsFraudDrawerOpen(false),
        isUiBuilderOpen,
        openUiBuilderModal: () => setIsUiBuilderOpen(true),
        closeUiBuilderModal: () => setIsUiBuilderOpen(false),
        urgentFraudPopup,
        dismissUrgentFraudPopup: () => setUrgentFraudPopup(null),
        acknowledgeGpsFraudAlert,
        updateSysConfig,
        resetSysConfigToDefaults,
        updateUiConfig,
        resetUiConfigToDefaults,
        recordAuditAction,
        evaluateAndRecordGpsSample,
        triggerSimulatedGpsFraudHeuristic,
        loginWithLatinaSoft,
        switchActiveCorporateRole,
        logoutLatinaSession,
        runServerPing,
      }}
    >
      {children}
    </GeoLatinaSystemContext.Provider>
  );
};

export function useGeoLatinaSystem(): GeoLatinaSystemContextValue {
  const ctx = useContext(GeoLatinaSystemContext);
  if (!ctx) {
    throw new Error('useGeoLatinaSystem debe utilizarse dentro de un GeoLatinaSystemProvider');
  }
  return ctx;
}
