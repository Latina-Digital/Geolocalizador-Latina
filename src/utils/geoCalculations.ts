import { RoutePoint, SuspiciousAlert, AlertType } from '../types';

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(3));
}

/**
 * Checks if a point lies within a circular geofence
 */
export function isInsideGeofence(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radiusKm: number
): boolean {
  const distance = calculateDistanceKm(point.lat, point.lng, center.lat, center.lng);
  return distance <= radiusKm;
}

/**
 * Standard Ray-Casting algorithm to check if a GPS coordinate is inside a polygon
 */
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: { lat: number; lng: number }[]
): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Checks if a point is inside either a polygon or circular geofence
 */
export function isInsideCustomGeofence(
  point: { lat: number; lng: number },
  geofence: {
    center?: { lat: number; lng: number };
    radiusKm?: number;
    coordinates?: { lat: number; lng: number }[];
  }
): boolean {
  if (geofence.coordinates && geofence.coordinates.length >= 3) {
    return isPointInPolygon(point, geofence.coordinates);
  }
  if (geofence.center && geofence.radiusKm) {
    return isInsideGeofence(point, geofence.center, geofence.radiusKm);
  }
  return true; // If no boundaries configured, assume inside
}

/**
 * Calculates total distance of an array of route points
 */
export function calculateTotalRouteDistance(points: RoutePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateDistanceKm(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }
  return parseFloat(total.toFixed(2));
}

/**
 * Calculates Route Efficiency Score from 0 to 100
 * Factors:
 * - Visit completion rate (45%)
 * - Distance optimization / km efficiency (25%)
 * - Average speed & driving consistency (15%)
 * - Anomaly/Alert deductions (15% with penalty)
 */
export interface EfficiencyInput {
  plannedVisits: number;
  completedVisits: number;
  totalKm: number;
  expectedKm: number;
  alertsCount: number;
  timeSpentInVisitsMinutes: number;
  totalShiftMinutes: number;
}

export function calculateEfficiencyScore(input: EfficiencyInput): number {
  const {
    plannedVisits,
    completedVisits,
    totalKm,
    expectedKm,
    alertsCount,
    timeSpentInVisitsMinutes,
    totalShiftMinutes,
  } = input;

  if (plannedVisits === 0) return 100;

  // 1. Visit completion score (max 45 pts)
  const visitRate = Math.min(completedVisits / plannedVisits, 1);
  const visitScore = visitRate * 45;

  // 2. Kilometers optimization (max 25 pts)
  // If actual km is reasonably close to expected km, full points. Excessive deviance reduces score.
  let kmScore = 25;
  if (expectedKm > 0 && totalKm > 0) {
    const ratio = totalKm / expectedKm;
    if (ratio > 1.4) {
      kmScore = Math.max(5, 25 - (ratio - 1.4) * 30);
    } else if (ratio < 0.6 && completedVisits < plannedVisits) {
      kmScore = 15;
    }
  }

  // 3. Time utilization in front of clients (max 15 pts)
  let timeScore = 15;
  if (totalShiftMinutes > 0) {
    const activeClientRatio = timeSpentInVisitsMinutes / totalShiftMinutes;
    // Target is around 40%-60% of workday spent inside client stores
    timeScore = Math.min(15, Math.max(5, activeClientRatio * 25));
  }

  // 4. Incident & Anomaly deduction (max 15 pts)
  // Each alert deducts 3 to 5 points
  const alertPenalty = alertsCount * 4;
  const alertScore = Math.max(0, 15 - alertPenalty);

  const rawTotal = Math.round(visitScore + kmScore + timeScore + alertScore);
  return Math.max(0, Math.min(100, rawTotal));
}

/**
 * Checks for anomalies such as speeding, prolonged stop, or geofence violation
 */
