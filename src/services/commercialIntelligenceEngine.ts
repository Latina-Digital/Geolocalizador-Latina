/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor ERP/CRM de Inteligencia Comercial, Cascada Jerárquica, Potencialización
 * de Productos (LATINA & INDULESS) y Gestión de Cobranzas / Cartera.
 * Conectado a LatinaWebApi con persistencia y caché resiliente en localStorage.
 */

import { jsPDF } from 'jspdf';
import {
  LatinaSysConfig,
  LatinaUserSession,
  executeLatinaApiFetch,
  getRoleHierarchyLevel,
} from './latinaApiEngine';

export const ERP_PORTFOLIO_STORAGE_KEY = 'geolatina_erp_portfolio_v2';
export const ERP_COLLECTIONS_STORAGE_KEY = 'geolatina_erp_collections_v1';
export const ERP_COMMITMENTS_STORAGE_KEY = 'geolatina_erp_commitments_v1';

export type ProductBrand = 'LATINA' | 'INDULESS';

export type ProductLineCategory =
  | 'Pinturas Arquitectónicas e Industriales'
  | 'Diluyentes/Thinners'
  | 'Cubiertas y Techos'
  | 'Correas Metálicas'
  | 'Empastes'
  | 'Morteros'
  | 'Selladores'
  | 'Recubrimientos/Antigravilla'
  | 'Brochas y Herramientas';

export type ProductSubgroup =
  | 'Pinturas Caucho Interior'
  | 'Esmaltes Anticorrosivos'
  | 'Diluyentes Industriales'
  | 'Cubiertas Galvalume'
  | 'Correas Perfil G'
  | 'Empastes Exteriores'
  | 'Morteros Adhesivos'
  | 'Selladores Elastómeros'
  | 'Recubrimientos Automotrices'
  | 'Brochas Profesionales';

export const ALL_PRODUCT_SUBGROUPS: ProductSubgroup[] = [
  'Pinturas Caucho Interior',
  'Esmaltes Anticorrosivos',
  'Diluyentes Industriales',
  'Cubiertas Galvalume',
  'Correas Perfil G',
  'Empastes Exteriores',
  'Morteros Adhesivos',
  'Selladores Elastómeros',
  'Recubrimientos Automotrices',
  'Brochas Profesionales',
];

export interface MasterCatalogProduct {
  sku: string;
  productName: string;
  brand: ProductBrand;
  productLine: ProductLineCategory;
  subgrupo: ProductSubgroup;
  unitLabel: string;
  unitPriceUsd: number;
  marginPercent: number;
  complementaryLines: ProductLineCategory[];
  defaultCommercialPitch: string;
  suggestedMonthlyGoalQty: number;
}

export interface ProductPurchase12M {
  sku: string;
  productName: string;
  brand: ProductBrand;
  productLine: ProductLineCategory;
  subgrupo: ProductSubgroup;
  unitLabel: string;
  totalQuantity12M: number;
  totalSalesUsd12M: number;
  /** Precio unitario exacto de la última factura vendida al cliente ($ USD) */
  lastUnitPriceSoldUsd: number;
  lastPurchaseDate: string;
  /** Ventas en unidades durante los últimos 12 meses móviles (M1..M12, donde M12 es el mes actual) */
  monthlyTrendUnits: number[];
}

export interface RankedProductPurchase12M extends ProductPurchase12M {
  rankPosition: number;
  sharePercentage: number;
  stoppedBuyingLast60To90Days: boolean;
  daysWithoutPurchase: number;
  lastSaleFormattedDate: string;
}

export interface InactiveChurnProductAlert {
  id: string;
  clientId: string;
  sku: string;
  productName: string;
  brand: ProductBrand;
  productLine: ProductLineCategory;
  subgrupo: ProductSubgroup;
  lastPurchaseDate: string;
  lastSaleFormattedDate: string;
  daysWithoutPurchase: number;
  lastUnitPriceSoldUsd: number;
  avgMonthlyQtySold: number;
  unitLabel: string;
  valueAtRiskUsd: number;
  severity?: 'CRITICA_90D' | 'ALTA_60D' | 'ALERTA_45D';
  committedInVisit: boolean;
  committedAt?: string;
}

export interface SubgroupSuggestedProduct {
  id: string;
  sku: string;
  productName: string;
  brand: ProductBrand;
  productLine: ProductLineCategory;
  subgrupo: ProductSubgroup;
  unitLabel: string;
  referenceListPriceUsd: number;
  suggestedGoalQty: number;
  estimatedMonthlyOpportunityUsd: number;
  estimatedMarginPercent: number;
  commercialArgument: string;
  committedInVisit: boolean;
  committedAt?: string;
}

export interface SubgroupExpansionGroup {
  subgrupo: ProductSubgroup;
  productLine: ProductLineCategory;
  clientCurrentOrPastProducts: {
    sku: string;
    productName: string;
    brand: ProductBrand;
    status: 'ACTIVO' | 'DEJO_DE_COMPRAR';
    lastUnitPriceSoldUsd: number;
    lastSaleFormattedDate: string;
    totalSalesUsd12M: number;
  }[];
  suggestedSameSubgroupProducts: SubgroupSuggestedProduct[];
}

export type OpportunityCategory = 'CROSS_SELL' | 'REACTIVATION' | 'UP_SELL';

export interface ProductOpportunityRecommendation {
  id: string;
  clientId: string;
  category: OpportunityCategory;
  sku: string;
  productName: string;
  brand: ProductBrand;
  productLine: ProductLineCategory;
  subgrupo?: ProductSubgroup;
  priority: 'ALTA' | 'MEDIA';
  commercialPitch: string;
  suggestedGoalQty: number;
  unitLabel: string;
  estimatedMonthlyExtraUsd: number;
  inactiveDays?: number;
  previousAvgMonthlyUsd?: number;
  referenceUnitPriceUsd?: number;
  committedInVisit?: boolean;
  committedAt?: string;
}

export type ClientAttentionStatus = 'ACTIVO' | 'EN_RIESGO_FUGA' | 'SEGUIMIENTO_COBRO';

export interface ClientPortfolioRecord {
  id: string;
  codigoLatinaSoft: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  ciudad: string;
  sector: string;
  direccion: string;
  lat: number;
  lng: number;
  categoria: string;
  estadoAtencion: ClientAttentionStatus;
  cupoCreditoUsd: number;
  saldoDisponibleUsd: number;
  frecuenciaVisita: string;
  supervisorId: string;
  supervisorName: string;
  zoneName: string;
  executiveId: string;
  executiveName: string;
  contactoNombre: string;
  contactoTelefono: string;
  purchases12M: ProductPurchase12M[];
}

export type CollectionManagementStatus =
  | 'Contactado - Promesa de Pago'
  | 'Abono Parcial Recibido'
  | 'Pago Total / Transferencia'
  | 'Pendiente de Retención'
  | 'En trámite de Nota de Crédito (NC)'
  | 'Cliente solicita prórroga';

export interface CollectionFollowUpEntry {
  id: string;
  invoiceId: string;
  status: CollectionManagementStatus;
  promiseDate: string;
  reminderTime: string;
  receiptNumber: string;
  committedOrPaidAmountUsd: number;
  notes: string;
  registeredBy: string;
  registeredRole: string;
  createdAt: string;
}

export interface ReceivableInvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientRuc: string;
  executiveId: string;
  executiveName: string;
  supervisorId: string;
  supervisorName: string;
  zoneName: string;
  issueDate: string;
  dueDate: string;
  creditTermDays: number;
  originalAmountUsd: number;
  appliedCreditsUsd: number;
  pendingBalanceUsd: number;
  /** Negativo = vencida hace X días; 0 = vence HOY; Positivo = por vencer en X días */
  daysToMaturity: number;
  followUps: CollectionFollowUpEntry[];
}

export type InvoiceSemaphoreLevel = 'RED_CRITICAL' | 'AMBER_URGENT' | 'YELLOW_SOON' | 'GREEN_PREVENTIVE';

export interface InvoiceSemaphoreVisual {
  level: InvoiceSemaphoreLevel;
  badgeLabel: string;
  shortStatus: string;
}

export interface ReceivablesKpiSummary {
  totalPortfolioUsd: number;
  totalInvoicesCount: number;
  critical0To5DaysUsd: number;
  critical0To5DaysCount: number;
  upcoming6To15DaysUsd: number;
  upcoming6To15DaysCount: number;
  preventive16PlusDaysUsd: number;
  preventive16PlusDaysCount: number;
  overdueMoraUsd: number;
  overdueMoraCount: number;
}

export interface HierarchySupervisorOption {
  id: string;
  name: string;
  zone: string;
}

export interface HierarchyExecutiveOption {
  id: string;
  name: string;
  supervisorId: string;
  zone: string;
  roleLabel: string;
}

export interface CascadeFilterState {
  supervisorId: string; // 'ALL' o id del supervisor
  executiveId: string;  // 'ALL' o id del ejecutivo
  clientId: string;     // 'ALL' o id del cliente
}

/**
 * Jerarquía comercial oficial de Supervisores y Ejecutivos de Industrial Latina S.A.
 */
export const HIERARCHY_SUPERVISORS: HierarchySupervisorOption[] = [
  {
    id: 'usr-sup-norte',
    name: 'Lic. Mariana Paredes',
    zone: 'Zona Norte & Guayaquil Metropolitano',
  },
  {
    id: 'usr-sup-sur',
    name: 'Ing. Diego Cárdenas',
    zone: 'Zona Sur & Costa Austral',
  },
];

export const HIERARCHY_EXECUTIVES: HierarchyExecutiveOption[] = [
  {
    id: 'agt-1',
    name: 'Carlos Vera',
    supervisorId: 'usr-sup-norte',
    zone: 'Zona Norte & Guayaquil Metropolitano',
    roleLabel: 'Ejecutivo Comercial Senior',
  },
  {
    id: 'agt-2',
    name: 'Elena Mendoza',
    supervisorId: 'usr-sup-norte',
    zone: 'Zona Norte & Guayaquil Metropolitano',
    roleLabel: 'Ejecutiva de Ventas Corporativas',
  },
  {
    id: 'agt-3',
    name: 'Javier Solís',
    supervisorId: 'usr-sup-norte',
    zone: 'Zona Norte & Guayaquil Metropolitano',
    roleLabel: 'Ejecutivo de Desarrollo Ferretero',
  },
  {
    id: 'trans-1',
    name: 'Manuel Quintero',
    supervisorId: 'usr-sup-sur',
    zone: 'Zona Sur & Costa Austral',
    roleLabel: 'Ejecutivo Comercial & Logística Sur',
  },
];

/**
 * Catálogo Maestro de Productos Actuales de Industrial Latina S.A. (Marcas LATINA e INDULESS)
 * Cubre las 9 líneas estratégicas y 10 Subgrupos con productos hermanos para expansión por Subgrupo.
 */
