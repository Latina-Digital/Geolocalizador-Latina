import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { AgentRealTimeState, ClientVisit, SuspiciousAlert, CustomGeofence, LatLngPoint } from '../types';

interface MapTrackerProps {
  selectedAgent: AgentRealTimeState;
  allAgents?: AgentRealTimeState[];
  onSelectAgent?: (agentId: string) => void;
  onSelectVisit?: (visit: ClientVisit) => void;
  activeAlerts?: SuspiciousAlert[];
  showGeofence?: boolean;
  customGeofences?: CustomGeofence[];
  isDrawingGeofence?: boolean;
  drawingPoints?: LatLngPoint[];
  onMapClick?: (point: LatLngPoint) => void;
  onSelectGeofence?: (geofence: CustomGeofence) => void;
}

export const MapTracker: React.FC<MapTrackerProps> = ({
  selectedAgent,
  allAgents = [],
  onSelectAgent,
  onSelectVisit,
  activeAlerts = [],
  showGeofence = true,
  customGeofences = [],
  isDrawingGeofence = false,
  drawingPoints = [],
  onMapClick,
  onSelectGeofence,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const drawingLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [selectedAgent.currentLocation.lat, selectedAgent.currentLocation.lng],
        zoom: 14,
        zoomControl: false,
      });

      // OpenStreetMap standard tiles (real street map, zero watermark)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add Zoom Control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      layersGroupRef.current = L.layerGroup().addTo(map);
      drawingLayerGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layersGroupRef.current = null;
        drawingLayerGroupRef.current = null;
      }
    };
  }, []);

  // Handle map click for drawing
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isDrawingGeofence) {
      map.closePopup();
    }

    const handleLeafletClick = (e: L.LeafletMouseEvent) => {
      if (isDrawingGeofence && onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    map.on('click', handleLeafletClick);
    return () => {
      map.off('click', handleLeafletClick);
    };
  }, [isDrawingGeofence, onMapClick]);

  // Render Drawing Layer (current polygon being drawn)
  useEffect(() => {
    const drawingLayer = drawingLayerGroupRef.current;
    if (!drawingLayer) return;

    drawingLayer.clearLayers();

    if (isDrawingGeofence && drawingPoints.length > 0) {
      const latLngs: [number, number][] = drawingPoints.map(p => [p.lat, p.lng]);

      // Connect points with line
      if (drawingPoints.length >= 2) {
        const polyline = L.polyline(latLngs, {
          color: '#f59e0b',
          weight: 3,
          dashArray: '5, 5',
        });
        drawingLayer.addLayer(polyline);
      }

      // If 3 or more points, close with a semi-transparent polygon
      if (drawingPoints.length >= 3) {
        const polygon = L.polygon(latLngs, {
          color: '#f59e0b',
          fillColor: '#fbbf24',
          fillOpacity: 0.25,
          weight: 2,
        });
        drawingLayer.addLayer(polygon);
      }

      // Draw vertex markers with sequence numbers
      drawingPoints.forEach((pt, index) => {
        const vertexIcon = L.divIcon({
          className: 'custom-vertex-marker',
          html: `
            <div style="
              width: 22px;
              height: 22px;
              background-color: #f59e0b;
              border: 2px solid #ffffff;
              border-radius: 50%;
              color: #0f172a;
              font-weight: 800;
              font-size: 11px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            ">
              ${index + 1}
            </div>
          `,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([pt.lat, pt.lng], { icon: vertexIcon });
        drawingLayer.addLayer(marker);
      });
    }
  }, [isDrawingGeofence, drawingPoints]);

  // Update map markers, custom geofences, polyline and agents
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Render all Active Custom Geofences (Polygons & Circles)
    if (showGeofence && customGeofences.length > 0) {
      customGeofences.forEach((geo) => {
        if (!geo.active) return;
        const color = geo.color || '#3b82f6';

        if (geo.coordinates && geo.coordinates.length >= 3) {
          const latLngs: [number, number][] = geo.coordinates.map(p => [p.lat, p.lng]);
          const polygon = L.polygon(latLngs, {
            color,
            fillColor: color,
            fillOpacity: 0.12,
            weight: 2.5,
            dashArray: '6, 4',
          });

          polygon.bindPopup(`
            <div style="font-family: inherit; font-size: 13px; color: #1e293b; padding: 4px; min-width: 190px;">
              <div style="display: flex; items-center; gap: 4px; margin-bottom: 2px;">
                <span style="font-size: 14px;">🛡️</span>
                <b style="color: ${color}; font-size: 13px;">${geo.name}</b>
              </div>
              <div style="font-size: 11px; color: #475569;">Jurisdicción: <b>${geo.zone}</b></div>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                Tipo: Polígono personalizado (${geo.coordinates.length} vértices)
              </div>
              <div style="margin-top: 4px; font-size: 11px; color: #047857; font-weight: 600;">
                ● Agentes asignados: ${geo.assignedAgentIds.length}
              </div>
            </div>
          `);

          if (onSelectGeofence) {
            polygon.on('click', () => onSelectGeofence(geo));
          }

          layerGroup.addLayer(polygon);
        } else if (geo.center && geo.radiusKm) {
          const circle = L.circle([geo.center.lat, geo.center.lng], {
            radius: geo.radiusKm * 1000,
            color,
            fillColor: color,
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '6, 6',
          });

          circle.bindPopup(`
            <div style="font-family: inherit; font-size: 13px; color: #1e293b; padding: 4px;">
              <b style="color: ${color};">🛡️ Geocerca: ${geo.name}</b><br/>
              <span style="font-size: 11px; color: #64748b;">Radio: ${geo.radiusKm} km | Zona: ${geo.zone}</span>
            </div>
          `);
          layerGroup.addLayer(circle);
        }
      });
    }

    // Fallback: If no customGeofences provided but agent has single assignedGeofence
    if (showGeofence && customGeofences.length === 0 && selectedAgent.assignedGeofence) {
      const { center, radiusKm, name } = selectedAgent.assignedGeofence;
      const geofenceCircle = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: '#3b82f6',
        fillColor: '#60a5fa',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '6, 6',
      });
      geofenceCircle.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; color: #1e293b; padding: 4px;">
          <b style="color: #1e40af;">🛡️ Geocerca Oficial Asignada</b><br/>
          <span>${name}</span><br/>
          <small style="color: #64748b;">Radio máximo: ${radiusKm} km</small>
        </div>
      `);
      layerGroup.addLayer(geofenceCircle);
    }

    // 2. Render Route Breadcrumb Polyline for selected agent
    if (selectedAgent.routeHistory.length > 0) {
      const latLngs: [number, number][] = selectedAgent.routeHistory.map(p => [p.lat, p.lng]);
      
      // Add current position to close polyline
      latLngs.push([selectedAgent.currentLocation.lat, selectedAgent.currentLocation.lng]);

      const routePolyline = L.polyline(latLngs, {
        color: '#d97706', // Industrial Latina Amber
        weight: 4,
        opacity: 0.85,
        smoothFactor: 1,
      });
      layerGroup.addLayer(routePolyline);

      // Add smaller waypoint dots along the breadcrumb path
      selectedAgent.routeHistory.forEach((pt, idx) => {
        const dotIcon = L.divIcon({
          className: 'custom-breadcrumb-dot',
          html: `<div style="width: 8px; height: 8px; background-color: #f59e0b; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`,
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        });
        const waypointMarker = L.marker([pt.lat, pt.lng], { icon: dotIcon });
        waypointMarker.bindPopup(`
          <div style="font-size: 12px; color: #1e293b;">
            <b>Punto #${idx + 1} Registrado</b><br/>
            <span>Velocidad: ${Math.round(pt.speed)} km/h</span><br/>
            <small style="color: #64748b;">Hora: ${new Date(pt.timestamp).toLocaleTimeString()}</small>
            ${pt.address ? `<br/><small style="color: #475569;">📍 ${pt.address}</small>` : ''}
          </div>
        `);
        layerGroup.addLayer(waypointMarker);
      });
    }

    // 3. Render Client Visits & Registered Activity Tachuelas
    if (selectedAgent.visits) {
      selectedAgent.visits.forEach((visit, idx) => {
        const isCompleted = visit.status === 'completada' || visit.hasTachuelaPin;
        const isVenta = visit.activityType === 'VENTA';
        const isCobranza = visit.activityType === 'COBRANZA';

        let pinHtml = '';
        let iconSize: [number, number] = [32, 32];
        let iconAnchor: [number, number] = [16, 16];

        if (isCompleted) {
          // TACHUELA PUSHPIN DESIGN (Tachuela de actividad registrada en ruta)
          const tachuelaColor = isVenta ? '#10b981' : isCobranza ? '#8b5cf6' : '#0284c7';
          const symbol = isVenta ? '🛒' : isCobranza ? '💵' : '📌';
          const amountText = isVenta 
            ? `$${(visit.orderAmount || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`
            : isCobranza
            ? `$${(visit.collectedAmount || 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`
            : '';

          pinHtml = `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">
              <!-- Tachuela Head -->
              <div style="
                display: flex;
                align-items: center;
                gap: 3px;
                padding: 3px 6px;
                background-color: ${tachuelaColor};
                border: 2px solid #ffffff;
                border-radius: 12px;
                color: #ffffff;
                font-weight: 800;
                font-size: 10px;
                white-space: nowrap;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
              ">
                <span>${symbol}</span>
                <span>${isVenta ? 'VENTA' : isCobranza ? 'COBRO' : 'VISITA'}</span>
                ${amountText ? `<span style="background: rgba(0,0,0,0.25); padding: 1px 4px; border-radius: 6px;">${amountText}</span>` : ''}
              </div>
              <!-- Tachuela Needle Tip -->
              <div style="
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 8px solid ${tachuelaColor};
                margin-top: -1px;
              "></div>
              ${visit.evidenceUrl ? `
                <div style="
                  position: absolute;
                  top: -6px;
                  right: -6px;
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: #f59e0b;
                  border: 1.5px solid #ffffff;
                  color: #0f172a;
                  font-size: 9px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                ">📸</div>
              ` : ''}
            </div>
          `;
          iconSize = [100, 36];
          iconAnchor = [50, 36];
        } else {
          // Standard visit pin
          let pinColor = '#0284c7'; // pending
          let statusBadge = 'Pendiente';
          if (visit.status === 'en_visita') {
            pinColor = '#f59e0b';
            statusBadge = 'En Atención';
          } else if (visit.status === 'en_camino') {
            pinColor = '#6366f1';
            statusBadge = 'En Camino';
          }

          pinHtml = `
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 30px;
              height: 30px;
              background-color: ${pinColor};
              border: 2px solid #ffffff;
              border-radius: 50%;
              color: #ffffff;
              font-weight: bold;
              font-size: 12px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
            ">
              ${idx + 1}
            </div>
          `;
          iconSize = [30, 30];
          iconAnchor = [15, 15];
        }

        const visitIcon = L.divIcon({
          className: 'custom-visit-tachuela',
          html: pinHtml,
          iconSize,
          iconAnchor,
        });

        const visitMarker = L.marker([visit.lat, visit.lng], { icon: visitIcon });
        visitMarker.bindPopup(`
          <div style="font-family: inherit; font-size: 13px; color: #1e293b; min-width: 220px; max-width: 280px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; border-b: 1px solid #e2e8f0; padding-bottom: 4px;">
              <span style="font-weight: 800; color: #0f2a4a; display: flex; items-center; gap: 4px;">
                ${isCompleted ? '📌 TACHUELA DE ACTIVIDAD' : `Visita #${idx + 1}`}
              </span>
              <span style="font-size: 10px; padding: 1px 6px; background: #e2e8f0; border-radius: 4px; font-weight: 700;">
                ${visit.scheduledTime}
              </span>
            </div>

            <b style="color: #0f172a; font-size: 13px;">${visit.name}</b>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">📍 ${visit.address}</div>

            <!-- Tiempos de Duración y Trayecto -->
            <div style="margin-top: 6px; padding: 4px 6px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 11px; color: #334155;">
              <div>⏱️ <b>Tiempo en Cliente:</b> ${visit.durationMinutes ? `${visit.durationMinutes} min` : (visit.actualArrivalTime ? 'En curso...' : '--')}</div>
              <div>🚗 <b>Tiempo de Trayecto:</b> ${visit.travelMinutesFromPrevious ? `${visit.travelMinutesFromPrevious} min` : '--'}</div>
              <div>🕒 <b>Horario Real:</b> ${visit.actualArrivalTime || '--'} - ${visit.departureTime || '--'}</div>
            </div>

            <!-- Actividad Registrada -->
            ${isCompleted ? `
              <div style="margin-top: 6px; padding: 4px 6px; background: ${isVenta ? '#ecfdf5' : isCobranza ? '#f5f3ff' : '#f0f9ff'}; border-radius: 6px; border: 1px solid ${isVenta ? '#a7f3d0' : isCobranza ? '#ddd6fe' : '#bae6fd'};">
                <div style="font-weight: 800; font-size: 12px; color: ${isVenta ? '#047857' : isCobranza ? '#6d28d9' : '#0284c7'};">
                  ${isVenta ? `🛒 VENTA CONCRETADA: $${(visit.orderAmount || 0).toFixed(2)}` : isCobranza ? `💵 COBRANZA RECAUDADA: $${(visit.collectedAmount || 0).toFixed(2)}` : '📋 VISITA EFECTUADA'}
                </div>
                ${visit.invoiceOrReceiptNumber ? `<div style="font-size: 10px; color: #64748b;">Doc: ${visit.invoiceOrReceiptNumber} | Pago: ${visit.paymentMethod || 'Contado'}</div>` : ''}
              </div>
            ` : ''}

            <!-- Evidencia Fotográfica / Video Thumbnail -->
            ${visit.evidenceUrl ? `
              <div style="margin-top: 6px;">
                <span style="font-size: 10px; font-weight: 700; color: #475569;">📸 EVIDENCIA ADJUNTA:</span>
                <div style="width: 100%; height: 75px; border-radius: 6px; overflow: hidden; margin-top: 2px; border: 1px solid #cbd5e1;">
                  <img src="${visit.evidenceUrl}" alt="Evidencia" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
              </div>
            ` : ''}

            ${visit.notes ? `<div style="margin-top: 5px; font-size: 10px; color: #475569; font-style: italic;">"${visit.notes}"</div>` : ''}
          </div>
        `);

        visitMarker.on('click', () => {
          if (onSelectVisit) onSelectVisit(visit);
        });
        layerGroup.addLayer(visitMarker);
      });
    }

    // 4. Render Active Alerts on the Map
    activeAlerts.forEach((alt) => {
      const alertIcon = L.divIcon({
        className: 'custom-alert-pin',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background-color: #ef4444;
            border: 2px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 16px;
            animation: gps-pulse 1.5s infinite;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
          ">
            ⚠️
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const alertMarker = L.marker([alt.lat, alt.lng], { icon: alertIcon });
      alertMarker.bindPopup(`
        <div style="font-size: 12px; color: #1e293b;">
          <b style="color: #b91c1c;">⚠️ ALERTA: ${alt.type.replace(/_/g, ' ')}</b><br/>
          <span>${alt.description}</span><br/>
          <small style="color: #64748b;">Agente: ${alt.agentName}</small>
        </div>
      `);
      layerGroup.addLayer(alertMarker);
    });

    // 5. Render All Agents or other active agents (faint or distinct)
    allAgents.forEach((ag) => {
      const isSelected = ag.user.id === selectedAgent.user.id;
      const isTruck = ag.user.role === 'TRANSPORTISTA';

      const agentIcon = L.divIcon({
        className: 'custom-agent-marker',
        html: `
          <div style="
            position: relative;
            width: ${isSelected ? '44px' : '36px'};
            height: ${isSelected ? '44px' : '36px'};
          ">
            ${isSelected ? `<div style="
              position: absolute;
              inset: -6px;
              border-radius: 50%;
              background: rgba(217, 119, 6, 0.35);
              animation: gps-pulse 2s infinite;
            "></div>` : ''}
            <div style="
              position: relative;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              border: 3px solid ${isSelected ? '#d97706' : '#0f2a4a'};
              background: #0f2a4a;
              overflow: hidden;
              box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
            ">
              <img src="${ag.user.avatar}" alt="${ag.user.name}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <div style="
              position: absolute;
              bottom: -2px;
              right: -2px;
              width: 14px;
              height: 14px;
              background-color: ${ag.currentStatus === 'inactivo' ? '#94a3b8' : ag.speed > 5 ? '#22c55e' : '#f59e0b'};
              border: 2px solid #ffffff;
              border-radius: 50%;
            "></div>
          </div>
        `,
        iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
        iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
      });

      const agentMarker = L.marker([ag.currentLocation.lat, ag.currentLocation.lng], { icon: agentIcon });
      agentMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; color: #1e293b; min-width: 190px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <img src="${ag.user.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid #cbd5e1;" />
            <div>
              <b style="color: #0f2a4a; font-size: 13px;">${ag.user.name}</b><br/>
              <span style="font-size: 10px; color: #64748b; text-transform: uppercase;">${ag.user.role === 'EJECUTIVO_VENTAS' ? 'Ejecutivo en Ruta' : 'Transportista'}</span>
            </div>
          </div>
          <div style="font-size: 11px; color: #334155; line-height: 1.4;">
            <div>🚗 <b>Vehículo:</b> ${ag.user.assignedVehicle || 'Asignado'}</div>
            <div>⚡ <b>Velocidad actual:</b> ${Math.round(ag.speed)} km/h</div>
            <div>🔋 <b>Batería:</b> ${ag.battery}% | GPS: ${ag.gpsSignal}</div>
            <div>📍 <b>Km hoy:</b> ${ag.todayKm} km</div>
          </div>
        </div>
      `);

      agentMarker.on('click', () => {
        if (onSelectAgent) onSelectAgent(ag.user.id);
      });

      layerGroup.addLayer(agentMarker);
    });

    // Pan smoothly to selected agent location
    map.panTo([selectedAgent.currentLocation.lat, selectedAgent.currentLocation.lng], {
      animate: true,
      duration: 0.6,
    });
  }, [selectedAgent, allAgents, showGeofence, activeAlerts]);

  // Recenter helper
  const handleRecenter = () => {
    if (mapInstanceRef.current && selectedAgent) {
      mapInstanceRef.current.setView(
        [selectedAgent.currentLocation.lat, selectedAgent.currentLocation.lng],
        14,
        { animate: true }
      );
    }
  };

  return (
    <div className={`relative w-full h-full min-h-[360px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700/60 shadow-inner ${
      isDrawingGeofence ? 'cursor-crosshair ring-2 ring-amber-500' : ''
    }`}>
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map HUD Controls */}
      <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2">
        {!isDrawingGeofence ? (
          <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Telemetría en Vivo: <strong className="text-amber-400 font-semibold">{selectedAgent.user.name}</strong></span>
          </div>
        ) : (
          <div className="bg-amber-950/95 backdrop-blur-md px-3.5 py-2 rounded-lg border border-amber-500 text-xs font-semibold text-amber-200 flex items-center gap-2 shadow-xl animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span>MODO DIBUJO ACTIVO: Haz clic en el mapa para marcar vértices ({drawingPoints.length} puntos)</span>
          </div>
        )}

        <button
          onClick={handleRecenter}
          className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-lg active:scale-95"
          title="Centrar en el agente"
          aria-label="Centrar mapa en agente"
        >
          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Centrar</span>
        </button>
      </div>

      {/* Floating Legend */}
      <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-3 shadow-xl hidden sm:flex">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Visita Completada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>En Atención</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-500"></span>
          <span>Ruta Recorrida</span>
        </div>
      </div>
    </div>
  );
};
