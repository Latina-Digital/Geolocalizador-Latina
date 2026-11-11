import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultSysConfig,
  isSessionValid,
  adaptLatinaApiResponse,
  buildApiUrl,
  buildAuthHeaders,
  authenticateLatinaUser,
  buildGoogleMapsScriptUrl,
  saveGoogleMapsApiKeyToSysConfig,
  loadSysConfig,
  SYS_CONFIG_STORAGE_KEY,
  LatinaUserSession,
  SYSPRO_CONFIGURED_ROLES,
  getRoleHierarchyLevel,
  mapRoleToGeoLatinaRole,
  canUserAccessTicConfig,
} from './latinaApiEngine';

test('getDefaultSysConfig initializes live Syspro Users API parameters', () => {
  const config = getDefaultSysConfig();
  assert.equal(config.baseUrl, 'http://181.78.203.134:7070');
  assert.equal(config.authEndpoint, '/api/syspro/users');
  assert.equal(config.apiKey, 'x7mRjQiJPbKUYECIETn0vNpNIH29ajAI');
  assert.equal(config.httpMethod, 'POST');
  assert.equal(config.payloadFormat, 'JSON');
  assert.equal(config.timeoutMs, 10000);
  assert.equal(config.sessionExpirationHours, 8);
});

test('SYSPRO_CONFIGURED_ROLES contains all 14 configured corporate roles with appropriate levels', () => {
  assert.equal(SYSPRO_CONFIGURED_ROLES.length, 14);

  const expectedRoles = [
    'ADMIN',
    'JEFE DE COMPRAS',
    'JEFE DE VENTAS',
    'VENDEDOR',
    'SUPERVISOR',
    'IMPULSADOR(A)',
    'AUXILIAR DE BODEGA',
    'SUPERVISOR IMP',
    'SUPERVISOR BODEGA',
    'JEFE DE PROYECTOS E INDUSTRIAS',
    'JEFE NACIONAL DE VENTAS',
    'ASESOR CORPORATIVO',
    'GESTOR(A) DE COBRANZA',
    'JEFE LOGISTICA',
  ];

  expectedRoles.forEach((roleCode) => {
    const found = SYSPRO_CONFIGURED_ROLES.find((r) => r.codigo === roleCode);
    assert.ok(found, `Role ${roleCode} must be present in SYSPRO_CONFIGURED_ROLES`);
  });

  // Verify hierarchy levels
  assert.equal(getRoleHierarchyLevel('ADMIN'), 4);
  assert.equal(getRoleHierarchyLevel('JEFE DE COMPRAS'), 3);
  assert.equal(getRoleHierarchyLevel('JEFE DE VENTAS'), 3);
  assert.equal(getRoleHierarchyLevel('JEFE NACIONAL DE VENTAS'), 3);
  assert.equal(getRoleHierarchyLevel('JEFE LOGISTICA'), 3);
  assert.equal(getRoleHierarchyLevel('SUPERVISOR'), 2);
  assert.equal(getRoleHierarchyLevel('SUPERVISOR IMP'), 2);
  assert.equal(getRoleHierarchyLevel('SUPERVISOR BODEGA'), 2);
  assert.equal(getRoleHierarchyLevel('VENDEDOR'), 1);
  assert.equal(getRoleHierarchyLevel('IMPULSADOR(A)'), 1);
  assert.equal(getRoleHierarchyLevel('AUXILIAR DE BODEGA'), 1);
  assert.equal(getRoleHierarchyLevel('ASESOR CORPORATIVO'), 1);
  assert.equal(getRoleHierarchyLevel('GESTOR(A) DE COBRANZA'), 1);

  // Verify operational mapping
  assert.equal(mapRoleToGeoLatinaRole('ADMIN').geoRole, 'DIRECTOR_GENERAL');
  assert.equal(mapRoleToGeoLatinaRole('SUPERVISOR').geoRole, 'SUPERVISOR_REGIONAL');
  assert.equal(mapRoleToGeoLatinaRole('AUXILIAR DE BODEGA').geoRole, 'TRANSPORTISTA');
  assert.equal(mapRoleToGeoLatinaRole('VENDEDOR').geoRole, 'EJECUTIVO_VENTAS');
});

test('adaptLatinaApiResponse parses Syspro user array response preserving exact rol field', () => {
  const config = getDefaultSysConfig();
  const sysproApiResponse = [
    {
      nombre: 'YAGUACHI MENDOZA CARLOS EDUARDO',
      user: 'CYAGUACHI',
      pass: '',
      rol: 'ADMIN',
      supervisor: '',
      apiKey: null,
    },
  ];

  const session = adaptLatinaApiResponse(sysproApiResponse, config, 'cyaguachi', 'Matriz Guayaquil');
  assert.ok(session);
  assert.equal(session.usuario, 'CYAGUACHI');
  assert.equal(session.nombreCompleto, 'YAGUACHI MENDOZA CARLOS EDUARDO');
  assert.equal(session.rol, 'ADMIN'); // Verbatim from API
  assert.equal(session.hierarchyLevel, 4);
  assert.equal(session.mappedGeoLatinaRole, 'DIRECTOR_GENERAL');
});

