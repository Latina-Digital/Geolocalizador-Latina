/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de Autenticación, Configuración de Sistema y Puente de Datos
 * para Interconexión Corporativa GEOLATINA <-> LatinaSoft (LatinaWebApi IIS / SQL Server)
 */

import { UserRole } from '../types';

export const SYS_CONFIG_STORAGE_KEY = 'geolatina_sys_config';
export const USER_SESSION_STORAGE_KEY = 'geolatina_user_session';

export type LatinaOperationMode = 'PRODUCTION_LIVE' | 'HYBRID_CONTINGENCY';

export interface LatinaJsonFieldMapping {
  successField: string;
  userIdField: string;
  fullNameField: string;
  roleField: string;
  permissionsField: string;
  tokenField: string;
  branchField: string;
}

export type LatinaRoleTier =
  | 'EJECUTIVO_VENTAS'
  | 'SUPERVISOR'
  | 'JEFE_VENTAS'
  | 'GERENCIA'
  | 'ADMINISTRADOR'
  | 'SISTEMAS';

export function getRoleHierarchyLevel(rol: string | undefined): 1 | 2 | 3 | 4 {
  const norm = (rol || '').toUpperCase();
  if (norm.includes('ADMIN') || norm.includes('SISTEMA')) return 4;
  if (norm.includes('JEFE') || norm.includes('GERENCIA') || norm.includes('DIRECTOR')) return 3;
  if (norm.includes('SUPERVISOR')) return 2;
  return 1; // EJECUTIVO_VENTAS / TRANSPORTISTA (Nivel 1 - Operativo en ruta)
}

export interface LatinaSysConfig {
  // Sección A: Interconexión API LatinaSoft (LatinaWebApi)
  baseUrl: string;
  authEndpoint: string;
  permissionsEndpoint: string;
  syncEndpoint: string;
  auditLogEndpoint: string;
  gpsAlertsEndpoint: string;
  httpMethod: 'POST' | 'GET';
  payloadFormat: 'JSON' | 'FORM_URLENCODED';
  defaultSucursal: string;

  // Sección B: Seguridad, Cabeceras y Red
  authHeaderType: 'X-Latina-ApiKey' | 'Authorization-Bearer' | 'Both';
  apiKey: string;
  timeoutMs: number;
  sessionExpirationHours: number;
  operationMode: LatinaOperationMode;
  enableTechCredentials: boolean;
  techUsername: string;
  techPassword: string;

  // Sección C: Mapeo de Respuesta JSON (Adaptador Flexible)
  jsonMapping: LatinaJsonFieldMapping;

  // Metadatos de auditoría de configuración
  lastUpdated: string;
  updatedBy: string;
}

export interface LatinaUserSession {
  usuario: string;
  nombreCompleto: string;
  rol: string; // EJECUTIVO_VENTAS (N1), SUPERVISOR (N2), JEFE_VENTAS / GERENCIA (N3), ADMINISTRADOR / SISTEMAS (N4)
  hierarchyLevel?: 1 | 2 | 3 | 4;
  admUserRole: string; // Etiqueta AdmUser en SQL Server
  permisos: string[]; // Lista de permisos AdmRelacionPermisoUsuario
  token: string;
  sucursal: string;
  aplicacion: 'GEOLATINA';
  timestamp: number;
  expiresAt: number;
  authMode: 'API_IIS_LIVE' | 'CONTINGENCIA_LOCAL' | 'CREDENCIAL_TECNICA_SISTEMAS';
  mappedGeoLatinaRole: UserRole;
  mappedGeoLatinaUserId: string;
}

export interface PingDiagnosticResult {
  ok: boolean;
  timestamp: string;
  targetUrl: string;
  latencyMs: number;
  httpStatus: number | null;
  statusText: string;
  corsBlocked: boolean;
  networkError: boolean;
  serverReachable: boolean;
  diagnosticSummary: string;
  technicalDetails: string[];
}

export interface AuthorizedLocalCredential {
  usuario: string;
  password: string;
  nombreCompleto: string;
  rol: LatinaRoleTier;
  admUserRole: string;
  permisos: string[];
  sucursal: string;
  mappedGeoLatinaRole: UserRole;
  mappedGeoLatinaUserId: string;
}