export const MASTER_CATALOG_LATINA_INDULESS: MasterCatalogProduct[] = [
  // SUBGRUPO 1: Pinturas Caucho Interior
  {
    sku: 'LAT-PIN-001',
    productName: 'Pintura Caucho Látex Supremo Interior/Exterior (Caneca 5 Gal)',
    brand: 'LATINA',
    productLine: 'Pinturas Arquitectónicas e Industriales',
    subgrupo: 'Pinturas Caucho Interior',
    unitLabel: 'Canecas',
    unitPriceUsd: 68.5,
    marginPercent: 28,
    complementaryLines: ['Diluyentes/Thinners', 'Empastes', 'Selladores', 'Brochas y Herramientas'],
    defaultCommercialPitch:
      'Alta rotación en mostrador ferretero con margen del 28% para el distribuidor y respaldo técnico Latina.',
    suggestedMonthlyGoalQty: 25,
  },
  {
    sku: 'LAT-PIN-004',
    productName: 'Pintura Caucho Satinado Lavable Antihongos Latina (Galón)',
    brand: 'LATINA',
    productLine: 'Pinturas Arquitectónicas e Industriales',
    subgrupo: 'Pinturas Caucho Interior',
    unitLabel: 'Galones',
    unitPriceUsd: 16.4,
    marginPercent: 31,
    complementaryLines: ['Empastes', 'Brochas y Herramientas'],
    defaultCommercialPitch:
      'Producto hermano del mismo Subgrupo (Pinturas Caucho Interior): presentación en Galón de alta demanda residencial con 31% de margen.',
    suggestedMonthlyGoalQty: 45,
  },
  {
    sku: 'IND-PIN-005',
    productName: 'Pintura Acrílica Profesional Obra Gris Induless (Caneca 5 Gal)',
    brand: 'INDULESS',
    productLine: 'Pinturas Arquitectónicas e Industriales',
    subgrupo: 'Pinturas Caucho Interior',
    unitLabel: 'Canecas',
    unitPriceUsd: 49.9,
    marginPercent: 26,
    complementaryLines: ['Empastes', 'Brochas y Herramientas'],
    defaultCommercialPitch:
      'Alternativa competitiva Induless en el mismo Subgrupo de Pinturas Caucho Interior para licitaciones y constructoras.',
    suggestedMonthlyGoalQty: 30,
  },

  // SUBGRUPO 2: Esmaltes Anticorrosivos
  {
    sku: 'LAT-PIN-002',
    productName: 'Esmalte Sintético Anticorrosivo Industrial Brillante (Galón)',
    brand: 'LATINA',
    productLine: 'Pinturas Arquitectónicas e Industriales',
    subgrupo: 'Esmaltes Anticorrosivos',
    unitLabel: 'Galones',
    unitPriceUsd: 19.8,
    marginPercent: 29,
    complementaryLines: ['Diluyentes/Thinners', 'Brochas y Herramientas', 'Recubrimientos/Antigravilla'],
    defaultCommercialPitch:
      'Doble protección antioxidante para estructuras metálicas; venta conjunta obligatoria con Thinner Latina.',
    suggestedMonthlyGoalQty: 40,
  },
  {
    sku: 'LAT-PIN-006',
    productName: 'Fondo Cromato de Zinc Anticorrosivo Naval Latina (Caneca 5 Gal)',
    brand: 'LATINA',
    productLine: 'Pinturas Arquitectónicas e Industriales',
    subgrupo: 'Esmaltes Anticorrosivos',
    unitLabel: 'Canecas',
    unitPriceUsd: 86.0,
    marginPercent: 32,
    complementaryLines: ['Diluyentes/Thinners', 'Correas Metálicas'],
    defaultCommercialPitch:
      'Mismo Subgrupo (Esmaltes Anticorrosivos): base primaria indispensable para clientes que ya compran esmalte sintético o estructuras metálicas.',
    suggestedMonthlyGoalQty: 15,
  },
  {
    sku: 'IND-PIN-007',
    productName: 'Esmalte Secado Rápido Industrial Martillado Induless (Galón)',
    brand: 'INDULESS',
    productLine: 'Pinturas Arquitectónicas e Industriales',
    subgrupo: 'Esmaltes Anticorrosivos',
    unitLabel: 'Galones',
    unitPriceUsd: 22.5,
    marginPercent: 34,
    complementaryLines: ['Diluyentes/Thinners'],
    defaultCommercialPitch:
      'Expansión directa en Subgrupo Esmaltes Anticorrosivos para cerrajerías y metalmecánicas con 34% de margen comercial.',
    suggestedMonthlyGoalQty: 25,
  },

  // SUBGRUPO 3: Diluyentes Industriales
  {
    sku: 'IND-DIL-010',
    productName: 'Thinner Acrílico Automotriz & Industrial Alto Brillo (Tanque 55 Gal)',
    brand: 'INDULESS',
    productLine: 'Diluyentes/Thinners',
    subgrupo: 'Diluyentes Industriales',
    unitLabel: 'Galones',
    unitPriceUsd: 8.9,
    marginPercent: 27,
    complementaryLines: ['Pinturas Arquitectónicas e Industriales', 'Recubrimientos/Antigravilla'],
    defaultCommercialPitch:
      'El cliente ya factura Pinturas Latina pero no diluyentes Induless; combo directo de 3 galones de thinner por cada caja de esmalte.',
    suggestedMonthlyGoalQty: 60,
  },
  {
    sku: 'LAT-DIL-012',
    productName: 'Diluyente Sintético Estándar Latina (Caja 12 Litros)',
    brand: 'LATINA',
    productLine: 'Diluyentes/Thinners',
    subgrupo: 'Diluyentes Industriales',
    unitLabel: 'Cajas',
    unitPriceUsd: 24.0,
    marginPercent: 30,
    complementaryLines: ['Pinturas Arquitectónicas e Industriales', 'Brochas y Herramientas'],
    defaultCommercialPitch:
      'Complemento indispensable del Subgrupo Diluyentes Industriales en punto de venta para esmaltes y anticorrosivos Latina.',
    suggestedMonthlyGoalQty: 20,
  },
  {
    sku: 'IND-DIL-015',
    productName: 'Thinner Laca Extra Refinado Induless (Caneca 5 Galones)',
    brand: 'INDULESS',
    productLine: 'Diluyentes/Thinners',
    subgrupo: 'Diluyentes Industriales',
    unitLabel: 'Canecas',
    unitPriceUsd: 42.0,
    marginPercent: 29,
    complementaryLines: ['Pinturas Arquitectónicas e Industriales'],
    defaultCommercialPitch:
      'Formato intermedio de 5 Galones en el mismo Subgrupo Diluyentes Industriales con altísima rotación semanal.',
    suggestedMonthlyGoalQty: 22,
  },

  // SUBGRUPO 4: Cubiertas Galvalume
  {
    sku: 'LAT-CUB-020',
    productName: 'Cubierta Galvalume Trapezoidal Prepintada Azul/Rojo 0.40mm (Plancha 6m)',
    brand: 'LATINA',
    productLine: 'Cubiertas y Techos',
    subgrupo: 'Cubiertas Galvalume',
    unitLabel: 'Planchas',
    unitPriceUsd: 42.5,
    marginPercent: 24,
    complementaryLines: ['Correas Metálicas', 'Selladores', 'Pinturas Arquitectónicas e Industriales'],
    defaultCommercialPitch:
      'Línea líder en proyectos industriales y galpones; alta demanda estacional con entrega directa en obra.',
    suggestedMonthlyGoalQty: 50,
  },
  {
    sku: 'LAT-CUB-022',
    productName: 'Cumbrera Articulada Galvalume Prepintada 0.40mm Latina (3m)',
    brand: 'LATINA',
    productLine: 'Cubiertas y Techos',
    subgrupo: 'Cubiertas Galvalume',
    unitLabel: 'Unidades',
    unitPriceUsd: 18.9,
    marginPercent: 31,
    complementaryLines: ['Cubiertas y Techos', 'Selladores'],
    defaultCommercialPitch:
      'Producto hermano obligatorio del Subgrupo Cubiertas Galvalume: cada 10 planchas de cubierta requieren 2 cumbreras Latina.',
    suggestedMonthlyGoalQty: 30,
  },
  {
    sku: 'IND-CUB-025',
    productName: 'Plancha Traslúcida Policarbonato Trapezoidal UV Induless (6m)',
    brand: 'INDULESS',
    productLine: 'Cubiertas y Techos',
    subgrupo: 'Cubiertas Galvalume',
    unitLabel: 'Planchas',
    unitPriceUsd: 36.8,
    marginPercent: 35,
    complementaryLines: ['Cubiertas y Techos', 'Selladores'],
    defaultCommercialPitch:
      'Mismo Subgrupo (Cubiertas Galvalume): iluminación natural para galpones industriales con 35% de margen para el distribuidor.',
    suggestedMonthlyGoalQty: 20,
  },

  // SUBGRUPO 5: Correas Perfil G
  {
    sku: 'LAT-COR-030',
    productName: 'Correa Metálica Perfil G Galvanizada 100x50x15x2.0mm (6m)',
    brand: 'LATINA',
    productLine: 'Correas Metálicas',
    subgrupo: 'Correas Perfil G',
    unitLabel: 'Unidades',
    unitPriceUsd: 23.4,
    marginPercent: 25,
    complementaryLines: ['Cubiertas y Techos', 'Pinturas Arquitectónicas e Industriales', 'Selladores'],
    defaultCommercialPitch:
      'El cliente adquiere Cubiertas pero no lleva Correas Metálicas Latina; oportunidad inmediata de cerrar paquete estructural completo.',
    suggestedMonthlyGoalQty: 45,
  },
  {
    sku: 'LAT-COR-034',
    productName: 'Correa Metálica Perfil G Galvanizada 125x50x15x2.0mm Latina (6m)',
    brand: 'LATINA',
    productLine: 'Correas Metálicas',
    subgrupo: 'Correas Perfil G',
    unitLabel: 'Unidades',
    unitPriceUsd: 27.8,
    marginPercent: 27,
    complementaryLines: ['Cubiertas y Techos'],
    defaultCommercialPitch:
      'Mismo Subgrupo (Correas Perfil G): peralte estructural de 125mm para luces mayores en naves industriales.',
    suggestedMonthlyGoalQty: 35,
  },

  // SUBGRUPO 6: Empastes Exteriores
  {
    sku: 'IND-EMP-040',
    productName: 'Empaste Profesional Exterior/Interior Hidrófugo Induless (Saco 20 Kg)',
    brand: 'INDULESS',
    productLine: 'Empastes',
    subgrupo: 'Empastes Exteriores',
    unitLabel: 'Sacos',
    unitPriceUsd: 14.2,
    marginPercent: 30,
    complementaryLines: ['Pinturas Arquitectónicas e Industriales', 'Selladores', 'Brochas y Herramientas'],
    defaultCommercialPitch:
      'Preparación de superficie previa a Pintura Látex Latina; cada caneca de pintura arrastra 2 sacos de empaste Induless.',
    suggestedMonthlyGoalQty: 50,
  },
  {
    sku: 'LAT-EMP-042',
    productName: 'Empaste Acrílico Listo para Usar Pasta Fina Latina (Caneca 5 Gal)',
    brand: 'LATINA',
    productLine: 'Empastes',
    subgrupo: 'Empastes Exteriores',
    unitLabel: 'Canecas',
    unitPriceUsd: 31.5,
    marginPercent: 33,
    complementaryLines: ['Pinturas Arquitectónicas e Industriales'],
    defaultCommercialPitch:
      'Producto hermano premium del Subgrupo Empastes Exteriores listo para aplicar en acabados arquitectónicos.',
    suggestedMonthlyGoalQty: 20,
  },

  // SUBGRUPO 7: Morteros Adhesivos
  {
    sku: 'IND-MOR-050',
    productName: 'Mortero Adhesivo Pegamento Porcelanato & Cerámica Induless (Saco 25 Kg)',
    brand: 'INDULESS',
    productLine: 'Morteros',
    subgrupo: 'Morteros Adhesivos',
    unitLabel: 'Sacos',
    unitPriceUsd: 9.6,
    marginPercent: 29,
    complementaryLines: ['Empastes', 'Selladores'],
    defaultCommercialPitch:
      'Alta rotación en ferreterías de acabados y constructoras con excelente rentabilidad por pallet.',
    suggestedMonthlyGoalQty: 80,
  },
  {
    sku: 'IND-MOR-054',
    productName: 'Mortero Flexible Piscinas & Gran Formato Induless (Saco 25 Kg)',
    brand: 'INDULESS',
    productLine: 'Morteros',
    subgrupo: 'Morteros Adhesivos',
    unitLabel: 'Sacos',
    unitPriceUsd: 15.8,
    marginPercent: 34,
    complementaryLines: ['Empastes', 'Selladores'],
    defaultCommercialPitch:
      'Expansión en el mismo Subgrupo (Morteros Adhesivos): alta adherencia para porcelanato de gran formato.',
    suggestedMonthlyGoalQty: 40,
  },

  // SUBGRUPO 8: Selladores Elastómeros
  {
    sku: 'IND-SEL-060',
    productName: 'Sellador Elastómero Impermeabilizante de Cubiertas & Fisuras (Galón)',
    brand: 'INDULESS',
    productLine: 'Selladores',
    subgrupo: 'Selladores Elastómeros',
    unitLabel: 'Galones',
    unitPriceUsd: 21.5,
    marginPercent: 32,
    complementaryLines: ['Cubiertas y Techos', 'Empastes', 'Pinturas Arquitectónicas e Industriales'],
    defaultCommercialPitch:
      'Complemento técnico ideal para clientes que compran Cubiertas o Pintura Exterior; sella traslapes y pernos de techo.',
    suggestedMonthlyGoalQty: 30,
  },
  {
    sku: 'LAT-SEL-064',
    productName: 'Imprimante Sellador Acrílico Antialcalino de Paredes Latina (Caneca 5 Gal)',
    brand: 'LATINA',
    productLine: 'Selladores',
    subgrupo: 'Selladores Elastómeros',
    unitLabel: 'Canecas',
    unitPriceUsd: 54.0,
    marginPercent: 31,
    complementaryLines: ['Pinturas Arquitectónicas e Industriales', 'Empastes'],
    defaultCommercialPitch:
      'Mismo Subgrupo (Selladores Elastómeros): puente de adherencia entre empaste y pintura caucho.',
    suggestedMonthlyGoalQty: 18,
  },

  // SUBGRUPO 9: Recubrimientos Automotrices
  {
    sku: 'IND-REC-070',
    productName: 'Recubrimiento Antigravilla & Undercoating Chasis Automotriz Induless (1 Litro)',
    brand: 'INDULESS',
    productLine: 'Recubrimientos/Antigravilla',
    subgrupo: 'Recubrimientos Automotrices',
    unitLabel: 'Unidades',
    unitPriceUsd: 7.8,
    marginPercent: 36,
    complementaryLines: ['Diluyentes/Thinners', 'Pinturas Arquitectónicas e Industriales'],
    defaultCommercialPitch:
      'Producto estrella de alto margen en línea automotriz/industrial Induless para talleres y ferreterías.',
    suggestedMonthlyGoalQty: 36,
  },
  {
    sku: 'IND-REC-074',
    productName: 'Masilla Poliéster Automotriz Ultra Suave con Catalizador Induless (Galón)',
    brand: 'INDULESS',
    productLine: 'Recubrimientos/Antigravilla',
    subgrupo: 'Recubrimientos Automotrices',
    unitLabel: 'Galones',
    unitPriceUsd: 26.5,
    marginPercent: 35,
    complementaryLines: ['Diluyentes/Thinners'],
    defaultCommercialPitch:
      'Hermano directo en el Subgrupo Recubrimientos Automotrices para clientes que compran Antigravilla o Thinner Acrílico.',
    suggestedMonthlyGoalQty: 24,
  },

  // SUBGRUPO 10: Brochas Profesionales
  {
    sku: 'IND-BRO-080',
    productName: 'Set Brochas Profesionales Cerda Negra & Rodillos Antigota Induless (Display 24 u)',
    brand: 'INDULESS',
    productLine: 'Brochas y Herramientas',
    subgrupo: 'Brochas Profesionales',
    unitLabel: 'Displays',
    unitPriceUsd: 46.0,
    marginPercent: 33,
    complementaryLines: ['Pinturas Arquitectónicas e Industriales', 'Empastes', 'Diluyentes/Thinners'],
    defaultCommercialPitch:
      'Venta por impulso garantizada junto al mostrador de Pinturas Latina; exhibidor sin costo en compras de 2 displays.',
    suggestedMonthlyGoalQty: 10,
  },
  {
    sku: 'LAT-BRO-084',
    productName: 'Kit Rodillos Epóxicos & Felpa Industrial 9" Latina Pro (Caja 12 u)',
    brand: 'LATINA',
    productLine: 'Brochas y Herramientas',
    subgrupo: 'Brochas Profesionales',
    unitLabel: 'Cajas',
    unitPriceUsd: 38.4,
    marginPercent: 32,
    complementaryLines: ['Pinturas Arquitectónicas e Industriales'],
    defaultCommercialPitch:
      'Mismo Subgrupo (Brochas Profesionales): rodillos de alta resistencia a solventes para aplicar esmaltes y anticorrosivos.',
    suggestedMonthlyGoalQty: 14,
  },
];

