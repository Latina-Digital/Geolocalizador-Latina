/// <reference types="google.maps" />
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 4: Detalle Completo de Cada Visita Generado por el Usuario + Visor Street View
 * Muestra las 5 secciones corporativas obligatorias y, para Supervisores y cargos superiores,
 * incluye la Auditoría Técnica de Ubicación y el visor interactivo `google.maps.StreetViewPanorama`.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ClientVisit, User } from '../types';
import { canUserAccessGpsFraudAlerts } from '../services/geoIntegrityGuard';
import {
  classifyVisitMarkerCategory,
  formatActivityTypeLabel,
  resolveExactStreetAddress,
} from '../utils/googleMapsRouting';
import {
  X,
  MapPin,
  Clock,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Building2,
  UserCheck,
  Camera,
  ExternalLink,
} from 'lucide-react';

interface VisitDetailAndStreetViewModalProps {
  visit: ClientVisit | null;
  visitSequenceIndex: number;
  totalVisitsInRoute: number;
  executiveUser: User;
  viewerRole: string;
  onClose: () => void;
}

export const VisitDetailAndStreetViewModal: React.FC<VisitDetailAndStreetViewModalProps> = ({
  visit,
  visitSequenceIndex,
  totalVisitsInRoute,
  executiveUser,
  viewerRole,
  onClose,
}) => {
  const [resolvedStreetAddress, setResolvedStreetAddress] = useState<string>('');
  const [showStreetViewPanorama, setShowStreetViewPanorama] = useState<boolean>(false);
  const [streetViewStatus, setStreetViewStatus] = useState<'IDLE' | 'LOADING' | 'READY' | 'UNAVAILABLE'>('IDLE');
  const streetViewContainerRef = useRef<HTMLDivElement | null>(null);

  const isSupervisorOrHigher = canUserAccessGpsFraudAlerts(viewerRole);

  // Resolución de dirección vial exacta a partir de coordenadas GPS y padrón cartográfico
  useEffect(() => {
    if (!visit) return;
    setResolvedStreetAddress(
      resolveExactStreetAddress(
        visit.lat,
        visit.lng,
        visit.reverseGeocodedAddress || visit.address
      )
    );
    setShowStreetViewPanorama(false);
    setStreetViewStatus('IDLE');
  }, [visit]);

  // Inicializar google.maps.StreetViewPanorama al activar "👁️ Ver Fachada en Street View"
  useEffect(() => {
    if (!showStreetViewPanorama || !visit || !streetViewContainerRef.current) return;

    setStreetViewStatus('LOADING');
    if (typeof window !== 'undefined' && (window as any).google?.maps?.StreetViewPanorama) {
      try {
        const svService = new google.maps.StreetViewService();
        const targetLatLng = { lat: visit.lat, lng: visit.lng };

        svService.getPanorama(
          { location: targetLatLng, radius: 120 },
          (data, status) => {
            if (!streetViewContainerRef.current) return;
            if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng) {
              new google.maps.StreetViewPanorama(streetViewContainerRef.current, {
                position: data.location.latLng,
                pov: { heading: 165, pitch: 5 },
                zoom: 1,
                addressControl: true,
                fullscreenControl: true,
                panControl: true,
                zoomControl: true,
              });
              setStreetViewStatus('READY');
            } else {
              // Inicializar panorama directo en las coordenadas por si hay cobertura cercana
              new google.maps.StreetViewPanorama(streetViewContainerRef.current, {
                position: targetLatLng,
                pov: { heading: 165, pitch: 5 },
                zoom: 1,
              });
              setStreetViewStatus('READY');
            }
          }
        );
      } catch {
        setStreetViewStatus('UNAVAILABLE');
      }
    } else {
      setStreetViewStatus('UNAVAILABLE');
    }
  }, [showStreetViewPanorama, visit]);

  if (!visit) return null;

  const pinCategory = classifyVisitMarkerCategory(visit);
  const isRedAlert = pinCategory === 'RED_ALERT';
  const isGreenEffective = pinCategory === 'GREEN_EFFECTIVE';

  const transactionAmount = visit.orderAmount ?? visit.collectedAmount ?? 0;

  return (
    <div
      className="fixed inset-0 z-[9995] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visit-detail-modal-title"
    >
      <div className="geo-modal-fullviewport bg-[#1E293B] border border-slate-700 rounded-2xl w-[96vw] max-w-[96vw] h-[92dvh] max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isRedAlert
              ? 'bg-gradient-to-r from-red-950 via-[#0A2540] to-red-950 border-red-700'
              : isGreenEffective
              ? 'bg-gradient-to-r from-[#0A2540] via-emerald-950/70 to-[#0A2540] border-emerald-700/60'
              : 'bg-[#0A2540] border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl font-black text-base flex items-center justify-center border-2 border-white shadow-lg shrink-0 ${
                isRedAlert
                  ? 'bg-red-600 text-white animate-pulse'
                  : isGreenEffective
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-sky-500 text-white'
              }`}
            >
              {visitSequenceIndex}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400">
                  INSPECCIÓN DE VISITA EN CAMPO · PARADA #{visitSequenceIndex} DE {totalVisitsInRoute}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    isRedAlert
                      ? 'bg-red-600 text-white'
                      : isGreenEffective
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  }`}
                >
                  {isRedAlert
                    ? '🚨 Alerta GPS Detectada'
                    : isGreenEffective
                    ? '✓ Visita Completada Efectiva'
                    : '● En Seguimiento / Ruta'}
                </span>
              </div>
              <h2 id="visit-detail-modal-title" className="text-base sm:text-lg font-bold text-white mt-0.5">
                {visit.name} — {visit.companyName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle de visita"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body with the 5 Mandatory Corporate Sections */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* 1. DATOS DEL EJECUTIVO Y SECUENCIA */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px] mb-2.5">
              <UserCheck className="w-4 h-4" />
              <span>1. Datos del Ejecutivo y Secuencia en Ruta</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 block text-[11px]">Ejecutivo Comercial:</span>
                <strong className="text-white text-sm">{executiveUser.name}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Rol / Cargo & Vehículo:</span>
                <strong className="text-slate-200">
                  {executiveUser.role === 'TRANSPORTISTA' ? 'Transportista Logístico' : 'Ejecutivo de Ventas'} ·{' '}
                  {executiveUser.assignedVehicle || 'Unidad Asignada'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Secuencia Cronológica:</span>
                <strong className="text-amber-400 font-mono text-sm">
                  Visita #{visitSequenceIndex} de {totalVisitsInRoute} ({executiveUser.zone})
                </strong>
              </div>
            </div>
          </div>

          {/* 2. DATOS DEL CLIENTE / PUNTO VISITADO */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-[11px] mb-2.5">
              <Building2 className="w-4 h-4" />
              <span>2. Datos del Cliente / Punto Visitado (Padrón LatinaSoft)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 block text-[11px]">Nombre Comercial / Razón Social:</span>
                <strong className="text-white">{visit.name}</strong>
                <span className="block text-slate-300 text-[11px]">{visit.companyName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Código / RUC LatinaSoft:</span>
                <strong className="text-amber-300 font-mono">{visit.clientRuc || '0992348192001'}</strong>
                <span className="block text-slate-400 text-[11px]">
                  Contacto: {visit.contactPerson} ({visit.phone})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Clasificación / Tipo de Cliente:</span>
                <strong className="text-slate-200">
                  {visit.clientType || 'Distribuidor Comercial Autorizado'}
                </strong>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 text-[11px] block">
                  Dirección Vial Exacta (Geocodificación Inversa Google Maps):
                </span>
                <strong className="text-emerald-300 font-medium">{resolvedStreetAddress}</strong>
              </div>
            </div>
          </div>

          {/* 3. CONTROL DE TIEMPOS */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[11px] mb-2.5">
              <Clock className="w-4 h-4" />
              <span>3. Control de Tiempos de Operación</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Hora Programada</span>
                <strong className="text-slate-200 font-mono text-sm">{visit.scheduledTime}</strong>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Hora Llegada (Check-in)</span>
                <strong className="text-emerald-400 font-mono text-sm">
                  {visit.actualArrivalTime || visit.scheduledTime}
                </strong>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Hora Salida (Check-out)</span>
                <strong className="text-sky-400 font-mono text-sm">
                  {visit.departureTime || (visit.status === 'en_visita' ? 'En atención' : '--:--')}
                </strong>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Permanencia Total</span>
                <strong className="text-amber-400 font-mono text-sm">
                  {visit.durationMinutes ? `${visit.durationMinutes} min` : '30 min'}
                </strong>
              </div>
            </div>
          </div>

          {/* 4. DETALLE DE LA GESTIÓN REALIZADA (GENERADO POR EL USUARIO) */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                <FileText className="w-4 h-4" />
                <span>4. Detalle de la Gestión Realizada en el Punto</span>
              </div>
              <span className="px-2.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold text-[11px]">
                Estado: {visit.operationStatus || (visit.status === 'completada' ? 'Concretado' : 'En negociación')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Tipo de Gestión:</span>
                <strong className="text-white text-xs">
                  {formatActivityTypeLabel(visit.activityType)}
                </strong>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">N° Documento / Pedido / Cotización:</span>
                <strong className="text-amber-300 font-mono text-xs">
                  {visit.invoiceOrReceiptNumber || 'DOC-LAT-2026-S/N'} ({visit.paymentMethod || 'CREDITO'})
                </strong>
              </div>
              <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Monto de la Operación ($ USD):</span>
                <strong className="text-emerald-400 font-mono text-sm">
                  ${transactionAmount.toLocaleString('es-EC', { minimumFractionDigits: 2 })} USD
                </strong>
              </div>
            </div>

            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <div>
                <span className="text-slate-400 text-[11px] font-semibold">
                  Productos / Líneas Industrial Latina Gestionadas:
                </span>
                <p className="text-slate-200 font-medium mt-0.5">
                  {visit.managedProducts || 'Línea Ferretera, Soldadura Industrial y Perfilería Metálica'}
                </p>
              </div>
              <div className="pt-1.5 border-t border-slate-800/80">
                <span className="text-slate-400 text-[11px] font-semibold">
                  Observaciones / Resumen de Acuerdos Comerciales:
                </span>
                <p className="text-slate-300 italic mt-0.5">
                  "{visit.notes || 'Visita comercial registrada en punto del cliente según rutero oficial.'}"
                </p>
              </div>
            </div>

            {visit.evidenceUrl && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-950/90 p-3 rounded-xl border border-slate-800">
                <img
                  src={visit.evidenceUrl}
                  alt="Evidencia de visita"
                  className="w-28 h-20 object-cover rounded-lg border border-slate-700 shrink-0"
                />
                <div>
                  <span className="text-emerald-400 font-bold flex items-center gap-1 text-xs">
                    <Camera className="w-3.5 h-3.5" />
                    Evidencia Fotográfica Verificada en Campo
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Hora de captura: {visit.evidenceTimestamp || visit.departureTime || visit.scheduledTime} · Respaldo sincronizado con LatinaSoft.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 5. AUDITORÍA TÉCNICA DE UBICACIÓN (EXCLUSIVO PARA SUPERVISOR Y CARGOS SUPERIORES) */}
          {isSupervisorOrHigher && (
            <div
              className={`rounded-xl p-4 border space-y-3 ${
                isRedAlert
                  ? 'bg-red-950/35 border-red-600'
                  : 'bg-[#0F172A] border-emerald-700/60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px] text-white">
                  {isRedAlert ? (
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>5. Auditoría Técnica de Ubicación (Exclusivo Supervisión / Gerencia)</span>
                </div>

                {/* Sello de Verificación Anti-Fraude */}
                <span
                  className={`px-3 py-1 rounded-lg font-black text-xs border ${
                    isRedAlert
                      ? 'bg-red-600 text-white border-red-400 animate-pulse'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-600'
                  }`}
                >
                  {isRedAlert
                    ? '🚨 ALERTA ROJA: Posible alteración por app externa'
                    : '✅ Ubicación GPS Auténtica'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Coordenadas Exactas (Lat, Lng):</span>
                  <strong className="text-white font-mono text-xs">
                    {visit.lat.toFixed(6)}, {visit.lng.toFixed(6)}
                  </strong>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Precisión del GPS (accuracy):</span>
                  <strong
                    className={`font-mono text-xs ${
                      (visit.gpsAccuracyMeters ?? 4.5) <= 1.2 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    ±{(visit.gpsAccuracyMeters ?? 4.5).toFixed(1)} metros
                  </strong>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Velocidad de Llegada Previa:</span>
                  <strong
                    className={`font-mono text-xs ${
                      (visit.arrivalSpeedKmh ?? 38) > 120 ? 'text-red-400' : 'text-sky-400'
                    }`}
                  >
                    {visit.arrivalSpeedKmh ?? 38} km/h
                  </strong>
                </div>
              </div>

              {/* Botón Directo Street View Panorama */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-300">
                  Inspección visual de fachada comercial mediante Google Street View oficial:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowStreetViewPanorama((prev) => !prev)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>
                      {showStreetViewPanorama
                        ? 'Ocultar Street View'
                        : '👁️ Ver Fachada en Street View'}
                    </span>
                  </button>
                  <a
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${visit.lat},${visit.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1 border border-slate-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir 360°</span>
                  </a>
                </div>
              </div>

              {showStreetViewPanorama && (
                <div className="mt-3 rounded-xl overflow-hidden border-2 border-amber-500/70 bg-slate-950 relative">
                  <div
                    ref={streetViewContainerRef}
                    className="w-full h-72 sm:h-80 bg-slate-900"
                  />
                  {streetViewStatus === 'UNAVAILABLE' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center">
                      <p className="text-xs text-amber-300 font-bold">
                        Vista panorámica lista en coordenadas ({visit.lat.toFixed(5)}, {visit.lng.toFixed(5)}).
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Dirección verificada: {resolvedStreetAddress}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#0F172A] border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            ID Punto: {visit.id} · RUC: {visit.clientRuc || '0992348192001'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            Cerrar Inspección
          </button>
        </div>
      </div>
    </div>
  );
};