export function checkForAnomalies(
  currentPoint: RoutePoint,
  recentPoints: RoutePoint[],
  geofence: {
    center?: { lat: number; lng: number };
    radiusKm?: number;
    coordinates?: { lat: number; lng: number }[];
    name: string;
  },
  agentId: string,
  agentName: string,
  zone: string
): SuspiciousAlert | null {
  // 1. Speed limit check (> 85 km/h for urban/sales route)
  if (currentPoint.speed > 85) {
    return {
      id: `alert-spd-${Date.now()}`,
      agentId,
      agentName,
      type: 'EXCESO_VELOCIDAD',
      severity: 'alta',
      timestamp: currentPoint.timestamp,
      lat: currentPoint.lat,
      lng: currentPoint.lng,
      description: `Velocidad excesiva detectada: ${Math.round(currentPoint.speed)} km/h en ruta asignada.`,
      resolved: false,
      zone,
    };
  }

  // 2. Geofence violation check (Polygon or Circular)
  const inside = isInsideCustomGeofence(
    { lat: currentPoint.lat, lng: currentPoint.lng },
    geofence
  );

  if (!inside) {
    const isPoly = geofence.coordinates && geofence.coordinates.length >= 3;
    const boundaryDesc = isPoly
      ? `polígono delimitado (${geofence.coordinates?.length} vértices)`
      : `radio de ${geofence.radiusKm} km`;

    return {
      id: `alert-geo-${Date.now()}`,
      agentId,
      agentName,
      type: 'FUERA_GEOCERCA',
      severity: 'alta',
      timestamp: currentPoint.timestamp,
      lat: currentPoint.lat,
      lng: currentPoint.lng,
      description: `Agente fuera del perímetro asignado: "${geofence.name}" (${boundaryDesc}).`,
      resolved: false,
      zone,
    };
  }

  // 3. Prolonged stop in unauthorized zone (speed 0 for last 4 consecutive points when not in visit)
  if (recentPoints.length >= 4 && currentPoint.status === 'stopped') {
    const allStopped = recentPoints.slice(-4).every(p => p.speed < 1 && p.status === 'stopped');
    if (allStopped) {
      return {
        id: `alert-stop-${Date.now()}`,
        agentId,
        agentName,
        type: 'PARADA_PROLONGADA',
        severity: 'media',
        timestamp: currentPoint.timestamp,
        lat: currentPoint.lat,
        lng: currentPoint.lng,
        description: `Detención no programada superior a 20 minutos sin registro de visita a cliente.`,
        resolved: false,
        zone,
      };
    }
  }

  return null;
}

/**
 * Formats minutes into human-readable hours and minutes (e.g. 1h 25m)
 */
export function formatMinutesToHuman(minutes: number): string {
  if (minutes < 0) minutes = 0;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

/**
 * Calculates duration in minutes between two HH:MM strings (assuming same day)
 */
export function calculateMinutesBetweenTimes(startHHMM: string, endHHMM: string): number {
  if (!startHHMM || !endHHMM) return 0;
  const [startH, startM] = startHHMM.split(':').map(Number);
  const [endH, endM] = endHHMM.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;

  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  const diff = endTotal - startTotal;
  return diff >= 0 ? diff : diff + 1440;
}

/**
 * Validates if a shift has reached or exceeded the 9-hour mandatory closure limit (9 * 60 * 60 * 1000 ms)
 */
export const NINE_HOURS_MS = 9 * 60 * 60 * 1000;

export function hasShiftExceeded9Hours(
  shiftStartTimestamp: number,
  nowTimestamp: number = Date.now()
): boolean {
  if (!shiftStartTimestamp || shiftStartTimestamp <= 0) return false;
  return nowTimestamp - shiftStartTimestamp >= NINE_HOURS_MS;
}

/**
 * Calculates remaining minutes until 9-hour automatic shift closure
 */
export function getRemainingMinutesTo9Hours(
  shiftStartTimestamp: number,
  nowTimestamp: number = Date.now()
): number {
  if (!shiftStartTimestamp || shiftStartTimestamp <= 0) return 540;
  const elapsedMs = nowTimestamp - shiftStartTimestamp;
  const remainingMs = NINE_HOURS_MS - elapsedMs;
  return Math.max(0, Math.floor(remainingMs / 60000));
}

