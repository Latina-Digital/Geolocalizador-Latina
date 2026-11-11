import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGpsIntegrityHeuristics,
  canUserAccessGpsFraudAlerts,
} from './geoIntegrityGuard';
import {
  createAuditLogEntry,
  filterAuditLogs,
  generateAuditLogsCsvContent,
} from './geoAuditLogger';
import {
  getDefaultUiConfig,
  moveBlockInOrder,
} from './uiConfigEngine';
import { getRoleHierarchyLevel } from './latinaApiEngine';
import {
  buildDirectionsRequestsForChunks,
  buildInteractiveTrajectoryCheckpoints,
  chunkRouteWaypoints,
  classifyVisitMarkerCategory,
  extractDetailedStepsPathFromGoogleRoute,
  filterAgentsBySupervisorForHud,
  resolveExecutiveVitalTelemetry,
  traceStreetNetworkPathBetweenPoints,
} from '../utils/googleMapsRouting';
import {
  calculateBearingDegrees,
  computeTrajectoryVitalMetrics,
  evaluateUnregisteredStopAtPoint,
  shouldRecordTrajectoryStep,
} from './liveTrajectoryTracker';
import { CARLOS_VISITS, INITIAL_AGENTS_STATE } from '../data/mockData';

test('GeoIntegrityGuard Heuristic #1 detects impossible teleportation speed (>130 km/h)', () => {
  const now = Date.now();
  const alerts = evaluateGpsIntegrityHeuristics(
    {
      lat: -2.0500,
      lng: -79.9000,
      previousLat: -2.2000,
      previousLng: -79.9000, // ~16.6 km jump
      previousTimestamp: now - 30_000, // in 30 seconds (~1990 km/h)
      positionTimestamp: now,
      systemTimestamp: now,
      accuracy: 8,
    },
    {
      id: 'agt-1',
      name: 'Carlos Vera',
      role: 'EJECUTIVO_VENTAS',
      sucursal: 'Sucursal Norte',
    }
  );

  assert.equal(alerts.some((a) => a.anomalyCode === 'ALERTA_TELETRANSPORTE'), true);
});

test('GeoIntegrityGuard Heuristic #2, #3, #4, #5 detect artificial accuracy, timestamp drift, sensor mismatch, and timezone mismatch', () => {
  const now = Date.now();
  const alerts = evaluateGpsIntegrityHeuristics(
    {
      lat: 40.4168, // Madrid (outside Ecuador)
      lng: -3.7038,
      positionTimestamp: now - 300_000, // 5 min drift (> 120s)
      systemTimestamp: now,
      accuracy: 1,
      altitudeAccuracy: null,
      recentAccuracies: [1, 1, 1],
      speedKmh: 65,
      deviceMotionAcceleration: 0, // Still phone while moving at 65 km/h
      reportedTimezoneOffsetMinutes: -60, // Europe TZ
    },
    {
      id: 'agt-1',
      name: 'Carlos Vera',
      role: 'EJECUTIVO_VENTAS',
      sucursal: 'Sucursal Norte',
    }
  );

  const codes = alerts.map((a) => a.anomalyCode);
  assert.ok(codes.includes('ALERTA_PRECISION_ARTIFICIAL'));
  assert.ok(codes.includes('ALERTA_TIMESTAMP_ALTERADO'));
  assert.ok(codes.includes('ALERTA_SENSORES_INCONSISTENTES'));
  assert.ok(codes.includes('ALERTA_DISCREPANCIA_ZONA_HORARIA'));
});

test('Role Hierarchy enforces 4 levels and restricts GPS fraud alerts to SUPERVISOR (Level 2) or higher', () => {
  assert.equal(getRoleHierarchyLevel('EJECUTIVO_VENTAS'), 1);
  assert.equal(getRoleHierarchyLevel('SUPERVISOR'), 2);
  assert.equal(getRoleHierarchyLevel('JEFE_VENTAS'), 3);
  assert.equal(getRoleHierarchyLevel('GERENCIA'), 3);
  assert.equal(getRoleHierarchyLevel('ADMINISTRADOR'), 4);
  assert.equal(getRoleHierarchyLevel('SISTEMAS'), 4);

  assert.equal(canUserAccessGpsFraudAlerts('EJECUTIVO_VENTAS'), false);
  assert.equal(canUserAccessGpsFraudAlerts('SUPERVISOR'), true);
  assert.equal(canUserAccessGpsFraudAlerts('JEFE_VENTAS'), true);
  assert.equal(canUserAccessGpsFraudAlerts('ADMINISTRADOR'), true);
});

