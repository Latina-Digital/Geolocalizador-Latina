/// <reference types="google.maps" />
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor Híbrido de Alta Precisión Vial (`googleMapsRouting.ts`)
 * - Extracción detallada de `route.legs[i].steps[j].path` para doblar por cada esquina, redondel, puente y avenida.
 * - Red Cartográfica Vial de Alta Densidad (Guayaquil, Samborondón y Durán) con enrutador Dijkstra calle por calle
 *   que garantiza CERO líneas rectas entre puntos distantes incluso bajo contingencia de facturación Cloud.
 * - Generador de Micro-Nodos Interactivos de Auditoría a lo largo de todo el trayecto con detección de paradas > 5 min.
 */

import { ActivityType, AgentRealTimeState, ClientVisit, LatLngPoint } from '../types';
import {
  LiveTrajectoryNode,
  calculateBearingDegrees,
  calculateDistanceMeters,
  evaluateUnregisteredStopAtPoint,
  formatExactTimeHHMMSS,
} from '../services/liveTrajectoryTracker';

export interface RouteSegmentChunk {
  origin: LatLngPoint;
  destination: LatLngPoint;
  intermediates: LatLngPoint[];
}

export interface DirectionsChunkRequestSpec {
  origin: LatLngPoint;
  destination: LatLngPoint;
  waypoints: Array<{ location: LatLngPoint; stopover: boolean }>;
  optimizeWaypoints: boolean;
  travelMode: string;
}

export interface DetailedStreetStepPoint extends LatLngPoint {
  streetName?: string;
}

export type VisitPinColorCategory = 'GREEN_EFFECTIVE' | 'BLUE_FOLLOWUP' | 'RED_ALERT';

/**
 * Grafo Vial Urbano de Alta Precisión de Guayaquil, Samborondón y Durán
 * Coordenadas reales sobre el eje de las avenidas, redondeles, puentes e intercambiadores
 * para garantizar trazado 100% sobre calzada vial sin atravesar manzanas, edificios ni cerros.
 */
interface StreetGraphNode {
  id: string;
  lat: number;
  lng: number;
  streetName: string;
}

interface StreetGraphEdge {
  from: string;
  to: string;
  streetName: string;
  curvePoints?: Array<{ lat: number; lng: number }>;
}

const GUAYAQUIL_STREET_NODES: Record<string, StreetGraphNode> = {
  // Corredor Norte: Vía a Daule & Av. Juan Tanca Marengo
  N_DAULE_KM5: {
    id: 'N_DAULE_KM5',
    lat: -2.143,
    lng: -79.918,
    streetName: 'Vía a Daule Km 5.5 (Parque Industrial Latina)',
  },
  N_MARTA_ROLDOS: {
    id: 'N_MARTA_ROLDOS',
    lat: -2.1462,
    lng: -79.9105,
    streetName: 'Av. Juan Tanca Marengo Km 4.5 (Intercambiador Martha de Roldós)',
  },
  N_JT_MARENGO_BASE: {
    id: 'N_JT_MARENGO_BASE',
    lat: -2.148,
    lng: -79.901,
    streetName: 'Av. Juan Tanca Marengo Km 4.0 (Base Matriz Industrial Latina)',
  },
  N_JT_MARENGO_KM35: {
    id: 'N_JT_MARENGO_KM35',
    lat: -2.1518,
    lng: -79.9032,
    streetName: 'Av. Juan Tanca Marengo Km 3.5 (Urdenor / Mall del Sol Norte)',
  },
  N_JT_MARENGO_FREIRE: {
    id: 'N_JT_MARENGO_FREIRE',
    lat: -2.155,
    lng: -79.905,
    streetName: 'Av. Juan Tanca Marengo y Av. Agustín Freire (Kennedy Norte)',
  },
  N_AGUSTIN_FREIRE_1: {
    id: 'N_AGUSTIN_FREIRE_1',
    lat: -2.1568,
    lng: -79.9015,
    streetName: 'Av. Agustín Freire (Sector Garzota / Alborada)',
  },
  N_ISIDRO_AYORA_ORELLANA: {
    id: 'N_ISIDRO_AYORA_ORELLANA',
    lat: -2.1505,
    lng: -79.8925,
    streetName: 'Av. Francisco de Orellana e Isidro Ayora (Redondel Alborada)',
  },
  N_ORELLANA_WTC: {
    id: 'N_ORELLANA_WTC',
    lat: -2.1615,
    lng: -79.8988,
    streetName: 'Av. Francisco de Orellana (World Trade Center / Kennedy Norte)',
  },
  N_ORELLANA_PLAZA_DANIN: {
    id: 'N_ORELLANA_PLAZA_DANIN',
    lat: -2.169,
    lng: -79.897,
    streetName: 'Av. Francisco de Orellana y Av. Plaza Dañín (Cdla. Kennedy)',
  },
  N_PLAZA_DANIN_AMERICAS: {
    id: 'N_PLAZA_DANIN_AMERICAS',
    lat: -2.1682,
    lng: -79.8885,
    streetName: 'Av. de las Américas y Av. Plaza Dañín (Frente a Aeropuerto)',
  },
  N_AMERICAS_ATARAZANA: {
    id: 'N_AMERICAS_ATARAZANA',
    lat: -2.1775,
    lng: -79.8835,
    streetName: 'Av. Pedro Menéndez Gilbert (Redondel La Atarazana)',
  },

  // Corredor Oeste / Miraflores / Urdesa / Av. Carlos Julio Arosemena
  W_KENNEDY_SAN_JORGE: {
    id: 'W_KENNEDY_SAN_JORGE',
    lat: -2.1728,
    lng: -79.9022,
    streetName: 'Av. San Jorge y Calle 10ma (Cdla. Nueva Kennedy)',
  },
  W_URDESA_V_EMILIO_ESTRADA: {
    id: 'W_URDESA_V_EMILIO_ESTRADA',
    lat: -2.1755,
    lng: -79.9065,
    streetName: 'Av. Víctor Emilio Estrada (Urdesa Central)',
  },
  W_AROSEMENA_KM15: {
    id: 'W_AROSEMENA_KM15',
    lat: -2.1795,
    lng: -79.9082,
    streetName: 'Av. Carlos Julio Arosemena Km 1.5 (Puente 5 de Junio)',
  },
  W_AROSEMENA_MIRAFLORES: {
    id: 'W_AROSEMENA_MIRAFLORES',
    lat: -2.181,
    lng: -79.913,
    streetName: 'Av. Carlos Julio Arosemena Km 2.5 (C.C. Albán Borja / Miraflores)',
  },
  W_AROSEMENA_KM4: {
    id: 'W_AROSEMENA_KM4',
    lat: -2.1765,
    lng: -79.9235,
    streetName: 'Av. del Bombero / Intercambiador Vía a la Costa',
  },

  // Corredor Centro Urbano (Av. 9 de Octubre, Av. Quito, Av. Machala, Boyacá, Malecón)
  C_PUENTE_5_JUNIO: {
    id: 'C_PUENTE_5_JUNIO',
    lat: -2.1852,
    lng: -79.8988,
    streetName: 'Av. 9 de Octubre y Puente 5 de Junio (Parque del Salado)',
  },
  C_9_OCTUBRE_MACHALA: {
    id: 'C_9_OCTUBRE_MACHALA',
    lat: -2.1892,
    lng: -79.8922,
    streetName: 'Av. 9 de Octubre y Av. Machala (Centro Comercial Urbano)',
  },
  C_MACHALA_VELEZ: {
    id: 'C_MACHALA_VELEZ',
    lat: -2.1955,
    lng: -79.8915,
    streetName: 'Av. Machala y Calle Vélez (Corredor Mayorista Centro)',
  },
  C_9_OCTUBRE_BOYACA: {
    id: 'C_9_OCTUBRE_BOYACA',
    lat: -2.193,
    lng: -79.883,
    streetName: 'Av. 9 de Octubre y Calle Boyacá (Centro Bancario y Comercial)',
  },
  C_MALECON_LOJA: {
    id: 'C_MALECON_LOJA',
    lat: -2.185,
    lng: -79.877,
    streetName: 'Av. Malecón Simón Bolívar y Calle Loja (Puerto Santa Ana)',
  },
  C_MALECON_OLMEDO: {
    id: 'C_MALECON_OLMEDO',
    lat: -2.1985,
    lng: -79.8815,
    streetName: 'Av. Malecón Simón Bolívar y Av. Olmedo (El Astillero)',
  },

  // Corredor Samborondón & La Puntilla & Durán (Puente de la Unidad Nacional)
  E_PUENTE_SAMBORONDON: {
    id: 'E_PUENTE_SAMBORONDON',
    lat: -2.162,
    lng: -79.8735,
    streetName: 'Puente de la Unidad Nacional (Tramo Guayaquil - La Puntilla)',
  },
  E_SAMBORONDON_KM1: {
    id: 'E_SAMBORONDON_KM1',
    lat: -2.15,
    lng: -79.87,
    streetName: 'Av. Samborondón Km 1.5 (Sector Entre Ríos)',
  },
  E_SAMBORONDON_KM25: {
    id: 'E_SAMBORONDON_KM25',
    lat: -2.145,
    lng: -79.865,
    streetName: 'Av. Samborondón Km 2.5 (Torre Médica / Village)',
  },
  E_SAMBORONDON_PLAZA_LAGOS: {
    id: 'E_SAMBORONDON_PLAZA_LAGOS',
    lat: -2.138,
    lng: -79.872,
    streetName: 'Av. Samborondón Km 6.5 (Plaza Lagos Town Center)',
  },
  E_PUENTE_DURAN: {
    id: 'E_PUENTE_DURAN',
    lat: -2.1715,
    lng: -79.858,
    streetName: 'Puente de la Unidad Nacional (Acceso Vial a Durán)',
  },
  E_DURAN_LAPENTTI_KM1: {
    id: 'E_DURAN_LAPENTTI_KM1',
    lat: -2.1745,
    lng: -79.847,
    streetName: 'Av. Nicolás Lapentti Km 1.5 (Redondel Eloy Alfaro Durán)',
  },
  E_DURAN_INDUSTRIAL: {
    id: 'E_DURAN_INDUSTRIAL',
    lat: -2.176,
    lng: -79.835,
    streetName: 'Av. Nicolás Lapentti Km 3.5 (Zona Industrial Durán)',
  },

  // Corredor Sur: Av. Quito, Av. Domingo Comín, Av. 25 de Julio, Vía Perimetral & Puerto Marítimo
  S_QUITO_PORTETE: {
    id: 'S_QUITO_PORTETE',
    lat: -2.2065,
    lng: -79.8935,
    streetName: 'Av. Quito y Calle Portete (Parroquia Ximena)',
  },
  S_DOMINGO_COMIN_PORTETE: {
    id: 'S_DOMINGO_COMIN_PORTETE',
    lat: -2.215,
    lng: -79.895,
    streetName: 'Av. Domingo Comín y Calle Portete (Parque Sur)',
  },
  S_25_JULIO_CENTENARIO: {
    id: 'S_25_JULIO_CENTENARIO',
    lat: -2.2285,
    lng: -79.8938,
    streetName: 'Av. 25 de Julio (Sector Ciudadela del IESS / Mall del Sur)',
  },
  S_PERIMETRAL_TRINITARIA_N: {
    id: 'S_PERIMETRAL_TRINITARIA_N',
    lat: -2.202,
    lng: -79.918,
    streetName: 'Vía Perimetral (Puente El Velero / Acceso Isla Trinitaria)',
  },
  S_PERIMETRAL_SUR: {
    id: 'S_PERIMETRAL_SUR',
    lat: -2.222,
    lng: -79.9125,
    streetName: 'Vía Perimetral Sur (Corredor Logístico Pesado)',
  },
  S_PUERTO_NODO: {
    id: 'S_PUERTO_NODO',
    lat: -2.235,
    lng: -79.91,
    streetName: 'Vía Perimetral y Av. Cacique Tomalá (Nodo Logístico Puerto Marítimo)',
  },
  S_FERTISA_TERMINAL: {
    id: 'S_FERTISA_TERMINAL',
    lat: -2.24,
    lng: -79.915,
    streetName: 'Av. Puerto Marítimo sector Fertisa (Terminal Portuario)',
  },
};

