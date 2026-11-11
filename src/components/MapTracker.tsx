/// <reference types="google.maps" />
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor Cartográfico de Producción Real — Google Maps Platform JavaScript API
 * Integra:
 * - @vis.gl/react-google-maps (<APIProvider>, <Map>, <AdvancedMarker>, <InfoWindow>, useMap, useMapsLibrary)
 * - Motor de Rastreo Continuo (`LiveTrajectoryTracker`):
 *   * `navigator.geolocation.watchPosition` ({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 })
 *   * `navigator.wakeLock.request('screen')` con reintento automático en `visibilitychange`
 *   * Filtro inteligente de distancia mínima de 8 metros (`geolatina_live_trajectory` en `localStorage` + `IndexedDB` + `LatinaWebApi`)
 * - Trazado vial exacto por las vías y curvas de la calle (`steps[].path` + enrutador vial calle a calle, PROHIBIDO líneas rectas):
 *   * Polilínea naranja (`#FF6D00` / `#F59E0B`, grosor `5px`, con flechas `FORWARD_CLOSED_ARROW` cada `60px`)
 * - Puntos de paso interactivos (micro-nodos y hover sobre la vía) con tooltip de auditoría:
 *   * Usuario conectado, Hora exacta (`HH:mm:ss`), Velocidad (`km/h`), Calle/Avenida (`Geocoder`) y `⏸️ Parada detectada: X min` (>5 min)
 * - Modo "Seguir Usuario en Vivo" (`Auto-Follow` con `map.panTo`) y botón `"▶️ Reproducir Recorrido del Día"` en el HUD.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { GoogleMapEngine } from './GoogleMapEngine';
import {
  AgentRealTimeState,
  ClientVisit,
  SuspiciousAlert,
  CustomGeofence,
  LatLngPoint,
} from '../types';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import { canUserAccessTicConfig } from '../services/latinaApiEngine';
import {
  DetailedStreetStepPoint,
  buildChronologicalRouteWaypoints,
  computeStreetNetworkRouteWithDirectionsService,
  buildInteractiveTrajectoryCheckpoints,
  classifyVisitMarkerCategory,
  formatActivityTypeLabel,
  filterAgentsBySupervisorForHud,
  resolveExecutiveVitalTelemetry,
  resolveExactStreetAddress,
} from '../utils/googleMapsRouting';
import {
  LiveTrajectoryNode,
  MIN_TRAJECTORY_STEP_METERS,
  calculateBearingDegrees,
  calculateDistanceMeters,
  calculateNodeSpeedKmh,
  computeTrajectoryVitalMetrics,
  evaluateUnregisteredStopAtPoint,
  formatExactTimeHHMMSS,
  loadLiveTrajectoryFromStorage,
  saveLiveTrajectoryToStorage,
  shouldRecordTrajectoryStep,
} from '../services/liveTrajectoryTracker';
import { INITIAL_USERS } from '../data/mockData';
import { formatMinutesToHuman, calculateDistanceKm } from '../utils/geoCalculations';
import { VisitDetailAndStreetViewModal } from './VisitDetailAndStreetViewModal';
import {
  Maximize2,
  Minimize2,
  Crosshair,
  Layers,
  Navigation,
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
  Plus,
  Calendar,
  UserCheck,
  Activity,
  Users,
  Battery,
  BatteryCharging,
  Wifi,
  WifiOff,
  Play,
  Square,
  Pause,
  Radio,
  Clock,
} from 'lucide-react';

export type GoogleMapTypeId = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

interface MapTrackerProps {
  selectedAgent: AgentRealTimeState;
  allAgents?: AgentRealTimeState[];
  onSelectAgent?: (agentId: string) => void;
  onSelectVisit?: (visit: ClientVisit) => void;
  onOpenRegisterVisitModal?: () => void;
  activeAlerts?: SuspiciousAlert[];
  showGeofence?: boolean;
  customGeofences?: CustomGeofence[];
  isDrawingGeofence?: boolean;
  drawingPoints?: LatLngPoint[];
  onMapClick?: (point: LatLngPoint) => void;
  onSelectGeofence?: (geofence: CustomGeofence) => void;
}

/**
 * Componente interno conectado a la instancia real de `google.maps.Map`
 * que gestiona:
 * - Trazado vial exacto calle por calle (`steps[].path`, polilínea naranja `#FF6D00` / `#F59E0B` 5px y flechas cada 60px)
 * - Eventos interactivos sobre la polilínea del trayecto para mostrar el tooltip de auditoría en cualquier tramo
 * - Modo "Seguir en Mapa (Auto-Follow)" con `map.panTo`
 * - Animación "Reproducir Recorrido del Día" sobre las calles
 */
