/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 1: Motor de Visualización en Cascada Jerárquica (Roll-Up & Drill-Down)
 * Controla dinámicamente los módulos de Clientes, Ventas, Mapa y Cobranzas según el rol autenticado.
 */

import React from 'react';
import {
  CascadeFilterState,
  ClientPortfolioRecord,
  HierarchyExecutiveOption,
  HierarchySupervisorOption,
  ReceivableInvoiceRecord,
} from '../services/commercialIntelligenceEngine';
import {
  Building2,
  ChevronRight,
  Filter,
  Layers,
  Lock,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

interface HierarchyCascadeBarProps {
  roleName: string;
  hierarchyLevel: 1 | 2 | 3 | 4;
  canSelectSupervisor: boolean;
  canSelectExecutive: boolean;
  availableSupervisors: HierarchySupervisorOption[];
  availableExecutives: HierarchyExecutiveOption[];
  availableClients: ClientPortfolioRecord[];
  effectiveSupervisorId: string;
  effectiveExecutiveId: string;
  effectiveClientId: string;
  filteredClients: ClientPortfolioRecord[];
  filteredInvoices: ReceivableInvoiceRecord[];
  onChangeCascade: (next: CascadeFilterState) => void;
  onResetCascade: () => void;
}

export const HierarchyCascadeBar: React.FC<HierarchyCascadeBarProps> = ({
  roleName,
  hierarchyLevel,
  canSelectSupervisor,
  canSelectExecutive,
  availableSupervisors,
  availableExecutives,
  availableClients,
  effectiveSupervisorId,
  effectiveExecutiveId,
  effectiveClientId,
  filteredClients,
  filteredInvoices,
  onChangeCascade,
  onResetCascade,
}) => {
  // Cálculos consolidados en tiempo real según el nivel de cascada seleccionado (Roll-Up / Drill-Down)
  const totalSales12MUsd = React.useMemo(() => {
    return filteredClients.reduce(
      (sum, client) =>
        sum + client.purchases12M.reduce((cSum, p) => cSum + p.totalSalesUsd12M, 0),
      0
    );
  }, [filteredClients]);

  const totalPendingReceivablesUsd = React.useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + inv.pendingBalanceUsd, 0);
  }, [filteredInvoices]);

  const hierarchyBadgeText = React.useMemo(() => {
    if (hierarchyLevel === 1) return 'NIVEL 1 · CARTERA PROPIA EXCLUSIVA';
    if (hierarchyLevel === 2) return 'NIVEL 2 · CONSOLIDADO DE ZONA Y EQUIPO';
    if (hierarchyLevel === 3) return 'NIVEL 3 · JEFATURA / GERENCIA MULTINIVEL';
    return 'NIVEL 4 · ADMINISTRACIÓN GENERAL MULTINIVEL';
  }, [hierarchyLevel]);

  return (
    <section
      aria-label="Filtro Jerárquico en Cascada"
      className="w-full max-w-full bg-gradient-to-r from-slate-950 via-[#0a192f] to-slate-950 border-b border-slate-800/90 px-3 sm:px-4 py-2.5 shrink-0 shadow-md"
    >
      <div className="w-full max-w-full flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        {/* Identificador de Jerarquía Activa */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-black uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Cascada Jerárquica ERP</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700/80 text-slate-200 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Rol: {roleName}</span>
            <span className="text-slate-500">·</span>
            <span className="text-amber-400 font-extrabold">{hierarchyBadgeText}</span>
          </div>
        </div>

        {/* Selectores en Cascada Multinivel: Nivel 1 (Supervisor/Zona) -> Nivel 2 (Ejecutivo) -> Nivel 3 (Cliente) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 min-w-0">
          {/* NIVEL 1: SUPERVISOR / ZONA */}
          <div className="flex items-center gap-2 bg-slate-900/95 border border-slate-700/80 rounded-lg px-2.5 py-1.5 min-w-0">
            <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Nivel 1 · Supervisor / Zona</span>
                {!canSelectSupervisor && (
                  <span className="inline-flex items-center gap-0.5 text-amber-400">
                    <Lock className="w-2.5 h-2.5" /> Fijo por Rol
                  </span>
                )}
              </div>
              <select
                aria-label="Selector de Supervisor o Zona"
                disabled={!canSelectSupervisor}
                value={effectiveSupervisorId}
                onChange={(e) =>
                  onChangeCascade({
                    supervisorId: e.target.value,
                    executiveId: 'ALL',
                    clientId: 'ALL',
                  })
                }
                className="w-full bg-transparent text-xs font-bold text-white focus:outline-none truncate disabled:opacity-90 cursor-pointer"
              >
                {canSelectSupervisor && (
                  <option value="ALL" className="bg-slate-900 text-white">
                    🌐 Todos los Supervisores / Todas las Zonas ({availableSupervisors.length})
                  </option>
                )}
                {availableSupervisors.map((sup) => (
                  <option key={sup.id} value={sup.id} className="bg-slate-900 text-white">
                    {sup.name} — {sup.zone}
                  </option>
                ))}
              </select>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden md:block shrink-0" />
          </div>

          {/* NIVEL 2: EJECUTIVO DE VENTAS ASIGNADO */}
          <div className="flex items-center gap-2 bg-slate-900/95 border border-slate-700/80 rounded-lg px-2.5 py-1.5 min-w-0">
            <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Nivel 2 · Ejecutivo de Ventas</span>
                {!canSelectExecutive && (
                  <span className="inline-flex items-center gap-0.5 text-amber-400">
                    <Lock className="w-2.5 h-2.5" /> Cartera Propia
                  </span>
                )}
              </div>
              <select
                aria-label="Selector de Ejecutivo de Ventas"
                disabled={!canSelectExecutive}
                value={effectiveExecutiveId}
                onChange={(e) =>
                  onChangeCascade({
                    supervisorId: effectiveSupervisorId,
                    executiveId: e.target.value,
                    clientId: 'ALL',
                  })
                }
                className="w-full bg-transparent text-xs font-bold text-white focus:outline-none truncate disabled:opacity-90 cursor-pointer"
              >
                {canSelectExecutive && (
                  <option value="ALL" className="bg-slate-900 text-white">
                    👥 Todos los Ejecutivos Asignados ({availableExecutives.length})
                  </option>
                )}
                {availableExecutives.map((exec) => (
                  <option key={exec.id} value={exec.id} className="bg-slate-900 text-white">
                    {exec.name} ({exec.roleLabel})
                  </option>
                ))}
              </select>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 hidden md:block shrink-0" />
          </div>

          {/* NIVEL 3: CARTERA DE CLIENTES / DRILL-DOWN INDIVIDUAL */}
          <div className="flex items-center gap-2 bg-slate-900/95 border border-slate-700/80 rounded-lg px-2.5 py-1.5 min-w-0">
            <Users className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Nivel 3 · Cartera de Clientes</span>
                <span className="text-emerald-400">{availableClients.length} en alcance</span>
              </div>
              <select
                aria-label="Selector de Cliente en Cascada"
                value={effectiveClientId}
                onChange={(e) =>
                  onChangeCascade({
                    supervisorId: effectiveSupervisorId,
                    executiveId: effectiveExecutiveId,
                    clientId: e.target.value,
                  })
                }
                className="w-full bg-transparent text-xs font-bold text-white focus:outline-none truncate cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">
                  🏢 Toda la Cartera Filtrada ({availableClients.length} clientes)
                </option>
                {availableClients.map((cli) => (
                  <option key={cli.id} value={cli.id} className="bg-slate-900 text-white">
                    {cli.razonSocial} — RUC: {cli.ruc} ({cli.executiveName})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Consolidado Instantáneo Roll-Up + Botón Restablecer */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Venta 12M:</span>
            <strong className="text-emerald-400 font-black">
              ${totalSales12MUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] flex items-center gap-2">
            <span className="text-slate-400 font-semibold">Por Cobrar:</span>
            <strong className="text-amber-400 font-black">
              ${totalPendingReceivablesUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </strong>
          </div>
          {(effectiveSupervisorId !== 'ALL' ||
            effectiveExecutiveId !== 'ALL' ||
            effectiveClientId !== 'ALL') && (
            <button
              type="button"
              onClick={onResetCascade}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Restablecer filtro en cascada al alcance general de su rol"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Todo mi Alcance</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
