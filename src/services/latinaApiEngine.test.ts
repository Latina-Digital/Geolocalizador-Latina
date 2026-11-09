import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultSysConfig,
  isSessionValid,
  adaptLatinaApiResponse,
  buildApiUrl,
  buildAuthHeaders,
  authenticateLatinaUser,
  LatinaUserSession,
} from './latinaApiEngine';

test('getDefaultSysConfig initializes standard LatinaWebApi corporate parameters', () => {
  const config = getDefaultSysConfig();
  assert.equal(config.baseUrl, 'https://servidor-iis.industriallatina.com/LatinaWebApi');
  assert.equal(config.authEndpoint, '/api/Seguridad/spConsultaUsuario');
  assert.equal(config.httpMethod, 'POST');
  assert.equal(config.payloadFormat, 'JSON');
  assert.equal(config.timeoutMs, 10000);
  assert.equal(config.sessionExpirationHours, 8);
});

test('buildApiUrl normalizes base URL and endpoint slashes cleanly', () => {
  assert.equal(
    buildApiUrl('https://servidor-iis.industriallatina.com/LatinaWebApi/', '/api/Usuarios/Login'),
    'https://servidor-iis.industriallatina.com/LatinaWebApi/api/Usuarios/Login'
  );
  assert.equal(
    buildApiUrl('https://servidor-iis.industriallatina.com/LatinaWebApi', 'api/Seguridad/spConsultaUsuario'),
    'https://servidor-iis.industriallatina.com/LatinaWebApi/api/Seguridad/spConsultaUsuario'
  );
});

test('adaptLatinaApiResponse maps custom SQL Server / IIS field names via flexible JSON adapter', () => {
  const config = getDefaultSysConfig();
  const mockIisPayload = {
    estado: true,
    CodUsuario: 'USR-901',
    NombreUsuario: 'Ing. Carlos Montalvo',
    Perfil: 'SUPERVISOR_REGIONAL',
    ListaPermisos: ['ADM_RUTAS', 'VER_MAPA_VIVO'],
    TokenSesion: 'jwt-iis-xyz-999',
    NombreSucursal: 'Sucursal Quito Norte',
  };

  const session = adaptLatinaApiResponse(mockIisPayload, config, 'cmontalvo', 'Matriz Guayaquil');
  assert.ok(session);
  assert.equal(session.usuario, 'cmontalvo');
  assert.equal(session.nombreCompleto, 'Ing. Carlos Montalvo');
  assert.equal(session.rol, 'SUPERVISOR_REGIONAL');
  assert.equal(session.token, 'jwt-iis-xyz-999');
  assert.equal(session.sucursal, 'Sucursal Quito Norte');
  assert.deepEqual(session.permisos, ['ADM_RUTAS', 'VER_MAPA_VIVO']);
  assert.equal(session.mappedGeoLatinaRole, 'SUPERVISOR_REGIONAL');
});

test('isSessionValid respects configured sessionExpirationHours', () => {
  const config = getDefaultSysConfig();
  config.sessionExpirationHours = 8;
  const now = 1_700_000_000_000;

  const validSession: LatinaUserSession = {
    usuario: 'sistemas',
    nombreCompleto: 'Admin Sistemas',
    rol: 'SISTEMAS',
    admUserRole: 'AdmUser_Sistemas',
    permisos: ['ALL'],
    token: 'tok-123',
    sucursal: 'Matriz',
    aplicacion: 'GEOLATINA',
    timestamp: now - 2 * 3600 * 1000, // 2h ago
    expiresAt: now + 6 * 3600 * 1000,
    authMode: 'CREDENCIAL_TECNICA_SISTEMAS',
    mappedGeoLatinaRole: 'DIRECTOR_GENERAL',
    mappedGeoLatinaUserId: 'usr-dir',
  };

  assert.equal(isSessionValid(validSession, config, now), true);

  const expiredSession: LatinaUserSession = {
    ...validSession,
    timestamp: now - 9 * 3600 * 1000, // 9h ago (> 8h)
    expiresAt: now - 1 * 3600 * 1000,
  };

  assert.equal(isSessionValid(expiredSession, config, now), false);
});

test('authenticateLatinaUser validates technical Sistemas credentials even when API is offline', async () => {
  const config = getDefaultSysConfig();
  config.timeoutMs = 1500;
  const result = await authenticateLatinaUser(
    {
      usuario: config.techUsername,
      password: config.techPassword,
      sucursal: 'Matriz Guayaquil',
    },
    config
  );

  assert.equal(result.ok, true);
  assert.ok(result.session);
  assert.equal(result.session.rol, 'SISTEMAS');
  assert.equal(result.session.authMode, 'CREDENCIAL_TECNICA_SISTEMAS');
});

test('buildAuthHeaders injects X-Latina-ApiKey or Bearer headers according to config', () => {
  const config = getDefaultSysConfig();
  config.authHeaderType = 'Both';
  config.apiKey = 'TEST-KEY-999';

  const headers = buildAuthHeaders(config, null);
  assert.equal(headers['X-Latina-ApiKey'], 'TEST-KEY-999');
  assert.equal(headers['Authorization'], 'Bearer TEST-KEY-999');
});
