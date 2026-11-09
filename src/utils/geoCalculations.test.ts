import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceKm,
  isInsideGeofence,
  isPointInPolygon,
  calculateTotalRouteDistance,
  calculateEfficiencyScore,
  checkForAnomalies,
  formatMinutesToHuman,
  calculateMinutesBetweenTimes,
  hasShiftExceeded9Hours,
  getRemainingMinutesTo9Hours,
  NINE_HOURS_MS,
} from './geoCalculations';
import { RoutePoint } from '../types';

test('calculateDistanceKm returns accurate distance between known coordinates', () => {
  // Distance between Guayaquil center (-2.1894, -79.8891) and Duran (-2.1722, -79.8242) ~ 7.4 km
  const dist = calculateDistanceKm(-2.1894, -79.8891, -2.1722, -79.8242);
  assert.ok(dist > 7.0 && dist < 8.0, `Expected distance ~7.4km, got ${dist}`);
});

test('isInsideGeofence correctly validates radius boundaries', () => {
  const center = { lat: -2.1894, lng: -79.8891 };
  const insidePoint = { lat: -2.1900, lng: -79.8895 }; // ~100m away
  const outsidePoint = { lat: -2.3500, lng: -79.8891 }; // ~18km away

  assert.equal(isInsideGeofence(insidePoint, center, 5), true);
  assert.equal(isInsideGeofence(outsidePoint, center, 5), false);
});

test('calculateTotalRouteDistance accumulates segment lengths', () => {
  const points: RoutePoint[] = [
    { lat: -2.1800, lng: -79.8900, timestamp: '2026-10-24T08:00:00Z', speed: 30, status: 'driving' },
    { lat: -2.1900, lng: -79.8900, timestamp: '2026-10-24T08:10:00Z', speed: 35, status: 'driving' },
    { lat: -2.2000, lng: -79.8900, timestamp: '2026-10-24T08:20:00Z', speed: 20, status: 'driving' },
  ];
  const total = calculateTotalRouteDistance(points);
  assert.ok(total > 2.0 && total < 2.5, `Expected ~2.2km, got ${total}`);
});

test('calculateEfficiencyScore produces consistent and bounded metrics', () => {
  // Perfect day: 6 planned, 6 completed, expected km matched, no alerts
  const perfect = calculateEfficiencyScore({
    plannedVisits: 6,
    completedVisits: 6,
    totalKm: 35,
    expectedKm: 34,
    alertsCount: 0,
    timeSpentInVisitsMinutes: 240,
    totalShiftMinutes: 480,
  });
  assert.ok(perfect >= 85 && perfect <= 100, `Expected high score, got ${perfect}`);

  // Bad day: only 2 of 6 visits completed, 3 alerts
  const bad = calculateEfficiencyScore({
    plannedVisits: 6,
    completedVisits: 2,
    totalKm: 70,
    expectedKm: 30,
    alertsCount: 3,
    timeSpentInVisitsMinutes: 60,
    totalShiftMinutes: 480,
  });
  assert.ok(bad < perfect, 'Bad day should score lower than perfect day');
  assert.ok(bad >= 0 && bad <= 100, 'Score must be clamped between 0 and 100');
});

test('isPointInPolygon accurately detects interior and exterior points', () => {
  // Triangle around downtown Guayaquil
  const triangle = [
    { lat: -2.1800, lng: -79.9000 },
    { lat: -2.1800, lng: -79.8800 },
    { lat: -2.2000, lng: -79.8900 },
  ];

  const insidePoint = { lat: -2.1850, lng: -79.8900 }; // Center of triangle
  const outsidePoint = { lat: -2.2100, lng: -79.8900 }; // South of triangle
  const farPoint = { lat: -2.1700, lng: -79.8900 }; // North of triangle

  assert.equal(isPointInPolygon(insidePoint, triangle), true);
  assert.equal(isPointInPolygon(outsidePoint, triangle), false);
  assert.equal(isPointInPolygon(farPoint, triangle), false);
});

test('checkForAnomalies detects overspeeding and custom polygon geofence breach', () => {
  const polygonGeofence = {
    name: 'Sector Comercial Kennedy-Alborada',
    coordinates: [
      { lat: -2.1500, lng: -79.9100 },
      { lat: -2.1500, lng: -79.8800 },
      { lat: -2.1800, lng: -79.8800 },
      { lat: -2.1800, lng: -79.9100 },
    ],
  };

  // Point inside the polygon
  const insidePt: RoutePoint = {
    lat: -2.1650,
    lng: -79.8950,
    timestamp: '2026-10-24T10:00:00Z',
    speed: 35,
    status: 'driving',
  };
  const okAlert = checkForAnomalies(insidePt, [], polygonGeofence, 'agt-1', 'Carlos Vera', 'Zona Norte');
  assert.equal(okAlert, null);

  // Point outside the polygon
  const outsidePt: RoutePoint = {
    lat: -2.2100,
    lng: -79.8950,
    timestamp: '2026-10-24T10:05:00Z',
    speed: 35,
    status: 'driving',
  };
  const breachAlert = checkForAnomalies(outsidePt, [], polygonGeofence, 'agt-1', 'Carlos Vera', 'Zona Norte');
  assert.ok(breachAlert !== null);
  assert.equal(breachAlert?.type, 'FUERA_GEOCERCA');
  assert.ok(breachAlert?.description.includes('Kennedy-Alborada'));
});

test('calculateMinutesBetweenTimes and formatMinutesToHuman format durations correctly', () => {
  const mins1 = calculateMinutesBetweenTimes('08:30', '09:15');
  assert.equal(mins1, 45);
  assert.equal(formatMinutesToHuman(mins1), '45m');

  const mins2 = calculateMinutesBetweenTimes('08:00', '10:45');
  assert.equal(mins2, 165);
  assert.equal(formatMinutesToHuman(mins2), '2h 45m');
});

test('hasShiftExceeded9Hours triggers when shift exceeds 9 hours', () => {
  const startTime = 10000000;
  // Under 9h: 8h 59m
  const under9h = startTime + (8 * 3600 + 59 * 60) * 1000;
  assert.equal(hasShiftExceeded9Hours(startTime, under9h), false);
  assert.ok(getRemainingMinutesTo9Hours(startTime, under9h) >= 1);

  // Exactly or over 9h
  const exactly9h = startTime + NINE_HOURS_MS;
  assert.equal(hasShiftExceeded9Hours(startTime, exactly9h), true);
  assert.equal(getRemainingMinutesTo9Hours(startTime, exactly9h), 0);

  const over9h = startTime + (9 * 3600 + 15 * 60) * 1000;
  assert.equal(hasShiftExceeded9Hours(startTime, over9h), true);
});

