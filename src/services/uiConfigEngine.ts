/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 6: Estudio de Diseño y Estructura para el Administrador (UI Builder - geolatina_ui_config)
 */

export const UI_CONFIG_STORAGE_KEY = 'geolatina_ui_config';

export type NavigationPosition = 'TOP_BAR' | 'LEFT_SIDEBAR' | 'RIGHT_SIDEBAR';
export type DashboardBlockId = 'KPIS_RESUMEN' | 'MAPA_Y_OPERACIONES' | 'ALERTAS_RECIENTES' | 'RESUMEN_BITACORA';

export interface CustomRegistrationField {
  id: string;
  label: string;
  placeholder: string;
  required: boolean;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

export interface RoleModuleVisibility {
  EJECUTIVO_VENTAS: {
    showEfficiencyTab: boolean;
    showMapTab: boolean;
    showSosButton: boolean;
    showPdfReportButton: boolean;
  };
  SUPERVISOR: {
    showGeofenceBuilder: boolean;
    showAuditHistoryButton: boolean;
    showGpsFraudBell: boolean;
    showSimulationControls: boolean;
  };
}

export interface GeoLatinaUiConfig {
  // A) Diseño Visual y Marca
  appTitle: string;
  appSubtitle: string;
  logoUrlOrBase64: string;
  primaryColor: string; // e.g. #0A2540
  secondaryColor: string; // e.g. #F59E0B
  accentRedColor: string; // e.g. #D32F2F
  pageBgColor: string; // e.g. #070d1e
  cardBgColor: string; // e.g. #0f172a
  textColor: string; // e.g. #f1f5f9
  fontFamily: 'Plus Jakarta Sans' | 'JetBrains Mono' | 'System Sans';
  baseFontSizePx: number; // 14, 15, 16, 17
  borderRadiusStyle: 'minimal_square' | 'modern_rounded' | 'pill_soft';

  // B) Estructura y Disposición de la Plataforma
  navPosition: NavigationPosition;
  dashboardBlocksOrder: DashboardBlockId[];
  roleVisibility: RoleModuleVisibility;
  customFormFields: CustomRegistrationField[];

  lastModified: string;
}

export function getDefaultUiConfig(): GeoLatinaUiConfig {
  return {
    appTitle: 'GEO LATINA',
    appSubtitle: 'Control de Rutas & Telemetría en Tiempo Real — Industrial Latina S.A.',
    logoUrlOrBase64: '',
    primaryColor: '#0A2540',
    secondaryColor: '#F59E0B',
    accentRedColor: '#D32F2F',
    pageBgColor: '#070d1e',
    cardBgColor: '#0f172a',
    textColor: '#f1f5f9',
    fontFamily: 'Plus Jakarta Sans',
    baseFontSizePx: 16,
    borderRadiusStyle: 'modern_rounded',

    navPosition: 'TOP_BAR',
    dashboardBlocksOrder: ['KPIS_RESUMEN', 'MAPA_Y_OPERACIONES', 'RESUMEN_BITACORA'],
    roleVisibility: {
      EJECUTIVO_VENTAS: {
        showEfficiencyTab: true,
        showMapTab: true,
        showSosButton: true,
        showPdfReportButton: true,
      },
      SUPERVISOR: {
        showGeofenceBuilder: true,
        showAuditHistoryButton: true,
        showGpsFraudBell: true,
        showSimulationControls: true,
      },
    },
    customFormFields: [
      {
        id: 'cf-codigo-sap',
        label: 'Código Cliente LatinaSoft / RUC',
        placeholder: 'Ej. 0992345678001',
        required: false,
        type: 'text',
      },
    ],
    lastModified: new Date().toISOString(),
  };
}

export function loadUiConfig(storage?: Pick<Storage, 'getItem' | 'setItem'>): GeoLatinaUiConfig {
  const defaults = getDefaultUiConfig();
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) return defaults;

  try {
    const raw = target.getItem(UI_CONFIG_STORAGE_KEY);
    if (!raw) {
      target.setItem(UI_CONFIG_STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      roleVisibility: {
        EJECUTIVO_VENTAS: {
          ...defaults.roleVisibility.EJECUTIVO_VENTAS,
          ...(parsed.roleVisibility?.EJECUTIVO_VENTAS || {}),
        },
        SUPERVISOR: {
          ...defaults.roleVisibility.SUPERVISOR,
          ...(parsed.roleVisibility?.SUPERVISOR || {}),
        },
      },
      dashboardBlocksOrder: Array.isArray(parsed.dashboardBlocksOrder)
        ? parsed.dashboardBlocksOrder
        : defaults.dashboardBlocksOrder,
      customFormFields: Array.isArray(parsed.customFormFields)
        ? parsed.customFormFields
        : defaults.customFormFields,
    };
  } catch {
    return defaults;
  }
}

export function saveUiConfig(
  config: GeoLatinaUiConfig,
  storage?: Pick<Storage, 'setItem'>
): GeoLatinaUiConfig {
  const updated: GeoLatinaUiConfig = {
    ...config,
    lastModified: new Date().toISOString(),
  };
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (target) {
    try {
      target.setItem(UI_CONFIG_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore quota errors
    }
  }
  applyUiConfigToDocumentRoot(updated);
  return updated;
}

/**
 * Aplica las variables CSS (:root) en tiempo real sin recargar la página.
 */
export function applyUiConfigToDocumentRoot(config: GeoLatinaUiConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--geolatina-primary', config.primaryColor);
  root.style.setProperty('--geolatina-secondary', config.secondaryColor);
  root.style.setProperty('--geolatina-accent-red', config.accentRedColor);
  root.style.setProperty('--geolatina-page-bg', config.pageBgColor);
  root.style.setProperty('--geolatina-card-bg', config.cardBgColor);
  root.style.setProperty('--geolatina-text', config.textColor);
  root.style.setProperty('--geolatina-font-size', `${config.baseFontSizePx}px`);

  const radiusVal =
    config.borderRadiusStyle === 'minimal_square'
      ? '0.25rem'
      : config.borderRadiusStyle === 'pill_soft'
      ? '1.25rem'
      : '0.75rem';
  root.style.setProperty('--geolatina-radius', radiusVal);

  const fontStack =
    config.fontFamily === 'JetBrains Mono'
      ? "'JetBrains Mono', monospace"
      : config.fontFamily === 'System Sans'
      ? 'system-ui, -apple-system, sans-serif'
      : "'Plus Jakarta Sans', system-ui, sans-serif";
  root.style.setProperty('--geolatina-font-family', fontStack);
}

export function moveBlockInOrder(
  order: DashboardBlockId[],
  blockId: DashboardBlockId,
  direction: 'UP' | 'DOWN'
): DashboardBlockId[] {
  const idx = order.indexOf(blockId);
  if (idx === -1) return order;
  const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= order.length) return order;
  const copy = [...order];
  const temp = copy[idx];
  copy[idx] = copy[targetIdx];
  copy[targetIdx] = temp;
  return copy;
}