/**
 * Formatea una fecha YYYY-MM-DD al formato ejecutivo compacto DD/Mes/YYYY (ej. 18/Oct/2026)
 */
export function formatShortSaleDate(isoDate: string): string {
  if (!isoDate) return 'S/F';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const months = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  const mIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
  return `${parts[2]}/${months[mIdx]}/${parts[0]}`;
}

/**
 * Calcula los días transcurridos sin comprar respecto a la fecha de corte operativa (2026-11-11)
 */
export function calculateDaysWithoutPurchase(
  lastPurchaseDate: string,
  referenceIsoDate: string = '2026-11-11'
): number {
  const refMs = Date.parse(referenceIsoDate);
  const lastMs = Date.parse(lastPurchaseDate);
  if (Number.isNaN(refMs) || Number.isNaN(lastMs)) return 0;
  return Math.max(0, Math.round((refMs - lastMs) / 86400000));
}

/**
 * Datos iniciales de Cartera de Clientes e Historial de Compras de 12 Meses (M1..M12)
 * Incluye Subgrupo y Último Precio Vendido ($) por producto.
 */
export const INITIAL_CLIENT_PORTFOLIO: ClientPortfolioRecord[] = [
  {
    id: 'cli-001',
    codigoLatinaSoft: 'CLI-GYE-00142',
    ruc: '0992348192001',
    razonSocial: 'Ferretería El Tornillo Cía. Ltda.',
    nombreComercial: 'Distribuidora Ferretera del Pacífico',
    ciudad: 'Guayaquil',
    sector: 'Av. Juan Tanca Marengo Km 3.5 · Kennedy Norte',
    direccion: 'Av. Juan Tanca Marengo Km 3.5 y Av. Agustín Freire, Bodega 4',
    lat: -2.1550,
    lng: -79.9050,
    categoria: 'Distribuidor Mayorista AAA',
    estadoAtencion: 'ACTIVO',
    cupoCreditoUsd: 45000,
    saldoDisponibleUsd: 26550,
    frecuenciaVisita: 'Semanal (Martes 08:30)',
    supervisorId: 'usr-sup-norte',
    supervisorName: 'Lic. Mariana Paredes',
    zoneName: 'Zona Norte & Guayaquil Metropolitano',
    executiveId: 'agt-1',
    executiveName: 'Carlos Vera',
    contactoNombre: 'Ing. Gonzalo Morales (Jefe de Compras)',
    contactoTelefono: '+593 4 239 8812',
    purchases12M: [
      {
        sku: 'LAT-PIN-001',
        productName: 'Pintura Caucho Látex Supremo Interior/Exterior (Caneca 5 Gal)',
        brand: 'LATINA',
        productLine: 'Pinturas Arquitectónicas e Industriales',
        subgrupo: 'Pinturas Caucho Interior',
        unitLabel: 'Canecas',
        totalQuantity12M: 420,
        totalSalesUsd12M: 28770,
        lastUnitPriceSoldUsd: 68.5,
        lastPurchaseDate: '2026-11-04',
        monthlyTrendUnits: [30, 32, 35, 28, 36, 40, 38, 34, 37, 36, 38, 36],
      },
      {
        sku: 'LAT-CUB-020',
        productName: 'Cubierta Galvalume Trapezoidal Prepintada Azul/Rojo 0.40mm (Plancha 6m)',
        brand: 'LATINA',
        productLine: 'Cubiertas y Techos',
        subgrupo: 'Cubiertas Galvalume',
        unitLabel: 'Planchas',
        totalQuantity12M: 510,
        totalSalesUsd12M: 21675,
        lastUnitPriceSoldUsd: 42.5,
        lastPurchaseDate: '2026-10-29',
        monthlyTrendUnits: [40, 42, 45, 38, 44, 48, 40, 42, 45, 42, 44, 40],
      },
      {
        sku: 'LAT-PIN-002',
        productName: 'Esmalte Sintético Anticorrosivo Industrial Brillante (Galón)',
        brand: 'LATINA',
        productLine: 'Pinturas Arquitectónicas e Industriales',
        subgrupo: 'Esmaltes Anticorrosivos',
        unitLabel: 'Galones',
        totalQuantity12M: 640,
        totalSalesUsd12M: 12672,
        lastUnitPriceSoldUsd: 19.8,
        lastPurchaseDate: '2026-11-02',
        monthlyTrendUnits: [50, 52, 48, 55, 54, 58, 50, 52, 56, 55, 54, 56],
      },
      {
        sku: 'IND-MOR-050',
        productName: 'Mortero Adhesivo Pegamento Porcelanato & Cerámica Induless (Saco 25 Kg)',
        brand: 'INDULESS',
        productLine: 'Morteros',
        subgrupo: 'Morteros Adhesivos',
        unitLabel: 'Sacos',
        totalQuantity12M: 780,
        totalSalesUsd12M: 7488,
        lastUnitPriceSoldUsd: 9.6,
        lastPurchaseDate: '2026-08-12',
        monthlyTrendUnits: [85, 90, 80, 95, 88, 92, 85, 85, 80, 0, 0, 0],
      },
      {
        sku: 'IND-REC-070',
        productName: 'Recubrimiento Antigravilla & Undercoating Chasis Automotriz Induless (1 Litro)',
        brand: 'INDULESS',
        productLine: 'Recubrimientos/Antigravilla',
        subgrupo: 'Recubrimientos Automotrices',
        unitLabel: 'Unidades',
        totalQuantity12M: 310,
        totalSalesUsd12M: 2418,
        lastUnitPriceSoldUsd: 7.8,
        lastPurchaseDate: '2026-08-05',
        monthlyTrendUnits: [35, 38, 32, 36, 34, 35, 34, 36, 30, 0, 0, 0],
      },
    ],
  },
  {
    id: 'cli-002',
    codigoLatinaSoft: 'CLI-GYE-00218',
    ruc: '0991122334001',
    razonSocial: 'Constructora & Estructuras Metálicas Andina S.A.',
    nombreComercial: 'Consorcio Industrial Andino',
    ciudad: 'Guayaquil',
    sector: 'Vía a Daule Km 11.5 · Parque Industrial California',
    direccion: 'Vía a Daule Km 11.5, Parque Industrial California 2, Manzana G Solar 8',
    lat: -2.1640,
    lng: -79.9000,
    categoria: 'Constructora Corporativa',
    estadoAtencion: 'SEGUIMIENTO_COBRO',
    cupoCreditoUsd: 65000,
    saldoDisponibleUsd: 33200,
    frecuenciaVisita: 'Quincenal (Miércoles 10:00)',
    supervisorId: 'usr-sup-norte',
    supervisorName: 'Lic. Mariana Paredes',
    zoneName: 'Zona Norte & Guayaquil Metropolitano',
    executiveId: 'agt-1',
    executiveName: 'Carlos Vera',
    contactoNombre: 'Arq. Valeria Zambrano (Directora de Adquisiciones)',
    contactoTelefono: '+593 4 210 4490',
    purchases12M: [
      {
        sku: 'LAT-CUB-020',
        productName: 'Cubierta Galvalume Trapezoidal Prepintada Azul/Rojo 0.40mm (Plancha 6m)',
        brand: 'LATINA',
        productLine: 'Cubiertas y Techos',
        subgrupo: 'Cubiertas Galvalume',
        unitLabel: 'Planchas',
        totalQuantity12M: 920,
        totalSalesUsd12M: 39100,
        lastUnitPriceSoldUsd: 42.5,
        lastPurchaseDate: '2026-11-01',
        monthlyTrendUnits: [70, 75, 80, 72, 78, 82, 75, 76, 80, 78, 76, 78],
      },
      {
        sku: 'LAT-COR-030',
        productName: 'Correa Metálica Perfil G Galvanizada 100x50x15x2.0mm (6m)',
        brand: 'LATINA',
        productLine: 'Correas Metálicas',
        subgrupo: 'Correas Perfil G',
        unitLabel: 'Unidades',
        totalQuantity12M: 850,
        totalSalesUsd12M: 19890,
        lastUnitPriceSoldUsd: 23.4,
        lastPurchaseDate: '2026-10-28',
        monthlyTrendUnits: [65, 70, 72, 68, 74, 75, 70, 72, 74, 70, 70, 70],
      },
      {
        sku: 'IND-EMP-040',
        productName: 'Empaste Profesional Exterior/Interior Hidrófugo Induless (Saco 20 Kg)',
        brand: 'INDULESS',
        productLine: 'Empastes',
        subgrupo: 'Empastes Exteriores',
        unitLabel: 'Sacos',
        totalQuantity12M: 540,
        totalSalesUsd12M: 7668,
        lastUnitPriceSoldUsd: 14.2,
        lastPurchaseDate: '2026-08-18',
        monthlyTrendUnits: [60, 62, 58, 64, 60, 58, 62, 58, 58, 0, 0, 0],
      },
      {
        sku: 'LAT-PIN-002',
        productName: 'Esmalte Sintético Anticorrosivo Industrial Brillante (Galón)',
        brand: 'LATINA',
        productLine: 'Pinturas Arquitectónicas e Industriales',
        subgrupo: 'Esmaltes Anticorrosivos',
        unitLabel: 'Galones',
        totalQuantity12M: 320,
        totalSalesUsd12M: 6336,
        lastUnitPriceSoldUsd: 19.8,
        lastPurchaseDate: '2026-10-25',
        monthlyTrendUnits: [24, 26, 25, 28, 27, 30, 26, 28, 27, 26, 27, 26],
      },
    ],
  },
  {
    id: 'cli-003',
    codigoLatinaSoft: 'CLI-GYE-00309',
    ruc: '0993344556001',
    razonSocial: 'Importadora Ferretera San Eduardo S.A.',
    nombreComercial: 'Megacentro Ferretero Urdesa',
    ciudad: 'Guayaquil',
    sector: 'Av. Víctor Emilio Estrada · Urdesa Central',
    direccion: 'Av. Víctor Emilio Estrada 812 y Guayacanes, Esquina Comercial',
    lat: -2.1740,
    lng: -79.9020,
    categoria: 'Ferretería Industrial AA',
    estadoAtencion: 'EN_RIESGO_FUGA',
    cupoCreditoUsd: 30000,
    saldoDisponibleUsd: 19400,
    frecuenciaVisita: 'Semanal (Jueves 11:00)',
    supervisorId: 'usr-sup-norte',
    supervisorName: 'Lic. Mariana Paredes',
    zoneName: 'Zona Norte & Guayaquil Metropolitano',
    executiveId: 'agt-2',
    executiveName: 'Elena Mendoza',
    contactoNombre: 'Econ. Patricio Cevallos (Gerente Propietario)',
    contactoTelefono: '+593 4 288 3105',
    purchases12M: [
      {
        sku: 'LAT-PIN-001',
        productName: 'Pintura Caucho Látex Supremo Interior/Exterior (Caneca 5 Gal)',
        brand: 'LATINA',
        productLine: 'Pinturas Arquitectónicas e Industriales',
        subgrupo: 'Pinturas Caucho Interior',
        unitLabel: 'Canecas',
        totalQuantity12M: 290,
        totalSalesUsd12M: 19865,
        lastUnitPriceSoldUsd: 68.5,
        lastPurchaseDate: '2026-11-05',
        monthlyTrendUnits: [22, 24, 25, 23, 26, 24, 25, 24, 25, 24, 24, 24],
      },
      {
        sku: 'IND-DIL-010',
        productName: 'Thinner Acrílico Automotriz & Industrial Alto Brillo (Tanque 55 Gal)',
        brand: 'INDULESS',
        productLine: 'Diluyentes/Thinners',
        subgrupo: 'Diluyentes Industriales',
        unitLabel: 'Galones',
        totalQuantity12M: 1120,
        totalSalesUsd12M: 9968,
        lastUnitPriceSoldUsd: 8.9,
        lastPurchaseDate: '2026-10-30',
        monthlyTrendUnits: [90, 92, 95, 88, 94, 96, 92, 95, 94, 96, 94, 94],
      },
      {
        sku: 'IND-BRO-080',
        productName: 'Set Brochas Profesionales Cerda Negra & Rodillos Antigota Induless (Display 24 u)',
        brand: 'INDULESS',
        productLine: 'Brochas y Herramientas',
        subgrupo: 'Brochas Profesionales',
        unitLabel: 'Displays',
        totalQuantity12M: 95,
        totalSalesUsd12M: 4370,
        lastUnitPriceSoldUsd: 46.0,
        lastPurchaseDate: '2026-08-09',
        monthlyTrendUnits: [10, 11, 10, 12, 11, 10, 11, 10, 10, 0, 0, 0],
      },
    ],
  },
  {
    id: 'cli-004',
    codigoLatinaSoft: 'CLI-GYE-00415',
    ruc: '0994455667001',
    razonSocial: 'Comercializadora de Acabados & Pinturas del Litoral Cía. Ltda.',
    nombreComercial: 'Pinturas & Techos Litoral Norte',
    ciudad: 'Guayaquil',
    sector: 'Av. Francisco de Orellana · Alborada 12va Etapa',
    direccion: 'Av. Francisco de Orellana, C.C. Gran Albocentro Local B-14',
    lat: -2.1480,
    lng: -79.9010,
    categoria: 'Almacén Pinturero A',
    estadoAtencion: 'ACTIVO',
    cupoCreditoUsd: 25000,
    saldoDisponibleUsd: 17800,
    frecuenciaVisita: 'Semanal (Viernes 09:30)',
    supervisorId: 'usr-sup-norte',
    supervisorName: 'Lic. Mariana Paredes',
    zoneName: 'Zona Norte & Guayaquil Metropolitano',
    executiveId: 'agt-3',
    executiveName: 'Javier Solís',
    contactoNombre: 'Ing. Fernando Villacreses',
    contactoTelefono: '+593 4 227 6510',
    purchases12M: [
      {
        sku: 'LAT-PIN-001',
        productName: 'Pintura Caucho Látex Supremo Interior/Exterior (Caneca 5 Gal)',
        brand: 'LATINA',
        productLine: 'Pinturas Arquitectónicas e Industriales',
        subgrupo: 'Pinturas Caucho Interior',
        unitLabel: 'Canecas',
        totalQuantity12M: 215,
        totalSalesUsd12M: 14727.5,
        lastUnitPriceSoldUsd: 68.5,
        lastPurchaseDate: '2026-11-03',
        monthlyTrendUnits: [16, 18, 17, 19, 18, 18, 17, 19, 18, 18, 19, 18],
      },
      {
        sku: 'IND-EMP-040',
        productName: 'Empaste Profesional Exterior/Interior Hidrófugo Induless (Saco 20 Kg)',
        brand: 'INDULESS',
        productLine: 'Empastes',
        subgrupo: 'Empastes Exteriores',
        unitLabel: 'Sacos',
        totalQuantity12M: 490,
        totalSalesUsd12M: 6958,
        lastUnitPriceSoldUsd: 14.2,
        lastPurchaseDate: '2026-10-31',
        monthlyTrendUnits: [40, 42, 38, 41, 40, 42, 41, 40, 42, 41, 41, 42],
      },
      {
        sku: 'LAT-DIL-012',
        productName: 'Diluyente Sintético Estándar Latina (Caja 12 Litros)',
        brand: 'LATINA',
        productLine: 'Diluyentes/Thinners',
        subgrupo: 'Diluyentes Industriales',
        unitLabel: 'Cajas',
        totalQuantity12M: 140,
        totalSalesUsd12M: 3360,
        lastUnitPriceSoldUsd: 24.0,
        lastPurchaseDate: '2026-08-14',
        monthlyTrendUnits: [15, 16, 15, 16, 15, 16, 16, 15, 16, 0, 0, 0],
      },
    ],
  },
  {
    id: 'cli-005',
    codigoLatinaSoft: 'CLI-SUR-00580',
    ruc: '0995566778001',
    razonSocial: 'Hierros, Cubiertas y Suministros Navales Guayas S.A.',
    nombreComercial: 'Suministros Industriales Puerto Sur',
    ciudad: 'Guayaquil',
    sector: 'Av. 25 de Julio · Vía Puerto Marítimo',
    direccion: 'Av. 25 de Julio Km 4.5 diagonal a Contecon, Bodega Industrial 12',
    lat: -2.2380,
    lng: -79.8980,
    categoria: 'Distribuidor Mayorista AAA',
    estadoAtencion: 'SEGUIMIENTO_COBRO',
    cupoCreditoUsd: 55000,
    saldoDisponibleUsd: 28900,
    frecuenciaVisita: 'Semanal (Lunes 09:00)',
    supervisorId: 'usr-sup-sur',
    supervisorName: 'Ing. Diego Cárdenas',
    zoneName: 'Zona Sur & Costa Austral',
    executiveId: 'trans-1',
    executiveName: 'Manuel Quintero',
    contactoNombre: 'Ing. Alberto Maruri (Gerente de Operaciones)',
    contactoTelefono: '+593 4 248 9021',
    purchases12M: [
      {
        sku: 'LAT-CUB-020',
        productName: 'Cubierta Galvalume Trapezoidal Prepintada Azul/Rojo 0.40mm (Plancha 6m)',
        brand: 'LATINA',
        productLine: 'Cubiertas y Techos',
        subgrupo: 'Cubiertas Galvalume',
        unitLabel: 'Planchas',
        totalQuantity12M: 760,
        totalSalesUsd12M: 32300,
        lastUnitPriceSoldUsd: 42.5,
        lastPurchaseDate: '2026-11-06',
        monthlyTrendUnits: [60, 62, 65, 64, 63, 66, 62, 64, 65, 63, 64, 62],
      },
      {
        sku: 'LAT-PIN-002',
        productName: 'Esmalte Sintético Anticorrosivo Industrial Brillante (Galón)',
        brand: 'LATINA',
        productLine: 'Pinturas Arquitectónicas e Industriales',
        subgrupo: 'Esmaltes Anticorrosivos',
        unitLabel: 'Galones',
        totalQuantity12M: 580,
        totalSalesUsd12M: 11484,
        lastUnitPriceSoldUsd: 19.8,
        lastPurchaseDate: '2026-11-02',
        monthlyTrendUnits: [46, 48, 50, 47, 49, 50, 48, 49, 48, 48, 49, 48],
      },
      {
        sku: 'IND-SEL-060',
        productName: 'Sellador Elastómero Impermeabilizante de Cubiertas & Fisuras (Galón)',
        brand: 'INDULESS',
        productLine: 'Selladores',
        subgrupo: 'Selladores Elastómeros',
        unitLabel: 'Galones',
        totalQuantity12M: 220,
        totalSalesUsd12M: 4730,
        lastUnitPriceSoldUsd: 21.5,
        lastPurchaseDate: '2026-08-10',
        monthlyTrendUnits: [24, 25, 24, 26, 24, 25, 24, 24, 24, 0, 0, 0],
      },
    ],
  },
];