test('adaptLatinaApiResponse returns null when Syspro API responds with empty array []', () => {
  const config = getDefaultSysConfig();
  const emptyResponse: any[] = [];
  const session = adaptLatinaApiResponse(emptyResponse, config, 'baduser', 'Matriz');
  assert.equal(session, null);
});

test('buildApiUrl normalizes base URL and endpoint slashes cleanly', () => {
  assert.equal(
    buildApiUrl('http://181.78.203.134:7070/', '/api/syspro/users'),
    'http://181.78.203.134:7070/api/syspro/users'
  );
  assert.equal(
    buildApiUrl('http://181.78.203.134:7070', 'api/syspro/users'),
    'http://181.78.203.134:7070/api/syspro/users'
  );
});

test('isSessionValid respects configured sessionExpirationHours', () => {
  const config = getDefaultSysConfig();
  config.sessionExpirationHours = 8;
  const now = 1_700_000_000_000;

  const validSession: LatinaUserSession = {
    usuario: 'CYAGUACHI',
    nombreCompleto: 'Carlos Yaguachi',
    rol: 'ADMIN',
    admUserRole: 'Syspro_ADMIN_N4',
    permisos: ['ALL'],
    token: 'tok-123',
    sucursal: 'Matriz',
    aplicacion: 'GEOLATINA',
    timestamp: now - 2 * 3600 * 1000, // 2h ago
    expiresAt: now + 6 * 3600 * 1000,
    authMode: 'API_IIS_LIVE',
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

test('authenticateLatinaUser authenticates successfully with real Syspro server', async () => {
  const config = getDefaultSysConfig();
  const result = await authenticateLatinaUser(
    {
      usuario: 'cyaguachi',
      password: 'Pa$$w0rd1990*.',
    },
    config
  );

  assert.equal(result.ok, true);
  assert.ok(result.session);
  assert.equal(result.session.usuario, 'CYAGUACHI');
  assert.equal(result.session.rol, 'ADMIN');
  assert.equal(result.session.nombreCompleto, 'YAGUACHI MENDOZA CARLOS EDUARDO');
});

test('authenticateLatinaUser detects empty array [] as invalid credentials', async () => {
  const config = getDefaultSysConfig();
  const result = await authenticateLatinaUser(
    {
      usuario: 'cyaguachi',
      password: 'wrong_password_test',
    },
    config
  );

  assert.equal(result.ok, false);
  assert.ok(result.error);
  assert.match(result.error, /credenciales/i);
});

test('saveGoogleMapsApiKeyToSysConfig stores googleMapsApiKey in geolatina_sys_config and buildGoogleMapsScriptUrl builds exact script URL', () => {
  const store: Record<string, string> = {};
  const mockStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
  };

  const saved = saveGoogleMapsApiKeyToSysConfig('AIzaSyTestProdKey123', mockStorage);
  assert.equal(saved.googleMapsApiKey, 'AIzaSyTestProdKey123');

  const rawJson = JSON.parse(store[SYS_CONFIG_STORAGE_KEY]);
  assert.equal(rawJson.googleMapsApiKey, 'AIzaSyTestProdKey123');

  const loaded = loadSysConfig(mockStorage);
  assert.equal(loaded.googleMapsApiKey, 'AIzaSyTestProdKey123');

  const scriptUrl = buildGoogleMapsScriptUrl(loaded.googleMapsApiKey, 'geometry,places,marker');
  assert.equal(
    scriptUrl,
    'https://maps.googleapis.com/maps/api/js?key=AIzaSyTestProdKey123&libraries=geometry,places,marker'
  );
});

test('canUserAccessTicConfig restricts TIC connection configurations strictly to ADMIN profile and user XBRIONES', () => {
  // Unauthenticated / null session -> false
  assert.equal(canUserAccessTicConfig(null), false);
  assert.equal(canUserAccessTicConfig(undefined), false);

  // ADMIN profile -> true
  assert.equal(canUserAccessTicConfig({ usuario: 'CYAGUACHI', rol: 'ADMIN' }), true);
  assert.equal(canUserAccessTicConfig({ usuario: 'otro_admin', rol: 'admin' }), true);

  // User XBRIONES -> true (regardless of casing or assigned Syspro role)
  assert.equal(canUserAccessTicConfig({ usuario: 'XBRIONES', rol: 'ADMIN' }), true);
  assert.equal(canUserAccessTicConfig({ usuario: 'xbriones', rol: 'SUPERVISOR' }), true);
  assert.equal(canUserAccessTicConfig({ usuario: 'XBRIONES', rol: 'JEFE LOGISTICA' }), true);

  // Other profiles and users -> false
  assert.equal(canUserAccessTicConfig({ usuario: 'JPEREZ', rol: 'VENDEDOR' }), false);
  assert.equal(canUserAccessTicConfig({ usuario: 'MGOMEZ', rol: 'SUPERVISOR' }), false);
  assert.equal(canUserAccessTicConfig({ usuario: 'LRAMIREZ', rol: 'JEFE DE VENTAS' }), false);
  assert.equal(canUserAccessTicConfig({ usuario: 'ACASTRO', rol: 'JEFE DE COMPRAS' }), false);
  assert.equal(canUserAccessTicConfig({ usuario: 'DVERA', rol: 'AUXILIAR DE BODEGA' }), false);
});

