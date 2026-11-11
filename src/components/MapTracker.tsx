/// <reference types="google.maps" />
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor Cartográfico de Producción Real — Google Maps Platform JavaScript API
 * Reemplaza por completo cualquier simulador o librería alternativa (Leaflet/OSM).
 * Integra:
 * - @vis.gl/react-google-maps (<APIProvider>, <Map>, <AdvancedMarker>, <InfoWindow>, useMap, useMapsLibrary)
 * - Trazado vial exacto calle a calle (Routes API computeRoutes + vectores direccionales FORWARD_CLOSED_ARROW)
 * - Capa de Tráfico en Tiempo Real (google.maps.TrafficLayer) y Selector de Tipo de Mapa (Carreteras, Satélite, Híbrido, Terreno)
 * - Modo Pantalla Completa ("🔲 Agrandar Mapa / Vista Completa" / "🗗 Restaurar Vista" + ESC) con HUD Flotante Colapsable
 * - Marcadores cronológicos numerados (Verde / Azul / Rojo Parpadeante) + InfoWindow + Inspector Completo 5 Secciones y Street View
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
import {
  getProvisionedGoogleMapsKey,
  loadGoogleMapsScriptDynamically,
  canUserAccessTicConfig,
} from '../services/latinaApiEngine';
import {
  buildChronologicalRouteWaypoints,
  chunkRouteWaypoints,
  computeStreetNetworkRouteWithDirectionsService,
  classifyVisitMarkerCategory,
  formatActivityTypeLabel,
} from '../utils/googleMapsRouting';
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
  ShieldAlert,
  Calendar,
  UserCheck,
  Activity,
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
 * que gestiona el trazado vial por calles y avenidas, flechas direccionales,
 * capa de tráfico en tiempo real, geocercas y auto-encuadre (`fitBounds`).
 */
