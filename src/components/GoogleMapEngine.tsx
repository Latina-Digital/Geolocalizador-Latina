/// <reference types="google.maps" />
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Componente `GoogleMapEngine`:
 * Encapsula la instancia oficial de `google.maps.Map`, verificando primero la existencia
 * de `googleMapsApiKey` dentro de `geolatina_sys_config` (en `localStorage` y contexto del sistema)
 * antes de renderizar la cartografía.
 *
 * Incluye:
 * - Verificación estricta de `geolatina_sys_config.googleMapsApiKey` con acceso directo a Configuración si falta.
 * - Carga dinámica del SDK oficial (`https://maps.googleapis.com/maps/api/js?key=...&libraries=geometry,places,marker`).
 * - Instancia real de `google.maps.Map` con controles nativos:
 *   * Street View (`streetViewControl: true`)
 *   * Selector de Tipo de Mapa (`mapTypeControl: true`: Carreteras, Satélite, Híbrido, Terreno)
 *   * Control de Zoom (`zoomControl: true`)
 * - Capa de Tráfico en Tiempo Real (`new google.maps.TrafficLayer()`).
 * - Renderizado de rutas viales por segmentos mediante `google.maps.DirectionsRenderer` y `google.maps.Polyline`
 *   enriquecidos con iconos direccionales `google.maps.SymbolPath.FORWARD_CLOSED_ARROW` a lo largo de cada tramo.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import {
  SYS_CONFIG_STORAGE_KEY,
  loadGoogleMapsScriptDynamically,
  saveGoogleMapsApiKeyToSysConfig,
  canUserAccessTicConfig,
} from '../services/latinaApiEngine';
import {
  computeStreetNetworkRouteWithDirectionsService,
  extractDetailedStepsPathFromGoogleRoute,
} from '../utils/googleMapsRouting';
import { calculateDistanceKm } from '../utils/geoCalculations';
import { LatLngPoint } from '../types';
import { KeyRound, Settings, CheckCircle2, AlertTriangle } from 'lucide-react';

export type GoogleMapEngineTypeId = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

export interface GoogleMapEngineProps {
  center: LatLngPoint;
  zoom?: number;
  mapTypeId?: GoogleMapEngineTypeId;
  showTrafficLayer?: boolean;
  streetViewControl?: boolean;
  mapTypeControl?: boolean;
  zoomControl?: boolean;
  routeWaypoints?: LatLngPoint[];
  directionsResults?: google.maps.DirectionsResult[];
  fallbackDistanceKm?: number;
  visitStayMinutes?: number;
  visitTravelMinutes?: number;
  onRouteStatsComputed?: (stats: { roadDistanceKm: number; roadDurationMinutes: number }) => void;
  onMapClick?: (point: LatLngPoint) => void;
  onMapInstanceReady?: (map: google.maps.Map) => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Construye las opciones de polilínea (`google.maps.PolylineOptions`) para segmentos viales
 * incorporando vectores `google.maps.SymbolPath.FORWARD_CLOSED_ARROW` cada `60px`
 * con color naranja corporativo (`#FF6D00` / `#F59E0B`) y grosor `5px`.
 */
export function createDirectionalPolylineOptions(
  strokeColor: string = '#FF6D00',
  strokeWeight: number = 5
): google.maps.PolylineOptions {
  const forwardArrowSymbol: google.maps.Symbol = {
    path:
      typeof google !== 'undefined' && google.maps?.SymbolPath
        ? google.maps.SymbolPath.FORWARD_CLOSED_ARROW
        : (1 as google.maps.SymbolPath),
    scale: 3.4,
    strokeColor: '#0F172A',
    strokeWeight: 1.2,
    fillColor: '#F59E0B',
    fillOpacity: 1,
  };

  return {
    geodesic: true,
    strokeColor,
    strokeOpacity: 0.96,
    strokeWeight,
    icons: [
      {
        icon: forwardArrowSymbol,
        offset: '30px',
        repeat: '60px',
      },
    ],
  };
}

/**
 * Lee y verifica directamente en `localStorage` (`geolatina_sys_config`) la existencia de `googleMapsApiKey`.
 */
export function getVerifiedGoogleMapsKeyFromSysConfig(fallbackConfigKey?: string): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(SYS_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.googleMapsApiKey === 'string' && parsed.googleMapsApiKey.trim().length > 0) {
          return parsed.googleMapsApiKey.trim();
        }
      }
    } catch {
      // Fallback to context config key
    }
  }
  return (fallbackConfigKey || '').trim();
}