// Directorio corporativo local con los 4 niveles jerárquicos de LatinaSoft
export const AUTHORIZED_CONTINGENCY_USERS: AuthorizedLocalCredential[] = [
  {
    usuario: 'ralcivar',
    password: 'Latina2026',
    nombreCompleto: 'Ing. Roberto Alcívar',
    rol: 'ADMINISTRADOR',
    admUserRole: 'AdmUser_AdminGeneral_N4',
    permisos: [
      'GEOLATINA_TOTAL_CONTROL',
      'ADM_UI_BUILDER',
      'ADM_CONFIG_SISTEMA',
      'ADM_BITACORA_EXPORT',
      'ADM_ANTIFRAUDE_GPS',
      'ADM_GEOCERCAS_WRITE',
    ],
    sucursal: 'Matriz Guayaquil - Parque Industrial Latina',
    mappedGeoLatinaRole: 'DIRECTOR_GENERAL',
    mappedGeoLatinaUserId: 'usr-dir',
  },
  {
    usuario: 'dcardenas',
    password: 'Latina2026',
    nombreCompleto: 'Ing. Diego Cárdenas',
    rol: 'JEFE_VENTAS',
    admUserRole: 'AdmUser_JefeVentas_N3',
    permisos: [
      'GEOLATINA_DIRECCION_COMERCIAL',
      'ADM_BITACORA_EXPORT',
      'ADM_ANTIFRAUDE_GPS',
      'ADM_REPORTES_EJECUTIVOS',
    ],
    sucursal: 'Dirección Comercial - Zona Sur & Costa',
    mappedGeoLatinaRole: 'DIRECTOR_GENERAL',
    mappedGeoLatinaUserId: 'usr-sup-sur',
  },
  {
    usuario: 'mparedes',
    password: 'Latina2026',
    nombreCompleto: 'Lic. Mariana Paredes',
    rol: 'SUPERVISOR',
    admUserRole: 'AdmUser_SupervisorNorte_N2',
    permisos: [
      'GEOLATINA_SUPERVISION_ZONA',
      'ADM_BITACORA_EXPORT',
      'ADM_ANTIFRAUDE_GPS',
      'ADM_GEOCERCAS_WRITE',
    ],
    sucursal: 'Sucursal Norte - Guayaquil Metropolitano',
    mappedGeoLatinaRole: 'SUPERVISOR_REGIONAL',
    mappedGeoLatinaUserId: 'usr-sup-norte',
  },
  {
    usuario: 'cvera',
    password: 'Latina2026',
    nombreCompleto: 'Carlos Vera',
    rol: 'EJECUTIVO_VENTAS',
    admUserRole: 'AdmUser_EjecutivoComercial_N1',
    permisos: [
      'GEOLATINA_RUTA_MOVIL',
      'REGISTRO_VISITAS_EVIDENCIA',
      'EMISION_SOS_PANICO',
    ],
    sucursal: 'Sucursal Norte - División Comercial',
    mappedGeoLatinaRole: 'EJECUTIVO_VENTAS',
    mappedGeoLatinaUserId: 'agt-1',
  },
  {
    usuario: 'mquintero',
    password: 'Latina2026',
    nombreCompleto: 'Manuel Quintero',
    rol: 'EJECUTIVO_VENTAS',
    admUserRole: 'AdmUser_FlotaLogistica_N1',
    permisos: [
      'GEOLATINA_DESPACHO_RUTA',
      'REGISTRO_ENTREGAS_PUERTO',
      'EMISION_SOS_PANICO',
    ],
    sucursal: 'Base Logística Sur - Flota Pesada',
    mappedGeoLatinaRole: 'TRANSPORTISTA',
    mappedGeoLatinaUserId: 'trans-1',
  },
];