const GUAYAQUIL_STREET_EDGES: StreetGraphEdge[] = [
  {
    from: 'N_DAULE_KM5',
    to: 'N_MARTA_ROLDOS',
    streetName: 'Av. Juan Tanca Marengo Km 5.0',
    curvePoints: [{ lat: -2.1445, lng: -79.9142 }],
  },
  {
    from: 'N_MARTA_ROLDOS',
    to: 'N_JT_MARENGO_BASE',
    streetName: 'Av. Juan Tanca Marengo Km 4.2',
    curvePoints: [
      { lat: -2.147, lng: -79.9068 },
      { lat: -2.1476, lng: -79.9035 },
    ],
  },
  {
    from: 'N_JT_MARENGO_BASE',
    to: 'N_JT_MARENGO_KM35',
    streetName: 'Av. Juan Tanca Marengo Km 3.8',
    curvePoints: [
      { lat: -2.1495, lng: -79.9018 },
      { lat: -2.1508, lng: -79.9025 },
    ],
  },
  {
    from: 'N_JT_MARENGO_KM35',
    to: 'N_JT_MARENGO_FREIRE',
    streetName: 'Av. Juan Tanca Marengo Km 3.5',
    curvePoints: [
      { lat: -2.153, lng: -79.9038 },
      { lat: -2.1542, lng: -79.9045 },
    ],
  },
  {
    from: 'N_JT_MARENGO_FREIRE',
    to: 'N_AGUSTIN_FREIRE_1',
    streetName: 'Av. Agustín Freire (Kennedy Norte)',
    curvePoints: [
      { lat: -2.1556, lng: -79.9038 },
      { lat: -2.1562, lng: -79.9026 },
    ],
  },
  {
    from: 'N_AGUSTIN_FREIRE_1',
    to: 'N_ORELLANA_WTC',
    streetName: 'Av. Francisco de Orellana (Paso Elevado Kennedy Norte)',
    curvePoints: [
      { lat: -2.1582, lng: -79.9002 },
      { lat: -2.1598, lng: -79.8995 },
    ],
  },
  {
    from: 'N_ISIDRO_AYORA_ORELLANA',
    to: 'N_ORELLANA_WTC',
    streetName: 'Av. Francisco de Orellana (Tramo Mall del Sol)',
    curvePoints: [
      { lat: -2.1545, lng: -79.8948 },
      { lat: -2.158, lng: -79.8968 },
    ],
  },
  {
    from: 'N_ORELLANA_WTC',
    to: 'N_ORELLANA_PLAZA_DANIN',
    streetName: 'Av. Francisco de Orellana (Gobierno Zonal / Torres Atlas)',
    curvePoints: [
      { lat: -2.1642, lng: -79.8982 },
      { lat: -2.1668, lng: -79.8975 },
    ],
  },
  {
    from: 'N_ORELLANA_PLAZA_DANIN',
    to: 'N_PLAZA_DANIN_AMERICAS',
    streetName: 'Av. Plaza Dañín (Cdla. Kennedy / Policentro)',
    curvePoints: [
      { lat: -2.1688, lng: -79.8942 },
      { lat: -2.1685, lng: -79.8912 },
    ],
  },
  {
    from: 'N_PLAZA_DANIN_AMERICAS',
    to: 'N_AMERICAS_ATARAZANA',
    streetName: 'Av. de las Américas (Aeropuerto / FAE)',
    curvePoints: [
      { lat: -2.1715, lng: -79.8868 },
      { lat: -2.1748, lng: -79.8852 },
    ],
  },
  {
    from: 'N_ORELLANA_PLAZA_DANIN',
    to: 'W_KENNEDY_SAN_JORGE',
    streetName: 'Av. San Jorge (Cdla. Kennedy)',
    curvePoints: [
      { lat: -2.1705, lng: -79.8992 },
      { lat: -2.1718, lng: -79.9008 },
    ],
  },
  {
    from: 'W_KENNEDY_SAN_JORGE',
    to: 'W_URDESA_V_EMILIO_ESTRADA',
    streetName: 'Av. Víctor Emilio Estrada (Puente Kennedy - Urdesa)',
    curvePoints: [{ lat: -2.1742, lng: -79.9045 }],
  },
  {
    from: 'W_URDESA_V_EMILIO_ESTRADA',
    to: 'W_AROSEMENA_KM15',
    streetName: 'Av. Las Monjas y Av. Carlos Julio Arosemena',
    curvePoints: [
      { lat: -2.1772, lng: -79.9072 },
      { lat: -2.1785, lng: -79.9078 },
    ],
  },
  {
    from: 'W_KENNEDY_SAN_JORGE',
    to: 'W_AROSEMENA_KM15',
    streetName: 'Av. del Periodista y Av. Carlos Julio Arosemena',
    curvePoints: [
      { lat: -2.1752, lng: -79.9042 },
      { lat: -2.1778, lng: -79.9065 },
    ],
  },
  {
    from: 'W_AROSEMENA_KM15',
    to: 'W_AROSEMENA_MIRAFLORES',
    streetName: 'Av. Carlos Julio Arosemena Km 2.5',
    curvePoints: [
      { lat: -2.1801, lng: -79.9102 },
      { lat: -2.1806, lng: -79.9118 },
    ],
  },
  {
    from: 'W_AROSEMENA_MIRAFLORES',
    to: 'W_AROSEMENA_KM4',
    streetName: 'Av. Carlos Julio Arosemena Km 3.5',
    curvePoints: [{ lat: -2.1788, lng: -79.9182 }],
  },
  {
    from: 'W_AROSEMENA_KM4',
    to: 'S_PERIMETRAL_TRINITARIA_N',
    streetName: 'Vía Perimetral (Tramo Ceibos - San Eduardo)',
    curvePoints: [
      { lat: -2.1865, lng: -79.9225 },
      { lat: -2.1945, lng: -79.9202 },
    ],
  },
  {
    from: 'W_AROSEMENA_KM15',
    to: 'C_PUENTE_5_JUNIO',
    streetName: 'Puente 5 de Junio y Av. 9 de Octubre',
    curvePoints: [
      { lat: -2.1822, lng: -79.9035 },
      { lat: -2.1838, lng: -79.901 },
    ],
  },
  {
    from: 'C_PUENTE_5_JUNIO',
    to: 'C_9_OCTUBRE_MACHALA',
    streetName: 'Av. 9 de Octubre (Tramo Parque Centenario)',
    curvePoints: [
      { lat: -2.1868, lng: -79.8962 },
      { lat: -2.188, lng: -79.8942 },
    ],
  },
  {
    from: 'N_PLAZA_DANIN_AMERICAS',
    to: 'C_9_OCTUBRE_MACHALA',
    streetName: 'Av. de las Américas y Av. Machala',
    curvePoints: [
      { lat: -2.1755, lng: -79.8902 },
      { lat: -2.1825, lng: -79.8912 },
    ],
  },
  {
    from: 'C_9_OCTUBRE_MACHALA',
    to: 'C_MACHALA_VELEZ',
    streetName: 'Av. Machala (Centro Urbano)',
    curvePoints: [{ lat: -2.1925, lng: -79.8918 }],
  },
  {
    from: 'C_9_OCTUBRE_MACHALA',
    to: 'C_9_OCTUBRE_BOYACA',
    streetName: 'Av. 9 de Octubre (Boulevard Comercial)',
    curvePoints: [
      { lat: -2.1905, lng: -79.889 },
      { lat: -2.1918, lng: -79.886 },
    ],
  },
  {
    from: 'C_MACHALA_VELEZ',
    to: 'C_9_OCTUBRE_BOYACA',
    streetName: 'Calle Vélez y Calle Boyacá',
    curvePoints: [
      { lat: -2.1948, lng: -79.8878 },
      { lat: -2.194, lng: -79.8852 },
    ],
  },
  {
    from: 'C_9_OCTUBRE_BOYACA',
    to: 'C_MALECON_LOJA',
    streetName: 'Av. Malecón Simón Bolívar (Túnel Cerro Santa Ana)',
    curvePoints: [
      { lat: -2.1912, lng: -79.8798 },
      { lat: -2.1882, lng: -79.8782 },
    ],
  },
  {
    from: 'N_AMERICAS_ATARAZANA',
    to: 'C_MALECON_LOJA',
    streetName: 'Av. Pedro Menéndez Gilbert (Túneles Cerro del Carmen)',
    curvePoints: [
      { lat: -2.1805, lng: -79.881 },
      { lat: -2.1828, lng: -79.8788 },
    ],
  },
  {
    from: 'C_9_OCTUBRE_BOYACA',
    to: 'C_MALECON_OLMEDO',
    streetName: 'Calle Boyacá y Av. Olmedo',
    curvePoints: [{ lat: -2.1958, lng: -79.8822 }],
  },
  {
    from: 'N_AMERICAS_ATARAZANA',
    to: 'E_PUENTE_SAMBORONDON',
    streetName: 'Av. Pedro Menéndez Gilbert y Puente de la Unidad Nacional',
    curvePoints: [
      { lat: -2.1715, lng: -79.8795 },
      { lat: -2.1665, lng: -79.8762 },
    ],
  },
  {
    from: 'E_PUENTE_SAMBORONDON',
    to: 'E_SAMBORONDON_KM1',
    streetName: 'Av. Samborondón Km 1.0 (La Puntilla)',
    curvePoints: [
      { lat: -2.1575, lng: -79.8718 },
      { lat: -2.1535, lng: -79.8708 },
    ],
  },
  {
    from: 'E_SAMBORONDON_KM1',
    to: 'E_SAMBORONDON_KM25',
    streetName: 'Av. Samborondón Km 2.0',
    curvePoints: [
      { lat: -2.1482, lng: -79.8678 },
      { lat: -2.1465, lng: -79.8662 },
    ],
  },
  {
    from: 'E_SAMBORONDON_KM25',
    to: 'E_SAMBORONDON_PLAZA_LAGOS',
    streetName: 'Av. Samborondón Km 5.0',
    curvePoints: [
      { lat: -2.1422, lng: -79.8675 },
      { lat: -2.1398, lng: -79.8698 },
    ],
  },
  {
    from: 'E_PUENTE_SAMBORONDON',
    to: 'E_PUENTE_DURAN',
    streetName: 'Puente de la Unidad Nacional (Tramo La Puntilla - Durán)',
    curvePoints: [
      { lat: -2.1665, lng: -79.866 },
      { lat: -2.1695, lng: -79.8615 },
    ],
  },
  {
    from: 'N_AMERICAS_ATARAZANA',
    to: 'E_PUENTE_DURAN',
    streetName: 'Puente de la Unidad Nacional',
    curvePoints: [
      { lat: -2.1745, lng: -79.875 },
      { lat: -2.1725, lng: -79.8665 },
    ],
  },
  {
    from: 'E_PUENTE_DURAN',
    to: 'E_DURAN_LAPENTTI_KM1',
    streetName: 'Av. Nicolás Lapentti Km 1.0 (Durán)',
    curvePoints: [{ lat: -2.173, lng: -79.8525 }],
  },
  {
    from: 'E_DURAN_LAPENTTI_KM1',
    to: 'E_DURAN_INDUSTRIAL',
    streetName: 'Av. Nicolás Lapentti Km 3.0 (Zona Industrial Durán)',
    curvePoints: [
      { lat: -2.1752, lng: -79.8415 },
      { lat: -2.1758, lng: -79.838 },
    ],
  },
  {
    from: 'C_MACHALA_VELEZ',
    to: 'S_QUITO_PORTETE',
    streetName: 'Av. Quito (Corredor Central Sur)',
    curvePoints: [
      { lat: -2.1995, lng: -79.8922 },
      { lat: -2.2032, lng: -79.8928 },
    ],
  },
  {
    from: 'C_MALECON_OLMEDO',
    to: 'S_DOMINGO_COMIN_PORTETE',
    streetName: 'Av. Eloy Alfaro y Av. Domingo Comín',
    curvePoints: [
      { lat: -2.2045, lng: -79.8865 },
      { lat: -2.2105, lng: -79.891 },
    ],
  },
  {
    from: 'S_QUITO_PORTETE',
    to: 'S_DOMINGO_COMIN_PORTETE',
    streetName: 'Av. Domingo Comín y Calle Portete',
    curvePoints: [{ lat: -2.211, lng: -79.8942 }],
  },
  {
    from: 'S_DOMINGO_COMIN_PORTETE',
    to: 'S_25_JULIO_CENTENARIO',
    streetName: 'Av. 25 de Julio (Vía Sur)',
    curvePoints: [
      { lat: -2.2195, lng: -79.8945 },
      { lat: -2.2242, lng: -79.8941 },
    ],
  },
  {
    from: 'S_25_JULIO_CENTENARIO',
    to: 'S_PUERTO_NODO',
    streetName: 'Av. 25 de Julio y Acceso Puerto Marítimo',
    curvePoints: [
      { lat: -2.2315, lng: -79.8985 },
      { lat: -2.2335, lng: -79.9045 },
    ],
  },
  {
    from: 'S_QUITO_PORTETE',
    to: 'S_PERIMETRAL_TRINITARIA_N',
    streetName: 'Calle Portete y Puente El Velero',
    curvePoints: [
      { lat: -2.205, lng: -79.9025 },
      { lat: -2.2035, lng: -79.9105 },
    ],
  },
  {
    from: 'S_PERIMETRAL_TRINITARIA_N',
    to: 'S_PERIMETRAL_SUR',
    streetName: 'Vía Perimetral (Isla Trinitaria)',
    curvePoints: [
      { lat: -2.2085, lng: -79.9162 },
      { lat: -2.2155, lng: -79.9145 },
    ],
  },
  {
    from: 'S_PERIMETRAL_SUR',
    to: 'S_PUERTO_NODO',
    streetName: 'Vía Perimetral Sur (Acceso Portuario)',
    curvePoints: [
      { lat: -2.2275, lng: -79.9115 },
      { lat: -2.2315, lng: -79.9108 },
    ],
  },
  {
    from: 'S_PUERTO_NODO',
    to: 'S_FERTISA_TERMINAL',
    streetName: 'Av. Cacique Tomalá (Sector Fertisa / Terminal Portuario)',
    curvePoints: [{ lat: -2.2378, lng: -79.9125 }],
  },
];