/**
 * Controlador interno que sincroniza la instancia real `google.maps.Map`,
 * la capa `google.maps.TrafficLayer`, los controles nativos solicitados y
 * los `DirectionsRenderer` / polilíneas con `google.maps.SymbolPath.FORWARD_CLOSED_ARROW`.
 */
const GoogleMapNativeInstanceController: React.FC<{
  containerElRef?: React.RefObject<HTMLDivElement | null>;
  mapTypeId: GoogleMapEngineTypeId;
  showTrafficLayer: boolean;
  streetViewControl: boolean;
  mapTypeControl: boolean;
  zoomControl: boolean;
  routeWaypoints?: LatLngPoint[];
  directionsResults?: google.maps.DirectionsResult[];
  fallbackDistanceKm?: number;
  visitStayMinutes?: number;
  visitTravelMinutes?: number;
  onRouteStatsComputed?: (stats: { roadDistanceKm: number; roadDurationMinutes: number }) => void;
  onMapInstanceReady?: (map: google.maps.Map) => void;
}> = ({
  containerElRef,
  mapTypeId,
  showTrafficLayer,
  streetViewControl,
  mapTypeControl,
  zoomControl,
  routeWaypoints = [],
  directionsResults = [],
  fallbackDistanceKm = 0,
  visitStayMinutes = 0,
  visitTravelMinutes = 0,
  onRouteStatsComputed,
  onMapInstanceReady,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const geometryLib = useMapsLibrary('geometry');

  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const directionsRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  const directionalPolylinesRef = useRef<google.maps.Polyline[]>([]);

  // 1. Exponer instancia `google.maps.Map` y configurar opciones nativas
  useEffect(() => {
    if (!map) return;

    map.setOptions({
      mapTypeId,
      gestureHandling: 'greedy',
      streetViewControl,
      mapTypeControl,
      zoomControl,
      mapTypeControlOptions: {
        mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
      },
    });

    if (onMapInstanceReady) {
      onMapInstanceReady(map);
    }
  }, [map, mapTypeId, streetViewControl, mapTypeControl, zoomControl, onMapInstanceReady]);

  // 1.B Detección de Rotación de Pantalla (orientationchange + resize) y ResizeObserver con re-encuadre automático (fitBounds)
  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    const triggerMapResizeAndRefit = (shouldRefitBounds: boolean = false) => {
      if (typeof google !== 'undefined' && google.maps?.event) {
        google.maps.event.trigger(map, 'resize');
        if (shouldRefitBounds && routeWaypoints && routeWaypoints.length > 1) {
          const bounds = new google.maps.LatLngBounds();
          routeWaypoints.forEach((pt) => bounds.extend(pt));
          map.fitBounds(bounds, 48);
        } else if (shouldRefitBounds && routeWaypoints && routeWaypoints.length === 1) {
          map.setCenter(routeWaypoints[0]);
        }
      }
    };

    const handleWindowResize = () => triggerMapResizeAndRefit(false);
    const handleOrientationChange = () => {
      setTimeout(() => triggerMapResizeAndRefit(true), 120);
    };

    const targetNode =
      containerElRef?.current || (typeof map.getDiv === 'function' ? map.getDiv() : null);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && targetNode) {
      observer = new ResizeObserver(() => {
        triggerMapResizeAndRefit(false);
      });
      observer.observe(targetNode);
    }

    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [map, containerElRef, routeWaypoints]);

  // 2. Gestionar Capa de Tráfico en Tiempo Real (`google.maps.TrafficLayer`)
  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.TrafficLayer) return;

    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new google.maps.TrafficLayer();
    }

    trafficLayerRef.current.setMap(showTrafficLayer ? map : null);

    return () => {
      trafficLayerRef.current?.setMap(null);
    };
  }, [map, showTrafficLayer]);

  // 3. Si se proveen `directionsResults` explícitos, extraer `route.legs[i].steps[j].path` detallados
  // aplicando `polylineOptions` con `google.maps.SymbolPath.FORWARD_CLOSED_ARROW` cada 60px
  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.Polyline) return;

    directionsRenderersRef.current.forEach((dr) => dr.setMap(null));
    directionsRenderersRef.current = [];

    if (!directionsResults || directionsResults.length === 0) return;

    const polylineOpts = createDirectionalPolylineOptions('#FF6D00', 5);
    const createdPolys: google.maps.Polyline[] = [];

    directionsResults.forEach((result) => {
      const detailedStepsPath = extractDetailedStepsPathFromGoogleRoute(result?.routes?.[0]);
      if (detailedStepsPath && detailedStepsPath.length > 1) {
        const poly = new google.maps.Polyline({
          ...polylineOpts,
          path: detailedStepsPath,
          map,
        });
        createdPolys.push(poly);
      }
    });

    return () => {
      createdPolys.forEach((p) => p.setMap(null));
    };
  }, [map, directionsResults]);

  // 4. Trazado vial por segmentos con `Polyline` y flechas `FORWARD_CLOSED_ARROW`
  // a partir de `routeWaypoints` cronológicos
  useEffect(() => {
    if (!map || typeof google === 'undefined') return;

    directionalPolylinesRef.current.forEach((p) => p.setMap(null));
    directionalPolylinesRef.current = [];

    if (!routeWaypoints || routeWaypoints.length < 2) {
      if (onRouteStatsComputed) {
        onRouteStatsComputed({
          roadDistanceKm: fallbackDistanceKm,
          roadDurationMinutes: visitStayMinutes + visitTravelMinutes,
        });
      }
      return;
    }

    let cancelled = false;

    const renderDirectionalRouteSegments = async () => {
      const {
        path: fullRoadPath,
        totalDistanceMeters,
        totalDurationSeconds,
      } = await computeStreetNetworkRouteWithDirectionsService(routeWaypoints, routesLib);

      if (cancelled || !map) return;

      const directionalOptions = createDirectionalPolylineOptions('#FF6D00', 5);

      const effectivePath = fullRoadPath.length >= 2 ? fullRoadPath : routeWaypoints;
      const poly = new google.maps.Polyline({
        ...directionalOptions,
        path: effectivePath,
        map,
      });
      directionalPolylinesRef.current.push(poly);

      if (onRouteStatsComputed) {
        let computedKm = totalDistanceMeters > 0 ? totalDistanceMeters / 1000 : 0;
        if (computedKm === 0 && geometryLib?.spherical && effectivePath.length >= 2) {
          const latLngObjs = effectivePath.map((p) => new google.maps.LatLng(p.lat, p.lng));
          computedKm = geometryLib.spherical.computeLength(latLngObjs) / 1000;
        }
        if (computedKm === 0) {
          let accum = 0;
          for (let i = 1; i < routeWaypoints.length; i++) {
            accum += calculateDistanceKm(
              routeWaypoints[i - 1].lat,
              routeWaypoints[i - 1].lng,
              routeWaypoints[i].lat,
              routeWaypoints[i].lng
            );
          }
          computedKm = accum || fallbackDistanceKm;
        }

        onRouteStatsComputed({
          roadDistanceKm: Number(Math.max(computedKm, fallbackDistanceKm).toFixed(2)),
          roadDurationMinutes:
            totalDurationSeconds > 0
              ? Math.round(totalDurationSeconds / 60) + visitStayMinutes
              : visitTravelMinutes + visitStayMinutes,
        });
      }
    };

    renderDirectionalRouteSegments();

    return () => {
      cancelled = true;
      directionalPolylinesRef.current.forEach((p) => p.setMap(null));
      directionalPolylinesRef.current = [];
    };
  }, [
    map,
    routesLib,
    geometryLib,
    routeWaypoints,
    fallbackDistanceKm,
    visitStayMinutes,
    visitTravelMinutes,
    onRouteStatsComputed,
  ]);

  return null;
};

