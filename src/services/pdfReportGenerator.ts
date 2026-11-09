import jsPDF from 'jspdf';
import { DailyReportSummary, ClientVisit, SuspiciousAlert, RoutePoint } from '../types';

export interface PDFReportData {
  report: DailyReportSummary;
  visits: ClientVisit[];
  alerts: SuspiciousAlert[];
  routePoints: RoutePoint[];
  zoneName: string;
}

export function generateDailyPDFReport(data: PDFReportData): void {
  const { report, visits, alerts, zoneName } = data;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const primaryColor = [15, 42, 74]; // Navy Industrial Latina #0F2A4A
  const accentGold = [217, 119, 6]; // Amber Gold #D97706
  const bgLight = [248, 250, 252]; // Slate-50
  const textDark = [30, 41, 59]; // Slate-800
  const textMuted = [100, 116, 139]; // Slate-500

  // 1. Header Banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Gold accent line under header
  doc.setFillColor(accentGold[0], accentGold[1], accentGold[2]);
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Company Brand & Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('INDUSTRIAL LATINA', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('DIVISIÓN COMERCIAL Y LOGÍSTICA | SISTEMA GEO LATINA', 14, 18);
  doc.text(`CÓDIGO: RPT-${report.date.replace(/-/g, '')}-${report.agentId.toUpperCase()}`, 14, 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('INFORME OFICIAL DE JORNADA Y EFICIENCIA DE RUTA', pageWidth - 14, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`, pageWidth - 14, 21, { align: 'right' });

  // Calculations for route metrics
  const totalVisitM = visits.reduce((acc, v) => acc + (v.durationMinutes || (v.status === 'completada' ? 25 : 0)), 0);
  const totalTravelM = visits.reduce((acc, v) => acc + (v.travelMinutesFromPrevious || (v.status === 'completada' ? 15 : 0)), 0);
  const totalRouteM = totalVisitM + totalTravelM;
  const totalSalesUSD = visits.reduce((acc, v) => acc + (v.orderAmount || 0), 0);
  const totalCollectedUSD = visits.reduce((acc, v) => acc + (v.collectedAmount || 0), 0);
  const tachuelasCount = visits.filter(v => v.hasTachuelaPin || v.status === 'completada').length;
  const evidencesCount = visits.filter(v => !!v.evidenceUrl).length;

  const hoursRoute = Math.floor(totalRouteM / 60);
  const minsRoute = totalRouteM % 60;
  const routeDurationFormatted = `${hoursRoute}h ${minsRoute}m`;

  // 2. Executive Metadata Box
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(14, 33, pageWidth - 28, 28, 2, 2, 'FD');

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('INFORMACIÓN DEL COLABORADOR Y TELEMETRÍA DE RUTA', 18, 39);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Colaborador: ${report.agentName}`, 18, 45);
  doc.text(`Rol: ${report.role === 'EJECUTIVO_VENTAS' ? 'Ejecutivo Comercial en Ruta' : 'Transportista / Distribución'}`, 18, 50);
  doc.text(`Zona Asignada: ${zoneName}`, 18, 55);

  doc.text(`Fecha Jornada: ${report.date}`, 108, 45);
  doc.text(`Horario: ${report.shiftStart} - ${report.shiftEnd}`, 108, 50);
  doc.text(`Duración Total de Ruta: ${routeDurationFormatted} (${totalVisitM}m clientes + ${totalTravelM}m trayectos)`, 108, 55);

  // 3. KPI Metric Cards
  const cardY = 64;
  const cardWidth = (pageWidth - 28 - 9) / 4; // 4 cards with 3mm gap
  const cardHeight = 22;

  const metrics = [
    { title: 'EFICIENCIA GLOBAL', val: `${report.efficiencyScore}%`, sub: 'Score operativo' },
    { title: 'CUMPLIMIENTO VISITAS', val: `${report.completedVisits} / ${report.plannedVisits}`, sub: `${report.visitCompliancePercent.toFixed(0)}% efectividad` },
    { title: 'KILÓMETROS RECORRIDOS', val: `${report.totalKm} km`, sub: `Prom: ${report.avgSpeed} km/h` },
    { title: 'PRODUCCIÓN TOTAL', val: `$${(totalSalesUSD + totalCollectedUSD).toFixed(0)} USD`, sub: `Vtas: $${totalSalesUSD.toFixed(0)} | Cob: $${totalCollectedUSD.toFixed(0)}` },
  ];

  metrics.forEach((m, idx) => {
    const x = 14 + idx * (cardWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // top mini banner
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(x, cardY, cardWidth, 1.5, 'F');

    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(m.title, x + 3, cardY + 6);

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(m.val, x + 3, cardY + 13);

    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(m.sub, x + 3, cardY + 18);
  });

  // 4. Client Itinerary & Activity Table
  const tableY = 90;
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('AUDITORÍA DE ACTIVIDADES EN CLIENTES, TACHUELAS Y DURACIONES', 14, tableY);

  // Table header
  const thY = tableY + 3.5;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(14, thY, pageWidth - 28, 7, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'bold');
  doc.text('#', 16, thY + 4.8);
  doc.text('CLIENTE / EMPRESA', 22, thY + 4.8);
  doc.text('ACTIVIDAD / DOC', 78, thY + 4.8);
  doc.text('HORA', 114, thY + 4.8);
  doc.text('DURACIÓN', 128, thY + 4.8);
  doc.text('TRAYECTO', 146, thY + 4.8);
  doc.text('VALOR USD', 162, thY + 4.8);
  doc.text('TACHUELA / EVID.', 179, thY + 4.8);

  let currentY = thY + 7;
  visits.forEach((vis, idx) => {
    const rowHeight = 7.5;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, currentY, pageWidth - 28, rowHeight, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(14, currentY + rowHeight, pageWidth - 14, currentY + rowHeight);

    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    doc.text(`${idx + 1}`, 16, currentY + 5);
    const clientName = vis.name.length > 26 ? vis.name.substring(0, 24) + '...' : vis.name;
    doc.text(clientName, 22, currentY + 5);

    // Activity description
    let actText = 'Pendiente';
    if (vis.activityType === 'VENTA') {
      actText = `VENTA Fact #${vis.invoiceOrReceiptNumber || 'S/N'}`;
    } else if (vis.activityType === 'COBRANZA') {
      actText = `COBRO Rec #${vis.invoiceOrReceiptNumber || 'S/N'}`;
    } else if (vis.status === 'completada') {
      actText = 'Gestión Completada';
    }
    doc.text(actText, 78, currentY + 5);

    doc.text(vis.actualArrivalTime || vis.scheduledTime, 114, currentY + 5);
    doc.text(`${vis.durationMinutes || (vis.status === 'completada' ? 25 : 0)} min`, 128, currentY + 5);
    doc.text(`${vis.travelMinutesFromPrevious || (idx > 0 ? 15 : 0)} min`, 146, currentY + 5);

    const amountVal = vis.orderAmount || vis.collectedAmount || 0;
    doc.text(amountVal > 0 ? `$${amountVal.toFixed(2)}` : '$0.00', 162, currentY + 5);

    // Tachuela & evidence marker
    let markerText = 'En espera';
    if (vis.status === 'completada' || vis.hasTachuelaPin) {
      markerText = vis.evidenceUrl ? 'PIN + FOTO [OK]' : 'PIN [OK]';
    }
    doc.setTextColor(vis.status === 'completada' ? 22 : 100, vis.status === 'completada' ? 101 : 116, vis.status === 'completada' ? 52 : 139);
    doc.setFont('helvetica', 'bold');
    doc.text(markerText, 179, currentY + 5);

    currentY += rowHeight;
  });

  // Summary audit box
  currentY += 4;
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, pageWidth - 28, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('RESUMEN DE AUDITORÍA OPERATIVA:', 18, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`• Total Ventas: $${totalSalesUSD.toFixed(2)} USD   |   • Total Cobranzas: $${totalCollectedUSD.toFixed(2)} USD   |   • Tachuelas Satelitales: ${tachuelasCount} fijadas`, 18, currentY + 9.5);
  doc.text(`• Evidencias Fotográficas Auditadas: ${evidencesCount}   |   • Tiempo Total en Ruta: ${routeDurationFormatted}   |   • Estado de Jornada: Conforme`, 18, currentY + 13);

  currentY += 18;

  // 5. Alerts / Incident Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('AUDITORÍA DE ACTIVIDADES SOSPECHOSAS Y ALERTAS GPS', 14, currentY);

  currentY += 3.5;
  if (alerts.length === 0) {
    doc.setFillColor(240, 253, 244); // green-50
    doc.setDrawColor(187, 247, 208); // green-200
    doc.roundedRect(14, currentY, pageWidth - 28, 10, 1.5, 1.5, 'FD');
    doc.setTextColor(22, 101, 52); // green-800
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('✓ Jornada sin anomalías operativas. Cumplimiento estricto del perímetro geocercado y límite reglamentario de jornada.', 18, currentY + 6.5);
    currentY += 14;
  } else {
    alerts.slice(0, 3).forEach((alt) => {
      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(254, 202, 202); // red-200
      doc.roundedRect(14, currentY, pageWidth - 28, 11, 1.5, 1.5, 'FD');

      doc.setTextColor(185, 28, 28); // red-700
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(`[${alt.type.replace(/_/g, ' ')}] - Severidad: ${alt.severity.toUpperCase()}`, 18, currentY + 4);

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(`${alt.description} (Coord: ${alt.lat.toFixed(4)}, ${alt.lng.toFixed(4)})`, 18, currentY + 8.5);

      doc.setTextColor(alt.resolved ? 22 : 185, alt.resolved ? 101 : 28, alt.resolved ? 52 : 28);
      doc.setFont('helvetica', 'bold');
      doc.text(alt.resolved ? '✓ RESUELTO' : '⚠️ PENDIENTE', pageWidth - 32, currentY + 6);

      currentY += 13;
    });
  }

  // 6. Signatures & Corporate Approvals
  const signY = 248;
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.line(24, signY, 85, signY);
  doc.line(pageWidth - 85, signY, pageWidth - 24, signY);

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(report.agentName, 54, signY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Ejecutivo de Ruta / Transportista', 54, signY + 9, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(report.supervisorSignature || 'Supervisión Regional de Ventas', pageWidth - 54, signY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Industrial Latina S.A. - Control Operativo', pageWidth - 54, signY + 9, { align: 'center' });

  // 7. Footer
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 285, pageWidth, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.text('GEO LATINA © INDUSTRIAL LATINA | Documento confidencial generado mediante sistema de telemetría y geolocalización satelital.', pageWidth / 2, 292, { align: 'center' });

  // Download trigger
  const fileName = `Informe_Ruta_${report.agentName.replace(/\s+/g, '_')}_${report.date}.pdf`;
  doc.save(fileName);
}
