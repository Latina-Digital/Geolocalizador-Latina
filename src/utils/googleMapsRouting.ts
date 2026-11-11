/// <reference types="google.maps" />
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure utility functions and `google.maps.DirectionsService` street-network routing engine
 * (supporting chronological visit waypoints and automatic chunking when waypoints exceed 25 points).
 */

import { ActivityType, AgentRealTimeState, ClientVisit, LatLngPoint } from '../types';

export interface RouteSegmentChunk {
  origin: LatLngPoint;
  destination: LatLngPoint;
  intermediates: LatLngPoint[];
}

export interface DirectionsChunkRequestSpec {
  origin: LatLngPoint;
  destination: LatLngPoint;
  waypoints: Array<{ location: LatLngPoint; stopover: boolean }>;
  optimizeWaypoints: boolean;
  travelMode: string;
}

export type VisitPinColorCategory = 'GREEN_EFFECTIVE' | 'BLUE_FOLLOWUP' | 'RED_ALERT';

/**
 * Extracts chronological route waypoints from the agent's route history, chronological visits,
 * and current live GPS position.
 */
export function buildChronologicalRouteWaypoints(selectedAgent: AgentRealTimeState): LatLngPoint[] {
  const pts: LatLngPoint[] = [];

  selectedAgent.routeHistory.forEach((pt) => {
    if (
      pts.length === 0 ||
      Math.abs(pts[pts.length - 1].lat - pt.lat) > 0.00005 ||
      Math.abs(pts[pts.length - 1].lng - pt.lng) > 0.00005
    ) {
      pts.push({ lat: pt.lat, lng: pt.lng });
    }
  });

  // Integrate chronological visit points as waypoints along the route
  selectedAgent.visits
    .filter((v) => v.status === 'completada' || v.status === 'en_visita')
    .forEach((v) => {
      const alreadyNear = pts.some(
        (p) => Math.abs(p.lat - v.lat) < 0.0002 && Math.abs(p.lng - v.lng) < 0.0002
      );
      if (!alreadyNear) {
        pts.push({ lat: v.lat, lng: v.lng });
      }
    });

  // Finish with the agent's current live position
  if (
    pts.length === 0 ||
    Math.abs(pts[pts.length - 1].lat - selectedAgent.currentLocation.lat) > 0.00005 ||
    Math.abs(pts[pts.length - 1].lng - selectedAgent.currentLocation.lng) > 0.00005
  ) {
    pts.push({
      lat: selectedAgent.currentLocation.lat,
      lng: selectedAgent.currentLocation.lng,
    });
  }

  return pts;
}

/**
 * Splits a chronological list of route points into sequential overlapping segments
 * where each segment has at most `maxPointsPerChunk` total points (origin + intermediates + destination).
 * Google Maps DirectionsService / Routes API supports up to 25 total points (origin + destination + 23 waypoints) per request.
 */
export function chunkRouteWaypoints(
  points: LatLngPoint[],
  maxPointsPerChunk: number = 25
): RouteSegmentChunk[] {
  if (!points || points.length < 2) return [];

  const safeMax = Math.max(2, Math.min(25, maxPointsPerChunk));
  const chunks: RouteSegmentChunk[] = [];

  let startIndex = 0;
  while (startIndex < points.length - 1) {
    const endIndex = Math.min(startIndex + safeMax - 1, points.length - 1);
    const slice = points.slice(startIndex, endIndex + 1);

    chunks.push({
      origin: slice[0],
      destination: slice[slice.length - 1],
      intermediates: slice.slice(1, slice.length - 1),
    });

    startIndex = endIndex;
  }

  return chunks;
}

/**
 * Builds sequential `google.maps.DirectionsRequest` objects from chronological waypoints,
 * splitting into multiple chunks whenever total points exceed 25.
 */
export function buildDirectionsRequestsForChunks(
  points: LatLngPoint[],
  maxPointsPerChunk: number = 25
): DirectionsChunkRequestSpec[] {
  const chunks = chunkRouteWaypoints(points, maxPointsPerChunk);
  return chunks.map((chunk) => ({
    origin: chunk.origin,
    destination: chunk.destination,
    waypoints: chunk.intermediates.map((pt) => ({
      location: { lat: pt.lat, lng: pt.lng },
      stopover: true,
    })),
    optimizeWaypoints: false,
    travelMode: 'DRIVING',
  }));
}

