/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 4: Detector Anti-Fraude GPS (Mock Location) y Alertas Jerárquicas (GeoIntegrityGuard)
 * Evalúa las 5 heurísticas técnicas en lecturas de navigator.geolocation para usuarios EJECUTIVO_VENTAS.
 */

import { calculateDistanceKm } from '../utils/geoCalculations';
import { getRoleHierarchyLevel } from './latinaApiEngine';

export const GPS_FRAUD_ALERTS_STORAGE_KEY = 'geolatina_gps_fraud_alerts';

export type GpsFraudAnomalyCode =
  | 'ALERTA_TELETRANSPORTE'
  | 'ALERTA_PRECISION_ARTIFICIAL'
  | 'ALERTA_TIMESTAMP_ALTERADO'
  | 'ALERTA_SENSORES_INCONSISTENTES'
  | 'ALERTA_DISCREPANCIA_ZONA_HORARIA';

export interface GpsTelemetrySample {
  lat: number;
  lng: number;
  accuracy: number;
  altitudeAccuracy?: number | null;
  speedKmh?: number | null;
  positionTimestamp: number;
  systemTimestamp?: number;
  previousLat?: number;
  previousLng?: number;
  previousTimestamp?: number;
  recentAccuracies?: number[];
  deviceMotionAcceleration?: number | null; // m/s^2 from DeviceMotionEvent
  isWebDriverOrEmulator?: boolean;
  reportedTimezoneOffsetMinutes?: number; // e.g., new Date().getTimezoneOffset() (Ecuador = +300)
}

export interface GpsFraudAlertRecord {
  id: string;
  executiveId: string;
  executiveName: string;
  executiveRole: string;
  sucursal: string;
  timestampIso: string;
  timestampLocal: string;
  lat: number;
  lng: number;
  previousLat?: number;
  previousLng?: number;
  calculatedSpeedKmh?: number;
  reportedAccuracyMeters: number;
  anomalyCode: GpsFraudAnomalyCode;
  heuristicNumber: 1 | 2 | 3 | 4 | 5;
  heuristicTitle: string;
  technicalReason: string;
  severity: 'CRÍTICA';
  acknowledgedBySupervisor: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  immutableHash: string;
}

/**
 * Evalúa las 5 heurísticas técnicas de GeoIntegrityGuard sobre una muestra de ubicación GPS.
 */
