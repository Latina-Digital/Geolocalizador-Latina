export type UserRole = 
  | 'DIRECTOR_GENERAL'      // Super Administrador: Industrial Latina Total
  | 'SUPERVISOR_REGIONAL'   // Supervisor / Jefe de Ventas de Zona
  | 'EJECUTIVO_VENTAS'      // Agente comercial en ruta
  | 'TRANSPORTISTA';        // Conductor logístico de distribución

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  phone: string;
  zone: string;
  supervisorId?: string; // For hierarchy filtering
  assignedVehicle?: string; // E.g., "Camioneta Chevrolet D-Max #08"
  shiftActive?: boolean;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string; // ISO string
  speed: number; // km/h
  accuracy?: number; // meters
  heading?: number; // degrees
  address?: string;
  batteryLevel?: number; // percentage
  status: 'driving' | 'stopped' | 'in_visit' | 'idle' | 'off_route';
}

export type ActivityType = 'VENTA' | 'COBRANZA' | 'SEGUIMIENTO' | 'OTRO';
export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'CREDITO';

export interface ClientVisit {
  id: string;
  name: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  scheduledTime: string; // e.g. "09:30"
  actualArrivalTime?: string;
  departureTime?: string;
  durationMinutes?: number; // Tiempo ocupado en visita
  travelMinutesFromPrevious?: number; // Tiempo ocupado en trayecto
  status: 'pendiente' | 'en_camino' | 'en_visita' | 'completada' | 'no_visitada';
  
  // Actividad registrada (Venta o Cobranza)
  activityType?: ActivityType;
  orderAmount?: number; // USD
  collectedAmount?: number; // USD (para cobranza)
  invoiceOrReceiptNumber?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  
  // Evidencia obligatoria (Foto o Video)
  evidenceType?: 'photo' | 'video';
  evidenceUrl?: string; // base64 or preview url
  evidenceTimestamp?: string;
  hasTachuelaPin?: boolean; // Tachuela especial en el mapa
}

export type AlertType = 
  | 'PARADA_PROLONGADA' 
  | 'DESVIO_RUTA' 
  | 'FUERA_GEOCERCA' 
  | 'EXCESO_VELOCIDAD' 
  | 'PERDIDA_GPS' 
  | 'PANICO_SOS'
  | 'CIERRE_AUTO_9H';

export interface SuspiciousAlert {
  id: string;
  agentId: string;
  agentName: string;
  type: AlertType;
  severity: 'baja' | 'media' | 'alta' | 'critica';
  timestamp: string;
  lat: number;
  lng: number;
  description: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  zone: string;
}

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export type GeofenceType = 'polygon' | 'circle';

export interface CustomGeofence {
  id: string;
  name: string;
  zone: string;
  type: GeofenceType;
  color: string;
  center?: LatLngPoint;
  radiusKm?: number;
  coordinates?: LatLngPoint[]; // polygon vertices
  assignedAgentIds: string[];
  active: boolean;
  createdAt: string;
}

export type ShiftState = 
  | 'sin_iniciar' 
  | 'inactivo'
  | 'activo_ruta' 
  | 'en_cliente' 
  | 'pausa_almuerzo' 
  | 'detenido_alerta' 
  | 'finalizado' 
  | 'cerrado_auto_9h';

export interface AgentRealTimeState {
  user: User;
  currentLocation: LatLngPoint;
  speed: number;
  battery: number;
  gpsSignal: 'excelente' | 'bueno' | 'debil' | 'sin_conexion';
  lastPing: string;
  shiftStartTimestamp?: number; // Epoch ms for 9-hour limit tracking
  activeShiftStartTime?: string;
  shiftEndTime?: string;
  todayKm: number;
  currentStatus: ShiftState;
  routeHistory: RoutePoint[];
  visits: ClientVisit[];
  assignedGeofence: {
    id?: string;
    name: string;
    center: LatLngPoint;
    radiusKm: number;
    coordinates?: LatLngPoint[];
  };
}

export interface DailyReportSummary {
  agentId: string;
  agentName: string;
  role: UserRole;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  totalHours: string;
  totalKm: number;
  plannedVisits: number;
  completedVisits: number;
  visitCompliancePercent: number;
  totalSalesOrders: number;
  totalSalesCount?: number;
  totalCollectionsAmount?: number;
  totalCollectionsCount?: number;
  evidencesCount?: number;
  totalVisitsDurationMinutes?: number;
  totalTravelDurationMinutes?: number;
  efficiencyScore: number; // 0 - 100
  alertsTriggered: number;
  avgSpeed: number;
  timeSpentInVisitsMinutes: number;
  timeSpentDrivingMinutes: number;
  autoClosedAfter9Hours?: boolean;
  supervisorSignature?: string;
}