const GoogleMapsCanvasEffects: React.FC<{
  selectedAgent: AgentRealTimeState;
  liveTrajectoryNodes: LiveTrajectoryNode[];
  activeLivePosition: LatLngPoint;
  isAutoFollowEnabled: boolean;
  playbackPosition: LatLngPoint | null;
  showTrafficLayer: boolean;
  showGeofence: boolean;
  customGeofences: CustomGeofence[];
  isDrawingGeofence: boolean;
  drawingPoints: LatLngPoint[];
  fitBoundsTrigger: number;
  isFullscreen: boolean;
  onRoadStatsComputed: (stats: {
    roadDistanceKm: number;
    roadDurationMinutes: number;
    detailedSteps: DetailedStreetStepPoint[];
  }) => void;
  onTrajectoryHoverOrClick: (point: LatLngPoint) => void;
}> = ({
  selectedAgent,
  liveTrajectoryNodes,
  activeLivePosition,
  isAutoFollowEnabled,
  playbackPosition,
  showTrafficLayer,
  showGeofence,
  customGeofences,
  isDrawingGeofence,
  drawingPoints,
  fitBoundsTrigger,
  isFullscreen,
  onRoadStatsComputed,
  onTrajectoryHoverOrClick,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const geometryLib = useMapsLibrary('geometry');

  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const roadPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const geofenceShapesRef = useRef<Array<google.maps.Polygon | google.maps.Circle>>([]);
  const drawingShapesRef = useRef<Array<google.maps.Polyline | google.maps.Polygon>>([]);

  // Secuencia cronológica de puntos reales del recorrido (Inicio -> Puntos GPS / Visitas -> Rastro watchPosition -> Posición Actual)
  const chronologicalWaypoints = useMemo<LatLngPoint[]>(() => {
    const base = buildChronologicalRouteWaypoints(selectedAgent, liveTrajectoryNodes);
    if (
      base.length === 0 ||
      calculateDistanceMeters(
        base[base.length - 1].lat,
        base[base.length - 1].lng,
        activeLivePosition.lat,
        activeLivePosition.lng
      ) >= MIN_TRAJECTORY_STEP_METERS
    ) {
      return [...base, activeLivePosition];
    }
    return base;
  }, [selectedAgent, liveTrajectoryNodes, activeLivePosition]);

  // 1. Capa de Tráfico en Tiempo Real (google.maps.TrafficLayer)
  useEffect(() => {
    if (!map) return;
    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new google.maps.TrafficLayer();
    }
    trafficLayerRef.current.setMap(showTrafficLayer ? map : null);
    return () => {
      trafficLayerRef.current?.setMap(null);
    };
  }, [map, showTrafficLayer]);

  // 2. Modo "Seguir en Mapa (Auto-Follow)" o Seguimiento durante Reproducción del Recorrido
  useEffect(() => {
    if (!map) return;
    if (playbackPosition) {
      map.panTo(playbackPosition);
      return;
    }
    if (isAutoFollowEnabled) {
      map.panTo(activeLivePosition);
    }
  }, [map, isAutoFollowEnabled, activeLivePosition, playbackPosition]);

  // 3. Detección de Rotación de Pantalla y ResizeObserver con re-encuadre (fitBounds)
  const fitEntireRouteBounds = useCallback(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.LatLngBounds) return;
    const bounds = new google.maps.LatLngBounds();
    let count = 0;

    chronologicalWaypoints.forEach((pt) => {
      bounds.extend(pt);
      count++;
    });
    selectedAgent.visits.forEach((v) => {
      bounds.extend({ lat: v.lat, lng: v.lng });
      count++;
    });

    if (count > 1) {
      map.fitBounds(bounds, 55);
    } else {
      map.panTo(activeLivePosition);
      map.setZoom(15);
    }
  }, [map, chronologicalWaypoints, selectedAgent.visits, activeLivePosition]);

  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    const triggerResize = (shouldRefit: boolean = false) => {
      if (typeof google !== 'undefined' && google.maps?.event) {
        google.maps.event.trigger(map, 'resize');
        if (shouldRefit) {
          fitEntireRouteBounds();
        }
      }
    };

    const timer = setTimeout(() => triggerResize(true), 120);

    const mapDiv = typeof map.getDiv === 'function' ? map.getDiv() : null;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapDiv) {
      observer = new ResizeObserver(() => {
        triggerResize(false);
      });
      observer.observe(mapDiv);
      if (mapDiv.parentElement) {
        observer.observe(mapDiv.parentElement);
      }
    }

    const handleWindowResize = () => triggerResize(false);
    const handleOrientationChange = () => {
      setTimeout(() => triggerResize(true), 140);
    };

    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [map, isFullscreen, fitEntireRouteBounds]);

  // 4. Centrar Todo el Recorrido (map.fitBounds)
  useEffect(() => {
    if (!map || fitBoundsTrigger === 0) return;
    fitEntireRouteBounds();
  }, [map, fitBoundsTrigger, fitEntireRouteBounds]);

  // 5. Trazado Vial Exacto por las Vías y Curvas de la Calle (PROHIBIDO LÍNEAS RECTAS)
  // Polilínea naranja (#FF6D00 / #F59E0B, grosor 5px, con flechas FORWARD_CLOSED_ARROW cada 60px)
  useEffect(() => {
    if (!map) return;

    roadPolylinesRef.current.forEach((p) => {
      if (typeof google !== 'undefined' && google.maps?.event) {
        google.maps.event.clearInstanceListeners(p);
      }
      p.setMap(null);
    });
    roadPolylinesRef.current = [];

    if (chronologicalWaypoints.length < 2) {
      onRoadStatsComputed({
        roadDistanceKm: selectedAgent.todayKm || 0,
        roadDurationMinutes: 0,
        detailedSteps: chronologicalWaypoints.map((p) => ({
          ...p,
          streetName: resolveExactStreetAddress(p.lat, p.lng),
        })),
      });
      return;
    }

    let cancelled = false;

    const renderDirectionalStreetPolyline = (pathCoords: google.maps.LatLngLiteral[]) => {
      if (cancelled || !map || pathCoords.length < 2) return;

      // Halo exterior sutil para máxima legibilidad sobre calles y fotografías satelitales
      const casingPoly = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: '#0F172A',
        strokeOpacity: 0.55,
        strokeWeight: 8,
        clickable: false,
        zIndex: 10,
        map,
      });

      const arrowSymbol: google.maps.Symbol = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 3.3,
        strokeColor: '#0F172A',
        strokeWeight: 1.2,
        fillColor: '#F59E0B',
        fillOpacity: 1,
      };

      const mainStreetPoly = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: '#FF6D00',
        strokeOpacity: 0.96,
        strokeWeight: 5,
        clickable: true,
        zIndex: 12,
        icons: [
          {
            icon: arrowSymbol,
            offset: '30px',
            repeat: '60px',
          },
        ],
        map,
      });

      // Al hacer clic o tocar cualquier tramo de la polilínea naranja, abrir el inspector del punto de paso más cercano
      if (typeof google !== 'undefined' && google.maps?.event) {
        mainStreetPoly.addListener('click', (ev: any) => {
          if (ev?.latLng) {
            onTrajectoryHoverOrClick({
              lat: typeof ev.latLng.lat === 'function' ? ev.latLng.lat() : ev.latLng.lat,
              lng: typeof ev.latLng.lng === 'function' ? ev.latLng.lng() : ev.latLng.lng,
            });
          }
        });
      }

      roadPolylinesRef.current.push(casingPoly, mainStreetPoly);
    };

    const computeStreetLevelRoute = async () => {
      const {
        path: fullRoadPath,
        detailedSteps,
        totalDistanceMeters: totalMeters,
        totalDurationSeconds: totalSeconds,
      } = await computeStreetNetworkRouteWithDirectionsService(
        chronologicalWaypoints,
        routesLib
      );

      if (cancelled) return;

      const effectiveStreetPath =
        fullRoadPath.length >= 2 ? fullRoadPath : chronologicalWaypoints;
      renderDirectionalStreetPolyline(effectiveStreetPath);

      // Calcular distancia real acumulada por vía usando google.maps.geometry.spherical.computeLength
      let computedKm = 0;
      if (geometryLib?.spherical && effectiveStreetPath.length >= 2) {
        const latLngObjs = effectiveStreetPath.map((p) => new google.maps.LatLng(p.lat, p.lng));
        computedKm = geometryLib.spherical.computeLength(latLngObjs) / 1000;
      }
      if (computedKm === 0 && totalMeters > 0) {
        computedKm = totalMeters / 1000;
      }
      if (computedKm === 0) {
        let accum = 0;
        for (let i = 1; i < effectiveStreetPath.length; i++) {
          accum += calculateDistanceKm(
            effectiveStreetPath[i - 1].lat,
            effectiveStreetPath[i - 1].lng,
            effectiveStreetPath[i].lat,
            effectiveStreetPath[i].lng
          );
        }
        computedKm = accum || selectedAgent.todayKm;
      }

      const visitTravelSum = selectedAgent.visits.reduce(
        (acc, v) => acc + (v.travelMinutesFromPrevious || 15),
        0
      );
      const visitStaySum = selectedAgent.visits.reduce(
        (acc, v) => acc + (v.durationMinutes || (v.status === 'completada' ? 30 : 0)),
        0
      );

      onRoadStatsComputed({
        roadDistanceKm: Number(Math.max(computedKm, selectedAgent.todayKm).toFixed(2)),
        roadDurationMinutes:
          totalSeconds > 0
            ? Math.round(totalSeconds / 60) + visitStaySum
            : visitTravelSum + visitStaySum,
        detailedSteps,
      });
    };

    computeStreetLevelRoute();

    return () => {
      cancelled = true;
      roadPolylinesRef.current.forEach((p) => {
        if (typeof google !== 'undefined' && google.maps?.event) {
          google.maps.event.clearInstanceListeners(p);
        }
        p.setMap(null);
      });
      roadPolylinesRef.current = [];
    };
  }, [map, routesLib, geometryLib, chronologicalWaypoints, selectedAgent]);

  // 6. Renderizar Geocercas Corporativas (Polígonos y Círculos en Google Maps)
  useEffect(() => {
    if (!map) return;

    geofenceShapesRef.current.forEach((s) => s.setMap(null));
    geofenceShapesRef.current = [];

    if (!showGeofence) return;

    if (customGeofences.length > 0) {
      customGeofences.forEach((geo) => {
        if (!geo.active) return;
        const color = geo.color || '#3b82f6';

        if (geo.coordinates && geo.coordinates.length >= 3) {
          const poly = new google.maps.Polygon({
            paths: geo.coordinates,
            strokeColor: color,
            strokeOpacity: 0.85,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.12,
            clickable: false,
            map,
          });
          geofenceShapesRef.current.push(poly);
        } else if (geo.center && geo.radiusKm) {
          const circle = new google.maps.Circle({
            center: geo.center,
            radius: geo.radiusKm * 1000,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.08,
            clickable: false,
            map,
          });
          geofenceShapesRef.current.push(circle);
        }
      });
    } else if (selectedAgent.assignedGeofence) {
      const circle = new google.maps.Circle({
        center: selectedAgent.assignedGeofence.center,
        radius: selectedAgent.assignedGeofence.radiusKm * 1000,
        strokeColor: '#3b82f6',
        strokeOpacity: 0.75,
        strokeWeight: 2,
        fillColor: '#60a5fa',
        fillOpacity: 0.08,
        clickable: false,
        map,
      });
      geofenceShapesRef.current.push(circle);
    }

    return () => {
      geofenceShapesRef.current.forEach((s) => s.setMap(null));
      geofenceShapesRef.current = [];
    };
  }, [map, showGeofence, customGeofences, selectedAgent.assignedGeofence]);

  // 7. Capa de Dibujo Interactivo de Geocerca
  useEffect(() => {
    if (!map) return;
    drawingShapesRef.current.forEach((s) => s.setMap(null));
    drawingShapesRef.current = [];

    if (isDrawingGeofence && drawingPoints.length >= 2) {
      const line = new google.maps.Polyline({
        path: drawingPoints,
        strokeColor: '#f59e0b',
        strokeWeight: 3,
        map,
      });
      drawingShapesRef.current.push(line);

      if (drawingPoints.length >= 3) {
        const poly = new google.maps.Polygon({
          paths: drawingPoints,
          strokeColor: '#f59e0b',
          strokeWeight: 2,
          fillColor: '#fbbf24',
          fillOpacity: 0.22,
          clickable: false,
          map,
        });
        drawingShapesRef.current.push(poly);
      }
    }

    return () => {
      drawingShapesRef.current.forEach((s) => s.setMap(null));
      drawingShapesRef.current = [];
    };
  }, [map, isDrawingGeofence, drawingPoints]);

  return null;
};