/**
 * Facturas iniciales por vencer y vencidas para el módulo de Cartera y Seguimiento de Cobros
 */
export const INITIAL_RECEIVABLE_INVOICES: ReceivableInvoiceRecord[] = [
  {
    id: 'inv-001',
    invoiceNumber: 'FAC-001-002-0089412',
    clientId: 'cli-002',
    clientName: 'Constructora & Estructuras Metálicas Andina S.A.',
    clientRuc: '0991122334001',
    executiveId: 'agt-1',
    executiveName: 'Carlos Vera',
    supervisorId: 'usr-sup-norte',
    supervisorName: 'Lic. Mariana Paredes',
    zoneName: 'Zona Norte & Guayaquil Metropolitano',
    issueDate: '2026-09-20',
    dueDate: '2026-11-04',
    creditTermDays: 45,
    originalAmountUsd: 18400.0,
    appliedCreditsUsd: 3200.0,
    pendingBalanceUsd: 15200.0,
    daysToMaturity: -7, // Vencida hace 7 días
    followUps: [
      {
        id: 'fup-101',
        invoiceId: 'inv-001',
        status: 'Contactado - Promesa de Pago',
        promiseDate: '2026-11-12',
        reminderTime: '10:30',
        receiptNumber: 'COMP-TES-8821',
        committedOrPaidAmountUsd: 15200.0,
        notes: 'Tesorería confirma transferencia SPI aprobada para mañana antes del mediodía.',
        registeredBy: 'Carlos Vera',
        registeredRole: 'VENDEDOR',
        createdAt: '2026-11-09 15:20',
      },
    ],
  },
  {
    id: 'inv-002',
    invoiceNumber: 'FAC-001-002-0090105',
    clientId: 'cli-001',
    clientName: 'Ferretería El Tornillo Cía. Ltda.',
    clientRuc: '0992348192001',
    executiveId: 'agt-1',
    executiveName: 'Carlos Vera',
    supervisorId: 'usr-sup-norte',
    supervisorName: 'Lic. Mariana Paredes',
    zoneName: 'Zona Norte & Guayaquil Metropolitano',
    issueDate: '2026-10-12',
    dueDate: '2026-11-11',
    creditTermDays: 30,
    originalAmountUsd: 12850.0,
    appliedCreditsUsd: 2400.0,
    pendingBalanceUsd: 10450.0,
    daysToMaturity: 0, // Vence HOY
    followUps: [
      {
        id: 'fup-102',
        invoiceId: 'inv-002',
        status: 'Pendiente de Retención',
        promiseDate: '2026-11-11',
        reminderTime: '14:00',
        receiptNumber: 'RET-001-99201',
        committedOrPaidAmountUsd: 10450.0,
        notes: 'Cliente tiene listo cheque certificado y comprobante electrónico de retención 1.75%.',
        registeredBy: 'Carlos Vera',
        registeredRole: 'VENDEDOR',
        createdAt: '2026-11-10 11:15',
      },
    ],
  },
  {
    id: 'inv-003',
    invoiceNumber: 'FAC-001-002-0090388',
    clientId: 'cli-001',
    clientName: 'Ferretería El Tornillo Cía. Ltda.',
    clientRuc: '0992348192001',
    executiveId: 'agt-1',
    executiveName: 'Carlos Vera',
    supervisorId: 'usr-sup-norte',
    supervisorName: 'Lic. Mariana Paredes',
    zoneName: 'Zona Norte & Guayaquil Metropolitano',
    issueDate: '2026-10-16',
    dueDate: '2026-11-15',
    creditTermDays: 30,
    originalAmountUsd: 9500.0,
    appliedCreditsUsd: 1500.0,
    pendingBalanceUsd: 8000.0,
    daysToMaturity: 4, // Por vencer en 4 días (1 a 7 días -> Ámbar/Naranja, y < 5 días en KPI crítico)
    followUps: [],
  },
  {
    id: 'inv-004',
    invoiceNumber: 'FAC-001-002-0090740',
    clientId: 'cli-003',
    clientName: 'Importadora Ferretera San Eduardo S.A.',
    clientRuc: '0993344556001',
    executiveId: 'agt-2',
    executiveName: 'Elena Mendoza',
    supervisorId: 'usr-sup-norte',
    supervisorName: 'Lic. Mariana Paredes',
    zoneName: 'Zona Norte & Guayaquil Metropolitano',
    issueDate: '2026-10-22',
    dueDate: '2026-11-21',
    creditTermDays: 30,
    originalAmountUsd: 11600.0,
    appliedCreditsUsd: 1000.0,
    pendingBalanceUsd: 10600.0,
    daysToMaturity: 10, // Próxima a vencer (6 a 15 días -> Amarillo)
    followUps: [
      {
        id: 'fup-103',
        invoiceId: 'inv-004',
        status: 'Abono Parcial Recibido',
        promiseDate: '2026-11-21',
        reminderTime: '09:30',
        receiptNumber: 'REC-COB-4410',
        committedOrPaidAmountUsd: 1000.0,
        notes: 'Se registró abono inicial de $1,000 USD y se programó cancelación del saldo al vencimiento.',
        registeredBy: 'Elena Mendoza',
        registeredRole: 'VENDEDOR',
        createdAt: '2026-11-08 16:40',
      },
    ],
  },
  {
    id: 'inv-005',
    invoiceNumber: 'FAC-001-002-0091120',
    clientId: 'cli-004',
    clientName: 'Comercializadora de Acabados & Pinturas del Litoral Cía. Ltda.',
    clientRuc: '0994455667001',
    executiveId: 'agt-3',
    executiveName: 'Javier Solís',
    supervisorId: 'usr-sup-norte',
    supervisorName: 'Lic. Mariana Paredes',
    zoneName: 'Zona Norte & Guayaquil Metropolitano',
    issueDate: '2026-11-01',
    dueDate: '2026-12-01',
    creditTermDays: 30,
    originalAmountUsd: 7200.0,
    appliedCreditsUsd: 0,
    pendingBalanceUsd: 7200.0,
    daysToMaturity: 20, // Preventivo (> 15 días -> Verde)
    followUps: [],
  },
  {
    id: 'inv-006',
    invoiceNumber: 'FAC-001-003-0045190',
    clientId: 'cli-005',
    clientName: 'Hierros, Cubiertas y Suministros Navales Guayas S.A.',
    clientRuc: '0995566778001',
    executiveId: 'trans-1',
    executiveName: 'Manuel Quintero',
    supervisorId: 'usr-sup-sur',
    supervisorName: 'Ing. Diego Cárdenas',
    zoneName: 'Zona Sur & Costa Austral',
    issueDate: '2026-09-25',
    dueDate: '2026-11-09',
    creditTermDays: 45,
    originalAmountUsd: 19500.0,
    appliedCreditsUsd: 3400.0,
    pendingBalanceUsd: 16100.0,
    daysToMaturity: -2, // Vencida hace 2 días
    followUps: [
      {
        id: 'fup-104',
        invoiceId: 'inv-006',
        status: 'En trámite de Nota de Crédito (NC)',
        promiseDate: '2026-11-13',
        reminderTime: '11:00',
        receiptNumber: 'NC-002-00812',
        committedOrPaidAmountUsd: 16100.0,
        notes: 'Aplicada NC por descuento pronto pago en volumen de cubiertas; saldo neto listo para cobro.',
        registeredBy: 'Manuel Quintero',
        registeredRole: 'VENDEDOR',
        createdAt: '2026-11-10 09:45',
      },
    ],
  },
  {
    id: 'inv-007',
    invoiceNumber: 'FAC-001-003-0045890',
    clientId: 'cli-005',
    clientName: 'Hierros, Cubiertas y Suministros Navales Guayas S.A.',
    clientRuc: '0995566778001',
    executiveId: 'trans-1',
    executiveName: 'Manuel Quintero',
    supervisorId: 'usr-sup-sur',
    supervisorName: 'Ing. Diego Cárdenas',
    zoneName: 'Zona Sur & Costa Austral',
    issueDate: '2026-10-20',
    dueDate: '2026-11-19',
    creditTermDays: 30,
    originalAmountUsd: 10000.0,
    appliedCreditsUsd: 0,
    pendingBalanceUsd: 10000.0,
    daysToMaturity: 8, // Próxima a vencer (8 a 15 días)
    followUps: [],
  },
];