export function evaluateGpsIntegrityHeuristics(
  sample: GpsTelemetrySample,
  executiveInfo: {
    id: string;
    name: string;
    role: string;
    sucursal: string;
  }
): GpsFraudAlertRecord[] {
  const detected: GpsFraudAlertRecord[] = [];
  const sysNow = sample.systemTimestamp ?? Date.now();
  const isoStr = new Date(sysNow).toISOString();
  const localStr = new Date(sysNow).toLocaleString('es-EC');

  const createAlert = (
    code: GpsFraudAnomalyCode,
    heuristicNumber: 1 | 2 | 3 | 4 | 5,
    title: string,
    reason: string,
    calcSpeed?: number
  ): GpsFraudAlertRecord => ({
    id: `fraud-gps-${sysNow}-${heuristicNumber}-${Math.random().toString(36).slice(2, 6)}`,
    executiveId: executiveInfo.id,
    executiveName: executiveInfo.name,
    executiveRole: executiveInfo.role,
    sucursal: executiveInfo.sucursal,
    timestampIso: isoStr,
    timestampLocal: localStr,
    lat: sample.lat,
    lng: sample.lng,
    previousLat: sample.previousLat,
    previousLng: sample.previousLng,
    calculatedSpeedKmh: calcSpeed,
    reportedAccuracyMeters: sample.accuracy,
    anomalyCode: code,
    heuristicNumber,
    heuristicTitle: title,
    technicalReason: reason,
    severity: 'CRÍTICA',
    acknowledgedBySupervisor: false,
    immutableHash: `SHA256-LATINA-${sysNow.toString(16).toUpperCase()}-H${heuristicNumber}`,
  });

  // HEURÍSTICA 1: Velocidad / Teletransporte Imposible (> 130 km/h en ruta urbana o salto brusco de km en segundos)
  if (
    sample.previousLat !== undefined &&
    sample.previousLng !== undefined &&
    sample.previousTimestamp !== undefined
  ) {
    const distanceKm = calculateDistanceKm(
      sample.previousLat,
      sample.previousLng,
      sample.lat,
      sample.lng
    );
    const elapsedSeconds = Math.max(1, (sample.positionTimestamp - sample.previousTimestamp) / 1000);
    const elapsedHours = elapsedSeconds / 3600;
    const computedSpeedKmh = Math.round(distanceKm / elapsedHours);

    if (computedSpeedKmh > 130 || (distanceKm >= 2.0 && elapsedSeconds <= 30)) {
      detected.push(
        createAlert(
          'ALERTA_TELETRANSPORTE',
          1,
          'Heurística #1: Velocidad / Teletransporte Imposible',
          `Salto geográfico de ${distanceKm.toFixed(2)} km en ${Math.round(elapsedSeconds)}s (Velocidad calculada Haversine: ${computedSpeedKmh} km/h > límite 130 km/h). Indicio directo de inyección de coordenadas (Fake GPS / Mock Location).`,
          computedSpeedKmh
        )
      );
    }
  }

  // HEURÍSTICA 2: Precisión Artificial Fija (coords.accuracy clavada en 0, 1, 3, 5 sin variación o altitudeAccuracy === null con accuracy < 2m)
  const fixedSuspectValues = [0, 1, 3, 5];
  const isExactFixedNumber =
    fixedSuspectValues.includes(sample.accuracy) &&
    sample.recentAccuracies &&
    sample.recentAccuracies.length >= 2 &&
    sample.recentAccuracies.every((a) => a === sample.accuracy);

  const isNullAltitudeHighPrecision =
    sample.altitudeAccuracy === null && sample.accuracy > 0 && sample.accuracy <= 2;

  if (sample.accuracy === 0 || isExactFixedNumber || isNullAltitudeHighPrecision) {
    detected.push(
      createAlert(
        'ALERTA_PRECISION_ARTIFICIAL',
        2,
        'Heurística #2: Precisión Artificial Fija (Simulador GPS)',
        `El proveedor de ubicación reportó coords.accuracy=${sample.accuracy}m invariable con altitudeAccuracy=${String(
          sample.altitudeAccuracy
        )}. Patrón característico de software Mock Location / emulador GPS.`
      )
    );
  }

  // HEURÍSTICA 3: Desfase de Timestamp (position.timestamp vs Date.now())
  const timestampDriftMs = Math.abs(sysNow - sample.positionTimestamp);
  if (timestampDriftMs > 120_000) {
    const driftSec = Math.round(timestampDriftMs / 1000);
    detected.push(
      createAlert(
        'ALERTA_TIMESTAMP_ALTERADO',
        3,
        'Heurística #3: Desfase Crítico de Timestamp GPS vs Reloj del Sistema',
        `Desincronización de ${driftSec} segundos entre position.timestamp y Date.now(). Indica reproducción de ruta pregrabada o manipulación del paquete NMEA.`
      )
    );
  }

  // HEURÍSTICA 4: Inconsistencia de Sensores de Movimiento (GPS reporta desplazamiento rápido pero acelerómetro en reposo absoluto 0.00 m/s² o entorno emulado)
  const effectiveSpeed = sample.speedKmh ?? 0;
  const isMovingFastOnGps = effectiveSpeed > 25;
  const isSensorCompletelyStill =
    sample.deviceMotionAcceleration !== undefined &&
    sample.deviceMotionAcceleration !== null &&
    sample.deviceMotionAcceleration === 0;

  if ((isMovingFastOnGps && isSensorCompletelyStill) || sample.isWebDriverOrEmulator === true) {
    detected.push(
      createAlert(
        'ALERTA_SENSORES_INCONSISTENTES',
        4,
        'Heurística #4: Inconsistencia de Sensores Físicos / Entorno Emulado',
        `El GPS reporta desplazamiento a ${Math.round(
          effectiveSpeed
        )} km/h mientras el sensor físico DeviceMotionEvent registra reposo absoluto (${
          sample.deviceMotionAcceleration ?? 0
        } m/s²) o ejecución en contenedor emulado.`
      )
    );
  }

  // HEURÍSTICA 5: Discrepancia de Zona Horaria / Red vs Coordenadas reportadas
  // Ecuador Continental está en UTC-5 (offset = +300 min) y coordenadas aprox lat [-5.5, 1.5], lng [-81.5, -75.0]
  if (sample.reportedTimezoneOffsetMinutes !== undefined) {
    const isCoordsInEcuador =
      sample.lat >= -5.5 && sample.lat <= 1.5 && sample.lng >= -81.5 && sample.lng <= -75.0;
    const isEcuadorOrGalapagosTz =
      sample.reportedTimezoneOffsetMinutes === 300 || sample.reportedTimezoneOffsetMinutes === 360;

    if (!isCoordsInEcuador || !isEcuadorOrGalapagosTz) {
      detected.push(
        createAlert(
          'ALERTA_DISCREPANCIA_ZONA_HORARIA',
          5,
          'Heurística #5: Discrepancia de Zona Horaria / Red vs Coordenadas',
          `Coordenadas (${sample.lat.toFixed(4)}, ${sample.lng.toFixed(
            4
          )}) o zona horaria del dispositivo (UTC offset ${
            sample.reportedTimezoneOffsetMinutes
          } min) no coinciden con la jurisdicción operativa de Industrial Latina S.A.`
        )
      );
    }
  }

  return detected;
}