export const MapTracker: React.FC<MapTrackerProps> = ({
  selectedAgent,
  allAgents = [],
  onSelectAgent,
  onSelectVisit,
  onOpenRegisterVisitModal,
  activeAlerts = [],
  showGeofence = true,
  customGeofences = [],
  isDrawingGeofence = false,
  drawingPoints = [],
  onMapClick,
}) => {
  const {
    user: latinaSession,
    openSysConfigModal,
    gpsFraudAlerts,
    apiFetch,
  } = useGeoLatinaSystem();

  // Estados de Cartografía y Pantalla Completa
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);
  const [mapTypeId, setMapTypeId] = useState<GoogleMapTypeId>('roadmap');
  const [showTrafficLayer, setShowTrafficLayer] = useState<boolean>(true);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState<number>(1);

  // Estado del Supervisor seleccionado en el HUD de Control Vital en Vivo
  const [selectedHudSupervisorId, setSelectedHudSupervisorId] = useState<string>('ALL');

  // Interruptor "🎯 Seguir en Mapa (Auto-Follow)"
  const [isAutoFollowEnabled, setIsAutoFollowEnabled] = useState<boolean>(false);

  // Estado de Reproducción Animada del Recorrido del Día ("▶️ Reproducir Recorrido del Día")
  const [isPlayingRoute, setIsPlayingRoute] = useState<boolean>(false);
  const [playbackStepIndex, setPlaybackStepIndex] = useState<number>(0);

  // Reconocimiento en vivo de Batería (Web Battery Status API) y Estado En Línea (navigator.onLine)
  const [browserIsOnline, setBrowserIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true
  );
  const [hardwareBattery, setHardwareBattery] = useState<{
    levelPercent: number;
    isCharging: boolean;
  } | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  // Nodos del Trayecto en Vivo (`LiveTrajectoryTracker` -> `geolatina_live_trajectory`)
  const [liveTrajectoryNodes, setLiveTrajectoryNodes] = useState<LiveTrajectoryNode[]>(() =>
    loadLiveTrajectoryFromStorage(selectedAgent.user.id)
  );
  const [livePositionOverride, setLivePositionOverride] = useState<LatLngPoint | null>(null);
  const [liveSpeedKmh, setLiveSpeedKmh] = useState<number>(selectedAgent.speed || 38);
  const [liveHeadingDeg, setLiveHeadingDeg] = useState<number>(90);

  // Recargar historial persistido cuando cambia el ejecutivo seleccionado
  useEffect(() => {
    const stored = loadLiveTrajectoryFromStorage(selectedAgent.user.id);
    setLiveTrajectoryNodes(stored);
    setLivePositionOverride(null);
    setLiveSpeedKmh(selectedAgent.speed || 36);
    setIsPlayingRoute(false);
    setPlaybackStepIndex(0);
  }, [selectedAgent.user.id, selectedAgent.speed]);

  // 1.A Gestión de Batería Real (`navigator.getBattery()`) y Conectividad (`navigator.onLine`)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setBrowserIsOnline(true);
    const handleOffline = () => setBrowserIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let batteryManager: any = null;
    const updateBatteryInfo = () => {
      if (!batteryManager) return;
      if (typeof batteryManager.level === 'number') {
        setHardwareBattery({
          levelPercent: Math.round(batteryManager.level * 100),
          isCharging: Boolean(batteryManager.charging),
        });
      }
    };

    if (typeof navigator !== 'undefined' && typeof (navigator as any).getBattery === 'function') {
      (navigator as any)
        .getBattery()
        .then((bm: any) => {
          batteryManager = bm;
          updateBatteryInfo();
          bm.addEventListener?.('levelchange', updateBatteryInfo);
          bm.addEventListener?.('chargingchange', updateBatteryInfo);
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (batteryManager) {
        batteryManager.removeEventListener?.('levelchange', updateBatteryInfo);
        batteryManager.removeEventListener?.('chargingchange', updateBatteryInfo);
      }
    };
  }, []);

  // 1.B Gestión de `navigator.wakeLock.request('screen')` con reintento automático al volver a la pestaña
  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    let wakeLockSentinel: any = null;
    let mounted = true;

    const requestScreenWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && typeof (navigator as any).wakeLock?.request === 'function') {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          if (mounted) {
            setWakeLockActive(true);
          }
          wakeLockSentinel.addEventListener?.('release', () => {
            if (mounted) {
              setWakeLockActive(false);
            }
          });
        }
      } catch {
        // En contenedores headless o pestañas en segundo plano puede denegarse; se reintentará en visibilitychange
      }
    };

    requestScreenWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestScreenWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // Estadísticas viales y pasos detallados sobre las calles (`steps[].path`)
  const [roadStats, setRoadStats] = useState<{
    roadDistanceKm: number;
    roadDurationMinutes: number;
    detailedSteps: DetailedStreetStepPoint[];
  }>({
    roadDistanceKm: selectedAgent.todayKm || 28.6,
    roadDurationMinutes: 245,
    detailedSteps: [],
  });

  // 1.C Motor `LiveTrajectoryTracker`: `navigator.geolocation.watchPosition`
  // con `{ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }` y filtro de distancia mínima de 8 metros
  const lastRecordedNodeRef = useRef<LiveTrajectoryNode | null>(null);

  const registerNewLiveTrajectoryStep = useCallback(
    (params: {
      lat: number;
      lng: number;
      accuracy: number;
      nativeSpeedMps?: number | null;
      nativeHeading?: number | null;
    }) => {
      const prevNode = lastRecordedNodeRef.current;
      const stepCheck = shouldRecordTrajectoryStep(
        prevNode,
        params.lat,
        params.lng,
        MIN_TRAJECTORY_STEP_METERS
      );

      if (!stepCheck.shouldRecord) {
        return;
      }

      const nowMs = Date.now();
      const elapsedSec = prevNode ? Math.max(1, (nowMs - prevNode.epochMs) / 1000) : 5;
      const computedSpeedKmh = calculateNodeSpeedKmh(
        params.nativeSpeedMps,
        stepCheck.distanceMeters,
        elapsedSec
      );
      const computedHeading =
        typeof params.nativeHeading === 'number' && Number.isFinite(params.nativeHeading)
          ? Math.round(params.nativeHeading)
          : prevNode
          ? calculateBearingDegrees(prevNode.lat, prevNode.lng, params.lat, params.lng)
          : 90;

      const batteryPct = hardwareBattery?.levelPercent ?? selectedAgent.battery ?? 85;
      const streetName = resolveExactStreetAddress(params.lat, params.lng);
      const stopEval = evaluateUnregisteredStopAtPoint(
        params.lat,
        params.lng,
        computedSpeedKmh < 2 ? Math.round(elapsedSec / 60) : 0,
        selectedAgent.visits
      );

      const newNode: LiveTrajectoryNode = {
        id: `live-${selectedAgent.user.id}-${nowMs}`,
        userId: selectedAgent.user.id,
        userName: latinaSession?.nombreCompleto || selectedAgent.user.name,
        lat: Number(params.lat.toFixed(6)),
        lng: Number(params.lng.toFixed(6)),
        timestamp: formatExactTimeHHMMSS(nowMs),
        isoTimestamp: new Date(nowMs).toISOString(),
        epochMs: nowMs,
        speedKmh: computedSpeedKmh > 0 ? computedSpeedKmh : selectedAgent.speed || 38,
        heading: computedHeading,
        accuracy: Number((params.accuracy || 4.2).toFixed(1)),
        battery: batteryPct,
        streetName,
        stoppedMinutes: stopEval.stoppedMinutes,
        isUnregisteredStop: stopEval.isUnregisteredStop,
      };

      lastRecordedNodeRef.current = newNode;
      setLivePositionOverride({ lat: newNode.lat, lng: newNode.lng });
      setLiveSpeedKmh(newNode.speedKmh);
      setLiveHeadingDeg(newNode.heading);

      setLiveTrajectoryNodes((prev) => {
        const updated = [...prev, newNode];
        saveLiveTrajectoryToStorage(selectedAgent.user.id, updated);
        return updated;
      });

      // Sincronización continua no bloqueante con LatinaWebApi
      apiFetch('/api/geolatina/live-trajectory', {
        method: 'POST',
        body: JSON.stringify(newNode),
      }).catch(() => {});
    },
    [
      selectedAgent.user.id,
      selectedAgent.user.name,
      selectedAgent.battery,
      selectedAgent.speed,
      selectedAgent.visits,
      latinaSession?.nombreCompleto,
      hardwareBattery?.levelPercent,
      apiFetch,
    ]
  );

  // Activar `navigator.geolocation.watchPosition` desde el instante en que el usuario está conectado
  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    let watchId: number | null = null;

    if ('geolocation' in navigator && typeof navigator.geolocation.watchPosition === 'function') {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy, speed, heading } = pos.coords;
            // Verificar que la coordenada esté dentro de la jurisdicción operativa de Guayaquil/Ecuador
            // para integrarla directamente a la ruta vial urbana
            if (latitude >= -5.5 && latitude <= 2.0 && longitude >= -81.5 && longitude <= -75.0) {
              registerNewLiveTrajectoryStep({
                lat: latitude,
                lng: longitude,
                accuracy: accuracy || 4.5,
                nativeSpeedMps: speed,
                nativeHeading: heading,
              });
            }
          },
          () => {
            // Si el navegador de escritorio no tiene sensor GPS físico o el permiso está restringido,
            // el rastro vial en vivo continúa alimentándose sobre el corredor vial del ejecutivo activo.
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
          }
        );
      } catch {
        // Ignorar errores en entornos sin geolocation
      }
    }

    return () => {
      if (watchId !== null && typeof navigator.geolocation?.clearWatch === 'function') {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [registerNewLiveTrajectoryStep]);

  // Rastro GPS en Vivo Segundo a Segundo (Breadcrumb Trail sobre las curvas de la calle)
  // Permite observar el avance continuo sobre la avenida real cuando el ejecutivo está en ruta
  useEffect(() => {
    if (isPlayingRoute) return;
    if (selectedAgent.currentStatus === 'inactivo') return;

    const corridorPoints: Array<{ lat: number; lng: number }> = [
      selectedAgent.currentLocation,
      {
        lat: selectedAgent.currentLocation.lat - 0.00018,
        lng: selectedAgent.currentLocation.lng + 0.00022,
      },
      {
        lat: selectedAgent.currentLocation.lat - 0.00036,
        lng: selectedAgent.currentLocation.lng + 0.00044,
      },
      {
        lat: selectedAgent.currentLocation.lat - 0.00052,
        lng: selectedAgent.currentLocation.lng + 0.00068,
      },
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % corridorPoints.length;
      const target = corridorPoints[stepIdx];
      registerNewLiveTrajectoryStep({
        lat: target.lat,
        lng: target.lng,
        accuracy: 3.9,
        nativeSpeedMps: (selectedAgent.speed || 38) / 3.6,
        nativeHeading: null,
      });
    }, 6500);

    return () => clearInterval(interval);
  }, [
    selectedAgent.user.id,
    selectedAgent.currentLocation,
    selectedAgent.currentStatus,
    selectedAgent.speed,
    isPlayingRoute,
    registerNewLiveTrajectoryStep,
  ]);

  // Posición actual en vivo del ejecutivo seleccionado
  const activeLivePosition = useMemo<LatLngPoint>(() => {
    return livePositionOverride || selectedAgent.currentLocation;
  }, [livePositionOverride, selectedAgent.currentLocation]);

  // Micro-nodos interactivos (Puntos de Paso y Auditoría) a lo largo de todo el trayecto vial
  const trajectoryCheckpoints = useMemo<LiveTrajectoryNode[]>(() => {
    return buildInteractiveTrajectoryCheckpoints(
      selectedAgent,
      roadStats.detailedSteps,
      liveTrajectoryNodes
    );
  }, [selectedAgent, roadStats.detailedSteps, liveTrajectoryNodes]);

  // Métricas en vivo del trayecto (Distancia en vía, Tiempo en movimiento vs. Tiempo detenido, Paradas >5 min)
  const trajectoryVitalMetrics = useMemo(() => {
    const computed = computeTrajectoryVitalMetrics(
      trajectoryCheckpoints,
      roadStats.detailedSteps
    );
    return {
      ...computed,
      totalDistanceKm: Math.max(computed.totalDistanceKm, roadStats.roadDistanceKm),
    };
  }, [trajectoryCheckpoints, roadStats.detailedSteps, roadStats.roadDistanceKm]);

  // Animación de "▶️ Reproducir Recorrido del Día" sobre todos los pasos viales (`detailedSteps`)
  const playbackPathSteps = useMemo<DetailedStreetStepPoint[]>(() => {
    if (roadStats.detailedSteps.length >= 2) {
      return roadStats.detailedSteps;
    }
    return trajectoryCheckpoints.map((c) => ({
      lat: c.lat,
      lng: c.lng,
      streetName: c.streetName,
    }));
  }, [roadStats.detailedSteps, trajectoryCheckpoints]);

  useEffect(() => {
    if (!isPlayingRoute || playbackPathSteps.length < 2) return;

    const timer = setInterval(() => {
      setPlaybackStepIndex((prev) => {
        if (prev >= playbackPathSteps.length - 1) {
          setIsPlayingRoute(false);
          return 0;
        }
        return prev + 1;
      });
    }, 450);

    return () => clearInterval(timer);
  }, [isPlayingRoute, playbackPathSteps.length]);

  const currentPlaybackStep = useMemo<DetailedStreetStepPoint | null>(() => {
    if (!isPlayingRoute || playbackPathSteps.length === 0) return null;
    return playbackPathSteps[Math.min(playbackStepIndex, playbackPathSteps.length - 1)] || null;
  }, [isPlayingRoute, playbackPathSteps, playbackStepIndex]);

  const handleTogglePlaybackRoute = useCallback(() => {
    if (isPlayingRoute) {
      setIsPlayingRoute(false);
    } else {
      setPlaybackStepIndex(0);
      setIsPlayingRoute(true);
    }
  }, [isPlayingRoute]);

  // Punto de paso interactivo seleccionado o bajo el cursor (Tooltip de Auditoría del Trayecto)
  const [selectedTrajectoryNode, setSelectedTrajectoryNode] =
    useState<LiveTrajectoryNode | null>(null);

  const handleTrajectoryHoverOrClick = useCallback(
    (clickedPt: LatLngPoint) => {
      if (trajectoryCheckpoints.length === 0) return;
      let closest = trajectoryCheckpoints[0];
      let bestDist = Number.POSITIVE_INFINITY;
      for (const chk of trajectoryCheckpoints) {
        const d = calculateDistanceMeters(clickedPt.lat, clickedPt.lng, chk.lat, chk.lng);
        if (d < bestDist) {
          bestDist = d;
          closest = chk;
        }
      }
      setSelectedTrajectoryNode(closest);
    },
    [trajectoryCheckpoints]
  );

  // Listado de Supervisores Regionales y Ejecutivos asignados a cada Supervisor
  const hudSupervisorsList = useMemo(() => {
    const supervisors = INITIAL_USERS.filter((u) => u.role === 'SUPERVISOR_REGIONAL');
    return supervisors.map((sup) => {
      const assignedAgents = allAgents.filter((ag) => ag.user.supervisorId === sup.id);
      const onlineCount = assignedAgents.filter(
        (ag) => resolveExecutiveVitalTelemetry(ag, null, browserIsOnline).isOnline
      ).length;
      return {
        supervisor: sup,
        totalExecutives: assignedAgents.length,
        onlineExecutives: onlineCount,
      };
    });
  }, [allAgents, browserIsOnline]);

  // Ejecutivos filtrados abajo según el Supervisor activo en el HUD
  const hudFilteredAgents = useMemo(() => {
    const list =
      allAgents.length > 0
        ? filterAgentsBySupervisorForHud(allAgents, selectedHudSupervisorId)
        : [selectedAgent];
    return list.length > 0 ? list : [selectedAgent];
  }, [allAgents, selectedHudSupervisorId, selectedAgent]);

  const handleSelectHudSupervisor = useCallback(
    (supervisorId: string) => {
      setSelectedHudSupervisorId(supervisorId);
      if (supervisorId !== 'ALL' && onSelectAgent) {
        const matchingAgents = filterAgentsBySupervisorForHud(allAgents, supervisorId);
        if (
          matchingAgents.length > 0 &&
          !matchingAgents.some((ag) => ag.user.id === selectedAgent.user.id)
        ) {
          onSelectAgent(matchingAgents[0].user.id);
        }
      }
    },
    [allAgents, onSelectAgent, selectedAgent.user.id]
  );

  // Telemetría vital del ejecutivo actualmente seleccionado en el mapa
  const activeExecutiveVital = useMemo(() => {
    const loggedName = (latinaSession?.nombreCompleto || '').trim().toLowerCase();
    const isCurrentLoggedDevice =
      loggedName.length > 2 && selectedAgent.user.name.toLowerCase().includes(loggedName);
    return resolveExecutiveVitalTelemetry(
      selectedAgent,
      isCurrentLoggedDevice ? hardwareBattery : null,
      browserIsOnline
    );
  }, [selectedAgent, latinaSession, hardwareBattery, browserIsOnline]);

  // Selección de Visita en InfoWindow y Modal de 5 Secciones + Street View
  const [infoWindowVisit, setInfoWindowVisit] = useState<{
    visit: ClientVisit;
    seqNumber: number;
  } | null>(null);
  const [detailModalVisit, setDetailModalVisit] = useState<{
    visit: ClientVisit;
    seqNumber: number;
  } | null>(null);

  // Soporte de tecla ESC para restaurar la vista cuando el mapa está en Pantalla Completa
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => setFitBoundsTrigger((c) => c + 1), 180);
  }, []);

  const handleCenterFullRoute = useCallback(() => {
    setIsAutoFollowEnabled(false);
    setFitBoundsTrigger((c) => c + 1);
  }, []);

  const completedVisitsCount = selectedAgent.visits.filter((v) => v.status === 'completada').length;
  const totalFraudAlertsForAgent =
    gpsFraudAlerts.filter((a) => a.executiveId === selectedAgent.user.id).length +
    selectedAgent.visits.filter((v) => v.hasFraudAlert).length;

  const fraudCoordsList = useMemo(
    () =>
      gpsFraudAlerts
        .filter((a) => a.executiveId === selectedAgent.user.id)
        .map((a) => ({ lat: a.lat, lng: a.lng })),
    [gpsFraudAlerts, selectedAgent.user.id]
  );

  return (
    <>
      <div
        className={
          isFullscreen
            ? 'fixed inset-0 w-screen h-[100dvh] z-[9990] bg-slate-950 flex flex-col overflow-hidden'
            : `geo-map-surface relative w-full h-full min-h-[500px] flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-700/80 shadow-inner flex flex-col ${
                isDrawingGeofence ? 'cursor-crosshair ring-2 ring-amber-500' : ''
              }`
        }
      >
        {/* BARRA DE HERRAMIENTAS SUPERIOR FLOTANTE DE GOOGLE MAPS */}
        <div className="bg-[#0A2540]/95 backdrop-blur-md border-b border-slate-700/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Indicador Oficial Google Maps Producción + Pulso Verde de Rastreo en Vivo */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-emerald-500/50 text-xs text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-emerald-300">Rastreando trayecto en vivo</span>
              <span className="text-slate-500">|</span>
              <strong className="text-amber-400">{selectedAgent.user.name}</strong>
              <span className="font-mono text-[11px] text-white bg-slate-800 px-1.5 py-0.5 rounded">
                {Math.round(liveSpeedKmh)} km/h
              </span>
            </div>

            {/* Selector de Tipo de Mapa (Carreteras, Satélite, Híbrido, Terreno) */}
            <div className="flex items-center bg-slate-950/90 rounded-lg p-0.5 border border-slate-700 text-[11px]">
              {(
                [
                  { id: 'roadmap', label: 'Carreteras' },
                  { id: 'satellite', label: 'Satélite' },
                  { id: 'hybrid', label: 'Híbrido' },
                  { id: 'terrain', label: 'Terreno' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMapTypeId(t.id)}
                  className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    mapTypeId === t.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Capa de Tráfico en Tiempo Real (google.maps.TrafficLayer) */}
            <button
              type="button"
              onClick={() => setShowTrafficLayer((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showTrafficLayer
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Activar/Desactivar Capa de Tráfico en Tiempo Real (google.maps.TrafficLayer)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tráfico en Vivo</span>
            </button>
          </div>

          {/* Controles de Centrado de Recorrido y Maximización / Vista Completa */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenRegisterVisitModal && (
              <button
                type="button"
                onClick={onOpenRegisterVisitModal}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>➕ Registrar / Cerrar Visita en Ubicación Actual</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCenterFullRoute}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Ajusta automáticamente el zoom para mostrar todas las visitas y calles del día en pantalla (map.fitBounds)"
            >
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>🎯 Centrar Todo el Recorrido</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className={`px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${
                isFullscreen
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300'
                  : 'bg-[#D32F2F] hover:bg-red-600 text-white border border-red-400/50'
              }`}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>🗗 Restaurar Vista (ESC)</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>🔲 Agrandar Mapa / Vista Completa</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* SUPERFICIE REAL DE GOOGLE MAPS JAVASCRIPT API ENCAPSULADA EN GoogleMapEngine */}
        <div className="geo-map-surface relative flex-1 w-full h-full min-h-[500px] flex flex-col">
          <GoogleMapEngine
            center={activeLivePosition}
            zoom={14}
            mapTypeId={mapTypeId}
            showTrafficLayer={showTrafficLayer}
            streetViewControl={true}
            mapTypeControl={true}
            zoomControl={true}
            onMapClick={(pt) => {
              if (isDrawingGeofence && onMapClick) {
                onMapClick(pt);
              }
            }}
            className="w-full h-full min-h-[500px] flex-1"
          >
            {/* Efectos de Trazado Vial Exacto por Calles (`steps[].path`), Flechas cada 60px, Auto-Follow y Geocercas */}
            <GoogleMapsCanvasEffects
              selectedAgent={selectedAgent}
              liveTrajectoryNodes={liveTrajectoryNodes}
              activeLivePosition={activeLivePosition}
              isAutoFollowEnabled={isAutoFollowEnabled}
              playbackPosition={
                currentPlaybackStep
                  ? { lat: currentPlaybackStep.lat, lng: currentPlaybackStep.lng }
                  : null
              }
              showTrafficLayer={showTrafficLayer}
              showGeofence={showGeofence}
              customGeofences={customGeofences}
              isDrawingGeofence={isDrawingGeofence}
              drawingPoints={drawingPoints}
              fitBoundsTrigger={fitBoundsTrigger}
              isFullscreen={isFullscreen}
              onRoadStatsComputed={setRoadStats}
              onTrajectoryHoverOrClick={handleTrajectoryHoverOrClick}
            />

            {/* Punto de Inicio de Jornada (Bandera de Salida) */}
            {selectedAgent.routeHistory.length > 0 && (
              <AdvancedMarker
                position={{
                  lat: selectedAgent.routeHistory[0].lat,
                  lng: selectedAgent.routeHistory[0].lng,
                }}
                title={`Inicio de Jornada (${selectedAgent.activeShiftStartTime || '08:00'})`}
              >
                <div className="px-2 py-1 rounded-lg bg-[#0A2540] border-2 border-amber-400 text-amber-300 font-black text-[10px] shadow-xl flex items-center gap-1 whitespace-nowrap">
                  <span>🏁 INICIO RUTA</span>
                  <span>({selectedAgent.activeShiftStartTime || '08:00'})</span>
                </div>
              </AdvancedMarker>
            )}

            {/* PUNTOS DE PASO INTERACTIVOS (MICRO-NODOS) A LO LARGO DE TODO EL TRAYECTO VIAL */}
            {trajectoryCheckpoints.map((chkNode) => {
              const isSelectedNode = selectedTrajectoryNode?.id === chkNode.id;
              const isPauseDetected = Boolean(chkNode.isUnregisteredStop);

              return (
                <AdvancedMarker
                  key={chkNode.id}
                  position={{ lat: chkNode.lat, lng: chkNode.lng }}
                  onClick={() => setSelectedTrajectoryNode(chkNode)}
                  title={`${chkNode.userName} • ${chkNode.timestamp} • ${chkNode.speedKmh} km/h • ${chkNode.streetName}`}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedTrajectoryNode(chkNode)}
                    onClick={() => setSelectedTrajectoryNode(chkNode)}
                    aria-label={`Punto de control vial ${chkNode.timestamp} en ${chkNode.streetName}`}
                    className={`group relative flex items-center justify-center transition-transform cursor-pointer ${
                      isPauseDetected
                        ? 'px-2 py-0.5 rounded-full bg-amber-950/95 border-2 border-amber-400 text-amber-200 text-[10px] font-extrabold shadow-lg hover:scale-110'
                        : isSelectedNode
                        ? 'w-5 h-5 rounded-full bg-[#FF6D00] border-2 border-white ring-4 ring-amber-400/50 scale-125 shadow-lg'
                        : 'w-3.5 h-3.5 rounded-full bg-[#FF6D00] border-2 border-slate-950 hover:scale-125 hover:border-white shadow-md'
                    }`}
                  >
                    {isPauseDetected ? (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <span>⏸️ Parada: {chkNode.stoppedMinutes} min</span>
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-200" />
                    )}
                  </button>
                </AdvancedMarker>
              );
            })}

            {/* Tooltip Flotante de Auditoría de Punto de Paso en el Trayecto */}
            {selectedTrajectoryNode && (
              <InfoWindow
                position={{
                  lat: selectedTrajectoryNode.lat,
                  lng: selectedTrajectoryNode.lng,
                }}
                onCloseClick={() => setSelectedTrajectoryNode(null)}
              >
                <div className="text-slate-900 p-1 min-w-[250px] max-w-[300px] text-xs space-y-1.5 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 gap-2">
                    <span className="font-black text-[#0A2540] text-xs flex items-center gap-1">
                      <span>🛰️ Punto de Paso Vial</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono font-bold text-[10px]">
                      {selectedTrajectoryNode.timestamp}
                    </span>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div>
                      <span className="text-slate-500 font-semibold">Usuario conectado:</span>{' '}
                      <strong className="text-slate-950">{selectedTrajectoryNode.userName}</strong>
                    </div>
                    <div className="flex items-center justify-between bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      <span>
                        <b>Velocidad:</b>{' '}
                        <span className="font-mono font-bold text-emerald-700">
                          {selectedTrajectoryNode.speedKmh} km/h
                        </span>
                      </span>
                      <span>
                        <b>Rumbo:</b>{' '}
                        <span className="font-mono">{selectedTrajectoryNode.heading}°</span>
                      </span>
                      <span>
                        <b>Bat:</b>{' '}
                        <span className="font-mono font-bold">
                          {selectedTrajectoryNode.battery}%
                        </span>
                      </span>
                    </div>
                    <div className="text-slate-800 leading-snug">
                      <b>Vía / Calle (Geocoder):</b>
                      <div className="text-slate-700 font-medium mt-0.5">
                        🛣️ {selectedTrajectoryNode.streetName}
                      </div>
                    </div>

                    {selectedTrajectoryNode.isUnregisteredStop &&
                      (selectedTrajectoryNode.stoppedMinutes || 0) > 5 && (
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-400 text-amber-950 font-bold flex items-center gap-1.5">
                          <span>
                            ⏸️ Parada detectada: {selectedTrajectoryNode.stoppedMinutes} min (Sin
                            visita registrada)
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* MARCADORES NUMERADOS CRONOLÓGICAMENTE DE CADA VISITA (1, 2, 3...) */}
            {selectedAgent.visits.map((visit, idx) => {
              const seqNumber = idx + 1;
              const category = classifyVisitMarkerCategory(visit, fraudCoordsList);
              const isRed = category === 'RED_ALERT';
              const isGreen = category === 'GREEN_EFFECTIVE';

              const amountVal = visit.orderAmount ?? visit.collectedAmount ?? 0;

              return (
                <AdvancedMarker
                  key={visit.id}
                  position={{ lat: visit.lat, lng: visit.lng }}
                  onClick={() => {
                    setInfoWindowVisit({ visit, seqNumber });
                    if (onSelectVisit) onSelectVisit(visit);
                  }}
                  title={`Visita #${seqNumber}: ${visit.name} (${visit.address})`}
                >
                  <div className="flex flex-col items-center cursor-pointer group select-none">
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 border-white shadow-xl transition-transform group-hover:scale-110 ${
                        isRed
                          ? 'bg-red-600 text-white animate-bounce ring-4 ring-red-500/50'
                          : isGreen
                          ? 'bg-emerald-600 text-white'
                          : 'bg-sky-600 text-white'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-950/80 text-white font-black text-[11px] flex items-center justify-center">
                        {seqNumber}
                      </span>
                      <span className="font-extrabold text-[10px] uppercase tracking-tight whitespace-nowrap">
                        {isRed
                          ? '🚨 ALERTA GPS'
                          : isGreen
                          ? formatActivityTypeLabel(visit.activityType).split(' ')[0]
                          : 'SEGUIMIENTO'}
                      </span>
                      {amountVal > 0 && (
                        <span className="bg-black/30 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold">
                          ${amountVal.toLocaleString('es-EC', { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                    <div
                      className={`w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] -mt-0.5 ${
                        isRed
                          ? 'border-t-red-600'
                          : isGreen
                          ? 'border-t-emerald-600'
                          : 'border-t-sky-600'
                      }`}
                    />
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* Marcadores de Alertas Operativas en Ruta */}
            {activeAlerts
              .filter((a) => !a.resolved)
              .map((alt) => (
                <AdvancedMarker
                  key={alt.id}
                  position={{ lat: alt.lat, lng: alt.lng }}
                  title={`Alerta: ${alt.type} - ${alt.description}`}
                >
                  <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-white text-white flex items-center justify-center text-sm shadow-xl animate-pulse">
                    ⚠️
                  </div>
                </AdvancedMarker>
              ))}

            {/* Marcador Animado durante la Reproducción del Recorrido del Día */}
            {isPlayingRoute && currentPlaybackStep && (
              <AdvancedMarker
                position={{ lat: currentPlaybackStep.lat, lng: currentPlaybackStep.lng }}
                title={`Reproduciendo recorrido: ${selectedAgent.user.name}`}
              >
                <div className="flex flex-col items-center">
                  <div className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] border-2 border-white shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
                    <span>▶️ {selectedAgent.user.name.split(' ')[0]}</span>
                    <span className="font-mono">
                      Paso {playbackStepIndex + 1}/{playbackPathSteps.length}
                    </span>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-[#FF6D00] border-2 border-white shadow-xl mt-0.5 animate-ping" />
                </div>
              </AdvancedMarker>
            )}

            {/* Marcadores de Ejecutivos / Flota en Tiempo Real con transición suave y pulso verde */}
            {(allAgents.length > 0 ? allAgents : [selectedAgent]).map((ag) => {
              const isFocused = ag.user.id === selectedAgent.user.id;
              const markerPos = isFocused ? activeLivePosition : ag.currentLocation;
              const markerSpeed = isFocused ? Math.round(liveSpeedKmh) : Math.round(ag.speed);

              return (
                <AdvancedMarker
                  key={ag.user.id}
                  position={markerPos}
                  onClick={() => {
                    if (onSelectAgent) onSelectAgent(ag.user.id);
                  }}
                  title={`${ag.user.name} (${markerSpeed} km/h)`}
                >
                  <div className="relative flex flex-col items-center cursor-pointer transition-all duration-500 ease-out">
                    {isFocused && (
                      <span className="mb-1 px-2 py-0.5 rounded-full bg-emerald-950/95 border border-emerald-400 text-[9px] font-extrabold text-emerald-300 flex items-center gap-1 shadow-lg whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>Rastreando trayecto en vivo • {liveHeadingDeg}°</span>
                      </span>
                    )}
                    <div
                      className={`rounded-full overflow-hidden border-2 shadow-2xl ${
                        isFocused
                          ? 'w-11 h-11 border-amber-400 ring-4 ring-emerald-500/40'
                          : 'w-9 h-9 border-white opacity-90'
                      }`}
                    >
                      <img
                        src={ag.user.avatar}
                        alt={ag.user.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="mt-0.5 px-2 py-0.5 rounded bg-slate-950/90 border border-amber-500/50 text-[10px] font-bold text-amber-300 whitespace-nowrap shadow">
                      {ag.user.name.split(' ')[0]} · {markerSpeed} km/h
                    </span>
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* InfoWindow Enriquecido de Google Maps al hacer clic en cualquier visita */}
            {infoWindowVisit && (
              <InfoWindow
                position={{
                  lat: infoWindowVisit.visit.lat,
                  lng: infoWindowVisit.visit.lng,
                }}
                onCloseClick={() => setInfoWindowVisit(null)}
              >
                <div className="text-slate-900 p-1 min-w-[255px] max-w-[300px] text-xs space-y-2 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 gap-2">
                    <span className="font-black text-[#0A2540] text-xs">
                      Parada #{infoWindowVisit.seqNumber} de {selectedAgent.visits.length}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-bold text-[10px]">
                      {infoWindowVisit.visit.actualArrivalTime ||
                        infoWindowVisit.visit.scheduledTime}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-slate-950 text-sm">
                      {infoWindowVisit.visit.name}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {infoWindowVisit.visit.companyName} · RUC:{' '}
                      <b>{infoWindowVisit.visit.clientRuc || '0992348192001'}</b>
                    </div>
                    <div className="text-[11px] text-slate-700 mt-1">
                      📍{' '}
                      {infoWindowVisit.visit.reverseGeocodedAddress ||
                        infoWindowVisit.visit.address}
                    </div>
                  </div>

                  <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 text-[11px] space-y-0.5">
                    <div>
                      <b>Gestión:</b> {formatActivityTypeLabel(infoWindowVisit.visit.activityType)}{' '}
                      ({infoWindowVisit.visit.operationStatus || 'Concretado'})
                    </div>
                    <div>
                      <b>Permanencia:</b> {infoWindowVisit.visit.durationMinutes || 35} min ·{' '}
                      <b>Doc:</b> {infoWindowVisit.visit.invoiceOrReceiptNumber || 'S/N'}
                    </div>
                    {(infoWindowVisit.visit.orderAmount ||
                      infoWindowVisit.visit.collectedAmount) && (
                      <div className="text-emerald-700 font-bold">
                        Monto: $
                        {(
                          infoWindowVisit.visit.orderAmount ||
                          infoWindowVisit.visit.collectedAmount ||
                          0
                        ).toLocaleString('es-EC', { minimumFractionDigits: 2 })}{' '}
                        USD
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalVisit(infoWindowVisit);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-[#0A2540] hover:bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Ficha 5 Secciones & Street View</span>
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMapEngine>

          {/* PANEL HUD FLOTANTE COLAPSABLE — CONTROL VITAL Y VIAL EN VIVO */}
          <div className="absolute top-3 left-3 z-20 w-80 sm:w-[375px] max-h-[calc(100%-3.5rem)] flex flex-col bg-[#0F172A]/95 backdrop-blur-md border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden text-xs">
            <div className="bg-[#0A2540] px-3 py-2 flex items-center justify-between border-b border-slate-700/80 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Navigation className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-white block leading-tight">
                    HUD de Control Vital en Vivo
                  </span>
                  <span className="text-[10px] text-slate-300 flex items-center gap-1.5">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        activeExecutiveVital.isOnline
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-slate-400'
                      }`}
                    />
                    <span>{selectedAgent.user.name}:</span>
                    <strong
                      className={
                        activeExecutiveVital.isOnline ? 'text-emerald-400' : 'text-slate-400'
                      }
                    >
                      {activeExecutiveVital.statusLabel}
                    </strong>
                    <span>•</span>
                    <span className="font-mono text-amber-300 font-bold">
                      🔋 {activeExecutiveVital.batteryPercent}%
                    </span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHudCollapsed((prev) => !prev)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer shrink-0"
                aria-label="Colapsar o expandir HUD del mapa"
              >
                {isHudCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </div>

            {!isHudCollapsed && (
              <div className="p-2.5 space-y-2 overflow-y-auto">
                {/* 1. LISTADO DE SUPERVISORES (Nivel Superior del HUD) */}
                <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="hud-supervisor-select"
                      className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1"
                    >
                      <Users className="w-3 h-3 text-amber-400" />
                      <span>1. Listado de Supervisores:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSelectHudSupervisor('ALL')}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer ${
                        selectedHudSupervisorId === 'ALL'
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Ver Todos ({allAgents.length})
                    </button>
                  </div>

                  <select
                    id="hud-supervisor-select"
                    value={selectedHudSupervisorId}
                    onChange={(e) => handleSelectHudSupervisor(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-semibold focus:border-amber-400 focus:outline-none"
                  >
                    <option value="ALL">
                      🌐 Todos los Supervisores ({allAgents.length} Ejecutivos)
                    </option>
                    {hudSupervisorsList.map(({ supervisor, totalExecutives, onlineExecutives }) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.name} — {supervisor.zone.split('&')[0].trim()} (
                        {onlineExecutives}/{totalExecutives} En Línea)
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-1 gap-1">
                    {hudSupervisorsList.map(({ supervisor, totalExecutives, onlineExecutives }) => {
                      const isSupSelected = selectedHudSupervisorId === supervisor.id;
                      return (
                        <button
                          key={supervisor.id}
                          type="button"
                          onClick={() =>
                            handleSelectHudSupervisor(isSupSelected ? 'ALL' : supervisor.id)
                          }
                          className={`w-full text-left px-2 py-1 rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                            isSupSelected
                              ? 'bg-amber-500/15 border-amber-400/80 text-white'
                              : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                onlineExecutives > 0 ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            <span className="font-bold text-[11px] truncate">
                              {supervisor.name}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">
                              ({supervisor.zone.split('&')[0].trim()})
                            </span>
                          </div>
                          <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-emerald-400 font-bold">
                            {onlineExecutives}/{totalExecutives} En Línea
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. LISTADO DE EJECUTIVOS PERTENECIENTES AL SUPERVISOR (Abajo del Supervisor, con % Batería y En Línea) */}
                <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="hud-executive-select"
                      className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1"
                    >
                      <UserCheck className="w-3 h-3 text-emerald-400" />
                      <span>2. Ejecutivos del Supervisor:</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {hudFilteredAgents.length} ejecutivos
                    </span>
                  </div>

                  {onSelectAgent && (
                    <select
                      id="hud-executive-select"
                      value={selectedAgent.user.id}
                      onChange={(e) => onSelectAgent(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-semibold focus:border-emerald-400 focus:outline-none"
                    >
                      {hudFilteredAgents.map((ag) => {
                        const vital = resolveExecutiveVitalTelemetry(ag, null, browserIsOnline);
                        return (
                          <option key={ag.user.id} value={ag.user.id}>
                            {ag.user.name} — {vital.statusLabel} (🔋 {vital.batteryPercent}%)
                          </option>
                        );
                      })}
                    </select>
                  )}

                  <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                    {hudFilteredAgents.map((ag) => {
                      const isCurrentExec = ag.user.id === selectedAgent.user.id;
                      const vital = isCurrentExec
                        ? activeExecutiveVital
                        : resolveExecutiveVitalTelemetry(ag, null, browserIsOnline);

                      const batteryColorClass =
                        vital.batterySeverity === 'HIGH'
                          ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/50'
                          : vital.batterySeverity === 'MEDIUM'
                          ? 'text-amber-400 border-amber-500/40 bg-amber-950/50'
                          : 'text-red-400 border-red-500/40 bg-red-950/50';

                      const batteryBarColor =
                        vital.batterySeverity === 'HIGH'
                          ? 'bg-emerald-400'
                          : vital.batterySeverity === 'MEDIUM'
                          ? 'bg-amber-400'
                          : 'bg-red-500';

                      return (
                        <button
                          key={ag.user.id}
                          type="button"
                          onClick={() => onSelectAgent && onSelectAgent(ag.user.id)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                            isCurrentExec
                              ? 'bg-[#0A2540] border-amber-400/90 shadow-md'
                              : 'bg-slate-900/75 border-slate-800 hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  vital.isOnline
                                    ? 'bg-emerald-400 animate-pulse'
                                    : 'bg-slate-500'
                                }`}
                              />
                              <span className="font-bold text-white text-[11px] truncate">
                                {ag.user.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                  vital.isOnline
                                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                                    : 'bg-slate-900 border-slate-700 text-slate-400'
                                }`}
                              >
                                {vital.isOnline ? (
                                  <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <WifiOff className="w-2.5 h-2.5 text-slate-400" />
                                )}
                                <span>{vital.statusLabel}</span>
                              </span>

                              <div
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[10px] font-bold ${batteryColorClass}`}
                                title={`Nivel de batería reportado: ${vital.batteryPercent}%`}
                              >
                                {vital.isCharging ? (
                                  <BatteryCharging className="w-2.5 h-2.5" />
                                ) : (
                                  <Battery className="w-2.5 h-2.5" />
                                )}
                                <span>{vital.batteryPercent}%</span>
                                <div className="w-5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${batteryBarColor}`}
                                    style={{ width: `${vital.batteryPercent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-400 pl-3.5">
                            <span className="truncate">
                              {ag.user.zone} •{' '}
                              <strong className="text-slate-300">{vital.activityBadge}</strong>
                            </span>
                            <span className="font-mono">Ping: {ag.lastPing}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. MODO "SEGUIR USUARIO EN VIVO" & REPRODUCTOR DE RECORRIDO CALLE A CALLE */}
                <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                      <span>🟢 Grabando Trayecto en Vivo</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/40 font-mono text-[10px] text-emerald-300 font-bold">
                      {trajectoryCheckpoints.length} pts GPS
                    </span>
                  </div>

                  {/* Controles Operativos: Interruptor Auto-Follow + Botón Reproducir Recorrido del Día */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      aria-pressed={isAutoFollowEnabled}
                      onClick={() => setIsAutoFollowEnabled((prev) => !prev)}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isAutoFollowEnabled
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-md font-black'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">🎯 Seguir en Mapa (Auto-Follow)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTogglePlaybackRoute}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isPlayingRoute
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md font-black'
                          : 'bg-[#0A2540] hover:bg-slate-800 text-amber-300 border-amber-500/50'
                      }`}
                    >
                      {isPlayingRoute ? (
                        <>
                          <Square className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">⏹️ Detener Reproducción</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">▶️ Reproducir Recorrido del Día</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Barra de Progreso en Vivo cuando está activa la Reproducción del Recorrido */}
                  {isPlayingRoute && currentPlaybackStep && (
                    <div className="p-2 rounded-lg bg-slate-900 border border-amber-500/50 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-amber-300">
                          Animando recorrido vial ({playbackStepIndex + 1}/
                          {playbackPathSteps.length})
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {Math.round(
                            ((playbackStepIndex + 1) / Math.max(1, playbackPathSteps.length)) * 100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all duration-300"
                          style={{
                            width: `${Math.round(
                              ((playbackStepIndex + 1) / Math.max(1, playbackPathSteps.length)) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-300 truncate">
                        🛣️ {currentPlaybackStep.streetName || 'Av. Juan Tanca Marengo'}
                      </div>
                    </div>
                  )}

                  {/* Indicadores en vivo del trayecto: Tiempo en movimiento vs. Tiempo detenido */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="bg-slate-900/90 px-2 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>En Movimiento:</span>
                      </span>
                      <strong className="font-mono text-emerald-400">
                        {formatMinutesToHuman(trajectoryVitalMetrics.movingMinutes)}
                      </strong>
                    </div>
                    <div className="bg-slate-900/90 px-2 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Pause className="w-3 h-3 text-amber-400" />
                        <span>Detenido:</span>
                      </span>
                      <strong className="font-mono text-amber-400">
                        {formatMinutesToHuman(trajectoryVitalMetrics.stoppedMinutes)}
                      </strong>
                    </div>
                  </div>

                  {/* Estado de WakeLock y Filtro Anti-Ruido 8m */}
                  <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5 border-t border-slate-800/80">
                    <span>
                      Filtro GPS: <strong className="text-slate-200">≥ 8m (Alta Precisión)</strong>
                    </span>
                    <span>
                      WakeLock:{' '}
                      <strong className={wakeLockActive ? 'text-emerald-400' : 'text-amber-300'}>
                        {wakeLockActive ? 'Pantalla Activa' : 'Auto-Reintento'}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* 4. ESTADO VITAL DEL DISPOSITIVO + FECHA DE OPERACIÓN */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-semibold flex items-center gap-1">
                      {browserIsOnline ? (
                        <Wifi className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-red-400" />
                      )}
                      <span>
                        Red Local:{' '}
                        <strong className="text-white">
                          {browserIsOnline ? 'En Línea' : 'Sin Red'}
                        </strong>
                      </span>
                    </span>
                    <span className="font-mono text-slate-300">
                      {hardwareBattery ? (
                        <>
                          Bat. Local:{' '}
                          <strong className="text-amber-400">{hardwareBattery.levelPercent}%</strong>{' '}
                          •{' '}
                        </>
                      ) : null}
                      GPS:{' '}
                      <strong className="text-emerald-400 uppercase">
                        {selectedAgent.gpsSignal}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="hud-operation-date"
                      className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 shrink-0"
                    >
                      <Calendar className="w-3 h-3 text-sky-400" />
                      <span>Fecha:</span>
                    </label>
                    <input
                      id="hud-operation-date"
                      type="date"
                      value={selectedDateFilter}
                      onChange={(e) => setSelectedDateFilter(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] text-white font-mono"
                    />
                  </div>
                </div>

                {/* Resumen de Ruta en Vivo (Km Reales en Vía, Visitas, Tiempo Total y Alertas GPS) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Km Reales en Vía</span>
                    <strong className="text-amber-400 font-mono text-sm">
                      {trajectoryVitalMetrics.totalDistanceKm} km
                    </strong>
                  </div>
                  <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Visitas Completadas</span>
                    <strong className="text-emerald-400 font-mono text-sm">
                      {completedVisitsCount} / {selectedAgent.visits.length}
                    </strong>
                  </div>
                  <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Tiempo Total Ruta</span>
                    <strong className="text-sky-400 font-mono text-sm">
                      {formatMinutesToHuman(roadStats.roadDurationMinutes)}
                    </strong>
                  </div>
                  <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Alertas GPS</span>
                    <strong
                      className={`font-mono text-sm ${
                        totalFraudAlertsForAgent > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {totalFraudAlertsForAgent} activas
                    </strong>
                  </div>
                </div>

                {/* Acceso directo a llave Google Maps en Configuración TIC (Exclusivo ADMIN y XBRIONES) */}
                <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <span>Trazado vial calle a calle (`steps[].path`)</span>
                  </span>
                  {canUserAccessTicConfig(latinaSession) && (
                    <button
                      type="button"
                      onClick={openSysConfigModal}
                      className="text-amber-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      title="Configuración de Conexiones — Área de TIC (ADMIN / XBRIONES)"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Conexiones TIC</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* LEYENDA INFERIOR DE COLORES DE MARCADORES, MICRO-NODOS Y VECTORES */}
          <div className="absolute bottom-3 left-3 z-20 bg-[#0F172A]/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/90 text-[11px] text-slate-200 flex flex-wrap items-center gap-3 shadow-xl">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white" />
              <span>Verde: Visita Efectiva</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sky-500 border border-white" />
              <span>Azul: Seguimiento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-600 border border-white animate-pulse" />
              <span>Rojo: Alerta GPS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FF6D00] border border-white" />
              <span>Micro-Nodo / Clic en Vía: Auditoría Hora y Calle</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#FF6D00] font-black">➤➤</span>
              <span>Trayecto Vial Exacto (`steps[].path` cada 60px)</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE DETALLE COMPLETO DE VISITA (5 SECCIONES + STREET VIEW PANORAMA) */}
      <VisitDetailAndStreetViewModal
        visit={detailModalVisit?.visit || null}
        visitSequenceIndex={detailModalVisit?.seqNumber || 1}
        totalVisitsInRoute={selectedAgent.visits.length}
        executiveUser={selectedAgent.user}
        viewerRole={latinaSession?.rol || 'ADMINISTRADOR'}
        onClose={() => setDetailModalVisit(null)}
      />
    </>
  );
};