/**
 * 1. MOTOR DE VISUALIZACIÓN EN CASCADA JERÁRQUICA (ROLL-UP & DRILL-DOWN)
 * Determina el alcance permitido y filtra Supervisores, Ejecutivos, Clientes y Facturas
 * según el rol del usuario autenticado y la selección actual en la cascada.
 */
export function resolveEffectiveCascadeFilter(
  session: Pick<LatinaUserSession, 'rol' | 'usuario' | 'mappedGeoLatinaUserId'> | null | undefined,
  requestedFilter: CascadeFilterState
): {
  hierarchyLevel: 1 | 2 | 3 | 4;
  canSelectSupervisor: boolean;
  canSelectExecutive: boolean;
  availableSupervisors: HierarchySupervisorOption[];
  availableExecutives: HierarchyExecutiveOption[];
  effectiveSupervisorId: string;
  effectiveExecutiveId: string;
  effectiveClientId: string;
} {
  const level = getRoleHierarchyLevel(session?.rol, session?.usuario);
  const mappedId = session?.mappedGeoLatinaUserId || 'usr-dir';

  // Nivel 1: EJECUTIVO_VENTAS / VENDEDOR / TRANSPORTISTA -> Exclusivamente su propia cartera
  if (level === 1) {
    const ownExec =
      HIERARCHY_EXECUTIVES.find((e) => e.id === mappedId) || HIERARCHY_EXECUTIVES[0];
    const ownSup =
      HIERARCHY_SUPERVISORS.find((s) => s.id === ownExec.supervisorId) || HIERARCHY_SUPERVISORS[0];

    return {
      hierarchyLevel: 1,
      canSelectSupervisor: false,
      canSelectExecutive: false,
      availableSupervisors: [ownSup],
      availableExecutives: [ownExec],
      effectiveSupervisorId: ownSup.id,
      effectiveExecutiveId: ownExec.id,
      effectiveClientId: requestedFilter.clientId || 'ALL',
    };
  }

  // Nivel 2: SUPERVISOR -> Visualiza el consolidado de su zona y filtra por los Ejecutivos a su cargo
  if (level === 2) {
    const ownSup =
      HIERARCHY_SUPERVISORS.find((s) => s.id === mappedId) || HIERARCHY_SUPERVISORS[0];
    const teamExecutives = HIERARCHY_EXECUTIVES.filter((e) => e.supervisorId === ownSup.id);
    const validExec =
      requestedFilter.executiveId !== 'ALL' &&
      teamExecutives.some((e) => e.id === requestedFilter.executiveId)
        ? requestedFilter.executiveId
        : 'ALL';

    return {
      hierarchyLevel: 2,
      canSelectSupervisor: false,
      canSelectExecutive: true,
      availableSupervisors: [ownSup],
      availableExecutives: teamExecutives,
      effectiveSupervisorId: ownSup.id,
      effectiveExecutiveId: validExec,
      effectiveClientId: requestedFilter.clientId || 'ALL',
    };
  }

  // Nivel 3 y 4: JEFE_VENTAS / GERENCIA / ADMIN -> Cascada Multinivel Completa
  const validSup =
    requestedFilter.supervisorId !== 'ALL' &&
    HIERARCHY_SUPERVISORS.some((s) => s.id === requestedFilter.supervisorId)
      ? requestedFilter.supervisorId
      : 'ALL';

  const availableExecutives =
    validSup === 'ALL'
      ? HIERARCHY_EXECUTIVES
      : HIERARCHY_EXECUTIVES.filter((e) => e.supervisorId === validSup);

  const validExec =
    requestedFilter.executiveId !== 'ALL' &&
    availableExecutives.some((e) => e.id === requestedFilter.executiveId)
      ? requestedFilter.executiveId
      : 'ALL';

  return {
    hierarchyLevel: level,
    canSelectSupervisor: true,
    canSelectExecutive: true,
    availableSupervisors: HIERARCHY_SUPERVISORS,
    availableExecutives,
    effectiveSupervisorId: validSup,
    effectiveExecutiveId: validExec,
    effectiveClientId: requestedFilter.clientId || 'ALL',
  };
}