export const GoogleMapEngine: React.FC<GoogleMapEngineProps> = ({
  center,
  zoom = 14,
  mapTypeId = 'roadmap',
  showTrafficLayer = true,
  streetViewControl = true,
  mapTypeControl = true,
  zoomControl = true,
  routeWaypoints,
  directionsResults,
  fallbackDistanceKm,
  visitStayMinutes,
  visitTravelMinutes,
  onRouteStatsComputed,
  onMapClick,
  onMapInstanceReady,
  children,
  className = 'w-full h-full min-h-[500px] flex-1',
}) => {
  const { user, config, updateSysConfig, openSysConfigModal } = useGeoLatinaSystem();
  const isTicAuthorized = canUserAccessTicConfig(user);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const [quickKeyInput, setQuickKeyInput] = useState<string>('');
  const [isScriptReady, setIsScriptReady] = useState<boolean>(
    () => typeof window !== 'undefined' && Boolean((window as any).google?.maps?.importLibrary)
  );
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Verificar la existencia de `googleMapsApiKey` en `geolatina_sys_config`
  const verifiedApiKey = useMemo(() => {
    return getVerifiedGoogleMapsKeyFromSysConfig(config.googleMapsApiKey);
  }, [config.googleMapsApiKey, config.lastUpdated]);

  useEffect(() => {
    if (!verifiedApiKey) {
      setIsScriptReady(false);
      return;
    }

    let active = true;
    setScriptError(null);

    loadGoogleMapsScriptDynamically(verifiedApiKey, 'geometry,places,marker').then((res) => {
      if (!active) return;
      if (res.loaded || Boolean((window as any).google?.maps)) {
        setIsScriptReady(true);
      } else if (res.error) {
        setScriptError(res.error);
      }
    });

    return () => {
      active = false;
    };
  }, [verifiedApiKey]);

  // Limpiar automáticamente cualquier modal de restricción de facturación (`.dismissButton`)
  // inyectado por Google Maps si el proyecto Cloud aún no tiene cuenta de facturación vinculada
  useEffect(() => {
    const container = mapWrapperRef.current;
    if (!container || typeof MutationObserver === 'undefined') return;

    const cleanBillingOverlay = () => {
      const dismissButtons = container.querySelectorAll<HTMLButtonElement>('button.dismissButton');
      dismissButtons.forEach((btn) => {
        const dialogOverlay = btn.closest('div[style*="background-color"]') as HTMLElement | null;
        if (dialogOverlay) {
          dialogOverlay.style.display = 'none';
        } else {
          btn.click();
        }
      });
    };

    const observer = new MutationObserver(() => {
      cleanBillingOverlay();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [verifiedApiKey, isScriptReady]);

  const handleQuickSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = quickKeyInput.trim();
    if (!clean) return;
    const updated = saveGoogleMapsApiKeyToSysConfig(clean);
    updateSysConfig(updated);
  };

  // Si NO existe `googleMapsApiKey` en `geolatina_sys_config`, bloquear el renderizado del mapa
  // y presentar el panel de verificación / acceso directo a Configuración de Sistema
  if (!verifiedApiKey) {
    return (
      <div className="geo-map-surface w-full h-full min-h-[500px] flex-1 relative bg-[#0F172A] border border-amber-500/40 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <div className="w-full max-w-xl bg-[#1E293B] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Se Requiere Google Maps API Key (Producción)
            </h3>
            <p className="text-xs text-slate-300">
              El motor <code className="text-amber-300">GoogleMapEngine</code> verificó{' '}
              <code className="text-amber-300">geolatina_sys_config</code> y no encontró una llave{' '}
              <code className="text-emerald-300">googleMapsApiKey</code> activa.
            </p>
          </div>

          {isTicAuthorized ? (
            <form onSubmit={handleQuickSaveKey} className="space-y-2.5 text-left">
              <label className="block text-[11px] font-bold text-amber-300">
                Ingresar Google Maps API Key en `geolatina_sys_config` (Área de TIC):
              </label>
              <input
                type="text"
                value={quickKeyInput}
                onChange={(e) => setQuickKeyInput(e.target.value)}
                placeholder="AIzaSy... (Google Maps JavaScript API Key)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar y Activar Mapa</span>
                </button>
                <button
                  type="button"
                  onClick={openSysConfigModal}
                  className="py-2 px-3 rounded-lg bg-[#0A2540] hover:bg-slate-800 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span>⚙️ Conexiones TIC</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
              Solicite la configuración de conexión cartográfica al <strong className="text-amber-300">Área de TIC</strong> (Perfil <code className="text-white">ADMIN</code> o usuario <code className="text-amber-300">XBRIONES</code>).
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isScriptReady) {
    return (
      <div className="geo-map-surface w-full h-full min-h-[500px] flex-1 relative flex flex-col items-center justify-center bg-slate-950 text-slate-300 text-xs gap-2 p-6">
        {scriptError ? (
          <div className="w-full max-w-xl text-center space-y-2">
            <AlertTriangle className="w-7 h-7 text-amber-400 mx-auto" />
            <p className="text-amber-300 font-bold">{scriptError}</p>
            {isTicAuthorized && (
              <button
                type="button"
                onClick={openSysConfigModal}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Revisar Google Maps API Key en Conexiones TIC
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <span className="font-bold text-white">
              Inicializando GoogleMapEngine (`google.maps.Map` · `geometry,places,marker`)...
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={mapWrapperRef}
      className="geo-map-surface w-full h-full min-h-[500px] flex-1 relative flex flex-col"
    >
      <APIProvider
        apiKey={verifiedApiKey}
        libraries={['geometry', 'places', 'marker', 'routes']}
      >
        <GoogleMap
          defaultCenter={center}
          defaultZoom={zoom}
          mapId="DEMO_MAP_ID"
          mapTypeId={mapTypeId}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling="greedy"
          streetViewControl={streetViewControl}
          mapTypeControl={mapTypeControl}
          fullscreenControl={false}
          zoomControl={zoomControl}
          onClick={(ev) => {
            if (onMapClick && ev.detail.latLng) {
              onMapClick({
                lat: ev.detail.latLng.lat,
                lng: ev.detail.latLng.lng,
              });
            }
          }}
          className={className}
        >
          <GoogleMapNativeInstanceController
            containerElRef={mapWrapperRef}
            mapTypeId={mapTypeId}
            showTrafficLayer={showTrafficLayer}
            streetViewControl={streetViewControl}
            mapTypeControl={mapTypeControl}
            zoomControl={zoomControl}
            routeWaypoints={routeWaypoints}
            directionsResults={directionsResults}
            fallbackDistanceKm={fallbackDistanceKm}
            visitStayMinutes={visitStayMinutes}
            visitTravelMinutes={visitTravelMinutes}
            onRouteStatsComputed={onRouteStatsComputed}
            onMapInstanceReady={onMapInstanceReady}
          />
          {children}
        </GoogleMap>
      </APIProvider>
    </div>
  );
};