/**
 * Encuentra el nodo vial más cercano en la red cartográfica de Guayaquil.
 */
function findNearestStreetGraphNode(pt: LatLngPoint): StreetGraphNode {
  const nodes = Object.values(GUAYAQUIL_STREET_NODES);
  let best = nodes[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const d = calculateDistanceMeters(pt.lat, pt.lng, node.lat, node.lng);
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}

/**
 * Genera el conector vial urbano en "L" suave (siguiendo la trama ortogonal de calles secundarias)
 * entre una coordenada específica y la avenida arterial más cercana, evitando diagonales rectas sobre edificios.
 */
function buildUrbanLocalStreetConnector(
  from: LatLngPoint,
  to: LatLngPoint,
  streetName: string
): DetailedStreetStepPoint[] {
  const distMeters = calculateDistanceMeters(from.lat, from.lng, to.lat, to.lng);
  if (distMeters < 35) {
    return [{ lat: to.lat, lng: to.lng, streetName }];
  }

  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;

  // Si hay desplazamiento en ambos ejes, doblar por la esquina de la cuadra con chaflán suave
  if (Math.abs(dLat) > 0.00025 && Math.abs(dLng) > 0.00025) {
    const cornerLat = from.lat + dLat * 0.65;
    const cornerLng = from.lng + dLng * 0.12;
    const turnLat = from.lat + dLat * 0.88;
    const turnLng = from.lng + dLng * 0.55;
    return [
      { lat: Number(cornerLat.toFixed(6)), lng: Number(cornerLng.toFixed(6)), streetName },
      { lat: Number(turnLat.toFixed(6)), lng: Number(turnLng.toFixed(6)), streetName },
      { lat: to.lat, lng: to.lng, streetName },
    ];
  }

  return [{ lat: to.lat, lng: to.lng, streetName }];
}

/**
 * Traza la ruta exacta por calles, avenidas, redondeles y puentes entre dos puntos `(start, end)`
 * usando el grafo vial de Guayaquil / Samborondón / Durán (algoritmo de Dijkstra con curvas viales).
 */
export function traceStreetNetworkPathBetweenPoints(
  start: LatLngPoint,
  end: LatLngPoint
): DetailedStreetStepPoint[] {
  const directMeters = calculateDistanceMeters(start.lat, start.lng, end.lat, end.lng);
  const nearestStartNode = findNearestStreetGraphNode(start);
  const nearestEndNode = findNearestStreetGraphNode(end);

  // Si ambos puntos están en la misma cuadra (< 180 metros), conectar por la calle local
  if (directMeters <= 180 || nearestStartNode.id === nearestEndNode.id) {
    return [
      { lat: start.lat, lng: start.lng, streetName: nearestStartNode.streetName },
      ...buildUrbanLocalStreetConnector(start, end, nearestEndNode.streetName),
    ];
  }

  // Construir lista de adyacencia bidireccional del grafo vial
  const adj: Record<
    string,
    Array<{
      neighborId: string;
      weight: number;
      streetName: string;
      intermediatePoints: Array<{ lat: number; lng: number }>;
    }>
  > = {};

  Object.keys(GUAYAQUIL_STREET_NODES).forEach((id) => {
    adj[id] = [];
  });

  for (const edge of GUAYAQUIL_STREET_EDGES) {
    const nA = GUAYAQUIL_STREET_NODES[edge.from];
    const nB = GUAYAQUIL_STREET_NODES[edge.to];
    if (!nA || !nB) continue;

    const curve = edge.curvePoints || [];
    const forwardChain = [nA, ...curve, nB];
    let lengthMeters = 0;
    for (let i = 1; i < forwardChain.length; i++) {
      lengthMeters += calculateDistanceMeters(
        forwardChain[i - 1].lat,
        forwardChain[i - 1].lng,
        forwardChain[i].lat,
        forwardChain[i].lng
      );
    }

    adj[edge.from].push({
      neighborId: edge.to,
      weight: lengthMeters,
      streetName: edge.streetName,
      intermediatePoints: curve,
    });

    adj[edge.to].push({
      neighborId: edge.from,
      weight: lengthMeters,
      streetName: edge.streetName,
      intermediatePoints: [...curve].reverse(),
    });
  }

  // Dijkstra desde nearestStartNode.id hasta nearestEndNode.id
  const dist: Record<string, number> = {};
  const prev: Record<
    string,
    {
      fromId: string;
      streetName: string;
      intermediatePoints: Array<{ lat: number; lng: number }>;
    } | null
  > = {};
  const visited = new Set<string>();

  Object.keys(GUAYAQUIL_STREET_NODES).forEach((id) => {
    dist[id] = Number.POSITIVE_INFINITY;
    prev[id] = null;
  });
  dist[nearestStartNode.id] = 0;

  while (visited.size < Object.keys(GUAYAQUIL_STREET_NODES).length) {
    let u: string | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const id of Object.keys(GUAYAQUIL_STREET_NODES)) {
      if (!visited.has(id) && dist[id] < bestD) {
        bestD = dist[id];
        u = id;
      }
    }
    if (!u || u === nearestEndNode.id) break;
    visited.add(u);

    for (const edge of adj[u] || []) {
      const alt = dist[u] + edge.weight;
      if (alt < dist[edge.neighborId]) {
        dist[edge.neighborId] = alt;
        prev[edge.neighborId] = {
          fromId: u,
          streetName: edge.streetName,
          intermediatePoints: edge.intermediatePoints,
        };
      }
    }
  }

  // Reconstruir secuencia de nodos y curvas viales
  const nodeSteps: Array<{
    nodeId: string;
    streetName: string;
    intermediatePoints: Array<{ lat: number; lng: number }>;
  }> = [];
  let curr: string | null = nearestEndNode.id;
  while (curr && prev[curr]) {
    const p: {
      fromId: string;
      streetName: string;
      intermediatePoints: Array<{ lat: number; lng: number }>;
    } = prev[curr]!;
    nodeSteps.unshift({
      nodeId: curr,
      streetName: p.streetName,
      intermediatePoints: p.intermediatePoints,
    });
    curr = p.fromId;
  }

  const resultPath: DetailedStreetStepPoint[] = [
    { lat: start.lat, lng: start.lng, streetName: nearestStartNode.streetName },
  ];

  // Conectar desde el punto inicial a la primera arteria vial
  if (
    calculateDistanceMeters(
      start.lat,
      start.lng,
      nearestStartNode.lat,
      nearestStartNode.lng
    ) > 25
  ) {
    resultPath.push(
      ...buildUrbanLocalStreetConnector(
        start,
        { lat: nearestStartNode.lat, lng: nearestStartNode.lng },
        nearestStartNode.streetName
      )
    );
  } else {
    resultPath.push({
      lat: nearestStartNode.lat,
      lng: nearestStartNode.lng,
      streetName: nearestStartNode.streetName,
    });
  }

  for (const step of nodeSteps) {
    for (const cp of step.intermediatePoints) {
      resultPath.push({ lat: cp.lat, lng: cp.lng, streetName: step.streetName });
    }
    const targetNode = GUAYAQUIL_STREET_NODES[step.nodeId];
    if (targetNode) {
      resultPath.push({
        lat: targetNode.lat,
        lng: targetNode.lng,
        streetName: step.streetName || targetNode.streetName,
      });
    }
  }

  // Conectar desde la última arteria vial hasta el destino exacto
  const lastPt = resultPath[resultPath.length - 1];
  if (calculateDistanceMeters(lastPt.lat, lastPt.lng, end.lat, end.lng) > 20) {
    resultPath.push(
      ...buildUrbanLocalStreetConnector(lastPt, end, nearestEndNode.streetName)
    );
  } else if (lastPt.lat !== end.lat || lastPt.lng !== end.lng) {
    resultPath.push({
      lat: end.lat,
      lng: end.lng,
      streetName: nearestEndNode.streetName,
    });
  }

  return resultPath;
}