export function getDefaultSysConfig(): LatinaSysConfig {
  return {
    baseUrl: 'https://servidor-iis.industriallatina.com/LatinaWebApi',
    authEndpoint: '/api/Seguridad/spConsultaUsuario',
    permissionsEndpoint: '/api/Seguridad/AdmRelacionPermisoUsuario',
    syncEndpoint: '/api/GeoLatina/SincronizarParametros',
    auditLogEndpoint: '/api/GeoLatina/BitacoraDiaria',
    gpsAlertsEndpoint: '/api/GeoLatina/AlertasFraudeGps',
    httpMethod: 'POST',
    payloadFormat: 'JSON',
    defaultSucursal: 'Matriz Guayaquil - Parque Industrial Latina',

    authHeaderType: 'X-Latina-ApiKey',
    apiKey: 'LATINA-WEBAPI-IIS-2026-PROD-KEY',
    timeoutMs: 10000,
    sessionExpirationHours: 8,
    operationMode: 'HYBRID_CONTINGENCY',
    enableTechCredentials: true,
    techUsername: 'sistemas',
    techPassword: 'Latina2026*',

    jsonMapping: {
      successField: 'estado',
      userIdField: 'CodUsuario',
      fullNameField: 'NombreUsuario',
      roleField: 'Perfil',
      permissionsField: 'ListaPermisos',
      tokenField: 'TokenSesion',
      branchField: 'NombreSucursal',
    },

    lastUpdated: new Date().toISOString(),
    updatedBy: 'Sistemas Industrial Latina S.A.',
  };
}

export function loadSysConfig(storage?: Pick<Storage, 'getItem' | 'setItem'>): LatinaSysConfig {
  const defaults = getDefaultSysConfig();
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) return defaults;

  try {
    const raw = targetStorage.getItem(SYS_CONFIG_STORAGE_KEY);
    if (!raw) {
      if ('setItem' in targetStorage && typeof targetStorage.setItem === 'function') {
        targetStorage.setItem(SYS_CONFIG_STORAGE_KEY, JSON.stringify(defaults));
      }
      return defaults;
    }
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      jsonMapping: {
        ...defaults.jsonMapping,
        ...(parsed.jsonMapping || {}),
      },
    };
  } catch {
    return defaults;
  }
}

