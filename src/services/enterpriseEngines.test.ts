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
  chunkRouteWaypoints,
  classifyVisitMarkerCategory,
} from '../utils/googleMapsRouting';
import { CARLOS_VISITS } from '../data/mockData';

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
    sucursal: 'Norte',
    eventType: 'ALERTA_FRAUDE_GPS',
    alertState: 'CRITICA',
    detail: 'Mock location detectado',
    now,
  });

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