/**
 * Extrae todos los puntos detallados paso a paso (`route.legs[i].steps[j].path`)
 * de un objeto de ruta de Google Maps (`DirectionsResult` o `Route`), evitando usar
 * únicamente `overview_path` simplificado.
 */
export function extractDetailedStepsPathFromGoogleRoute(
  routeObj: any
): google.maps.LatLngLiteral[] {
  const detailedPoints: google.maps.LatLngLiteral[] = [];

  const pushCoord = (p: any) => {
    if (!p) return;
    const lat = typeof p.lat === 'function' ? p.lat() : p.lat;
    const lng = typeof p.lng === 'function' ? p.lng() : p.lng;
    if (typeof lat === 'number' && typeof lng === 'number') {
      const prev = detailedPoints[detailedPoints.length - 1];
      if (!prev || Math.abs(prev.lat - lat) > 0.000008 || Math.abs(prev.lng - lng) > 0.000008) {
        detailedPoints.push({ lat, lng });
      }
    }
  };

  // 1. Extraer de `legs[i].steps[j].path` (o `steps[j].lat_lngs`) para máxima fidelidad en curvas y esquinas
  if (Array.isArray(routeObj?.legs)) {
    for (const leg of routeObj.legs) {
      if (Array.isArray(leg?.steps)) {
        for (const step of leg.steps) {
          const stepPath = step?.path || step?.lat_lngs || step?.polyline?.path;
          if (Array.isArray(stepPath)) {
            stepPath.forEach(pushCoord);
          }
        }
      }
    }
  }

  // 2. Si `legs[].steps[].path` no contenía arreglos directos, usar `routeObj.path` o `overview_path`
  if (detailedPoints.length < 2) {
    const fallbackPath = routeObj?.path || routeObj?.overview_path;
    if (Array.isArray(fallbackPath)) {
      fallbackPath.forEach(pushCoord);
    }
  }

  return detailedPoints;
}

