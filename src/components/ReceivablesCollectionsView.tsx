/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 4: Gestión de Cartera — Facturas por Vencer y Seguimiento de Cobros.
 * Acoplado al 100% del viewport y sincronizado con el Filtro Jerárquico en Cascada.
 */

import React, { useState, useMemo } from 'react';
import {
  CollectionManagementStatus,
  ReceivableInvoiceRecord,
  calculateReceivablesKpis,
  classifyInvoiceMaturitySemaphore,
  exportCollectionsStatementPdf,
  sortReceivableInvoices,
} from '../services/commercialIntelligenceEngine';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  BadgeDollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  History,
  PhoneCall,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';

interface ReceivablesCollectionsViewProps {
  invoices: ReceivableInvoiceRecord[];
  scopeLabel: string;
  currentUserName: string;
  currentUserRole: string;
  onRegisterInvoiceFollowUp: (params: {
    invoiceId: string;
    status: CollectionManagementStatus;
    promiseDate: string;
    reminderTime: string;
    receiptNumber: string;
    committedOrPaidAmountUsd: number;
    notes: string;
  }) => void;
}

const COLLECTION_STATUS_OPTIONS: CollectionManagementStatus[] = [
  'Contactado - Promesa de Pago',
  'Abono Parcial Recibido',
  'Pago Total / Transferencia',
  'Pendiente de Retención',
  'En trámite de Nota de Crédito (NC)',
  'Cliente solicita prórroga',
];