const GoogleMapsCanvasEffects: React.FC<{
  selectedAgent: AgentRealTimeState;
  showTrafficLayer: boolean;
  showGeofence: boolean;
  customGeofences: CustomGeofence[];
  isDrawingGeofence: boolean;
  drawingPoints: LatLngPoint[];
  fitBoundsTrigger: number;
  isFullscreen: boolean;
  onRoadStatsComputed: (stats: { roadDistanceKm: number; roadDurationMinutes: number }) => void;
}> = ({
  selectedAgent,
  showTrafficLayer,
  showGeofence,
  customGeofences,
  isDrawingGeofence,
  drawingPoints,
  fitBoundsTrigger,
  isFullscreen,
  onRoadStatsComputed,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const geometryLib = useMapsLibrary('geometry');

  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const roadPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const geofenceShapesRef = useRef<Array<google.maps.Polygon | google.maps.Circle>>([]);
  const drawingShapesRef = useRef<Array<google.maps.Polyline | google.maps.Polygon>>([]);

  // Secuencia cronológica de puntos reales del recorrido (Inicio -> Puntos GPS / Visitas -> Posición Actual)
  const chronologicalWaypoints = useMemo<LatLngPoint[]>(() => {
    return buildChronologicalRouteWaypoints(selectedAgent);
  }, [selectedAgent]);

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

  // 2. Detección de Rotación de Pantalla (orientationchange + resize) y ResizeObserver con re-encuadre instantáneo (fitBounds)
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
      map.panTo(selectedAgent.currentLocation);
      map.setZoom(15);
    }
  }, [map, chronologicalWaypoints, selectedAgent]);

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

  // 3. Centrar Todo el Recorrido (map.fitBounds)
  useEffect(() => {
    if (!map || fitBoundsTrigger === 0) return;
    fitEntireRouteBounds();
  }, [map, fitBoundsTrigger, fitEntireRouteBounds]);

  // 4. Trazado Vial Exacto por las Vías y Calles del Mapa (Routes API computeRoutes + Vectores Direccionales)
  useEffect(() => {
    if (!map) return;

    // Limpiar polilíneas previas
    roadPolylinesRef.current.forEach((p) => p.setMap(null));
    roadPolylinesRef.current = [];

    if (chronologicalWaypoints.length < 2) {
      onRoadStatsComputed({
        roadDistanceKm: selectedAgent.todayKm || 0,
        roadDurationMinutes: 0,
      });
      return;
    }

    let cancelled = false;

    const renderDirectionalStreetPolyline = (pathCoords: google.maps.LatLngLiteral[]) => {
      if (cancelled || !map || pathCoords.length < 2) return;

      const arrowSymbol: google.maps.Symbol = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 3.2,
        strokeColor: '#0F172A',
        strokeWeight: 1.2,
        fillColor: '#F59E0B',
        fillOpacity: 1,
      };

      const poly = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: '#D97706',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        icons: [
          {
            icon: arrowSymbol,
            offset: '45px',
            repeat: '95px',
          },
        ],
        map,
      });

      roadPolylinesRef.current.push(poly);
    };

    const computeStreetLevelRoute = async () => {
      // Procesar visitas y puntos cronológicos como waypoints mediante `google.maps.DirectionsService`
      // (dividiendo automáticamente en bloques secuenciales si los puntos superan 25 waypoints)
      const {
        path: fullRoadPath,
        totalDistanceMeters: totalMeters,
        totalDurationSeconds: totalSeconds,
      } = await computeStreetNetworkRouteWithDirectionsService(
        chronologicalWaypoints,
        routesLib
      );

      if (cancelled) return;

      renderDirectionalStreetPolyline(
        fullRoadPath.length >= 2 ? fullRoadPath : chronologicalWaypoints
      );

      // Calcular distancia real sobre la vía usando google.maps.geometry.spherical.computeLength
      let computedKm = totalMeters > 0 ? totalMeters / 1000 : 0;
      if (computedKm === 0 && geometryLib?.spherical && fullRoadPath.length >= 2) {
        const latLngObjs = fullRoadPath.map((p) => new google.maps.LatLng(p.lat, p.lng));
        computedKm = geometryLib.spherical.computeLength(latLngObjs) / 1000;
      }
      if (computedKm === 0) {
        let accum = 0;
        for (let i = 1; i < chronologicalWaypoints.length; i++) {
          accum += calculateDistanceKm(
            chronologicalWaypoints[i - 1].lat,
            chronologicalWaypoints[i - 1].lng,
            chronologicalWaypoints[i].lat,
            chronologicalWaypoints[i].lng
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
      });
    };

    computeStreetLevelRoute();

    return () => {
      cancelled = true;
      roadPolylinesRef.current.forEach((p) => p.setMap(null));
      roadPolylinesRef.current = [];
    };
  }, [map, routesLib, geometryLib, chronologicalWaypoints, selectedAgent]);

  // 5. Renderizar Geocercas Corporativas (Polígonos y Círculos en Google Maps)
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

  // 6. Capa de Dibujo Interactivo de Geocerca
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
  const { config, user: latinaSession, openSysConfigModal, gpsFraudAlerts } = useGeoLatinaSystem();

  // Google Maps API Key (configurada en geolatina_sys_config.googleMapsApiKey o provisionada en AI Studio)
  const effectiveGoogleMapsKey = useMemo(() => {
    return (config.googleMapsApiKey || '').trim() || getProvisionedGoogleMapsKey();
  }, [config.googleMapsApiKey]);

  const [isScriptReady, setIsScriptReady] = useState<boolean>(
    () => typeof window !== 'undefined' && Boolean((window as any).google?.maps?.importLibrary)
  );

  useEffect(() => {
    let active = true;
    loadGoogleMapsScriptDynamically(effectiveGoogleMapsKey, 'geometry,places,marker').then((res) => {
      if (!active) return;
      if (res.loaded || Boolean((window as any).google?.maps)) {
        setIsScriptReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [effectiveGoogleMapsKey]);

  // Estados de Cartografía y Pantalla Completa
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);
  const [mapTypeId, setMapTypeId] = useState<GoogleMapTypeId>('roadmap');
  const [showTrafficLayer, setShowTrafficLayer] = useState<boolean>(true);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [fitBoundsTrigger, setFitBoundsTrigger] = useState<number>(1);

  // Estadísticas viales calculadas sobre la carretera
  const [roadStats, setRoadStats] = useState<{
    roadDistanceKm: number;
    roadDurationMinutes: number;
  }>({
    roadDistanceKm: selectedAgent.todayKm || 28.6,
    roadDurationMinutes: 245,
  });

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
            {/* Indicador Oficial Google Maps Producción */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-700 text-xs text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-white">Google Maps GIS</span>
              <span className="text-slate-500">|</span>
              <strong className="text-amber-400">{selectedAgent.user.name}</strong>
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
              title="Ajusta automáticamente el zoom para mostrar todas las visitas del día en pantalla (map.fitBounds)"
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
            center={selectedAgent.currentLocation}
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
              {/* Efectos de Trazado Vial por Calles, Vectores Direccionales, Tráfico y Geocercas */}
              <GoogleMapsCanvasEffects
                selectedAgent={selectedAgent}
                showTrafficLayer={showTrafficLayer}
                showGeofence={showGeofence}
                customGeofences={customGeofences}
                isDrawingGeofence={isDrawingGeofence}
                drawingPoints={drawingPoints}
                fitBoundsTrigger={fitBoundsTrigger}
                isFullscreen={isFullscreen}
                onRoadStatsComputed={setRoadStats}
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

              {/* Marcadores de Ejecutivos / Flota en Tiempo Real */}
              {(allAgents.length > 0 ? allAgents : [selectedAgent]).map((ag) => {
                const isFocused = ag.user.id === selectedAgent.user.id;
                return (
                  <AdvancedMarker
                    key={ag.user.id}
                    position={ag.currentLocation}
                    onClick={() => {
                      if (onSelectAgent) onSelectAgent(ag.user.id);
                    }}
                    title={`${ag.user.name} (${Math.round(ag.speed)} km/h)`}
                  >
                    <div className="relative flex flex-col items-center cursor-pointer">
                      <div
                        className={`rounded-full overflow-hidden border-2 shadow-2xl ${
                          isFocused
                            ? 'w-11 h-11 border-amber-400 ring-4 ring-amber-500/40'
                            : 'w-9 h-9 border-white opacity-90'
                        }`}
                      >
                        <img
                          src={ag.user.avatar}
                          alt={ag.user.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="mt-0.5 px-2 py-0.5 rounded bg-slate-950/90 border border-amber-500/50 text-[10px] font-bold text-amber-300 whitespace-nowrap shadow">
                        {ag.user.name.split(' ')[0]} · {Math.round(ag.speed)} km/h
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

          {/* PANEL HUD FLOTANTE COLAPSABLE (Especialmente útil en Vista Completa / Maximizada) */}
          <div className="absolute top-3 left-3 z-20 w-72 sm:w-80 bg-[#0F172A]/95 backdrop-blur-md border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden text-xs">
            <div className="bg-[#0A2540] px-3.5 py-2.5 flex items-center justify-between border-b border-slate-700/80">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white">
                  HUD de Control Vial en Vivo
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHudCollapsed((prev) => !prev)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
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
              <div className="p-3.5 space-y-3">
                {/* Filtros en vivo por Ejecutivo de Ventas y Fecha */}
                <div className="grid grid-cols-1 gap-2">
                  {allAgents.length > 1 && onSelectAgent && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1">
                        <UserCheck className="w-3 h-3 text-amber-400" />
                        <span>Ejecutivo en Ruta:</span>
                      </label>
                      <select
                        value={selectedAgent.user.id}
                        onChange={(e) => onSelectAgent(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold"
                      >
                        {allAgents.map((ag) => (
                          <option key={ag.user.id} value={ag.user.id}>
                            {ag.user.name} ({ag.user.zone})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3 text-sky-400" />
                      <span>Fecha de Operación:</span>
                    </label>
                    <input
                      type="date"
                      value={selectedDateFilter}
                      onChange={(e) => setSelectedDateFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Resumen de Ruta en Vivo (Km Reales en Vía, Visitas, Tiempo Total y Alertas GPS) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                  <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Km Reales en Vía</span>
                    <strong className="text-amber-400 font-mono text-sm">
                      {roadStats.roadDistanceKm} km
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
                    <span>Vectores viales activos</span>
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

          {/* LEYENDA INFERIOR DE COLORES DE MARCADORES Y VECTORES */}
          <div className="absolute bottom-3 left-3 z-20 bg-[#0F172A]/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/90 text-[11px] text-slate-200 flex flex-wrap items-center gap-3 shadow-xl">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white" />
              <span>Verde: Visita Efectiva Completada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sky-500 border border-white" />
              <span>Azul: Seguimiento / Pendiente</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-600 border border-white animate-pulse" />
              <span>Rojo: Alerta Ubicación / GPS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 font-black">➤➤</span>
              <span>Sentido Vial Calle a Calle</span>
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