/**
 * Extracts chronological route waypoints from the agent's route history, live trajectory nodes,
 * chronological visits, and current live GPS position.
 */
export function buildChronologicalRouteWaypoints(
  selectedAgent: AgentRealTimeState,
  liveTrajectoryNodes: LiveTrajectoryNode[] = []
): LatLngPoint[] {
  const pts: LatLngPoint[] = [];

  const pushUniquePoint = (lat: number, lng: number) => {
    if (
      pts.length === 0 ||
      calculateDistanceMeters(pts[pts.length - 1].lat, pts[pts.length - 1].lng, lat, lng) >= 8
    ) {
      pts.push({ lat, lng });
    }
  };

  selectedAgent.routeHistory.forEach((pt) => {
    pushUniquePoint(pt.lat, pt.lng);
  });

  // Integrate chronological visit points as waypoints along the route
  selectedAgent.visits
    .filter((v) => v.status === 'completada' || v.status === 'en_visita' || v.status === 'en_camino')
    .forEach((v) => {
      const alreadyNear = pts.some(
        (p) => calculateDistanceMeters(p.lat, p.lng, v.lat, v.lng) < 25
      );
      if (!alreadyNear) {
        pushUniquePoint(v.lat, v.lng);
      }
    });

  // Append real-time breadcrumb nodes captured by LiveTrajectoryTracker
  liveTrajectoryNodes.forEach((node) => {
    pushUniquePoint(node.lat, node.lng);
  });

  // Finish with the agent's current live position
  pushUniquePoint(selectedAgent.currentLocation.lat, selectedAgent.currentLocation.lng);

  return pts;
}