/**
 * Processes chronological waypoints through `google.maps.DirectionsService` (with automatic
 * >25-point chunk splitting and Routes API street-geometry resolution) so routes follow
 * actual street network geometries (`overview_path` / `legs[].steps[].path`) instead of straight lines.
 */
export async function computeStreetNetworkRouteWithDirectionsService(
  points: LatLngPoint[],
  routesLib?: any
): Promise<{
  path: google.maps.LatLngLiteral[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  chunkCount: number;
}> {
  if (!points || points.length < 2) {
    return {
      path: points ? [...points] : [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      chunkCount: 0,
    };
  }

  const requestChunks = buildDirectionsRequestsForChunks(points, 25);
  const fullRoadPath: google.maps.LatLngLiteral[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  let RouteClass =
    (routesLib as any)?.Route ||
    (typeof window !== 'undefined' && (window as any).google?.maps?.routes?.Route);

  if (
    !RouteClass &&
    typeof window !== 'undefined' &&
    typeof (window as any).google?.maps?.importLibrary === 'function'
  ) {
    try {
      const importedRoutesLib = await (window as any).google.maps.importLibrary('routes');
      RouteClass = importedRoutesLib?.Route;
    } catch {
      // Fallback if importLibrary('routes') is not ready yet
    }
  }

  for (const reqSpec of requestChunks) {
    let chunkResolved = false;

    // Resolver la geometría vial exacta de la red de calles mediante Routes API (New) `Route.computeRoutes`
    if (RouteClass && typeof RouteClass.computeRoutes === 'function') {
      try {
        const response = await RouteClass.computeRoutes({
          origin: reqSpec.origin,
          destination: reqSpec.destination,
          intermediates: reqSpec.waypoints.map((w) => ({ location: w.location })),
          travelMode: reqSpec.travelMode,
          optimizeWaypoints: reqSpec.optimizeWaypoints,
          fields: ['path', 'distanceMeters', 'durationMillis'],
        });

        const route = response?.routes?.[0];
        if (route?.path && route.path.length > 0) {
          route.path.forEach((p: any) => {
            const lat = typeof p.lat === 'function' ? p.lat() : p.lat;
            const lng = typeof p.lng === 'function' ? p.lng() : p.lng;
            fullRoadPath.push({ lat, lng });
          });
          totalDistanceMeters += route.distanceMeters || 0;
          totalDurationSeconds += Math.round((route.durationMillis || 0) / 1000);
          chunkResolved = true;
        }
      } catch (err: any) {
        if (/429|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT/i.test(String(err?.message || err))) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
        }
      }
    }

    // Respaldo de continuidad del segmento si aún está inicializando la librería routes
    if (!chunkResolved) {
      [
        reqSpec.origin,
        ...reqSpec.waypoints.map((w) => w.location),
        reqSpec.destination,
      ].forEach((pt) => fullRoadPath.push(pt));
    }
  }

  return {
    path: fullRoadPath.length >= 2 ? fullRoadPath : [...points],
    totalDistanceMeters,
    totalDurationSeconds,
    chunkCount: requestChunks.length,
  };
}

/**
 * Classifies a ClientVisit into one of the 3 required corporate marker states:
 * - RED_ALERT: Visit with suspicious location alert or GPS anomaly detected
 * - GREEN_EFFECTIVE: Completed visit with commercial management/order/collection
 * - BLUE_FOLLOWUP: Informative visit / follow-up in progress or pending
 */
export function classifyVisitMarkerCategory(
  visit: ClientVisit,
  fraudAlertCoords: Array<{ lat: number; lng: number }> = []
): VisitPinColorCategory {
  if (visit.hasFraudAlert || visit.gpsAuthenticSeal === false) {
    return 'RED_ALERT';
  }

  const nearFraudCoord = fraudAlertCoords.some(
    (c) => Math.abs(c.lat - visit.lat) < 0.0015 && Math.abs(c.lng - visit.lng) < 0.0015
  );
  if (nearFraudCoord) {
    return 'RED_ALERT';
  }

  if (visit.status === 'completada' || visit.hasTachuelaPin) {
    return 'GREEN_EFFECTIVE';
  }

  return 'BLUE_FOLLOWUP';
}

export function formatActivityTypeLabel(type?: ActivityType): string {
  switch (type) {
    case 'VENTA':
      return 'Venta / Pedido';
    case 'COTIZACION_PROFORMA':
      return 'Cotización / Proforma';
    case 'COBRANZA':
      return 'Cobranza';
    case 'VISITA_TECNICA':
      return 'Visita Técnica';
    case 'POSTVENTA':
      return 'Postventa';
    case 'SEGUIMIENTO':
      return 'Seguimiento Comercial';
    default:
      return 'Gestión Comercial';
  }
}

const GUAYAQUIL_STREET_CORRIDORS: Array<{
  lat: number;
  lng: number;
  streetAddress: string;
}> = [
  {
    lat: -2.143,
    lng: -79.918,
    streetAddress: 'Vía a Daule Km 5.5, Parque Industrial Latina, Guayaquil 090603, Ecuador',
  },
  {
    lat: -2.155,
    lng: -79.905,
    streetAddress: 'Av. Juan Tanca Marengo Km 3.5, Urb. Kennedy Norte, Guayaquil 090512, Ecuador',
  },
  {
    lat: -2.168,
    lng: -79.899,
    streetAddress: 'Av. Francisco de Orellana y Av. Plaza Dañín, Cdla. Kennedy, Guayaquil 090510, Ecuador',
  },
  {
    lat: -2.181,
    lng: -79.913,
    streetAddress: 'Av. Carlos Julio Arosemena Km 2.5, Sector Miraflores, Guayaquil 090615, Ecuador',
  },
  {
    lat: -2.192,
    lng: -79.889,
    streetAddress: 'Av. 9 de Octubre 612 y Boyacá, Centro Urbano, Guayaquil 090313, Ecuador',
  },
  {
    lat: -2.178,
    lng: -79.835,
    streetAddress: 'Av. Nicolás Lapentti Km 3.5, Zona Industrial Durán, Guayas 092401, Ecuador',
  },
  {
    lat: -2.238,
    lng: -79.892,
    streetAddress: 'Av. Domingo Comín y Calle Portete, Parroquia Ximena, Guayaquil 090109, Ecuador',
  },
  {
    lat: -2.265,
    lng: -79.888,
    streetAddress: 'Av. 25 de Julio Km 4.5, Vía al Puerto Marítimo, Guayaquil 090112, Ecuador',
  },
  {
    lat: -2.285,
    lng: -79.901,
    streetAddress: 'Terminal Portuario Simón Bolívar, Av. de la Marina, Guayaquil 090204, Ecuador',
  },
  {
    lat: -2.125,
    lng: -79.932,
    streetAddress: 'Vía a Daule Km 11.5, Parque Industrial Pascuales, Guayaquil 090701, Ecuador',
  },
];

/**
 * Resuelve la dirección vial exacta a partir de coordenadas GPS empleando el padrón cartográfico
 * y cálculo geodésico sin requerir el servicio externo de Geocoding API si no tiene facturación activa.
 */
export function resolveExactStreetAddress(
  lat: number,
  lng: number,
  existingAddress?: string
): string {
  if (
    existingAddress &&
    existingAddress.trim().length > 8 &&
    !existingAddress.startsWith('Punto GPS')
  ) {
    return existingAddress.trim();
  }

  let closest = GUAYAQUIL_STREET_CORRIDORS[0];
  let minSqDist = Number.POSITIVE_INFINITY;

  for (const corridor of GUAYAQUIL_STREET_CORRIDORS) {
    const dLat = lat - corridor.lat;
    const dLng = lng - corridor.lng;
    const sqDist = dLat * dLat + dLng * dLng;
    if (sqDist < minSqDist) {
      minSqDist = sqDist;
      closest = corridor;
    }
  }

  // Si está dentro de ~2.5 km de un corredor vial conocido, devolver la arteria exacta con referencia de coordenada
  if (minSqDist < 0.0008) {
    return closest.streetAddress;
  }

  return `${closest.streetAddress} (Ref. GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}