test('GeoAuditLogger filters entries and exports UTF-8 BOM CSV', () => {
  const now = new Date('2026-11-09T10:00:00Z');
  const e1 = createAuditLogEntry({
    usuario: 'cvera',
    nombreUsuario: 'Carlos Vera',
    rol: 'EJECUTIVO_VENTAS',
    sucursal: 'Norte',
    eventType: 'VISITA_CLIENTE',
    alertState: 'NORMAL',
    detail: 'Venta ferretería $4,850',
    now,
  });
  const e2 = createAuditLogEntry({
    usuario: 'cvera',
    nombreUsuario: 'Carlos Vera',
    rol: 'EJECUTIVO_VENTAS',
    rolRaw: 'EJECUTIVO_VENTAS',
    sucursal: 'Norte',
    eventType: 'ALERTA_FRAUDE_GPS',
    alertState: 'CRITICA',
    detail: 'Mock location detectado',
    now,
  } as any);

  const criticalOnly = filterAuditLogs(
    [e1, e2],
    {
      datePreset: 'HOY',
      executiveFilter: 'TODOS',
      eventTypeFilter: 'TODOS',
      alertStateFilter: 'CRITICA',
      searchQuery: '',
    },
    now
  );
  assert.equal(criticalOnly.length, 1);
  assert.equal(criticalOnly[0].id, e2.id);

  const csv = generateAuditLogsCsvContent([e1]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.equal(csv.includes('Carlos Vera'), true);
});

test('uiConfigEngine reorders dashboard blocks cleanly', () => {
  const cfg = getDefaultUiConfig();
  const reordered = moveBlockInOrder(cfg.dashboardBlocksOrder, 'MAPA_Y_OPERACIONES', 'UP');
  assert.equal(reordered[0], 'MAPA_Y_OPERACIONES');
  assert.equal(reordered[1], 'KPIS_RESUMEN');
});

test('chunkRouteWaypoints splits >25 GPS points into sequential continuous street segments', () => {
  const thirtyPoints = Array.from({ length: 30 }, (_, i) => ({
    lat: -2.14 - i * 0.001,
    lng: -79.90 - i * 0.001,
  }));
  const chunks = chunkRouteWaypoints(thirtyPoints, 25);
  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks[0].origin, thirtyPoints[0]);
  assert.deepEqual(chunks[0].destination, thirtyPoints[24]);
  assert.equal(chunks[0].intermediates.length, 23);
  assert.deepEqual(chunks[1].origin, thirtyPoints[24]);
  assert.deepEqual(chunks[1].destination, thirtyPoints[29]);
});

test('classifyVisitMarkerCategory assigns GREEN_EFFECTIVE, BLUE_FOLLOWUP, and RED_ALERT accurately', () => {
  assert.equal(classifyVisitMarkerCategory(CARLOS_VISITS[0]), 'GREEN_EFFECTIVE');
  assert.equal(classifyVisitMarkerCategory(CARLOS_VISITS[2]), 'BLUE_FOLLOWUP');
  assert.equal(classifyVisitMarkerCategory(CARLOS_VISITS[3]), 'RED_ALERT');
});

test('buildDirectionsRequestsForChunks builds sequential DirectionsRequest specs with stopover waypoints when points exceed 25', () => {
  const fiftyTwoPoints = Array.from({ length: 52 }, (_, i) => ({
    lat: -2.14 - i * 0.001,
    lng: -79.90 - i * 0.001,
  }));
  const reqs = buildDirectionsRequestsForChunks(fiftyTwoPoints, 25);
  assert.equal(reqs.length, 3);
  assert.equal(reqs[0].waypoints.length, 23);
  assert.equal(reqs[0].waypoints[0].stopover, true);
  assert.equal(reqs[0].optimizeWaypoints, false);
  assert.equal(reqs[0].travelMode, 'DRIVING');
  assert.deepEqual(reqs[1].origin, reqs[0].destination);
  assert.equal(reqs[1].waypoints.length, 23);
  assert.deepEqual(reqs[2].origin, reqs[1].destination);
  assert.equal(reqs[2].waypoints.length, 2);
});