export const ReceivablesCollectionsView: React.FC<ReceivablesCollectionsViewProps> = ({
  invoices,
  scopeLabel,
  currentUserName,
  currentUserRole,
  onRegisterInvoiceFollowUp,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DAYS_ASC' | 'BALANCE_DESC'>('DAYS_ASC');
  const [semaphoreFilter, setSemaphoreFilter] = useState<
    'ALL' | 'MORA' | 'CRITICAL_0_5' | 'UPCOMING_6_15' | 'PREVENTIVE_16_PLUS'
  >('ALL');

  // Estado del Modal/Drawer de Seguimiento de Cobro
  const [activeInvoiceIdForModal, setActiveInvoiceIdForModal] = useState<string | null>(null);
  const [followUpStatus, setFollowUpStatus] = useState<CollectionManagementStatus>(
    'Contactado - Promesa de Pago'
  );
  const [promiseDate, setPromiseDate] = useState<string>(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10)
  );
  const [reminderTime, setReminderTime] = useState<string>('10:30');
  const [receiptNumber, setReceiptNumber] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');

  // KPIs de Cartera sobre el alcance actual
  const kpis = useMemo(() => calculateReceivablesKpis(invoices), [invoices]);

  // Filtrado y Ordenamiento de la tabla principal
  const displayedInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = invoices.filter((inv) => {
      if (semaphoreFilter === 'MORA' && inv.daysToMaturity >= 0) return false;
      if (
        semaphoreFilter === 'CRITICAL_0_5' &&
        (inv.daysToMaturity < 0 || inv.daysToMaturity > 5)
      ) {
        return false;
      }
      if (
        semaphoreFilter === 'UPCOMING_6_15' &&
        (inv.daysToMaturity < 6 || inv.daysToMaturity > 15)
      ) {
        return false;
      }
      if (semaphoreFilter === 'PREVENTIVE_16_PLUS' && inv.daysToMaturity < 16) {
        return false;
      }
      if (q) {
        const hay = `${inv.invoiceNumber} ${inv.clientName} ${inv.clientRuc} ${inv.executiveName} ${inv.zoneName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return sortReceivableInvoices(filtered, sortBy);
  }, [invoices, searchQuery, semaphoreFilter, sortBy]);

  const activeModalInvoice = useMemo(
    () => invoices.find((inv) => inv.id === activeInvoiceIdForModal) || null,
    [invoices, activeInvoiceIdForModal]
  );

  const handleOpenFollowUpModal = (inv: ReceivableInvoiceRecord) => {
    setActiveInvoiceIdForModal(inv.id);
    setFollowUpStatus('Contactado - Promesa de Pago');
    setPromiseDate(new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10));
    setReminderTime('10:30');
    setReceiptNumber('');
    setAmountInput(String(inv.pendingBalanceUsd));
    setNotesInput('');
  };

  const handleSubmitFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalInvoice) return;

    const parsedAmount = Number(amountInput) || 0;
    onRegisterInvoiceFollowUp({
      invoiceId: activeModalInvoice.id,
      status: followUpStatus,
      promiseDate,
      reminderTime,
      receiptNumber: receiptNumber.trim() || `GES-${Date.now().toString().slice(-5)}`,
      committedOrPaidAmountUsd: parsedAmount,
      notes:
        notesInput.trim() ||
        `Gestión registrada (${followUpStatus}) por ${currentUserName} con compromiso al ${promiseDate}.`,
    });

    setNotesInput('');
    setReceiptNumber('');
  };

  return (
    <div className="w-full max-w-full flex-1 min-h-0 flex flex-col gap-3 p-2.5 sm:p-3.5 bg-[#070d1e] text-slate-100 overflow-x-hidden">
      {/* =========================================================================
          FILA SUPERIOR DE 5 TARJETAS KPI DE CARTERA (100% ANCHO FLUIDO)
          ========================================================================= */}
      <div
        className="w-full max-w-full grid gap-2.5 shrink-0"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        {/* KPI 1: Total Cartera por Cobrar */}
        <button
          type="button"
          onClick={() => setSemaphoreFilter('ALL')}
          className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
            semaphoreFilter === 'ALL'
              ? 'bg-slate-900 border-amber-500 shadow-lg'
              : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
              1. Total Cartera por Cobrar
            </span>
            <BadgeDollarSign className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            ${kpis.totalPortfolioUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>{kpis.totalInvoicesCount} facturas activas</span>
            <span className="text-amber-400 font-bold">100% Cartera</span>
          </div>
        </button>

        {/* KPI 2: Crítico: Vencen Hoy / En menos de 5 días */}
        <button
          type="button"
          onClick={() => setSemaphoreFilter('CRITICAL_0_5')}
          className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
            semaphoreFilter === 'CRITICAL_0_5'
              ? 'bg-orange-950/40 border-orange-400 shadow-lg'
              : 'bg-slate-900/90 border-orange-500/30 hover:border-orange-500/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-black uppercase tracking-wider text-orange-300">
              2. Crítico: Vencen Hoy / &lt; 5 días
            </span>
            <Clock className="w-4 h-4 text-orange-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-orange-400">
            ${kpis.critical0To5DaysUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-orange-200/80 flex items-center justify-between">
            <span>{kpis.critical0To5DaysCount} facturas urgentes</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-black">
              Prioridad Inmediata
            </span>
          </div>
        </button>

        {/* KPI 3: Próximas a Vencer: 6 a 15 días */}
        <button
          type="button"
          onClick={() => setSemaphoreFilter('UPCOMING_6_15')}
          className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
            semaphoreFilter === 'UPCOMING_6_15'
              ? 'bg-yellow-950/40 border-yellow-400 shadow-lg'
              : 'bg-slate-900/90 border-yellow-500/30 hover:border-yellow-500/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-black uppercase tracking-wider text-yellow-300">
              3. Próximas a Vencer: 6 a 15 días
            </span>
            <Calendar className="w-4 h-4 text-yellow-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-yellow-300">
            ${kpis.upcoming6To15DaysUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-yellow-200/80 flex items-center justify-between">
            <span>{kpis.upcoming6To15DaysCount} facturas</span>
            <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-200 text-[10px] font-black">
              Gestión Próxima
            </span>
          </div>
        </button>

        {/* KPI 4: Preventivo: 16 a 30+ días */}
        <button
          type="button"
          onClick={() => setSemaphoreFilter('PREVENTIVE_16_PLUS')}
          className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
            semaphoreFilter === 'PREVENTIVE_16_PLUS'
              ? 'bg-emerald-950/40 border-emerald-400 shadow-lg'
              : 'bg-slate-900/90 border-emerald-500/30 hover:border-emerald-500/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
              4. Preventivo: 16 a 30+ días
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400">
            ${kpis.preventive16PlusDaysUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-emerald-200/80 flex items-center justify-between">
            <span>{kpis.preventive16PlusDaysCount} facturas</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
              Cartera Corriente
            </span>
          </div>
        </button>

        {/* KPI 5: Cartera Vencida en Mora */}
        <button
          type="button"
          onClick={() => setSemaphoreFilter('MORA')}
          className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
            semaphoreFilter === 'MORA'
              ? 'bg-red-950/50 border-red-500 shadow-lg'
              : 'bg-slate-900/90 border-red-500/40 hover:border-red-500/70'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-black uppercase tracking-wider text-red-300">
              5. Cartera Vencida en Mora
            </span>
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-red-400">
            ${kpis.overdueMoraUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-red-200/90 flex items-center justify-between">
            <span>{kpis.overdueMoraCount} facturas vencidas</span>
            <span className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-black">
              Cobro Inmediato
            </span>
          </div>
        </button>
      </div>

      {/* =========================================================================
          TABLA PRINCIPAL DE FACTURAS Y DÍAS PARA VENCER (100% WIDTH)
          ========================================================================= */}
      <section className="w-full max-w-full flex-1 bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-xl min-h-0">
        {/* Barra de Controles, Búsqueda, Ordenamiento y Exportación PDF */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pb-2 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                💳 Facturas por Vencer y Seguimiento de Cobros ({displayedInvoices.length})
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Semáforo en vivo de días para vencer, saldos pendientes LatinaSoft y bitácora de promesas de pago.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Buscador */}
            <div className="relative min-w-[230px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar N° Factura, Cliente, RUC o Ejecutivo..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Selector de Ordenamiento Interactivo */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
              <span className="text-[10px] font-bold text-slate-400 px-1.5 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-amber-400" />
                Ordenar por:
              </span>
              <button
                type="button"
                onClick={() => setSortBy('DAYS_ASC')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  sortBy === 'DAYS_ASC'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                ⏳ Menor Días para Vencer (Urgentes 1°)
              </button>
              <button
                type="button"
                onClick={() => setSortBy('BALANCE_DESC')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  sortBy === 'BALANCE_DESC'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                💰 Mayor Saldo Pendiente ($)
              </button>
            </div>

            {/* Botón Exportar Estado de Cuenta / Hoja de Ruta de Cobros en PDF */}
            <button
              type="button"
              onClick={() => exportCollectionsStatementPdf(displayedInvoices, kpis, scopeLabel)}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>📄 Exportar Estado de Cuenta / Hoja de Ruta PDF</span>
            </button>
          </div>
        </div>

        {/* Tabla Principal 100% Fluida */}
        <div className="w-full overflow-x-auto rounded-lg border border-slate-800 flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="py-2.5 px-2.5">N° Factura LatinaSoft</th>
                <th className="py-2.5 px-2.5">Cliente / RUC</th>
                <th className="py-2.5 px-2.5">Ejecutivo Asignado</th>
                <th className="py-2.5 px-2.5">Emisión</th>
                <th className="py-2.5 px-2.5">Vencimiento</th>
                <th className="py-2.5 px-2.5 text-center">Plazo</th>
                <th className="py-2.5 px-2.5 text-right">Valor Original</th>
                <th className="py-2.5 px-2.5 text-right">Abonos / NC</th>
                <th className="py-2.5 px-2.5 text-right">Saldo Pendiente</th>
                <th className="py-2.5 px-2.5">Semáforo de Días para Vencer</th>
                <th className="py-2.5 px-2.5">Último Seguimiento</th>
                <th className="py-2.5 px-2.5 text-right">Acción de Cobro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {displayedInvoices.map((inv) => {
                const sem = classifyInvoiceMaturitySemaphore(inv.daysToMaturity);
                const latestFollowUp = inv.followUps[0] || null;

                return (
                  <tr
                    key={inv.id}
                    className={`transition-colors ${
                      sem.level === 'RED_CRITICAL'
                        ? 'bg-red-950/15 hover:bg-red-950/25'
                        : sem.level === 'AMBER_URGENT'
                        ? 'bg-orange-950/10 hover:bg-orange-950/20'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="py-2.5 px-2.5 font-mono font-bold text-amber-300 whitespace-nowrap">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-2.5 px-2.5 min-w-[200px]">
                      <div className="font-bold text-white">{inv.clientName}</div>
                      <div className="text-[10px] text-slate-400">RUC: {inv.clientRuc}</div>
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-200">{inv.executiveName}</div>
                      <div className="text-[10px] text-slate-500">{inv.supervisorName}</div>
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap text-slate-300">
                      {inv.issueDate}
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap font-bold text-white">
                      {inv.dueDate}
                    </td>
                    <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                        {inv.creditTermDays} días
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-slate-300 whitespace-nowrap">
                      ${inv.originalAmountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-sky-300 whitespace-nowrap">
                      ${inv.appliedCreditsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-black text-sm text-white whitespace-nowrap">
                      ${inv.pendingBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-2.5 whitespace-nowrap">
                      {sem.level === 'RED_CRITICAL' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-600/30 border border-red-500 text-red-200 text-[11px] font-black">
                          🔴 {sem.badgeLabel}
                        </span>
                      )}
                      {sem.level === 'AMBER_URGENT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-500/25 border border-orange-400 text-orange-200 text-[11px] font-black">
                          🟠 {sem.badgeLabel}
                        </span>
                      )}
                      {sem.level === 'YELLOW_SOON' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-yellow-500/20 border border-yellow-400/70 text-yellow-200 text-[11px] font-black">
                          🟡 {sem.badgeLabel}
                        </span>
                      )}
                      {sem.level === 'GREEN_PREVENTIVE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 text-[11px] font-black">
                          🟢 {sem.badgeLabel}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 min-w-[200px]">
                      {latestFollowUp ? (
                        <div className="text-[11px]">
                          <div className="font-bold text-amber-300">{latestFollowUp.status}</div>
                          <div className="text-slate-400 truncate max-w-[240px]">
                            Promesa: {latestFollowUp.promiseDate} · {latestFollowUp.notes}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">
                          Sin seguimiento registrado
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenFollowUpModal(inv)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/50 text-emerald-200 font-black text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>📞 Registrar Seguimiento / Gestión de Cobro</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* =========================================================================
          MODAL / DRAWER INTERACTIVO DE SEGUIMIENTO DE COBRO Y BITÁCORA POR FACTURA
          ========================================================================= */}
      {activeModalInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registrar Seguimiento de Cobro"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
        >
          <div className="w-full max-w-4xl max-h-[92dvh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Encabezado Modal */}
            <div className="bg-gradient-to-r from-slate-950 via-[#0a2540] to-slate-950 px-4 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                    📞 Gestión de Cobranza — Factura {activeModalInvoice.invoiceNumber}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Cliente: <strong>{activeModalInvoice.clientName}</strong> (RUC:{' '}
                  {activeModalInvoice.clientRuc}) · Ejecutivo:{' '}
                  <strong className="text-amber-300">{activeModalInvoice.executiveName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveInvoiceIdForModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo Modal: Resumen Financiero + Formulario + Historial Cronológico */}
            <div className="p-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
              {/* Columna Izquierda: Formulario de Nuevo Seguimiento (7 cols) */}
              <form
                onSubmit={handleSubmitFollowUp}
                className="lg:col-span-7 flex flex-col gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5"
              >
                <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-800 text-xs">
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      Valor Original
                    </div>
                    <div className="font-black text-white">
                      ${activeModalInvoice.originalAmountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      Abonos / NC
                    </div>
                    <div className="font-black text-sky-400">
                      ${activeModalInvoice.appliedCreditsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg border border-amber-500/40">
                    <div className="text-[10px] text-amber-300 uppercase font-bold">
                      Saldo Pendiente
                    </div>
                    <div className="font-black text-amber-400 text-sm">
                      ${activeModalInvoice.pendingBalanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                    Estado de Gestión de Cobro
                  </label>
                  <select
                    value={followUpStatus}
                    onChange={(e) =>
                      setFollowUpStatus(e.target.value as CollectionManagementStatus)
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
                  >
                    {COLLECTION_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st} className="bg-slate-900 text-white">
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                      Fecha de Promesa / Recordatorio
                    </label>
                    <input
                      type="date"
                      required
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                      Hora de Alerta Programada
                    </label>
                    <input
                      type="time"
                      required
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                      Monto Comprometido o Abonado ($ USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-emerald-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                      N° Comprobante / Recibo / Retención
                    </label>
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      placeholder="Ej: COMP-SPI-9012 / RET-001-442"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1">
                    Bitácora de Observaciones y Acuerdo con el Cliente
                  </label>
                  <textarea
                    rows={3}
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Detalle el acuerdo de pago, persona contactada en tesorería, banco emisor o motivo de prórroga..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveInvoiceIdForModal(null)}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Guardar Seguimiento y Sincronizar Bitácora</span>
                  </button>
                </div>
              </form>

              {/* Columna Derecha: Historial Cronológico de Seguimientos sobre esta Factura (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-2.5 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <History className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Historial Cronológico ({activeModalInvoice.followUps.length})
                    </h4>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    Sincronizado con GeoAuditLogger
                  </span>
                </div>

                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                  {activeModalInvoice.followUps.length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-8 text-center">
                      No existen gestiones previas registradas para esta factura.
                    </div>
                  ) : (
                    activeModalInvoice.followUps.map((fup) => (
                      <div
                        key={fup.id}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-black text-amber-300">{fup.status}</span>
                          <span className="text-[10px] text-slate-400">{fup.createdAt}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                          <span>
                            Promesa: <strong>{fup.promiseDate}</strong> ({fup.reminderTime})
                          </span>
                          <span>·</span>
                          <span className="text-emerald-400 font-bold">
                            $
                            {fup.committedOrPaidAmountUsd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span>·</span>
                          <span className="font-mono text-[10px] text-sky-300">
                            {fup.receiptNumber}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                          {fup.notes}
                        </p>
                        <div className="text-[10px] text-slate-500 text-right">
                          Registrado por: {fup.registeredBy} ({fup.registeredRole})
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