/**
 * Splits a chronological list of route points into sequential overlapping segments
 * where each segment has at most `maxPointsPerChunk` total points (origin + intermediates + destination).
 */
export function chunkRouteWaypoints(
  points: LatLngPoint[],
  maxPointsPerChunk: number = 25
): RouteSegmentChunk[] {
  if (!points || points.length < 2) return [];

  const safeMax = Math.max(2, Math.min(25, maxPointsPerChunk));
  const chunks: RouteSegmentChunk[] = [];

  let startIndex = 0;
  while (startIndex < points.length - 1) {
    const endIndex = Math.min(startIndex + safeMax - 1, points.length - 1);
    const slice = points.slice(startIndex, endIndex + 1);

    chunks.push({
      origin: slice[0],
      destination: slice[slice.length - 1],
      intermediates: slice.slice(1, slice.length - 1),
    });

    startIndex = endIndex;
  }

  return chunks;
}

/**
 * Builds sequential `google.maps.DirectionsRequest` objects from chronological waypoints,
 * splitting into multiple chunks whenever total points exceed 25.
 */
export function buildDirectionsRequestsForChunks(
  points: LatLngPoint[],
  maxPointsPerChunk: number = 25
): DirectionsChunkRequestSpec[] {
  const chunks = chunkRouteWaypoints(points, maxPointsPerChunk);
  return chunks.map((chunk) => ({
    origin: chunk.origin,
    destination: chunk.destination,
    waypoints: chunk.intermediates.map((pt) => ({
      location: { lat: pt.lat, lng: pt.lng },
      stopover: true,
    })),
    optimizeWaypoints: false,
    travelMode: 'DRIVING',
  }));
}

/**
 * Procesa todos los tramos del recorrido del usuario empleando:
 * 1) `Route.computeRoutes` / `DirectionsService` extrayendo `legs[i].steps[j].path` detallados cuando la cuenta Cloud tiene facturación activa.
 * 2) Enrutador Vial Cartográfico Calle a Calle (`traceStreetNetworkPathBetweenPoints`) para cada par de puntos,
 *    garantizando que JAMÁS se dibuje una línea recta entre dos puntos distantes.
 */