test('HUD de Control Vital en Vivo filters executives by supervisor and recognizes battery % and online/offline state', () => {
  const allAgentsList = Object.values(INITIAL_AGENTS_STATE);
  const norteAgents = filterAgentsBySupervisorForHud(allAgentsList, 'usr-sup-norte');
  assert.equal(norteAgents.length, 3);
  assert.deepEqual(
    norteAgents.map((a) => a.user.id),
    ['agt-1', 'agt-2', 'agt-3']
  );

  const surAgents = filterAgentsBySupervisorForHud(allAgentsList, 'usr-sup-sur');
  assert.equal(surAgents.length, 1);
  assert.equal(surAgents[0].user.id, 'trans-1');

  // Carlos Vera (agt-1): 84% battery, en_cliente -> En Línea
  const carlosVital = resolveExecutiveVitalTelemetry(norteAgents[0], null, true);
  assert.equal(carlosVital.batteryPercent, 84);
  assert.equal(carlosVital.batterySeverity, 'HIGH');
  assert.equal(carlosVital.isOnline, true);
  assert.equal(carlosVital.statusLabel, 'En Línea');

  // Javier Solís (agt-3): 95% battery, inactivo (Hace 1 hora) -> Fuera de Línea
  const javierVital = resolveExecutiveVitalTelemetry(norteAgents[2], null, true);
  assert.equal(javierVital.batteryPercent, 95);
  assert.equal(javierVital.isOnline, false);
  assert.equal(javierVital.statusLabel, 'Fuera de Línea');

  // Hardware battery override (e.g. 15% charging)
  const lowBatteryOverride = resolveExecutiveVitalTelemetry(
    norteAgents[0],
    { levelPercent: 15, isCharging: true },
    true
  );
  assert.equal(lowBatteryOverride.batteryPercent, 15);
  assert.equal(lowBatteryOverride.isCharging, true);
  assert.equal(lowBatteryOverride.batterySeverity, 'LOW');
});

test('LiveTrajectoryTracker applies 8-meter minimum step filter and detects unregistered stops >5 min', () => {
  const prev = { lat: -2.155, lng: -79.905 };
  // ~2.2 meters difference -> ignored as stationary GPS noise
  const tinyMove = shouldRecordTrajectoryStep(prev, -2.15501, -79.90501, 8);
  assert.equal(tinyMove.shouldRecord, false);

  // ~35 meters difference -> recorded as real trajectory step
  const realMove = shouldRecordTrajectoryStep(prev, -2.1553, -79.9052, 8);
  assert.equal(realMove.shouldRecord, true);
  assert.ok(realMove.distanceMeters >= 8);

  const bearing = calculateBearingDegrees(-2.155, -79.905, -2.165, -79.905);
  assert.equal(bearing, 180);

  // Unregistered stop >5 min away from any registered visit
  const unregStop = evaluateUnregisteredStopAtPoint(-2.171, -79.9, 14, CARLOS_VISITS);
  assert.equal(unregStop.isUnregisteredStop, true);
  assert.equal(unregStop.stoppedMinutes, 14);

  // Stop at a registered completed visit (vis-1 at -2.1550, -79.9050) is NOT an unregistered stop
  const visitStop = evaluateUnregisteredStopAtPoint(-2.155, -79.905, 40, CARLOS_VISITS);
  assert.equal(visitStop.isUnregisteredStop, false);
});

test('Street-and-curve router traces multi-step avenue geometry without straight lines and extracts steps[].path', () => {
  // Trace from Base Matriz (Av. Juan Tanca Marengo) to Miraflores (Av. Carlos Julio Arosemena)
  const streetSteps = traceStreetNetworkPathBetweenPoints(
    { lat: -2.148, lng: -79.901 },
    { lat: -2.181, lng: -79.913 }
  );
  // Must contain many intermediate street/avenue curve vertices, never a 2-point straight line
  assert.ok(streetSteps.length >= 10);
  assert.ok(streetSteps.some((s) => (s.streetName || '').includes('Francisco de Orellana')));
  assert.ok(streetSteps.some((s) => (s.streetName || '').includes('Carlos Julio Arosemena')));

  // Verify detailed steps[].path extraction from a Google Route object
  const mockGoogleRoute = {
    legs: [
      {
        steps: [
          {
            path: [
              { lat: -2.148, lng: -79.901 },
              { lat: -2.151, lng: -79.903 },
            ],
          },
          {
            path: [
              { lat: -2.151, lng: -79.903 },
              { lat: -2.155, lng: -79.905 },
            ],
          },
        ],
      },
    ],
  };
  const extracted = extractDetailedStepsPathFromGoogleRoute(mockGoogleRoute);
  assert.equal(extracted.length, 3);

  // Verify interactive checkpoints generation along the street trajectory
  const carlosAgent = INITIAL_AGENTS_STATE['agt-1'];
  const checkpoints = buildInteractiveTrajectoryCheckpoints(carlosAgent, streetSteps, []);
  assert.ok(checkpoints.length >= 4);
  assert.equal(checkpoints[0].userName, 'Carlos Vera');
  assert.match(checkpoints[0].timestamp, /^\d{2}:\d{2}:\d{2}$/);
  assert.ok(checkpoints.some((c) => c.isUnregisteredStop && (c.stoppedMinutes || 0) > 5));

  const vitalMetrics = computeTrajectoryVitalMetrics(checkpoints, streetSteps);
  assert.ok(vitalMetrics.totalDistanceKm > 3);
  assert.ok(vitalMetrics.movingMinutes > 0);
});