/**
 * Determina si el rol actual tiene jerarquía superior a EJECUTIVO_VENTAS (Nivel >= 2)
 * para recibir y gestionar alertas anti-fraude GPS.
 */
export function canUserAccessGpsFraudAlerts(rol: string | undefined): boolean {
  return getRoleHierarchyLevel(rol) >= 2;
}

export const INITIAL_SEED_FRAUD_ALERTS: GpsFraudAlertRecord[] = [
  {
    id: 'fraud-seed-001',
    executiveId: 'agt-1',
    executiveName: 'Carlos Vera',
    executiveRole: 'EJECUTIVO_VENTAS',
    sucursal: 'Sucursal Norte - División Comercial',
    timestampIso: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    timestampLocal: new Date(Date.now() - 18 * 60 * 1000).toLocaleString('es-EC'),
    lat: -2.0850,
    lng: -79.9620,
    previousLat: -2.1810,
    previousLng: -79.9130,
    calculatedSpeedKmh: 438,
    reportedAccuracyMeters: 1.0,
    anomalyCode: 'ALERTA_TELETRANSPORTE',
    heuristicNumber: 1,
    heuristicTitle: 'Heurística #1: Velocidad / Teletransporte Imposible',
    technicalReason:
      'Salto geográfico de 12.15 km en 100s (Velocidad calculada Haversine: 438 km/h > límite 130 km/h) con precisión fija clavada en 1.0m. Indicio directo de aplicativo Fake GPS.',
    severity: 'CRÍTICA',
    acknowledgedBySupervisor: false,
    immutableHash: 'SHA256-LATINA-8F92A1B4-H1',
  },
];

export function loadGpsFraudAlerts(storage?: Pick<Storage, 'getItem' | 'setItem'>): GpsFraudAlertRecord[] {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) return INITIAL_SEED_FRAUD_ALERTS;

  try {
    const raw = target.getItem(GPS_FRAUD_ALERTS_STORAGE_KEY);
    if (!raw) {
      target.setItem(GPS_FRAUD_ALERTS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_FRAUD_ALERTS));
      return INITIAL_SEED_FRAUD_ALERTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_FRAUD_ALERTS;
  } catch {
    return INITIAL_SEED_FRAUD_ALERTS;
  }
}

export function saveGpsFraudAlerts(
  alerts: GpsFraudAlertRecord[],
  storage?: Pick<Storage, 'setItem'>
): void {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) return;
  try {
    target.setItem(GPS_FRAUD_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // Ignore quota errors
  }
}