export function filterPortfolioByCascade(
  clients: ClientPortfolioRecord[],
  effectiveFilter: {
    effectiveSupervisorId: string;
    effectiveExecutiveId: string;
    effectiveClientId: string;
  },
  searchQuery: string = '',
  attentionFilter: 'TODOS' | ClientAttentionStatus = 'TODOS'
): ClientPortfolioRecord[] {
  const q = searchQuery.trim().toLowerCase();

  return clients.filter((c) => {
    if (
      effectiveFilter.effectiveSupervisorId !== 'ALL' &&
      c.supervisorId !== effectiveFilter.effectiveSupervisorId
    ) {
      return false;
    }
    if (
      effectiveFilter.effectiveExecutiveId !== 'ALL' &&
      c.executiveId !== effectiveFilter.effectiveExecutiveId
    ) {
      return false;
    }
    if (
      effectiveFilter.effectiveClientId !== 'ALL' &&
      c.id !== effectiveFilter.effectiveClientId
    ) {
      return false;
    }
    if (attentionFilter !== 'TODOS' && c.estadoAtencion !== attentionFilter) {
      return false;
    }
    if (q) {
      const hay = `${c.razonSocial} ${c.nombreComercial} ${c.ruc} ${c.codigoLatinaSoft} ${c.ciudad} ${c.sector} ${c.estadoAtencion}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function filterInvoicesByCascade(
  invoices: ReceivableInvoiceRecord[],
  effectiveFilter: {
    effectiveSupervisorId: string;
    effectiveExecutiveId: string;
    effectiveClientId: string;
  },
  searchQuery: string = ''
): ReceivableInvoiceRecord[] {
  const q = searchQuery.trim().toLowerCase();

  return invoices.filter((inv) => {
    if (
      effectiveFilter.effectiveSupervisorId !== 'ALL' &&
      inv.supervisorId !== effectiveFilter.effectiveSupervisorId
    ) {
      return false;
    }
    if (
      effectiveFilter.effectiveExecutiveId !== 'ALL' &&
      inv.executiveId !== effectiveFilter.effectiveExecutiveId
    ) {
      return false;
    }
    if (
      effectiveFilter.effectiveClientId !== 'ALL' &&
      inv.clientId !== effectiveFilter.effectiveClientId
    ) {
      return false;
    }
    if (q) {
      const hay = `${inv.invoiceNumber} ${inv.clientName} ${inv.clientRuc} ${inv.executiveName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Construye un registro consolidado ("Todos los Clientes") cuando ningún cliente individual
 * está seleccionado en la Cartera de Clientes, permitiendo analizar el Consolidado General
 * de Toda la Cartera visible en Cuadro 1 y Cuadro 2.
 */
export function buildConsolidatedPortfolioVirtualClient(
  clients: ClientPortfolioRecord[],
  scopeLabel: string = 'Todos los Clientes de la Cartera Visible'
): ClientPortfolioRecord {
  const skuMap = new Map<string, ProductPurchase12M>();

  let totalCupo = 0;
  let totalDisponible = 0;

  for (const client of clients) {
    totalCupo += client.cupoCreditoUsd;
    totalDisponible += client.saldoDisponibleUsd;

    for (const p of client.purchases12M) {
      const existing = skuMap.get(p.sku);
      const fallbackCatalog = MASTER_CATALOG_LATINA_INDULESS.find((c) => c.sku === p.sku);
      const safeSubgrupo: ProductSubgroup =
        p.subgrupo || fallbackCatalog?.subgrupo || 'Pinturas Caucho Interior';
      const safeLastPrice =
        typeof p.lastUnitPriceSoldUsd === 'number' && p.lastUnitPriceSoldUsd > 0
          ? p.lastUnitPriceSoldUsd
          : p.totalQuantity12M > 0
          ? Number((p.totalSalesUsd12M / p.totalQuantity12M).toFixed(2))
          : fallbackCatalog?.unitPriceUsd || 0;

      if (!existing) {
        skuMap.set(p.sku, {
          ...p,
          subgrupo: safeSubgrupo,
          lastUnitPriceSoldUsd: safeLastPrice,
          monthlyTrendUnits: [...p.monthlyTrendUnits],
        });
      } else {
        const isNewerSale = p.lastPurchaseDate > existing.lastPurchaseDate;
        existing.totalQuantity12M += p.totalQuantity12M;
        existing.totalSalesUsd12M = Number(
          (existing.totalSalesUsd12M + p.totalSalesUsd12M).toFixed(2)
        );
        if (isNewerSale) {
          existing.lastPurchaseDate = p.lastPurchaseDate;
          existing.lastUnitPriceSoldUsd = safeLastPrice;
        }
        existing.monthlyTrendUnits = existing.monthlyTrendUnits.map(
          (val, idx) => val + (p.monthlyTrendUnits[idx] || 0)
        );
      }
    }
  }

  const uniqueExecs = Array.from(new Set(clients.map((c) => c.executiveName)));
  const uniqueSups = Array.from(new Set(clients.map((c) => c.supervisorName)));

  return {
    id: 'ALL',
    codigoLatinaSoft: `CONSOLIDADO (${clients.length} CLIENTES)`,
    ruc: 'CONSOLIDADO-CARTERA',
    razonSocial: `CONSOLIDADO GENERAL — ${scopeLabel} (${clients.length} Clientes)`,
    nombreComercial: `Vista Global Consolidada (${clients.length} clientes activos en filtro)`,
    ciudad: 'Multiciudad / Nacional',
    sector: 'Consolidado de Cartera Comercial',
    direccion: 'Cobertura Consolidada Industrial Latina S.A.',
    lat: clients[0]?.lat ?? -2.155,
    lng: clients[0]?.lng ?? -79.905,
    categoria: 'Consolidado Corporativo',
    estadoAtencion: 'ACTIVO',
    cupoCreditoUsd: Number(totalCupo.toFixed(2)),
    saldoDisponibleUsd: Number(totalDisponible.toFixed(2)),
    frecuenciaVisita: 'Consolidado Continuo',
    supervisorId: clients.length === 1 ? clients[0].supervisorId : 'ALL',
    supervisorName:
      uniqueSups.length === 1 ? uniqueSups[0] : `${uniqueSups.length} Supervisores`,
    zoneName:
      clients.length === 1 ? clients[0].zoneName : 'Todas las Zonas Filtradas',
    executiveId: clients.length === 1 ? clients[0].executiveId : 'ALL',
    executiveName:
      uniqueExecs.length === 1 ? uniqueExecs[0] : `${uniqueExecs.length} Ejecutivos`,
    contactoNombre: `${clients.length} Clientes en Cartera Activa`,
    contactoTelefono: 'Central Comercial Latina S.A.',
    purchases12M: Array.from(skuMap.values()),
  };
}

/**
 * 2. CUADRO 1: HISTORIAL DE COMPRAS DE LOS ÚLTIMOS 12 MESES (DE MAYOR A MENOR)
 * Ordena estrictamente de MAYOR a MENOR (`DESC`) por Valor ($ USD) o Cantidad,
 * y filtra por marca (`TODOS` | `LATINA` | `INDULESS`) y por `Subgrupo`.
 * Incluye `Subgrupo` y `Último Precio Vendido ($)` con fecha compacta.
 */
export function rankAndFilterClientPurchases12M(
  purchases: ProductPurchase12M[],
  sortBy: 'VALOR_DESC' | 'CANTIDAD_DESC' = 'VALOR_DESC',
  brandFilter: 'TODOS' | ProductBrand = 'TODOS',
  subgrupoFilter: 'TODOS' | ProductSubgroup = 'TODOS'
): {
  items: RankedProductPurchase12M[];
  totals: {
    totalQuantity: number;
    totalSalesUsd: number;
    latinaSalesUsd: number;
    indulessSalesUsd: number;
  };
} {
  const normalizedPurchases = purchases.map((p) => {
    const fallbackCatalog = MASTER_CATALOG_LATINA_INDULESS.find((c) => c.sku === p.sku);
    const subgrupo: ProductSubgroup =
      p.subgrupo || fallbackCatalog?.subgrupo || 'Pinturas Caucho Interior';
    const lastUnitPriceSoldUsd =
      typeof p.lastUnitPriceSoldUsd === 'number' && p.lastUnitPriceSoldUsd > 0
        ? p.lastUnitPriceSoldUsd
        : p.totalQuantity12M > 0
        ? Number((p.totalSalesUsd12M / p.totalQuantity12M).toFixed(2))
        : fallbackCatalog?.unitPriceUsd || 0;
    return {
      ...p,
      subgrupo,
      lastUnitPriceSoldUsd,
    };
  });

  const filtered = normalizedPurchases.filter((p) => {
    if (brandFilter !== 'TODOS' && p.brand !== brandFilter) return false;
    if (subgrupoFilter !== 'TODOS' && p.subgrupo !== subgrupoFilter) return false;
    return true;
  });

  const totalSalesAllFiltered = filtered.reduce((acc, item) => acc + item.totalSalesUsd12M, 0);
  const totalQuantityAllFiltered = filtered.reduce((acc, item) => acc + item.totalQuantity12M, 0);
  const latinaSalesUsd = filtered
    .filter((p) => p.brand === 'LATINA')
    .reduce((acc, item) => acc + item.totalSalesUsd12M, 0);
  const indulessSalesUsd = filtered
    .filter((p) => p.brand === 'INDULESS')
    .reduce((acc, item) => acc + item.totalSalesUsd12M, 0);

  // Ordenamiento estricto de MAYOR A MENOR (DESC)
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'CANTIDAD_DESC') {
      if (b.totalQuantity12M !== a.totalQuantity12M) {
        return b.totalQuantity12M - a.totalQuantity12M;
      }
      return b.totalSalesUsd12M - a.totalSalesUsd12M;
    }
    if (b.totalSalesUsd12M !== a.totalSalesUsd12M) {
      return b.totalSalesUsd12M - a.totalSalesUsd12M;
    }
    return b.totalQuantity12M - a.totalQuantity12M;
  });

  const items: RankedProductPurchase12M[] = sorted.map((p, idx) => {
    const sharePercentage =
      totalSalesAllFiltered > 0
        ? Number(((p.totalSalesUsd12M / totalSalesAllFiltered) * 100).toFixed(1))
        : 0;

    const first9MonthsSum = p.monthlyTrendUnits.slice(0, 9).reduce((s, n) => s + n, 0);
    const last3MonthsSum = p.monthlyTrendUnits.slice(-3).reduce((s, n) => s + n, 0);
    const daysWithoutPurchase = calculateDaysWithoutPurchase(p.lastPurchaseDate);
    const stoppedBuyingLast60To90Days =
      (first9MonthsSum > 0 && last3MonthsSum === 0) || daysWithoutPurchase >= 45;

    return {
      ...p,
      rankPosition: idx + 1,
      sharePercentage,
      stoppedBuyingLast60To90Days,
      daysWithoutPurchase,
      lastSaleFormattedDate: formatShortSaleDate(p.lastPurchaseDate),
    };
  });

  return {
    items,
    totals: {
      totalQuantity: totalQuantityAllFiltered,
      totalSalesUsd: Number(totalSalesAllFiltered.toFixed(2)),
      latinaSalesUsd: Number(latinaSalesUsd.toFixed(2)),
      indulessSalesUsd: Number(indulessSalesUsd.toFixed(2)),
    },
  };
}

/**
 * 3. CUADRO 2: MOTOR DE INTELIGENCIA COMERCIAL POR SUBGRUPO Y PRODUCTOS INACTIVOS
 * A) Identificación de Productos que ha Dejado de Comprar (Alerta de Inactividad / Fuga > 45, 60 o 90 días)
 * B) Productos del Mismo Subgrupo que se le Pueden Vender (Expansión de Subgrupo contra Catálogo Maestro LATINA & INDULESS)
 */
export function analyzeSubgroupAndChurnIntelligence(
  client: ClientPortfolioRecord,
  committedIds: Record<string, string> = {}
): {
  inactiveProducts: InactiveChurnProductAlert[];
  subgroupExpansions: SubgroupExpansionGroup[];
  totalValueAtRiskUsd: number;
  totalSubgroupExpansionMonthlyUsd: number;
} {
  const normalizedPurchases = client.purchases12M.map((p) => {
    const fallbackCatalog = MASTER_CATALOG_LATINA_INDULESS.find((c) => c.sku === p.sku);
    return {
      ...p,
      subgrupo: (p.subgrupo ||
        fallbackCatalog?.subgrupo ||
        'Pinturas Caucho Interior') as ProductSubgroup,
      lastUnitPriceSoldUsd:
        typeof p.lastUnitPriceSoldUsd === 'number' && p.lastUnitPriceSoldUsd > 0
          ? p.lastUnitPriceSoldUsd
          : p.totalQuantity12M > 0
          ? Number((p.totalSalesUsd12M / p.totalQuantity12M).toFixed(2))
          : fallbackCatalog?.unitPriceUsd || 0,
    };
  });

  const purchasedSkus = new Set(normalizedPurchases.map((p) => p.sku));

  // A) Identificación de Productos que ha Dejado de Comprar (> 45, 60 o 90 días sin facturación)
  const inactiveProducts: InactiveChurnProductAlert[] = [];

  for (const p of normalizedPurchases) {
    const daysWithout = calculateDaysWithoutPurchase(p.lastPurchaseDate);
    const first9Units = p.monthlyTrendUnits.slice(0, 9).reduce((a, b) => a + b, 0);
    const last3Units = p.monthlyTrendUnits.slice(-3).reduce((a, b) => a + b, 0);
    const isInactive = daysWithout >= 45 || (first9Units > 0 && last3Units === 0);

    if (isInactive) {
      const activeMonthsCount = Math.max(
        1,
        p.monthlyTrendUnits.filter((qty) => qty > 0).length
      );
      const avgMonthlyQtySold = Math.max(
        1,
        Math.round(p.totalQuantity12M / activeMonthsCount)
      );
      const valueAtRiskUsd = Number(
        (avgMonthlyQtySold * p.lastUnitPriceSoldUsd).toFixed(2)
      );
      const severity: 'CRITICA_90D' | 'ALTA_60D' | 'ALERTA_45D' =
        daysWithout >= 90
          ? 'CRITICA_90D'
          : daysWithout >= 60
          ? 'ALTA_60D'
          : 'ALERTA_45D';

      const oppId = `churn-${client.id}-${p.sku}`;
      inactiveProducts.push({
        id: oppId,
        clientId: client.id,
        sku: p.sku,
        productName: p.productName,
        brand: p.brand,
        productLine: p.productLine,
        subgrupo: p.subgrupo,
        unitLabel: p.unitLabel,
        lastPurchaseDate: p.lastPurchaseDate,
        lastSaleFormattedDate: formatShortSaleDate(p.lastPurchaseDate),
        daysWithoutPurchase: Math.max(45, daysWithout),
        lastUnitPriceSoldUsd: p.lastUnitPriceSoldUsd,
        avgMonthlyQtySold,
        valueAtRiskUsd,
        severity,
        committedInVisit: Boolean(committedIds[oppId]),
        committedAt: committedIds[oppId],
      });
    }
  }

  inactiveProducts.sort((a, b) => b.valueAtRiskUsd - a.valueAtRiskUsd);

  // B) Productos del Mismo Subgrupo que se le Pueden Vender (Expansión de Subgrupo)
  // Agrupamos por cada Subgrupo en el que el cliente compra o dejó de comprar
  const clientSubgroupsMap = new Map<
    ProductSubgroup,
    Array<{
      sku: string;
      productName: string;
      brand: ProductBrand;
      status: 'ACTIVO' | 'DEJO_DE_COMPRAR';
      lastUnitPriceSoldUsd: number;
      lastSaleFormattedDate: string;
      totalSalesUsd12M: number;
    }>
  >();

  for (const p of normalizedPurchases) {
    const daysWithout = calculateDaysWithoutPurchase(p.lastPurchaseDate);
    const first9Units = p.monthlyTrendUnits.slice(0, 9).reduce((a, b) => a + b, 0);
    const last3Units = p.monthlyTrendUnits.slice(-3).reduce((a, b) => a + b, 0);
    const isInactive = daysWithout >= 45 || (first9Units > 0 && last3Units === 0);

    const list = clientSubgroupsMap.get(p.subgrupo) || [];
    list.push({
      sku: p.sku,
      productName: p.productName,
      brand: p.brand,
      status: isInactive ? 'DEJO_DE_COMPRAR' : 'ACTIVO',
      lastUnitPriceSoldUsd: p.lastUnitPriceSoldUsd,
      lastSaleFormattedDate: formatShortSaleDate(p.lastPurchaseDate),
      totalSalesUsd12M: p.totalSalesUsd12M,
    });
    clientSubgroupsMap.set(p.subgrupo, list);
  }

  const subgroupExpansions: SubgroupExpansionGroup[] = [];

  for (const [subgrupo, currentItems] of clientSubgroupsMap.entries()) {
    const firstCatalogInSubgroup = MASTER_CATALOG_LATINA_INDULESS.find(
      (c) => c.subgrupo === subgrupo
    );
    const productLine =
      firstCatalogInSubgroup?.productLine || 'Pinturas Arquitectónicas e Industriales';

    // Buscamos todos los productos hermanos del MISMO Subgrupo en el Catálogo Maestro que el cliente NO compra actualmente
    const siblingCatalogItems = MASTER_CATALOG_LATINA_INDULESS.filter(
      (c) => c.subgrupo === subgrupo && !purchasedSkus.has(c.sku)
    );

    const suggestedSameSubgroupProducts: SubgroupSuggestedProduct[] =
      siblingCatalogItems.map((cat) => {
        const oppId = `subexp-${client.id}-${cat.sku}`;
        const estimatedMonthlyOpportunityUsd = Number(
          (cat.suggestedMonthlyGoalQty * cat.unitPriceUsd).toFixed(2)
        );
        const estimatedMarginPercent = cat.brand === 'INDULESS' ? 34 : 29;

        return {
          id: oppId,
          sku: cat.sku,
          productName: cat.productName,
          brand: cat.brand,
          productLine: cat.productLine,
          subgrupo: cat.subgrupo,
          unitLabel: cat.unitLabel,
          referenceListPriceUsd: cat.unitPriceUsd,
          suggestedGoalQty: cat.suggestedMonthlyGoalQty,
          estimatedMonthlyOpportunityUsd,
          estimatedMarginPercent,
          commercialArgument: `Expansión directa en Subgrupo "${cat.subgrupo}": el cliente ya opera este subgrupo con ${currentItems[0]?.sku || 'línea base'}, por lo que tiene rotación garantizada para incorporar ${cat.productName} (${cat.brand}).`,
          committedInVisit: Boolean(committedIds[oppId]),
          committedAt: committedIds[oppId],
        };
      });

    if (suggestedSameSubgroupProducts.length > 0) {
      subgroupExpansions.push({
        subgrupo,
        productLine,
        clientCurrentOrPastProducts: currentItems,
        suggestedSameSubgroupProducts,
      });
    }
  }

  const totalValueAtRiskUsd = Number(
    inactiveProducts.reduce((acc, item) => acc + item.valueAtRiskUsd, 0).toFixed(2)
  );
  const totalSubgroupExpansionMonthlyUsd = Number(
    subgroupExpansions
      .reduce(
        (acc, grp) =>
          acc +
          grp.suggestedSameSubgroupProducts.reduce(
            (s, prod) => s + prod.estimatedMonthlyOpportunityUsd,
            0
          ),
        0
      )
      .toFixed(2)
  );

  return {
    inactiveProducts,
    subgroupExpansions,
    totalValueAtRiskUsd,
    totalSubgroupExpansionMonthlyUsd,
  };
}

/**
 * 3B. MOTOR DE INTELIGENCIA COMERCIAL CLÁSICO (Compatibilidad con exportaciones y tests)
 */
export function analyzeClientProductOpportunities(
  client: ClientPortfolioRecord,
  committedIds: Record<string, string> = {}
): {
  crossSell: ProductOpportunityRecommendation[];
  reactivation: ProductOpportunityRecommendation[];
  upSell: ProductOpportunityRecommendation[];
  all: ProductOpportunityRecommendation[];
  totalMonthlyPotentialUsd: number;
} {
  const purchasedSkus = new Set(client.purchases12M.map((p) => p.sku));
  const activeLines = new Set(
    client.purchases12M.filter((p) => p.totalSalesUsd12M > 0).map((p) => p.productLine)
  );

  const crossSell: ProductOpportunityRecommendation[] = [];
  const reactivation: ProductOpportunityRecommendation[] = [];
  const upSell: ProductOpportunityRecommendation[] = [];

  for (const catalogItem of MASTER_CATALOG_LATINA_INDULESS) {
    if (!purchasedSkus.has(catalogItem.sku)) {
      const isComplementary = catalogItem.complementaryLines.some((line) =>
        activeLines.has(line)
      );
      if (isComplementary || crossSell.length < 3) {
        const oppId = `opp-cross-${client.id}-${catalogItem.sku}`;
        const estimatedUsd = Number(
          (catalogItem.suggestedMonthlyGoalQty * catalogItem.unitPriceUsd).toFixed(2)
        );

        let customPitch = catalogItem.defaultCommercialPitch;
        if (
          activeLines.has('Pinturas Arquitectónicas e Industriales') &&
          (catalogItem.productLine === 'Diluyentes/Thinners' ||
            catalogItem.productLine === 'Empastes' ||
            catalogItem.productLine === 'Brochas y Herramientas')
        ) {
          customPitch = `Compra Pinturas Latina pero registra $0.00 en ${catalogItem.productLine} (${catalogItem.brand}). ${catalogItem.defaultCommercialPitch}`;
        } else if (
          activeLines.has('Cubiertas y Techos') &&
          (catalogItem.productLine === 'Correas Metálicas' ||
            catalogItem.productLine === 'Selladores')
        ) {
          customPitch = `Compra Cubiertas Latina pero lleva $0.00 en ${catalogItem.productLine} (${catalogItem.brand}). ${catalogItem.defaultCommercialPitch}`;
        }

        crossSell.push({
          id: oppId,
          clientId: client.id,
          category: 'CROSS_SELL',
          sku: catalogItem.sku,
          productName: catalogItem.productName,
          brand: catalogItem.brand,
          productLine: catalogItem.productLine,
          subgrupo: catalogItem.subgrupo,
          priority: estimatedUsd >= 600 ? 'ALTA' : 'MEDIA',
          commercialPitch: customPitch,
          suggestedGoalQty: catalogItem.suggestedMonthlyGoalQty,
          unitLabel: catalogItem.unitLabel,
          estimatedMonthlyExtraUsd: estimatedUsd,
          referenceUnitPriceUsd: catalogItem.unitPriceUsd,
          committedInVisit: Boolean(committedIds[oppId]),
          committedAt: committedIds[oppId],
        });
      }
    }
  }

  for (const purchase of client.purchases12M) {
    const first9MonthsUnits = purchase.monthlyTrendUnits.slice(0, 9).reduce((a, b) => a + b, 0);
    const last3MonthsUnits = purchase.monthlyTrendUnits.slice(-3).reduce((a, b) => a + b, 0);
    const daysWithout = calculateDaysWithoutPurchase(purchase.lastPurchaseDate);

    if ((first9MonthsUnits > 0 && last3MonthsUnits === 0) || daysWithout >= 45) {
      const oppId = `opp-react-${client.id}-${purchase.sku}`;
      const avgMonthlyUnits = Math.max(10, Math.round(first9MonthsUnits / 9));
      const avgMonthlyUsd = Number((purchase.totalSalesUsd12M / 9).toFixed(2));

      reactivation.push({
        id: oppId,
        clientId: client.id,
        category: 'REACTIVATION',
        sku: purchase.sku,
        productName: purchase.productName,
        brand: purchase.brand,
        productLine: purchase.productLine,
        subgrupo: purchase.subgrupo,
        priority: 'ALTA',
        commercialPitch: `ALERTA DE FUGA: El cliente compraba en promedio ${avgMonthlyUnits} ${purchase.unitLabel}/mes ($${avgMonthlyUsd.toLocaleString('en-US')} USD/mes), pero lleva ${daysWithout} días sin facturar (Última compra: ${purchase.lastPurchaseDate} a $${purchase.lastUnitPriceSoldUsd.toFixed(2)}).`,
        suggestedGoalQty: avgMonthlyUnits,
        unitLabel: purchase.unitLabel,
        estimatedMonthlyExtraUsd: avgMonthlyUsd,
        inactiveDays: daysWithout,
        previousAvgMonthlyUsd: avgMonthlyUsd,
        referenceUnitPriceUsd: purchase.lastUnitPriceSoldUsd,
        committedInVisit: Boolean(committedIds[oppId]),
        committedAt: committedIds[oppId],
      });
    }
  }

  for (const purchase of client.purchases12M) {
    const last3MonthsUnits = purchase.monthlyTrendUnits.slice(-3).reduce((a, b) => a + b, 0);
    if (last3MonthsUnits > 0) {
      const oppId = `opp-upsell-${client.id}-${purchase.sku}`;
      const currentMonthlyQty = Math.round(purchase.totalQuantity12M / 12);
      const targetExtraQty = Math.max(8, Math.round(currentMonthlyQty * 0.25));
      const unitPrice =
        purchase.lastUnitPriceSoldUsd > 0
          ? purchase.lastUnitPriceSoldUsd
          : purchase.totalQuantity12M > 0
          ? purchase.totalSalesUsd12M / purchase.totalQuantity12M
          : 20;
      const estimatedExtraUsd = Number((targetExtraQty * unitPrice).toFixed(2));

      upSell.push({
        id: oppId,
        clientId: client.id,
        category: 'UP_SELL',
        sku: purchase.sku,
        productName: purchase.productName,
        brand: purchase.brand,
        productLine: purchase.productLine,
        subgrupo: purchase.subgrupo,
        priority: estimatedExtraUsd >= 500 ? 'ALTA' : 'MEDIA',
        commercialPitch: `Línea consolidada (${currentMonthlyQty} ${purchase.unitLabel}/mes actuales). Escalar +25% volumen mensual en subgrupo ${purchase.subgrupo}.`,
        suggestedGoalQty: targetExtraQty,
        unitLabel: purchase.unitLabel,
        estimatedMonthlyExtraUsd: estimatedExtraUsd,
        referenceUnitPriceUsd: unitPrice,
        committedInVisit: Boolean(committedIds[oppId]),
        committedAt: committedIds[oppId],
      });
    }
  }

  const all = [...crossSell, ...reactivation, ...upSell];
  const totalMonthlyPotentialUsd = Number(
    all.reduce((acc, item) => acc + item.estimatedMonthlyExtraUsd, 0).toFixed(2)
  );

  return {
    crossSell,
    reactivation,
    upSell,
    all,
    totalMonthlyPotentialUsd,
  };
}

/**
 * 4. MOTOR DE SEMÁFORO DE VENCIMIENTO Y KPIS DE CARTERA / COBRANZAS
 */
export function classifyInvoiceMaturitySemaphore(daysToMaturity: number): InvoiceSemaphoreVisual {
  if (daysToMaturity < 0) {
    const overdueDays = Math.abs(daysToMaturity);
    return {
      level: 'RED_CRITICAL',
      badgeLabel: `Vencida hace ${overdueDays} ${overdueDays === 1 ? 'día' : 'días'}`,
      shortStatus: 'En Mora Crítica',
    };
  }
  if (daysToMaturity === 0) {
    return {
      level: 'RED_CRITICAL',
      badgeLabel: 'Vence HOY (Cobro Inmediato)',
      shortStatus: 'Vence HOY',
    };
  }
  if (daysToMaturity >= 1 && daysToMaturity <= 7) {
    return {
      level: 'AMBER_URGENT',
      badgeLabel: `Por vencer en ${daysToMaturity} ${daysToMaturity === 1 ? 'día' : 'días'} (Prioridad Inmediata)`,
      shortStatus: '1 a 7 días',
    };
  }
  if (daysToMaturity >= 8 && daysToMaturity <= 15) {
    return {
      level: 'YELLOW_SOON',
      badgeLabel: `Por vencer en ${daysToMaturity} días (Gestión Próxima)`,
      shortStatus: '8 a 15 días',
    };
  }
  return {
    level: 'GREEN_PREVENTIVE',
    badgeLabel: `Por vencer en ${daysToMaturity} días (Preventivo)`,
    shortStatus: '>15 días',
  };
}

export function calculateReceivablesKpis(
  invoices: ReceivableInvoiceRecord[]
): ReceivablesKpiSummary {
  let totalPortfolioUsd = 0;
  let totalInvoicesCount = 0;

  let critical0To5DaysUsd = 0;
  let critical0To5DaysCount = 0;

  let upcoming6To15DaysUsd = 0;
  let upcoming6To15DaysCount = 0;

  let preventive16PlusDaysUsd = 0;
  let preventive16PlusDaysCount = 0;

  let overdueMoraUsd = 0;
  let overdueMoraCount = 0;

  for (const inv of invoices) {
    if (inv.pendingBalanceUsd <= 0) continue;
    totalPortfolioUsd += inv.pendingBalanceUsd;
    totalInvoicesCount += 1;

    if (inv.daysToMaturity < 0) {
      overdueMoraUsd += inv.pendingBalanceUsd;
      overdueMoraCount += 1;
    } else if (inv.daysToMaturity >= 0 && inv.daysToMaturity <= 5) {
      critical0To5DaysUsd += inv.pendingBalanceUsd;
      critical0To5DaysCount += 1;
    } else if (inv.daysToMaturity >= 6 && inv.daysToMaturity <= 15) {
      upcoming6To15DaysUsd += inv.pendingBalanceUsd;
      upcoming6To15DaysCount += 1;
    } else {
      preventive16PlusDaysUsd += inv.pendingBalanceUsd;
      preventive16PlusDaysCount += 1;
    }
  }

  return {
    totalPortfolioUsd: Number(totalPortfolioUsd.toFixed(2)),
    totalInvoicesCount,
    critical0To5DaysUsd: Number(critical0To5DaysUsd.toFixed(2)),
    critical0To5DaysCount,
    upcoming6To15DaysUsd: Number(upcoming6To15DaysUsd.toFixed(2)),
    upcoming6To15DaysCount,
    preventive16PlusDaysUsd: Number(preventive16PlusDaysUsd.toFixed(2)),
    preventive16PlusDaysCount,
    overdueMoraUsd: Number(overdueMoraUsd.toFixed(2)),
    overdueMoraCount,
  };
}

export function sortReceivableInvoices(
  invoices: ReceivableInvoiceRecord[],
  sortBy: 'DAYS_ASC' | 'BALANCE_DESC' = 'DAYS_ASC'
): ReceivableInvoiceRecord[] {
  return [...invoices].sort((a, b) => {
    if (sortBy === 'BALANCE_DESC') {
      if (b.pendingBalanceUsd !== a.pendingBalanceUsd) {
        return b.pendingBalanceUsd - a.pendingBalanceUsd;
      }
      return a.daysToMaturity - b.daysToMaturity;
    }
    if (a.daysToMaturity !== b.daysToMaturity) {
      return a.daysToMaturity - b.daysToMaturity;
    }
    return b.pendingBalanceUsd - a.pendingBalanceUsd;
  });
}

/**
 * Registra un nuevo seguimiento de cobro sobre una factura y actualiza saldos si hubo pago/abono.
 */
export function applyInvoiceFollowUpToCollection(
  invoices: ReceivableInvoiceRecord[],
  params: {
    invoiceId: string;
    status: CollectionManagementStatus;
    promiseDate: string;
    reminderTime: string;
    receiptNumber: string;
    committedOrPaidAmountUsd: number;
    notes: string;
    registeredBy: string;
    registeredRole: string;
  }
): {
  updatedInvoices: ReceivableInvoiceRecord[];
  createdFollowUp: CollectionFollowUpEntry;
  targetInvoice: ReceivableInvoiceRecord | null;
} {
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const createdFollowUp: CollectionFollowUpEntry = {
    id: `fup-${Date.now()}`,
    invoiceId: params.invoiceId,
    status: params.status,
    promiseDate: params.promiseDate,
    reminderTime: params.reminderTime || '09:00',
    receiptNumber: params.receiptNumber.trim() || 'S/N',
    committedOrPaidAmountUsd: Math.max(0, Number(params.committedOrPaidAmountUsd) || 0),
    notes: params.notes.trim(),
    registeredBy: params.registeredBy,
    registeredRole: params.registeredRole,
    createdAt: nowStr,
  };

  let targetInvoice: ReceivableInvoiceRecord | null = null;

  const updatedInvoices = invoices.map((inv) => {
    if (inv.id !== params.invoiceId) return inv;

    let nextApplied = inv.appliedCreditsUsd;
    let nextPending = inv.pendingBalanceUsd;

    if (params.status === 'Pago Total / Transferencia') {
      const paid = createdFollowUp.committedOrPaidAmountUsd > 0
        ? createdFollowUp.committedOrPaidAmountUsd
        : inv.pendingBalanceUsd;
      nextApplied = Number((inv.appliedCreditsUsd + paid).toFixed(2));
      nextPending = Math.max(0, Number((inv.originalAmountUsd - nextApplied).toFixed(2)));
    } else if (
      params.status === 'Abono Parcial Recibido' &&
      createdFollowUp.committedOrPaidAmountUsd > 0
    ) {
      nextApplied = Number(
        (inv.appliedCreditsUsd + createdFollowUp.committedOrPaidAmountUsd).toFixed(2)
      );
      nextPending = Math.max(0, Number((inv.originalAmountUsd - nextApplied).toFixed(2)));
    }

    const updated: ReceivableInvoiceRecord = {
      ...inv,
      appliedCreditsUsd: nextApplied,
      pendingBalanceUsd: nextPending,
      followUps: [createdFollowUp, ...inv.followUps],
    };
    targetInvoice = updated;
    return updated;
  });

  return {
    updatedInvoices,
    createdFollowUp,
    targetInvoice,
  };
}

/**
 * Persistencia en localStorage y sincronización en segundo plano con LatinaWebApi
 * Normaliza automáticamente los campos `subgrupo` y `lastUnitPriceSoldUsd`
 */
export function loadClientPortfolioFromCache(): ClientPortfolioRecord[] {
  if (typeof window === 'undefined') return INITIAL_CLIENT_PORTFOLIO;
  try {
    const raw = window.localStorage.getItem(ERP_PORTFOLIO_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        ERP_PORTFOLIO_STORAGE_KEY,
        JSON.stringify(INITIAL_CLIENT_PORTFOLIO)
      );
      return INITIAL_CLIENT_PORTFOLIO;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_CLIENT_PORTFOLIO;

    const normalized: ClientPortfolioRecord[] = parsed.map((client: ClientPortfolioRecord) => ({
      ...client,
      purchases12M: (client.purchases12M || []).map((p: ProductPurchase12M) => {
        const fallbackCatalog = MASTER_CATALOG_LATINA_INDULESS.find((c) => c.sku === p.sku);
        return {
          ...p,
          subgrupo:
            p.subgrupo || fallbackCatalog?.subgrupo || 'Pinturas Caucho Interior',
          lastUnitPriceSoldUsd:
            typeof p.lastUnitPriceSoldUsd === 'number' && p.lastUnitPriceSoldUsd > 0
              ? p.lastUnitPriceSoldUsd
              : p.totalQuantity12M > 0
              ? Number((p.totalSalesUsd12M / p.totalQuantity12M).toFixed(2))
              : fallbackCatalog?.unitPriceUsd || 0,
        };
      }),
    }));
    return normalized;
  } catch {
    return INITIAL_CLIENT_PORTFOLIO;
  }
}

export function loadReceivableInvoicesFromCache(): ReceivableInvoiceRecord[] {
  if (typeof window === 'undefined') return INITIAL_RECEIVABLE_INVOICES;
  try {
    const raw = window.localStorage.getItem(ERP_COLLECTIONS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        ERP_COLLECTIONS_STORAGE_KEY,
        JSON.stringify(INITIAL_RECEIVABLE_INVOICES)
      );
      return INITIAL_RECEIVABLE_INVOICES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_RECEIVABLE_INVOICES;
  } catch {
    return INITIAL_RECEIVABLE_INVOICES;
  }
}

export function saveReceivableInvoicesToCache(invoices: ReceivableInvoiceRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ERP_COLLECTIONS_STORAGE_KEY, JSON.stringify(invoices));
  } catch {
    // ignore storage quota errors
  }
}

export function loadCommittedOpportunitiesFromCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ERP_COMMITMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCommittedOpportunitiesToCache(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ERP_COMMITMENTS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Sincroniza seguimiento de cobros o compromisos con LatinaWebApi en segundo plano
 */
export async function syncCommercialEventToLatinaWebApi(
  endpoint: string,
  payload: Record<string, any>,
  config: LatinaSysConfig,
  session: LatinaUserSession | null
): Promise<void> {
  try {
    await executeLatinaApiFetch(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      config,
      session
    );
  } catch {
    // Resiliencia garantizada por caché local
  }
}

/**
 * Exportación CSV y PDF del Historial de Compras 12M y Oportunidades Latina & Induless
 * Incluye obligatoriamente `Subgrupo` y `Último Precio Vendido ($)`
 */
export function exportClientPurchases12MCsv(
  client: ClientPortfolioRecord,
  rankedItems: RankedProductPurchase12M[],
  totals: { totalQuantity: number; totalSalesUsd: number }
): void {
  const headers = [
    'Posicion',
    'SKU',
    'Producto',
    'Marca',
    'Subgrupo',
    'Linea de Producto',
    'Cantidad 12M',
    'Unidad',
    'Ultimo Precio Vendido USD',
    'Fecha Ultima Venta',
    'Valor Total USD (12M)',
    '% Participacion',
    'Dias sin Comprar',
    'Estado Retencion',
  ];

  const rows = rankedItems.map((item) => [
    `#${item.rankPosition}`,
    item.sku,
    `"${item.productName.replace(/"/g, '""')}"`,
    item.brand,
    `"${item.subgrupo}"`,
    `"${item.productLine}"`,
    item.totalQuantity12M,
    item.unitLabel,
    `$${item.lastUnitPriceSoldUsd.toFixed(2)}`,
    item.lastSaleFormattedDate,
    item.totalSalesUsd12M.toFixed(2),
    `${item.sharePercentage}%`,
    item.daysWithoutPurchase,
    item.stoppedBuyingLast60To90Days ? 'ALERTA INACTIVIDAD / FUGA' : 'ACTIVO',
  ]);

  rows.push([
    'TOTALES',
    '-',
    '"TOTAL ACUMULADO 12 MESES"',
    '-',
    '-',
    '-',
    totals.totalQuantity,
    '-',
    '-',
    '-',
    totals.totalSalesUsd.toFixed(2),
    '100%',
    '-',
    '-',
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Historial_12M_${client.ruc}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportClientCommercialAnalysisPdf(
  client: ClientPortfolioRecord,
  rankedItems: RankedProductPurchase12M[],
  totals: {
    totalQuantity: number;
    totalSalesUsd: number;
    latinaSalesUsd: number;
    indulessSalesUsd: number;
  },
  opportunities: ProductOpportunityRecommendation[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(10, 37, 64);
  doc.rect(0, 0, 297, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.text(
    'INDUSTRIAL LATINA S.A. — HISTORIAL 12M POR SUBGRUPO & INTELIGENCIA COMERCIAL (LATINA / INDULESS)',
    12,
    11
  );
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Cliente: ${client.razonSocial} (RUC: ${client.ruc}) | Ejecutivo: ${client.executiveName} | Cupo: $${client.cupoCreditoUsd.toLocaleString('en-US')} | Disponible: $${client.saldoDisponibleUsd.toLocaleString('en-US')}`,
    12,
    19
  );

  let y = 33;
  doc.setFillColor(15, 23, 42);
  doc.rect(12, y - 5, 273, 7, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('#', 14, y);
  doc.text('SKU', 22, y);
  doc.text('Producto', 44, y);
  doc.text('Marca', 112, y);
  doc.text('Subgrupo', 130, y);
  doc.text('Cant. (12M)', 174, y);
  doc.text('Últ. Precio Vendido ($)', 200, y);
  doc.text('Venta Total ($ USD)', 242, y);
  doc.text('% Part.', 272, y);

  y += 6;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');

  for (const item of rankedItems) {
    if (y > 188) {
      doc.addPage();
      y = 20;
    }
    doc.text(`#${item.rankPosition}`, 14, y);
    doc.text(item.sku, 22, y);
    doc.text(item.productName.slice(0, 38), 44, y);
    doc.text(item.brand, 112, y);
    doc.text(item.subgrupo.slice(0, 24), 130, y);
    doc.text(`${item.totalQuantity12M} ${item.unitLabel}`, 174, y);
    doc.text(
      `$${item.lastUnitPriceSoldUsd.toFixed(2)} | ${item.lastSaleFormattedDate}`,
      200,
      y
    );
    doc.text(
      `$${item.totalSalesUsd12M.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      242,
      y
    );
    doc.text(`${item.sharePercentage}%`, 272, y);
    y += 5.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.text(
    `TOTAL 12M: ${totals.totalQuantity} unid. | $${totals.totalSalesUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (LATINA: $${totals.latinaSalesUsd.toLocaleString('en-US')} | INDULESS: $${totals.indulessSalesUsd.toLocaleString('en-US')})`,
    14,
    y + 2
  );

  y += 10;
  doc.setFontSize(9.5);
  doc.text(
    'INTELIGENCIA COMERCIAL: PRODUCTOS INACTIVOS (FUGA) Y EXPANSIÓN DEL MISMO SUBGRUPO',
    12,
    y
  );

  y += 6;
  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  for (const o of opportunities.slice(0, 12)) {
    if (y > 195) {
      doc.addPage();
      y = 20;
    }
    const catLabel =
      o.category === 'CROSS_SELL'
        ? 'EXPANSIÓN SUBGRUPO'
        : o.category === 'REACTIVATION'
        ? 'DEJÓ DE COMPRAR (FUGA)'
        : 'UP-SELLING (+25%)';
    doc.text(
      `[${catLabel} | ${o.brand} | ${o.subgrupo || o.productLine}] ${o.sku} - ${o.productName.slice(0, 44)} -> Meta: ${o.suggestedGoalQty} ${o.unitLabel} (+$${o.estimatedMonthlyExtraUsd.toLocaleString('en-US')}/mes)`,
      12,
      y
    );
    y += 5;
  }

  doc.save(`Analisis_Comercial_12M_${client.ruc}.pdf`);
}

/**
 * Exportación PDF de Estado de Cuenta / Hoja de Ruta de Cobros autoajustable
 */
export function exportCollectionsStatementPdf(
  invoices: ReceivableInvoiceRecord[],
  kpis: ReceivablesKpiSummary,
  scopeTitle: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(10, 37, 64);
  doc.rect(0, 0, 297, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(
    'INDUSTRIAL LATINA S.A. — ESTADO DE CUENTA Y HOJA DE RUTA DE COBRANZAS',
    12,
    11
  );
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Alcance: ${scopeTitle} | Total por Cobrar: $${kpis.totalPortfolioUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} | En Mora: $${kpis.overdueMoraUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} | Crítico (0-5d): $${kpis.critical0To5DaysUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    12,
    19
  );

  let y = 34;
  doc.setFillColor(15, 23, 42);
  doc.rect(12, y - 5, 273, 7, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('N° Factura', 14, y);
  doc.text('Cliente / RUC', 52, y);
  doc.text('Ejecutivo', 122, y);
  doc.text('Vencimiento', 155, y);
  doc.text('Saldo Pendiente', 182, y);
  doc.text('Estado / Semáforo', 215, y);

  y += 6;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');

  for (const inv of invoices) {
    if (y > 192) {
      doc.addPage();
      y = 20;
    }
    const sem = classifyInvoiceMaturitySemaphore(inv.daysToMaturity);
    doc.text(inv.invoiceNumber, 14, y);
    doc.text(`${inv.clientName.slice(0, 32)} (${inv.clientRuc})`, 52, y);
    doc.text(inv.executiveName, 122, y);
    doc.text(`${inv.dueDate} (${inv.creditTermDays}d)`, 155, y);
    doc.text(
      `$${inv.pendingBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      182,
      y
    );
    doc.text(sem.badgeLabel, 215, y);
    y += 6;
  }

  doc.save(`Hoja_Ruta_Cobranzas_GeoLatina_${new Date().toISOString().slice(0, 10)}.pdf`);
}