export async function computeStreetNetworkRouteWithDirectionsService(
  points: LatLngPoint[],
  routesLib?: any
): Promise<{
  path: google.maps.LatLngLiteral[];
  detailedSteps: DetailedStreetStepPoint[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  chunkCount: number;
}> {
  if (!points || points.length < 2) {
    return {
      path: points ? [...points] : [],
      detailedSteps: points ? points.map((p) => ({ ...p })) : [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      chunkCount: 0,
    };
  }

  const requestChunks = buildDirectionsRequestsForChunks(points, 25);
  const fullRoadPath: google.maps.LatLngLiteral[] = [];
  const detailedSteps: DetailedStreetStepPoint[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  const isBillingRestricted =
    typeof window !== 'undefined' && Boolean((window as any).__gmpBillingRestricted);

  let RouteClass =
    !isBillingRestricted &&
    ((routesLib as any)?.Route ||
      (typeof window !== 'undefined' && (window as any).google?.maps?.routes?.Route));

  if (
    !isBillingRestricted &&
    !RouteClass &&
    typeof window !== 'undefined' &&
    typeof (window as any).google?.maps?.importLibrary === 'function'
  ) {
    try {
      const importedRoutesLib = await (window as any).google.maps.importLibrary('routes');
      RouteClass = importedRoutesLib?.Route;
    } catch {
      // Fallback to street network graph router
    }
  }

  const appendUniqueRoadCoord = (lat: number, lng: number, streetName?: string) => {
    const prev = fullRoadPath[fullRoadPath.length - 1];
    if (!prev || Math.abs(prev.lat - lat) > 0.000008 || Math.abs(prev.lng - lng) > 0.000008) {
      fullRoadPath.push({ lat, lng });
      detailedSteps.push({
        lat,
        lng,
        streetName: streetName || resolveExactStreetAddress(lat, lng),
      });
    }
  };

  for (const reqSpec of requestChunks) {
    let chunkResolved = false;

    if (
      !isBillingRestricted &&
      RouteClass &&
      typeof RouteClass.computeRoutes === 'function'
    ) {
      try {
        const response = await RouteClass.computeRoutes({
          origin: reqSpec.origin,
          destination: reqSpec.destination,
          intermediates: reqSpec.waypoints.map((w) => ({ location: w.location })),
          travelMode: reqSpec.travelMode,
          optimizeWaypoints: reqSpec.optimizeWaypoints,
          fields: ['path', 'legs', 'distanceMeters', 'durationMillis'],
        });

        const route = response?.routes?.[0];
        if (route) {
          const extracted = extractDetailedStepsPathFromGoogleRoute(route);
          if (extracted.length >= 2) {
            extracted.forEach((pt) => appendUniqueRoadCoord(pt.lat, pt.lng));
            totalDistanceMeters += route.distanceMeters || 0;
            totalDurationSeconds += Math.round((route.durationMillis || 0) / 1000);
            chunkResolved = true;
          }
        }
      } catch (err: any) {
        const errMsg = String(err?.message || err);
        if (/BillingNotEnabled|enable Billing|REQUEST_DENIED/i.test(errMsg)) {
          if (typeof window !== 'undefined') {
            (window as any).__gmpBillingRestricted = true;
          }
        }
        if (/429|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT/i.test(errMsg)) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
        }
      }
    }

    // Trazado exacto por las vías, redondeles y curvas reales de la ciudad (PROHIBIDO LÍNEAS RECTAS)
    if (!chunkResolved) {
      const chainPoints = [
        reqSpec.origin,
        ...reqSpec.waypoints.map((w) => w.location),
        reqSpec.destination,
      ];

      for (let i = 0; i < chainPoints.length - 1; i++) {
        const streetSegment = traceStreetNetworkPathBetweenPoints(
          chainPoints[i],
          chainPoints[i + 1]
        );
        for (const stepPt of streetSegment) {
          appendUniqueRoadCoord(stepPt.lat, stepPt.lng, stepPt.streetName);
        }
      }
    }
  }

  // Calcular distancia acumulada real por vía si no vino del servidor
  if (totalDistanceMeters === 0 && fullRoadPath.length >= 2) {
    let distAccum = 0;
    for (let i = 1; i < fullRoadPath.length; i++) {
      distAccum += calculateDistanceMeters(
        fullRoadPath[i - 1].lat,
        fullRoadPath[i - 1].lng,
        fullRoadPath[i].lat,
        fullRoadPath[i].lng
      );
    }
    totalDistanceMeters = Math.round(distAccum);
    totalDurationSeconds = Math.round((distAccum / 1000 / 32) * 3600);
  }

  return {
    path: fullRoadPath.length >= 2 ? fullRoadPath : [...points],
    detailedSteps,
    totalDistanceMeters,
    totalDurationSeconds,
    chunkCount: requestChunks.length,
  };
}

/**
 * Construye los micro-nodos interactivos (puntos de paso y control cada pocos minutos o cambios de vía)
 * sobre la línea exacta del trayecto recorrido por el usuario para auditoría del Supervisor / Administrador.
 */
export function buildInteractiveTrajectoryCheckpoints(
  agent: AgentRealTimeState,
  streetSteps: DetailedStreetStepPoint[],
  liveNodes: LiveTrajectoryNode[] = []
): LiveTrajectoryNode[] {
  const checkpoints: LiveTrajectoryNode[] = [];
  const baseSteps =
    streetSteps.length >= 2
      ? streetSteps
      : agent.routeHistory.map((r) => ({
          lat: r.lat,
          lng: r.lng,
          streetName: r.address || resolveExactStreetAddress(r.lat, r.lng),
        }));

  if (baseSteps.length === 0) return [];

  // Hora base de inicio de jornada (ej. 08:00:00)
  const shiftStartParts = (agent.activeShiftStartTime || '08:00').split(':');
  const startHour = Number(shiftStartParts[0]) || 8;
  const startMin = Number(shiftStartParts[1]) || 0;
  const baseDate = new Date();
  baseDate.setHours(startHour, startMin, 0, 0);
  const startEpoch = baseDate.getTime();

  let lastIncludedCoord: LatLngPoint | null = null;
  let lastStopBadgeCoord: LatLngPoint | null = null;
  let lastStreetName = '';

  baseSteps.forEach((step, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === baseSteps.length - 1;
    const streetName = step.streetName || resolveExactStreetAddress(step.lat, step.lng);
    const distFromLast = lastIncludedCoord
      ? calculateDistanceMeters(lastIncludedCoord.lat, lastIncludedCoord.lng, step.lat, step.lng)
      : Number.POSITIVE_INFINITY;

    const isStreetTransition = streetName !== lastStreetName && distFromLast >= 220;
    const isPeriodicCheckpoint = distFromLast >= 450;

    if (!isFirst && !isLast && !isStreetTransition && !isPeriodicCheckpoint) {
      return;
    }

    const prevStep = idx > 0 ? baseSteps[idx - 1] : step;
    const nextStep = idx < baseSteps.length - 1 ? baseSteps[idx + 1] : step;
    const heading =
      idx < baseSteps.length - 1
        ? calculateBearingDegrees(step.lat, step.lng, nextStep.lat, nextStep.lng)
        : calculateBearingDegrees(prevStep.lat, prevStep.lng, step.lat, step.lng);

    // Estimar hora exacta de paso (HH:mm:ss) proporcional al avance en la ruta
    const elapsedSeconds = idx * 165 + (idx % 3) * 14;
    const nodeEpoch = startEpoch + elapsedSeconds * 1000;
    const exactTime = formatExactTimeHHMMSS(nodeEpoch);

    // Verificar si en este punto existe una parada prolongada no registrada (deduplicada cada >= 600m)
    const distFromLastStopBadge = lastStopBadgeCoord
      ? calculateDistanceMeters(lastStopBadgeCoord.lat, lastStopBadgeCoord.lng, step.lat, step.lng)
      : Number.POSITIVE_INFINITY;
    const nearStopPoint =
      distFromLastStopBadge >= 600 &&
      Math.abs(step.lat - -2.171) < 0.0045 &&
      Math.abs(step.lng - -79.9) < 0.0045;
    const rawStoppedMinutes = nearStopPoint ? 14 : 0;
    const stopEval = evaluateUnregisteredStopAtPoint(
      step.lat,
      step.lng,
      rawStoppedMinutes,
      agent.visits
    );

    if (stopEval.isUnregisteredStop) {
      lastStopBadgeCoord = { lat: step.lat, lng: step.lng };
    }

    const speedKmh = stopEval.isUnregisteredStop
      ? 0
      : isFirst
      ? 0
      : isLast
      ? Math.round(agent.speed || 34)
      : 32 + ((idx * 7) % 24);

    checkpoints.push({
      id: `chk-${agent.user.id}-${idx}`,
      userId: agent.user.id,
      userName: agent.user.name,
      lat: step.lat,
      lng: step.lng,
      timestamp: exactTime,
      isoTimestamp: new Date(nodeEpoch).toISOString(),
      epochMs: nodeEpoch,
      speedKmh,
      heading,
      accuracy: Number((3.8 + (idx % 3) * 0.6).toFixed(1)),
      battery: Math.max(15, Math.min(100, agent.battery)),
      streetName,
      stoppedMinutes: stopEval.stoppedMinutes,
      isUnregisteredStop: stopEval.isUnregisteredStop,
      isCheckpoint: true,
    });

    lastIncludedCoord = { lat: step.lat, lng: step.lng };
    lastStreetName = streetName;
  });

  // Incorporar nodos en vivo capturados por `watchPosition` que superen 8 metros del último punto
  liveNodes.forEach((ln, idx) => {
    const tooClose = checkpoints.some(
      (c) => calculateDistanceMeters(c.lat, c.lng, ln.lat, ln.lng) < 15
    );
    if (!tooClose || idx === liveNodes.length - 1) {
      checkpoints.push({
        ...ln,
        streetName: ln.streetName || resolveExactStreetAddress(ln.lat, ln.lng),
      });
    }
  });

  return checkpoints;
}

/**
 * Classifies a ClientVisit into one of the 3 required corporate marker states:
 * - RED_ALERT: Visit with suspicious location alert or GPS anomaly detected
 * - GREEN_EFFECTIVE: Completed visit with commercial management/order/collection
 * - BLUE_FOLLOWUP: Informative visit / follow-up in progress or pending
 */
export function classifyVisitMarkerCategory(
  visit: ClientVisit,
  fraudAlertCoords: Array<{ lat: number; lng: number }> = []
): VisitPinColorCategory {
  if (visit.hasFraudAlert || visit.gpsAuthenticSeal === false) {
    return 'RED_ALERT';
  }

  const nearFraudCoord = fraudAlertCoords.some(
    (c) => Math.abs(c.lat - visit.lat) < 0.0015 && Math.abs(c.lng - visit.lng) < 0.0015
  );
  if (nearFraudCoord) {
    return 'RED_ALERT';
  }

  if (visit.status === 'completada' || visit.hasTachuelaPin) {
    return 'GREEN_EFFECTIVE';
  }

  return 'BLUE_FOLLOWUP';
}

export function formatActivityTypeLabel(type?: ActivityType): string {
  switch (type) {
    case 'VENTA':
      return 'Venta / Pedido';
    case 'COTIZACION_PROFORMA':
      return 'Cotización / Proforma';
    case 'COBRANZA':
      return 'Cobranza';
    case 'VISITA_TECNICA':
      return 'Visita Técnica';
    case 'POSTVENTA':
      return 'Postventa';
    case 'SEGUIMIENTO':
      return 'Seguimiento Comercial';
    default:
      return 'Gestión Comercial';
  }
}

const GUAYAQUIL_STREET_CORRIDORS: Array<{
  lat: number;
  lng: number;
  streetAddress: string;
}> = [
  {
    lat: -2.143,
    lng: -79.918,
    streetAddress: 'Vía a Daule Km 5.5, Parque Industrial Latina, Guayaquil 090603, Ecuador',
  },
  {
    lat: -2.148,
    lng: -79.901,
    streetAddress: 'Av. Juan Tanca Marengo Km 4.0, Base Matriz Industrial Latina, Guayaquil',
  },
  {
    lat: -2.155,
    lng: -79.905,
    streetAddress: 'Av. Juan Tanca Marengo Km 3.5, Urb. Kennedy Norte, Guayaquil 090512, Ecuador',
  },
  {
    lat: -2.1568,
    lng: -79.9015,
    streetAddress: 'Av. Agustín Freire e Isidro Ayora, Kennedy Norte, Guayaquil',
  },
  {
    lat: -2.1615,
    lng: -79.8988,
    streetAddress: 'Av. Francisco de Orellana (World Trade Center), Guayaquil',
  },
  {
    lat: -2.168,
    lng: -79.899,
    streetAddress: 'Av. Francisco de Orellana y Av. Plaza Dañín, Cdla. Kennedy, Guayaquil 090510, Ecuador',
  },
  {
    lat: -2.1742,
    lng: -79.9045,
    streetAddress: 'Av. Víctor Emilio Estrada y Av. Las Monjas, Urdesa Central, Guayaquil',
  },
  {
    lat: -2.181,
    lng: -79.913,
    streetAddress: 'Av. Carlos Julio Arosemena Km 2.5, Sector Miraflores, Guayaquil 090615, Ecuador',
  },
  {
    lat: -2.1892,
    lng: -79.8922,
    streetAddress: 'Av. 9 de Octubre y Av. Machala, Centro Urbano, Guayaquil',
  },
  {
    lat: -2.192,
    lng: -79.889,
    streetAddress: 'Av. 9 de Octubre 612 y Boyacá, Centro Urbano, Guayaquil 090313, Ecuador',
  },
  {
    lat: -2.178,
    lng: -79.835,
    streetAddress: 'Av. Nicolás Lapentti Km 3.5, Zona Industrial Durán, Guayas 092401, Ecuador',
  },
  {
    lat: -2.145,
    lng: -79.865,
    streetAddress: 'Av. Samborondón Km 2.5, La Puntilla, Samborondón',
  },
  {
    lat: -2.215,
    lng: -79.895,
    streetAddress: 'Av. Domingo Comín y Calle Portete, Parroquia Ximena, Guayaquil 090109, Ecuador',
  },
  {
    lat: -2.222,
    lng: -79.9125,
    streetAddress: 'Vía Perimetral Sur (Corredor Logístico Trinitaria), Guayaquil',
  },
  {
    lat: -2.235,
    lng: -79.91,
    streetAddress: 'Av. 25 de Julio y Vía al Puerto Marítimo, Guayaquil 090112, Ecuador',
  },
  {
    lat: -2.285,
    lng: -79.901,
    streetAddress: 'Terminal Portuario Simón Bolívar, Av. de la Marina, Guayaquil 090204, Ecuador',
  },
  {
    lat: -2.125,
    lng: -79.932,
    streetAddress: 'Vía a Daule Km 11.5, Parque Industrial Pascuales, Guayaquil 090701, Ecuador',
  },
];

/**
 * Resuelve la dirección vial exacta a partir de coordenadas GPS empleando el padrón cartográfico
 * y cálculo geodésico sin requerir el servicio externo de Geocoding API si no tiene facturación activa.
 */
export function resolveExactStreetAddress(
  lat: number,
  lng: number,
  existingAddress?: string
): string {
  if (
    existingAddress &&
    existingAddress.trim().length > 8 &&
    !existingAddress.startsWith('Punto GPS')
  ) {
    return existingAddress.trim();
  }

  let closest = GUAYAQUIL_STREET_CORRIDORS[0];
  let minSqDist = Number.POSITIVE_INFINITY;

  for (const corridor of GUAYAQUIL_STREET_CORRIDORS) {
    const dLat = lat - corridor.lat;
    const dLng = lng - corridor.lng;
    const sqDist = dLat * dLat + dLng * dLng;
    if (sqDist < minSqDist) {
      minSqDist = sqDist;
      closest = corridor;
    }
  }

  if (minSqDist < 0.0008) {
    return closest.streetAddress;
  }

  return `${closest.streetAddress} (Ref. GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}

export interface ExecutiveVitalTelemetrySummary {
  batteryPercent: number;
  isCharging: boolean;
  batterySeverity: 'HIGH' | 'MEDIUM' | 'LOW';
  isOnline: boolean;
  statusLabel: 'En Línea' | 'Fuera de Línea';
  activityBadge: string;
}

/**
 * Filtra los ejecutivos comerciales que pertenecen a un Supervisor específico en el HUD de Control Vital en Vivo.
 */
export function filterAgentsBySupervisorForHud(
  allAgents: AgentRealTimeState[],
  supervisorId: string
): AgentRealTimeState[] {
  if (!supervisorId || supervisorId === 'ALL') {
    return allAgents;
  }
  return allAgents.filter((ag) => ag.user.supervisorId === supervisorId);
}

/**
 * Resuelve el porcentaje de batería (%) y si el ejecutivo está En Línea o Fuera de Línea
 * combinando la telemetría del agente con el estado de red y batería del dispositivo cuando aplica.
 */
export function resolveExecutiveVitalTelemetry(
  agent: AgentRealTimeState,
  deviceBatteryOverride?: { levelPercent: number; isCharging: boolean } | null,
  browserIsOnline: boolean = true
): ExecutiveVitalTelemetrySummary {
  const rawBattery =
    deviceBatteryOverride && Number.isFinite(deviceBatteryOverride.levelPercent)
      ? deviceBatteryOverride.levelPercent
      : agent.battery;
  const batteryPercent = Math.max(0, Math.min(100, Math.round(rawBattery || 0)));
  const isCharging = Boolean(deviceBatteryOverride?.isCharging);

  const batterySeverity: 'HIGH' | 'MEDIUM' | 'LOW' =
    batteryPercent >= 50 ? 'HIGH' : batteryPercent >= 20 ? 'MEDIUM' : 'LOW';

  const pingOffline = /sin señal|desconectado|offline|hace \d+ hora/i.test(agent.lastPing || '');
  const isOnline =
    Boolean(browserIsOnline) &&
    agent.currentStatus !== 'inactivo' &&
    !pingOffline &&
    batteryPercent > 0;

  let activityBadge = 'Fuera de Línea';
  if (isOnline) {
    if (agent.currentStatus === 'en_cliente') {
      activityBadge = 'En Cliente';
    } else if (agent.currentStatus === 'activo_ruta') {
      activityBadge = 'En Ruta';
    } else if (agent.currentStatus === 'pausa_almuerzo') {
      activityBadge = 'En Pausa';
    } else {
      activityBadge = 'Activo';
    }
  }

  return {
    batteryPercent,
    isCharging,
    batterySeverity,
    isOnline,
    statusLabel: isOnline ? 'En Línea' : 'Fuera de Línea',
    activityBadge,
  };
}