export function saveSysConfig(
  config: LatinaSysConfig,
  storage?: Pick<Storage, 'setItem'>
): LatinaSysConfig {
  const updated: LatinaSysConfig = {
    ...config,
    lastUpdated: new Date().toISOString(),
  };
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (targetStorage) {
    try {
      targetStorage.setItem(SYS_CONFIG_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors
    }
  }
  return updated;
}

export function loadUserSession(
  config?: LatinaSysConfig,
  storage?: Pick<Storage, 'getItem' | 'removeItem'>
): LatinaUserSession | null {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(USER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: LatinaUserSession = JSON.parse(raw);
    if (!isSessionValid(parsed, config)) {
      targetStorage.removeItem(USER_SESSION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveUserSession(
  session: LatinaUserSession | null,
  storage?: Pick<Storage, 'setItem' | 'removeItem'>
): void {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!targetStorage) return;

  try {
    if (!session) {
      targetStorage.removeItem(USER_SESSION_STORAGE_KEY);
    } else {
      targetStorage.setItem(USER_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage errors
  }
}

export function isSessionValid(
  session: LatinaUserSession | null | undefined,
  config?: LatinaSysConfig,
  nowMs: number = Date.now()
): boolean {
  if (!session || !session.usuario || !session.timestamp) {
    return false;
  }
  const expirationHours = config?.sessionExpirationHours ?? 8;
  const maxAgeMs = expirationHours * 3600 * 1000;
  const effectiveExpiry = session.expiresAt || session.timestamp + maxAgeMs;

  if (nowMs > effectiveExpiry) {
    return false;
  }
  if (nowMs - session.timestamp > maxAgeMs) {
    return false;
  }
  return true;
}

/**
 * Busca un campo dentro de la respuesta JSON de LatinaWebApi soportando el nombre configurado
 * y alias secundarios separados por coma, o anidamiento dentro de `data` / `resultado`.
 */
export function extractMappedField(obj: Record<string, any> | null | undefined, fieldSpec: string, fallbackKeys: string[] = []): any {
  if (!obj || typeof obj !== 'object') return undefined;

  const candidates = [
    ...fieldSpec.split(',').map(s => s.trim()).filter(Boolean),
    ...fallbackKeys,
  ];

  const containers = [obj, obj.data, obj.resultado, obj.usuario, obj.result].filter(
    c => c && typeof c === 'object'
  );

  for (const container of containers) {
    for (const key of candidates) {
      if (key in container && container[key] !== undefined && container[key] !== null) {
        return container[key];
      }
      // Búsqueda case-insensitive
      const foundKey = Object.keys(container).find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey && container[foundKey] !== undefined && container[foundKey] !== null) {
        return container[foundKey];
      }
    }
  }
  return undefined;
}

export function mapRoleToGeoLatinaRole(rawRole: string): {
  geoRole: UserRole;
  mappedUserId: string;
} {
  const norm = (rawRole || '').toUpperCase();
  if (norm.includes('SISTEMA') || norm.includes('ADMIN') || norm.includes('DIRECTOR') || norm.includes('GERENTE')) {
    return { geoRole: 'DIRECTOR_GENERAL', mappedUserId: 'usr-dir' };
  }
  if (norm.includes('SUPERVISOR') || norm.includes('JEFE')) {
    return { geoRole: 'SUPERVISOR_REGIONAL', mappedUserId: 'usr-sup-norte' };
  }
  if (norm.includes('TRANSPOR') || norm.includes('CHOFER') || norm.includes('LOGIST')) {
    return { geoRole: 'TRANSPORTISTA', mappedUserId: 'trans-1' };
  }
  if (norm.includes('VENTA') || norm.includes('EJECUTIVO') || norm.includes('COMERCIAL') || norm.includes('AGENTE')) {
    return { geoRole: 'EJECUTIVO_VENTAS', mappedUserId: 'agt-1' };
  }
  return { geoRole: 'DIRECTOR_GENERAL', mappedUserId: 'usr-dir' };
}

/**
 * Adaptador flexible para transformar cualquier respuesta JSON de LatinaWebApi (IIS / SQL Server)
 * en un objeto de sesión corporativo estandarizado para GEOLATINA.
 */
export function adaptLatinaApiResponse(
  rawJson: Record<string, any>,
  config: LatinaSysConfig,
  requestUser: string,
  requestSucursal: string
): LatinaUserSession | null {
  if (!rawJson || typeof rawJson !== 'object') return null;

  const { jsonMapping } = config;
  const rawSuccess = extractMappedField(rawJson, jsonMapping.successField, [
    'success',
    'estado',
    'ok',
    'autenticado',
    'valido',
  ]);

  const isSuccess =
    rawSuccess === true ||
    rawSuccess === 1 ||
    String(rawSuccess).toLowerCase() === 'true' ||
    String(rawSuccess).toLowerCase() === 'ok' ||
    String(rawSuccess).toLowerCase() === 'activo' ||
    String(rawSuccess) === '1';

  if (!isSuccess) {
    return null;
  }

  const fullName =
    extractMappedField(rawJson, jsonMapping.fullNameField, [
      'nombreCompleto',
      'NombreUsuario',
      'nombres',
      'name',
    ]) || requestUser;

  const roleRaw =
    extractMappedField(rawJson, jsonMapping.roleField, [
      'rol',
      'Perfil',
      'AdmUser',
      'cargo',
    ]) || 'ADMINISTRADOR';

  const permsRaw = extractMappedField(rawJson, jsonMapping.permissionsField, [
    'permisos',
    'ListaPermisos',
    'AdmRelacionPermisoUsuario',
  ]);

  let permisos: string[] = [];
  if (Array.isArray(permsRaw)) {
    permisos = permsRaw.map(p => (typeof p === 'string' ? p : p?.codigo || p?.permiso || JSON.stringify(p)));
  } else if (typeof permsRaw === 'string' && permsRaw.trim()) {
    permisos = permsRaw.split(',').map(s => s.trim());
  } else {
    permisos = ['GEOLATINA_ACCESO_GENERAL', 'LATINASOFT_SYNC_ACTIVO'];
  }

  const token =
    extractMappedField(rawJson, jsonMapping.tokenField, [
      'token',
      'TokenSesion',
      'jwt',
      'accessToken',
    ]) || `latina-iis-jwt-${Date.now()}`;

  const sucursal =
    extractMappedField(rawJson, jsonMapping.branchField, [
      'sucursal',
      'NombreSucursal',
      'planta',
    ]) ||
    requestSucursal ||
    config.defaultSucursal;

  const now = Date.now();
  const expiresAt = now + config.sessionExpirationHours * 3600 * 1000;
  const { geoRole, mappedUserId } = mapRoleToGeoLatinaRole(String(roleRaw));

  return {
    usuario: requestUser,
    nombreCompleto: String(fullName),
    rol: String(roleRaw).toUpperCase(),
    admUserRole: `AdmUser_${String(roleRaw).replace(/\s+/g, '_')}`,
    permisos,
    token: String(token),
    sucursal: String(sucursal),
    aplicacion: 'GEOLATINA',
    timestamp: now,
    expiresAt,
    authMode: 'API_IIS_LIVE',
    mappedGeoLatinaRole: geoRole,
    mappedGeoLatinaUserId: mappedUserId,
  };
}

export function buildApiUrl(baseUrl: string, endpoint: string): string {
  const cleanBase = (baseUrl || '').trim().replace(/\/+$/, '');
  const cleanEndpoint = (endpoint || '').trim();
  if (!cleanEndpoint) return cleanBase;
  if (cleanEndpoint.startsWith('http://') || cleanEndpoint.startsWith('https://')) {
    return cleanEndpoint;
  }
  return `${cleanBase}/${cleanEndpoint.replace(/^\/+/, '')}`;
}

export function buildAuthHeaders(
  config: LatinaSysConfig,
  session?: LatinaUserSession | null,
  extraHeaders?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (config.payloadFormat === 'JSON') {
    headers['Content-Type'] = 'application/json';
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  if (config.apiKey) {
    if (config.authHeaderType === 'X-Latina-ApiKey' || config.authHeaderType === 'Both') {
      headers['X-Latina-ApiKey'] = config.apiKey;
    }
    if (config.authHeaderType === 'Authorization-Bearer' || config.authHeaderType === 'Both') {
      headers['Authorization'] = `Bearer ${session?.token || config.apiKey}`;
    }
  } else if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  return headers;
}

/**
 * Función global apiFetch(endpoint, options) que inyecta automáticamente URL Base,
 * cabeceras de autorización, AbortController (timeout) y manejo de errores.
 */
export async function executeLatinaApiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  config: LatinaSysConfig = loadSysConfig(),
  session: LatinaUserSession | null = loadUserSession(config)
): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  latencyMs: number;
}> {
  const url = buildApiUrl(config.baseUrl, endpoint);
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, config.timeoutMs || 10000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startMs = performance.now();

  try {
    const mergedHeaders = buildAuthHeaders(
      config,
      session,
      options.headers as Record<string, string> | undefined
    );

    const response = await fetch(url, {
      ...options,
      headers: mergedHeaders,
      signal: controller.signal,
    });

    const latencyMs = Math.round(performance.now() - startMs);
    clearTimeout(timer);

    let data: T | null = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = ({ rawText: text } as unknown) as T;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText || 'Error del servidor IIS'}`,
      latencyMs,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - startMs);
    const isAbort = err?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: null,
      error: isAbort
        ? `Tiempo de espera agotado (${timeoutMs} ms) intentando conectar con ${url}`
        : err?.message || 'Fallo de red o bloqueo CORS en IIS',
      latencyMs,
    };
  }
}

/**
 * Herramienta de Diagnóstico: Probar Conexión con API (Ping)
 */
export async function pingLatinaApiServer(config: LatinaSysConfig): Promise<PingDiagnosticResult> {
  const targetUrl = buildApiUrl(config.baseUrl, config.authEndpoint);
  const startMs = performance.now();
  const controller = new AbortController();
  const timeoutMs = Math.max(1500, Math.min(config.timeoutMs || 10000, 12000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = buildAuthHeaders(config, null);
    const response = await fetch(targetUrl, {
      method: config.httpMethod,
      headers,
      body:
        config.httpMethod === 'POST'
          ? JSON.stringify({
              ping: true,
              aplicacion: 'GEOLATINA',
              timestamp: new Date().toISOString(),
            })
          : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Math.max(1, Math.round(performance.now() - startMs));

    return {
      ok: response.ok || response.status === 401 || response.status === 400 || response.status === 405,
      timestamp: new Date().toLocaleTimeString(),
      targetUrl,
      latencyMs,
      httpStatus: response.status,
      statusText: response.statusText || 'Respuesta recibida de IIS',
      corsBlocked: false,
      networkError: false,
      serverReachable: true,
      diagnosticSummary: response.ok
        ? `Conexión exitosa con LatinaWebApi (${latencyMs} ms) — HTTP ${response.status}`
        : `Servidor IIS alcanzable (${latencyMs} ms) — Código HTTP ${response.status}`,
      technicalDetails: [
        `URL probada: ${targetUrl}`,
        `Método HTTP: ${config.httpMethod} (${config.payloadFormat})`,
        `Tiempo de respuesta: ${latencyMs} ms (Timeout máx: ${config.timeoutMs} ms)`,
        `Código HTTP devuelto: ${response.status} ${response.statusText}`,
        `Cabecera enviada: ${config.authHeaderType}`,
      ],
    };
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Math.max(1, Math.round(performance.now() - startMs));
    const isTimeout = err?.name === 'AbortError';
    const isCorsOrNetwork = !isTimeout && (err instanceof TypeError || String(err?.message).includes('Failed to fetch'));

    return {
      ok: false,
      timestamp: new Date().toLocaleTimeString(),
      targetUrl,
      latencyMs,
      httpStatus: null,
      statusText: isTimeout ? 'TIMEOUT' : 'RED / CORS BLOCKED',
      corsBlocked: isCorsOrNetwork,
      networkError: true,
      serverReachable: false,
      diagnosticSummary: isTimeout
        ? `Timeout tras ${latencyMs} ms: El servidor IIS no respondió dentro del límite (${config.timeoutMs} ms).`
        : `No se pudo establecer enlace directo con IIS (${latencyMs} ms). Posible desconexión de VPN corporativa, certificado SSL privado o bloqueo CORS en IIS.`,
      technicalDetails: [
        `URL objetivo: ${targetUrl}`,
        `Tiempo transcurrido: ${latencyMs} ms`,
        `Detalle de excepción: ${err?.message || 'TypeError: Failed to fetch'}`,
        isCorsOrNetwork
          ? `Diagnóstico IIS/CORS: Verifique en el web.config de LatinaWebApi la cabecera Access-Control-Allow-Origin y que la VPN corporativa esté activa.`
          : `Diagnóstico de Red: El host tardó más de ${config.timeoutMs} ms en responder.`,
        config.operationMode === 'HYBRID_CONTINGENCY'
          ? `Resiliencia Activa: El modo "Híbrido / Contingencia" está habilitado para permitir operación local autorizada.`
          : `Modo Producción Estricto: Las sesiones requerirán respuesta en vivo de IIS.`,
      ],
    };
  }
}

/**
 * Motor Principal de Autenticación de Usuarios GEOLATINA <-> LatinaSoft
 */
export async function authenticateLatinaUser(
  credentials: {
    usuario: string;
    password: string;
    sucursal?: string;
  },
  config: LatinaSysConfig = loadSysConfig()
): Promise<{
  ok: boolean;
  session?: LatinaUserSession;
  error?: string;
  latencyMs: number;
  httpStatus?: number;
}> {
  const cleanUser = (credentials.usuario || '').trim();
  const cleanPassword = credentials.password || '';
  const cleanSucursal = (credentials.sucursal || config.defaultSucursal).trim();

  if (!cleanUser || !cleanPassword) {
    return {
      ok: false,
      error: 'Por favor ingrese su Usuario LatinaSoft y Contraseña corporativa.',
      latencyMs: 0,
    };
  }

  const startMs = performance.now();

  // 1. Verificar si es la Credencial Técnica de Sistemas (si está habilitada)
  if (
    config.enableTechCredentials &&
    cleanUser.toLowerCase() === config.techUsername.trim().toLowerCase() &&
    cleanPassword === config.techPassword
  ) {
    const now = Date.now();
    const techSession: LatinaUserSession = {
      usuario: cleanUser,
      nombreCompleto: 'Administrador Técnico de Sistemas (LatinaSoft)',
      rol: 'SISTEMAS',
      admUserRole: 'AdmUser_Sistemas_Root',
      permisos: [
        'SYS_CONFIG_FULL',
        'API_MAPPING_ADMIN',
        'GEOLATINA_TOTAL_CONTROL',
        'ADM_GEOCERCAS_WRITE',
        'ADM_REPORTES_EJECUTIVOS',
      ],
      token: `latina-tech-token-${now}`,
      sucursal: cleanSucursal,
      aplicacion: 'GEOLATINA',
      timestamp: now,
      expiresAt: now + config.sessionExpirationHours * 3600 * 1000,
      authMode: 'CREDENCIAL_TECNICA_SISTEMAS',
      mappedGeoLatinaRole: 'DIRECTOR_GENERAL',
      mappedGeoLatinaUserId: 'usr-dir',
    };

    return {
      ok: true,
      session: techSession,
      latencyMs: Math.max(12, Math.round(performance.now() - startMs)),
      httpStatus: 200,
    };
  }

  // 2. Intentar autenticación real contra el servidor IIS LatinaWebApi con AbortController
  const loginUrl = buildApiUrl(config.baseUrl, config.authEndpoint);
  const controller = new AbortController();
  const timeoutMs = Math.max(1500, config.timeoutMs || 10000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const payloadObj = {
    usuario: cleanUser,
    password: cleanPassword,
    aplicacion: 'GEOLATINA',
    sucursal: cleanSucursal,
  };

  try {
    const headers = buildAuthHeaders(config, null);
    const bodyPayload =
      config.payloadFormat === 'JSON'
        ? JSON.stringify(payloadObj)
        : new URLSearchParams(payloadObj as Record<string, string>).toString();

    const finalUrl =
      config.httpMethod === 'GET'
        ? `${loginUrl}?${new URLSearchParams(payloadObj as Record<string, string>).toString()}`
        : loginUrl;

    const response = await fetch(finalUrl, {
      method: config.httpMethod,
      headers,
      body: config.httpMethod === 'POST' ? bodyPayload : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Math.max(1, Math.round(performance.now() - startMs));

    if (response.ok) {
      const json = await response.json();
      const adapted = adaptLatinaApiResponse(json, config, cleanUser, cleanSucursal);
      if (adapted) {
        return {
          ok: true,
          session: adapted,
          latencyMs,
          httpStatus: response.status,
        };
      }
      return {
        ok: false,
        error: 'Credenciales rechazadas por LatinaWebApi o estructura JSON no coincide con el mapeo configurado.',
        latencyMs,
        httpStatus: response.status,
      };
    }

    // Si el servidor IIS devolvió 401/403 explícitamente, rechazar credenciales
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error: `Acceso denegado por servidor LatinaSoft (HTTP ${response.status}): Usuario o contraseña inválidos.`,
        latencyMs,
        httpStatus: response.status,
      };
    }
  } catch {
    clearTimeout(timer);
    // Fallo de red / VPN / IIS offline: evaluamos modo de operación abajo
  }

  const latencyMs = Math.max(1, Math.round(performance.now() - startMs));

  // 3. Si el modo es Híbrido / Contingencia, validar contra el padrón local autorizado
  if (config.operationMode === 'HYBRID_CONTINGENCY') {
    const matchedLocal = AUTHORIZED_CONTINGENCY_USERS.find(
      u => u.usuario.toLowerCase() === cleanUser.toLowerCase() && u.password === cleanPassword
    );

    if (matchedLocal) {
      const now = Date.now();
      const contingencySession: LatinaUserSession = {
        usuario: matchedLocal.usuario,
        nombreCompleto: matchedLocal.nombreCompleto,
        rol: matchedLocal.rol,
        admUserRole: matchedLocal.admUserRole,
        permisos: matchedLocal.permisos,
        token: `latina-contingency-jwt-${now}`,
        sucursal: cleanSucursal || matchedLocal.sucursal,
        aplicacion: 'GEOLATINA',
        timestamp: now,
        expiresAt: now + config.sessionExpirationHours * 3600 * 1000,
        authMode: 'CONTINGENCIA_LOCAL',
        mappedGeoLatinaRole: matchedLocal.mappedGeoLatinaRole,
        mappedGeoLatinaUserId: matchedLocal.mappedGeoLatinaUserId,
      };

      return {
        ok: true,
        session: contingencySession,
        latencyMs,
        httpStatus: 200,
      };
    }

    return {
      ok: false,
      error:
        'Credenciales no válidas. Servidor IIS sin enlace directo y el usuario/contraseña no coincide con cuentas autorizadas en Contingencia ni con la credencial técnica de Sistemas.',
      latencyMs,
    };
  }

  // 4. Modo Producción Estricto y falló la red
  return {
    ok: false,
    error: `No fue posible validar contra LatinaWebApi (${config.baseUrl}). Verifique su VPN corporativa o active el modo "Híbrido / Contingencia" en Configuración de Sistema.`,
    latencyMs,
  };
}
