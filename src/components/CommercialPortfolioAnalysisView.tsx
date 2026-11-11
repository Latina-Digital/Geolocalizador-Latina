/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulos 1, 2 y 3 Actualizados:
 * - Cartera de Clientes con Opción de Deseleccionar ("🔄 Deseleccionar Cliente / Ver Todos los Clientes" + botón "X")
 *   y Consolidado General de Toda la Cartera cuando no hay cliente individual seleccionado.
 * - CUADRO 1: Historial de Compras 12 Meses (DESC por Valor y Cantidad) con Columna `Subgrupo`, Filtro rápido por `Subgrupo`
 *   y Columna `Último Precio Vendido ($)` (`$XX.XX | DD/Mes/YYYY`).
 * - CUADRO 2: Inteligencia Comercial por `Subgrupo` y Productos Inactivos:
 *   A) Identificación de Productos que ha Dejado de Comprar (Alerta de Inactividad / Fuga > 45, 60 o 90 días)
 *   B) Productos del Mismo Subgrupo que se le Pueden Vender (Expansión de Subgrupo agrupada por `Subgrupo`).
 */

import React, { useState, useMemo } from 'react';
import {
  ALL_PRODUCT_SUBGROUPS,
  ClientAttentionStatus,
  ClientPortfolioRecord,
  InactiveChurnProductAlert,
  ProductBrand,
  ProductOpportunityRecommendation,
  ProductSubgroup,
  SubgroupSuggestedProduct,
  analyzeClientProductOpportunities,
  analyzeSubgroupAndChurnIntelligence,
  buildConsolidatedPortfolioVirtualClient,
  exportClientCommercialAnalysisPdf,
  exportClientPurchases12MCsv,
  rankAndFilterClientPurchases12M,
} from '../services/commercialIntelligenceEngine';
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  MapPin,
  Phone,
  PlusCircle,
  RefreshCw,
  Rocket,
  Search,
  TrendingDown,
  Users,
  X,
} from 'lucide-react';

interface CommercialPortfolioAnalysisViewProps {
  clients: ClientPortfolioRecord[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  committedOpportunities: Record<string, string>;
  onScheduleOpportunityCommitment: (
    client: ClientPortfolioRecord,
    opportunity: ProductOpportunityRecommendation
  ) => void;
  onNavigateToClientOnMap: (client: ClientPortfolioRecord) => void;
}

export const CommercialPortfolioAnalysisView: React.FC<CommercialPortfolioAnalysisViewProps> = ({
  clients,
  selectedClientId,
  onSelectClient,
  committedOpportunities,
  onScheduleOpportunityCommitment,
  onNavigateToClientOnMap,
}) => {
  // Filtros del panel de Cartera de Clientes
  const [clientSearch, setClientSearch] = useState<string>('');
  const [attentionStatusFilter, setAttentionStatusFilter] = useState<'TODOS' | ClientAttentionStatus>('TODOS');

  // Controles de Ordenamiento, Marca y Subgrupo del CUADRO 1 (12 Meses)
  const [sortBy12M, setSortBy12M] = useState<'VALOR_DESC' | 'CANTIDAD_DESC'>('VALOR_DESC');
  const [brandFilter12M, setBrandFilter12M] = useState<'TODOS' | ProductBrand>('TODOS');
  const [subgrupoFilter12M, setSubgrupoFilter12M] = useState<'TODOS' | ProductSubgroup>('TODOS');

  // Pestaña activa del CUADRO 2 (Inteligencia Comercial por Subgrupo y Productos Inactivos)
  const [activeCuadro2Mode, setActiveCuadro2Mode] = useState<
    'AMBOS' | 'INACTIVOS_FUGA' | 'EXPANSION_SUBGRUPO'
  >('AMBOS');
  const [opportunityBrandFilter, setOpportunityBrandFilter] = useState<'TODOS' | ProductBrand>('TODOS');
  const [opportunitySubgrupoFilter, setOpportunitySubgrupoFilter] = useState<'TODOS' | ProductSubgroup>('TODOS');

  // Filtrado en tiempo real de la lista de clientes
  const visibleClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return clients.filter((c) => {
      if (attentionStatusFilter !== 'TODOS' && c.estadoAtencion !== attentionStatusFilter) {
        return false;
      }
      if (q) {
        const hay = `${c.razonSocial} ${c.nombreComercial} ${c.ruc} ${c.codigoLatinaSoft} ${c.ciudad} ${c.sector} ${c.executiveName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clients, clientSearch, attentionStatusFilter]);

  // Determina si hay un cliente individual seleccionado o si estamos en modo "Todos los Clientes" (Consolidado General)
  const selectedIndividualClient: ClientPortfolioRecord | null = useMemo(() => {
    if (!selectedClientId || selectedClientId === 'ALL') return null;
    return (
      visibleClients.find((c) => c.id === selectedClientId) ||
      clients.find((c) => c.id === selectedClientId) ||
      null
    );
  }, [selectedClientId, visibleClients, clients]);

  const isAllClientsConsolidatedMode = !selectedIndividualClient;

  // Registro activo para Cuadro 1 y Cuadro 2: cliente individual o Consolidado General de Toda la Cartera
  const activeClient: ClientPortfolioRecord | null = useMemo(() => {
    if (selectedIndividualClient) return selectedIndividualClient;
    const baseList = visibleClients.length > 0 ? visibleClients : clients;
    if (baseList.length === 0) return null;
    return buildConsolidatedPortfolioVirtualClient(
      baseList,
      'Todos los Clientes de la Cartera Visible'
    );
  }, [selectedIndividualClient, visibleClients, clients]);

  // Toggle al hacer clic sobre un cliente de la lista: si ya está activo, se deselecciona ("ALL")
  const handleToggleClientSelection = (clientId: string) => {
    if (selectedClientId === clientId) {
      onSelectClient('ALL');
    } else {
      onSelectClient(clientId);
    }
  };

  // CUADRO 1: Historial de Compras de los Últimos 12 Meses ordenado estrictamente de MAYOR a MENOR (DESC)
  const rankedPurchases12M = useMemo(() => {
    if (!activeClient) {
      return {
        items: [],
        totals: { totalQuantity: 0, totalSalesUsd: 0, latinaSalesUsd: 0, indulessSalesUsd: 0 },
      };
    }
    return rankAndFilterClientPurchases12M(
      activeClient.purchases12M,
      sortBy12M,
      brandFilter12M,
      subgrupoFilter12M
    );
  }, [activeClient, sortBy12M, brandFilter12M, subgrupoFilter12M]);

  // CUADRO 2: Motor de Inteligencia Comercial por Subgrupo y Productos que ha Dejado de Comprar
  const subgroupIntelligence = useMemo(() => {
    if (!activeClient) {
      return {
        inactiveProducts: [],
        subgroupExpansions: [],
        totalValueAtRiskUsd: 0,
        totalSubgroupExpansionMonthlyUsd: 0,
      };
    }
    return analyzeSubgroupAndChurnIntelligence(activeClient, committedOpportunities);
  }, [activeClient, committedOpportunities]);

  // También mantenemos el arreglo clásico para exportación PDF
  const classicOpportunityAnalysis = useMemo(() => {
    if (!activeClient) {
      return {
        crossSell: [],
        reactivation: [],
        upSell: [],
        all: [],
        totalMonthlyPotentialUsd: 0,
      };
    }
    return analyzeClientProductOpportunities(activeClient, committedOpportunities);
  }, [activeClient, committedOpportunities]);

  // Filtrado de A) Productos que ha Dejado de Comprar
  const filteredInactiveProducts = useMemo(() => {
    return subgroupIntelligence.inactiveProducts.filter((item) => {
      if (opportunityBrandFilter !== 'TODOS' && item.brand !== opportunityBrandFilter) {
        return false;
      }
      if (opportunitySubgrupoFilter !== 'TODOS' && item.subgrupo !== opportunitySubgrupoFilter) {
        return false;
      }
      return true;
    });
  }, [subgroupIntelligence.inactiveProducts, opportunityBrandFilter, opportunitySubgrupoFilter]);

  // Filtrado de B) Expansión de Productos del Mismo Subgrupo
  const filteredSubgroupExpansions = useMemo(() => {
    return subgroupIntelligence.subgroupExpansions
      .filter((grp) =>
        opportunitySubgrupoFilter === 'TODOS' ? true : grp.subgrupo === opportunitySubgrupoFilter
      )
      .map((grp) => ({
        ...grp,
        suggestedSameSubgroupProducts: grp.suggestedSameSubgroupProducts.filter((prod) =>
          opportunityBrandFilter === 'TODOS' ? true : prod.brand === opportunityBrandFilter
        ),
      }))
      .filter((grp) => grp.suggestedSameSubgroupProducts.length > 0);
  }, [subgroupIntelligence.subgroupExpansions, opportunityBrandFilter, opportunitySubgrupoFilter]);

  // Convierte un producto inactivo o sugerencia de subgrupo en ProductOpportunityRecommendation para agendar/cotizar
  const handleCommitInactiveProduct = (item: InactiveChurnProductAlert) => {
    if (!activeClient) return;
    const rec: ProductOpportunityRecommendation = {
      id: item.id,
      clientId: activeClient.id,
      category: 'REACTIVATION',
      sku: item.sku,
      productName: item.productName,
      brand: item.brand,
      productLine: item.productLine,
      subgrupo: item.subgrupo,
      priority: 'ALTA',
      commercialPitch: `Reactivación prioritaria en Subgrupo "${item.subgrupo}": lleva ${item.daysWithoutPurchase} días sin facturar (Último precio: $${item.lastUnitPriceSoldUsd.toFixed(2)} el ${item.lastSaleFormattedDate}). Solía comprar ${item.avgMonthlyQtySold} ${item.unitLabel}/mes.`,
      suggestedGoalQty: item.avgMonthlyQtySold,
      unitLabel: item.unitLabel,
      estimatedMonthlyExtraUsd: item.valueAtRiskUsd,
      inactiveDays: item.daysWithoutPurchase,
      previousAvgMonthlyUsd: item.valueAtRiskUsd,
      referenceUnitPriceUsd: item.lastUnitPriceSoldUsd,
      committedInVisit: item.committedInVisit,
      committedAt: item.committedAt,
    };
    onScheduleOpportunityCommitment(activeClient, rec);
  };

  const handleCommitSubgroupSuggested = (prod: SubgroupSuggestedProduct) => {
    if (!activeClient) return;
    const rec: ProductOpportunityRecommendation = {
      id: prod.id,
      clientId: activeClient.id,
      category: 'CROSS_SELL',
      sku: prod.sku,
      productName: prod.productName,
      brand: prod.brand,
      productLine: prod.productLine,
      subgrupo: prod.subgrupo,
      priority: 'ALTA',
      commercialPitch: prod.commercialArgument,
      suggestedGoalQty: prod.suggestedGoalQty,
      unitLabel: prod.unitLabel,
      estimatedMonthlyExtraUsd: prod.estimatedMonthlyOpportunityUsd,
      referenceUnitPriceUsd: prod.referenceListPriceUsd,
      committedInVisit: prod.committedInVisit,
      committedAt: prod.committedAt,
    };
    onScheduleOpportunityCommitment(activeClient, rec);
  };

  if (!activeClient) {
    return (
      <div className="w-full flex-1 flex items-center justify-center p-8 text-slate-400">
        No existen clientes disponibles en el filtro jerárquico seleccionado.
      </div>
    );
  }

  const creditUsagePercent =
    activeClient.cupoCreditoUsd > 0
      ? Math.min(
          100,
          Math.round(
            ((activeClient.cupoCreditoUsd - activeClient.saldoDisponibleUsd) /
              activeClient.cupoCreditoUsd) *
              100
          )
        )
      : 0;

  return (
    <div className="w-full max-w-full flex-1 min-h-0 flex flex-col gap-3 p-2.5 sm:p-3.5 bg-[#070d1e] text-slate-100 overflow-x-hidden">
      {/* FILA SUPERIOR: SELECTOR DE CARTERA CON OPCIÓN DE DESELECCIONAR + TARJETA EJECUTIVA (100% WIDTH) */}
      <div className="w-full max-w-full grid grid-cols-1 xl:grid-cols-12 gap-3 shrink-0">
        {/* Panel Selector de Cartera de Clientes (5 cols en XL) */}
        <div className="xl:col-span-5 bg-slate-900/95 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                👥 Cartera de Clientes ({visibleClients.length})
              </h2>
            </div>

            {/* Botón Destacado en la Cabecera: "🔄 Deseleccionar Cliente / Ver Todos los Clientes" */}
            <button
              type="button"
              onClick={() => onSelectClient('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                isAllClientsConsolidatedMode
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-md'
              }`}
              title="Deseleccionar el cliente actual y mostrar el Consolidado General de Toda la Cartera"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span>🔄 Deseleccionar Cliente / Ver Todos los Clientes</span>
            </button>
          </div>

          {/* Pastilla de Estado Actual de Selección (con botón rápido "X" si hay un cliente seleccionado) */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/90 border border-slate-800 rounded-lg px-2.5 py-1.5">
            {isAllClientsConsolidatedMode ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Vista Activa: <strong>Todos los Clientes (Consolidado General de Cartera)</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                    Cliente Activo
                  </span>
                  <span className="text-xs font-black text-white truncate">
                    {selectedIndividualClient?.razonSocial}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectClient('ALL')}
                  aria-label="Quitar filtro de cliente seleccionado"
                  className="px-2 py-0.5 rounded bg-red-500/25 hover:bg-red-500/40 border border-red-500/50 text-red-200 text-[11px] font-black inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  title="Quitar selección de cliente (Ver Todos)"
                >
                  <X className="w-3 h-3" />
                  <span>X</span>
                </button>
              </div>
            )}
          </div>

          {/* Buscador y Filtros Rápidos de Estado */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar Razón Social, RUC, Código LatinaSoft, Ciudad..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {(['TODOS', 'ACTIVO', 'EN_RIESGO_FUGA', 'SEGUIMIENTO_COBRO'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setAttentionStatusFilter(st)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    attentionStatusFilter === st
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {st === 'TODOS'
                    ? 'Todos'
                    : st === 'ACTIVO'
                    ? 'Activos'
                    : st === 'EN_RIESGO_FUGA'
                    ? 'Fuga'
                    : 'Cobro'}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de clientes: clic sobre el cliente activo lo DESELECCIONA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
            {visibleClients.map((cli) => {
              const isSelected = selectedIndividualClient?.id === cli.id;
              const cliTotal12M = cli.purchases12M.reduce((s, p) => s + p.totalSalesUsd12M, 0);
              return (
                <button
                  key={cli.id}
                  type="button"
                  onClick={() => handleToggleClientSelection(cli.id)}
                  title={
                    isSelected
                      ? 'Haz clic nuevamente para deseleccionar este cliente y ver Todos los Clientes'
                      : `Seleccionar ${cli.razonSocial}`
                  }
                  className={`text-left p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-950/80 border-slate-800/90 text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5 w-full">
                    <span className="text-xs font-bold truncate">{cli.razonSocial}</span>
                    {isSelected ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black shrink-0 inline-flex items-center gap-0.5">
                        ACTIVO · X
                      </span>
                    ) : (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                          cli.estadoAtencion === 'ACTIVO'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : cli.estadoAtencion === 'EN_RIESGO_FUGA'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {cli.estadoAtencion.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>RUC: {cli.ruc}</span>
                    <strong className="text-emerald-400 font-extrabold">
                      12M: ${cliTotal12M.toLocaleString('en-US')}
                    </strong>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tarjeta Resumen del Cliente Seleccionado o del Consolidado General de Toda la Cartera (7 cols en XL) */}
        <div className="xl:col-span-7 bg-gradient-to-br from-slate-900 via-[#0d1f38] to-slate-900 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase">
                  {activeClient.codigoLatinaSoft}
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[10px] font-bold">
                  {activeClient.categoria}
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  RUC: <strong className="text-slate-100">{activeClient.ruc}</strong>
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white truncate">
                {activeClient.razonSocial}
              </h3>
              <p className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                <span>
                  📍 {activeClient.ciudad} — {activeClient.sector}
                </span>
                <span className="text-slate-600">|</span>
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <Phone className="w-3 h-3 text-emerald-400" />
                  {activeClient.contactoNombre} ({activeClient.contactoTelefono})
                </span>
              </p>
            </div>

            {/* Botones de Acción Rápida */}
            <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onNavigateToClientOnMap(
                    selectedIndividualClient || visibleClients[0] || activeClient
                  )
                }
                className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span>📍 Ver en Google Maps / Iniciar Visita</span>
              </button>
              <span className="text-[10px] text-slate-400 font-semibold text-right">
                Ejecutivo: <strong className="text-amber-300">{activeClient.executiveName}</strong> · Sup:{' '}
                {activeClient.supervisorName}
              </span>
            </div>
          </div>

          {/* Indicadores financieros y de inteligencia comercial del cliente o consolidado */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/90">
            <div className="bg-slate-950/75 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-slate-400 uppercase font-bold">
                {isAllClientsConsolidatedMode ? 'Cupo Consolidado' : 'Cupo de Crédito'}
              </div>
              <div className="text-sm font-black text-white">
                ${activeClient.cupoCreditoUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400">Uso actual: {creditUsagePercent}%</div>
            </div>

            <div className="bg-slate-950/75 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Saldo Disponible</div>
              <div className="text-sm font-black text-emerald-400">
                ${activeClient.saldoDisponibleUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-emerald-300/80">Habilitado para pedidos</div>
            </div>

            <div className="bg-slate-950/75 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-slate-400 uppercase font-bold">
                Valor en Riesgo (Inactivos)
              </div>
              <div className="text-sm font-black text-red-400">
                ${subgroupIntelligence.totalValueAtRiskUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mes
              </div>
              <div className="text-[10px] text-red-300/80">
                {subgroupIntelligence.inactiveProducts.length} SKUs que dejó de comprar
              </div>
            </div>

            <div className="bg-slate-950/75 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-slate-400 uppercase font-bold">
                Expansión Mismo Subgrupo
              </div>
              <div className="text-sm font-black text-sky-400">
                +${subgroupIntelligence.totalSubgroupExpansionMonthlyUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mes
              </div>
              <div className="text-[10px] text-sky-300/80">
                {subgroupIntelligence.subgroupExpansions.length} Subgrupos con potencial
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FILA PRINCIPAL EN GRID FLUIDO 100% (CUADRO 1: HISTORIAL 12M CON SUBGRUPO Y ÚLTIMO PRECIO + CUADRO 2: SUBGRUPO & FUGA) */}
      <div className="w-full max-w-full flex-1 grid grid-cols-1 2xl:grid-cols-12 gap-3 min-h-0">
        {/* =========================================================================
            CUADRO 1: HISTORIAL DE COMPRAS DE LOS ÚLTIMOS 12 MESES (DE MAYOR A MENOR)
            INCLUYE COLUMNA `SUBGRUPO` Y `ÚLTIMO PRECIO VENDIDO ($)`
            ========================================================================= */}
        <section className="2xl:col-span-7 bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-xl min-w-0">
          <div className="flex flex-col gap-2.5">
            {/* Encabezado y Exportaciones PDF/CSV */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                    📊 CUADRO 1 · Historial de Compras Últimos 12 Meses (De Mayor a Menor)
                  </h3>
                  {isAllClientsConsolidatedMode && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-black">
                      CONSOLIDADO GENERAL ({visibleClients.length} CLIENTES)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Incluye <strong className="text-amber-300">Subgrupo Comercial LatinaSoft/SYSPRO</strong> y{' '}
                  <strong className="text-emerald-300">Último Precio Vendido ($) + Fecha</strong>.
                </p>
              </div>

              {/* Botones Exportar PDF y CSV */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    exportClientCommercialAnalysisPdf(
                      activeClient,
                      rankedPurchases12M.items,
                      rankedPurchases12M.totals,
                      classicOpportunityAnalysis.all
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Exportar PDF 12M</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportClientPurchases12MCsv(
                      activeClient,
                      rankedPurchases12M.items,
                      rankedPurchases12M.totals
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Barra de Ordenamiento Interactivo DESC + Filtro Rápido por Subgrupo + Filtro por Marca */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/90 border border-slate-800/90 rounded-lg p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mr-1">
                  <ArrowDownWideNarrow className="w-3.5 h-3.5 text-amber-400" />
                  Ordenar (DESC):
                </span>
                <button
                  type="button"
                  onClick={() => setSortBy12M('VALOR_DESC')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    sortBy12M === 'VALOR_DESC'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  💵 Mayor Valor de Venta ($ USD)
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy12M('CANTIDAD_DESC')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    sortBy12M === 'CANTIDAD_DESC'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
                  }`}
                >
                  📦 Mayor Cantidad Comprada
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro Rápido por Subgrupo en la cabecera del Cuadro 1 */}
                <div className="flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <label htmlFor="cuadro1-subgrupo-select" className="text-[11px] font-bold text-slate-300">
                    Subgrupo:
                  </label>
                  <select
                    id="cuadro1-subgrupo-select"
                    value={subgrupoFilter12M}
                    onChange={(e) =>
                      setSubgrupoFilter12M(e.target.value as 'TODOS' | ProductSubgroup)
                    }
                    className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="TODOS">Todos los Subgrupos ({ALL_PRODUCT_SUBGROUPS.length})</option>
                    {ALL_PRODUCT_SUBGROUPS.map((sg) => (
                      <option key={sg} value={sg}>
                        {sg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Marca */}
                <div className="flex items-center gap-1">
                  {(['TODOS', 'LATINA', 'INDULESS'] as const).map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setBrandFilter12M(brand)}
                      className={`px-2 py-1 rounded-md text-[11px] font-black transition-all cursor-pointer ${
                        brandFilter12M === brand
                          ? brand === 'LATINA'
                            ? 'bg-red-600 text-white shadow'
                            : brand === 'INDULESS'
                            ? 'bg-sky-600 text-white shadow'
                            : 'bg-slate-200 text-slate-950'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabla Responsiva 100% Ancho de Historial 12 Meses con Subgrupo y Último Precio Vendido ($) */}
            <div className="w-full overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-2">Pos.</th>
                    <th className="py-2.5 px-2">Código SKU</th>
                    <th className="py-2.5 px-2">Producto</th>
                    <th className="py-2.5 px-2">Marca</th>
                    <th className="py-2.5 px-2 text-amber-300">Subgrupo</th>
                    <th className="py-2.5 px-2 text-right">Cantidad (12M)</th>
                    <th className="py-2.5 px-2 text-right text-sky-300">Último Precio Vendido ($)</th>
                    <th className="py-2.5 px-2 text-right">Valor Venta ($ 12M)</th>
                    <th className="py-2.5 px-2 text-right">% Part.</th>
                    <th className="py-2.5 px-2">Tendencia 12M</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {rankedPurchases12M.items.map((item) => {
                    const maxMonth = Math.max(...item.monthlyTrendUnits, 1);
                    return (
                      <tr
                        key={item.sku}
                        className={`transition-colors ${
                          item.stoppedBuyingLast60To90Days
                            ? 'bg-red-950/20 hover:bg-red-950/30'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-2.5 px-2 font-black text-amber-400">
                          #{item.rankPosition}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {item.sku}
                        </td>
                        <td className="py-2.5 px-2 min-w-[180px]">
                          <div className="font-bold text-white leading-snug">
                            {item.productName}
                          </div>
                          <div className="text-[10px] text-slate-400">{item.productLine}</div>
                        </td>
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          {item.brand === 'LATINA' ? (
                            <span className="px-2 py-0.5 rounded bg-red-600/25 border border-red-500/60 text-red-200 text-[10px] font-black tracking-wider">
                              LATINA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-sky-600/25 border border-amber-400/60 text-amber-200 text-[10px] font-black tracking-wider">
                              INDULESS
                            </span>
                          )}
                        </td>
                        {/* Columna Obligatoria 1: Subgrupo */}
                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                            {item.subgrupo}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-extrabold text-slate-100 whitespace-nowrap">
                          {item.totalQuantity12M.toLocaleString('en-US')}{' '}
                          <span className="text-[10px] font-normal text-slate-400">
                            {item.unitLabel}
                          </span>
                        </td>
                        {/* Columna Obligatoria 2: Último Precio Vendido ($) + Fecha compacta */}
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                          <div className="font-black text-sky-300 text-xs">
                            ${item.lastUnitPriceSoldUsd.toFixed(2)}{' '}
                            <span className="text-slate-400 font-semibold text-[10px]">
                              | {item.lastSaleFormattedDate}
                            </span>
                          </div>
                          {item.stoppedBuyingLast60To90Days ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-red-400 uppercase">
                              <TrendingDown className="w-2.5 h-2.5" /> {item.daysWithoutPurchase}d sin compra
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400">
                              por{' '}
                              {item.unitLabel === 'Galones'
                                ? 'Galón'
                                : item.unitLabel === 'Unidades'
                                ? 'Unidad'
                                : item.unitLabel.endsWith('s')
                                ? item.unitLabel.slice(0, -1)
                                : item.unitLabel}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right font-black text-emerald-400 whitespace-nowrap">
                          ${item.totalSalesUsd12M.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                          <div className="font-bold text-slate-200">{item.sharePercentage}%</div>
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden ml-auto mt-0.5">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${Math.min(100, item.sharePercentage)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <div
                            className="flex items-end gap-0.5 h-7 w-24"
                            title={`Unidades M1..M12: ${item.monthlyTrendUnits.join(', ')}`}
                          >
                            {item.monthlyTrendUnits.map((val, idx) => {
                              const heightPct =
                                val > 0 ? Math.max(18, Math.round((val / maxMonth) * 100)) : 8;
                              const isLast3 = idx >= 9;
                              return (
                                <div
                                  key={idx}
                                  style={{ height: `${heightPct}%` }}
                                  className={`flex-1 rounded-t ${
                                    val === 0
                                      ? 'bg-red-500/60'
                                      : isLast3
                                      ? 'bg-emerald-400'
                                      : 'bg-sky-400/75'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Fila Inferior de Totales Generales */}
                <tfoot>
                  <tr className="bg-slate-950 border-t-2 border-amber-500/50 font-black text-xs text-white">
                    <td colSpan={5} className="py-3 px-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-amber-400 uppercase">TOTALES GENERALES (12 MESES):</span>
                        <span className="px-2 py-0.5 rounded bg-red-600/20 border border-red-500/40 text-red-300 text-[10px]">
                          LATINA: ${rankedPurchases12M.totals.latinaSalesUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-sky-600/20 border border-amber-400/40 text-amber-200 text-[10px]">
                          INDULESS: ${rankedPurchases12M.totals.indulessSalesUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-amber-300 whitespace-nowrap">
                      {rankedPurchases12M.totals.totalQuantity.toLocaleString('en-US')} unid.
                    </td>
                    <td className="py-3 px-2 text-right text-slate-400 text-[10px] whitespace-nowrap">
                      Precio Unit. Facturado
                    </td>
                    <td className="py-3 px-2 text-right text-emerald-400 text-sm whitespace-nowrap">
                      ${rankedPurchases12M.totals.totalSalesUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-200">100%</td>
                    <td className="py-3 px-2 text-right text-[11px] text-slate-400 whitespace-nowrap">
                      {rankedPurchases12M.items.length} SKUs
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* =========================================================================
            CUADRO 2: INTELIGENCIA COMERCIAL — POTENCIALIZACIÓN LATINA & INDULESS
            A) PRODUCTOS QUE HA DEJADO DE COMPRAR (ALERTA DE INACTIVIDAD / FUGA)
            B) PRODUCTOS DEL MISMO SUBGRUPO QUE SE LE PUEDEN VENDER (EXPANSIÓN DE SUBGRUPO)
            ========================================================================= */}
        <section className="2xl:col-span-5 bg-slate-900/95 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-xl min-w-0">
          <div className="flex flex-col gap-2.5">
            {/* Encabezado */}
            <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-amber-400 shrink-0" />
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                    🚀 Inteligencia Comercial — Potencialización Latina & Induless
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Motor por <strong className="text-amber-300">Subgrupo</strong>: detecta{' '}
                  <strong className="text-red-300">A) Productos que ha Dejado de Comprar</strong> y{' '}
                  <strong className="text-sky-300">B) Productos del Mismo Subgrupo para Venderle Hoy</strong>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-[11px] font-black">
                  Riesgo Fuga: ${subgroupIntelligence.totalValueAtRiskUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mes
                </span>
                <span className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-black">
                  Expansión Subgrupo: +${subgroupIntelligence.totalSubgroupExpansionMonthlyUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mes
                </span>
              </div>
            </div>

            {/* Selector de Vista de Cuadro 2 + Filtros de Subgrupo y Marca */}
            <div className="flex flex-col gap-2 bg-slate-950/90 border border-slate-800 rounded-lg p-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveCuadro2Mode('AMBOS')}
                    className={`px-2.5 py-1 rounded text-[11px] font-black transition-colors cursor-pointer ${
                      activeCuadro2Mode === 'AMBOS'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    Vista Completa (A + B)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCuadro2Mode('INACTIVOS_FUGA')}
                    className={`px-2.5 py-1 rounded text-[11px] font-black transition-colors cursor-pointer ${
                      activeCuadro2Mode === 'INACTIVOS_FUGA'
                        ? 'bg-red-500 text-white'
                        : 'text-red-300 hover:bg-slate-800'
                    }`}
                  >
                    A) Dejó de Comprar ({filteredInactiveProducts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCuadro2Mode('EXPANSION_SUBGRUPO')}
                    className={`px-2.5 py-1 rounded text-[11px] font-black transition-colors cursor-pointer ${
                      activeCuadro2Mode === 'EXPANSION_SUBGRUPO'
                        ? 'bg-sky-500 text-slate-950'
                        : 'text-sky-300 hover:bg-slate-800'
                    }`}
                  >
                    B) Mismo Subgrupo ({filteredSubgroupExpansions.length} Subgrupos)
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {(['TODOS', 'LATINA', 'INDULESS'] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setOpportunityBrandFilter(b)}
                      className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer ${
                        opportunityBrandFilter === b
                          ? 'bg-slate-200 text-slate-950'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro por Subgrupo en Cuadro 2 */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  Filtrar Análisis por Subgrupo:
                </span>
                <select
                  value={opportunitySubgrupoFilter}
                  onChange={(e) =>
                    setOpportunitySubgrupoFilter(e.target.value as 'TODOS' | ProductSubgroup)
                  }
                  className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs font-bold text-sky-300 focus:outline-none focus:border-sky-400 cursor-pointer"
                >
                  <option value="TODOS">Todos los Subgrupos Activos</option>
                  {ALL_PRODUCT_SUBGROUPS.map((sg) => (
                    <option key={sg} value={sg}>
                      {sg}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contenedor Scrollable de Secciones A y B */}
            <div className="flex flex-col gap-3 max-h-[560px] overflow-y-auto pr-1">
              {/* =====================================================================
                  SECCIÓN A: PRODUCTOS QUE HA DEJADO DE COMPRAR (ALERTA DE INACTIVIDAD / FUGA)
                  ===================================================================== */}
              {(activeCuadro2Mode === 'AMBOS' || activeCuadro2Mode === 'INACTIVOS_FUGA') && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-red-950/40 border border-red-500/40 rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-red-200">
                        A) Productos que ha Dejado de Comprar (Alerta de Inactividad / Fuga)
                      </h4>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-500/30 text-red-200">
                      {filteredInactiveProducts.length} detectados (&gt;45/60/90 días)
                    </span>
                  </div>

                  {filteredInactiveProducts.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                      No se registran productos con alerta de inactividad (&gt;45 días) en el filtro actual.
                    </div>
                  ) : (
                    filteredInactiveProducts.map((item) => {
                      const isCommitted = Boolean(item.committedInVisit);
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl bg-red-950/20 border border-red-500/45 flex flex-col gap-2 shadow-md"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-red-500/30 border border-red-400/50 text-red-200 text-[10px] font-black uppercase">
                                ⚠️ {item.daysWithoutPurchase} Días sin Comprar
                              </span>
                              {item.brand === 'LATINA' ? (
                                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black">
                                  LATINA
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-sky-600 border border-amber-400 text-amber-200 text-[10px] font-black">
                                  INDULESS
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                                Subgrupo: {item.subgrupo}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-black text-red-400">
                                Valor en Riesgo: ${item.valueAtRiskUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mes
                              </span>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-black text-white">
                              {item.sku} — {item.productName}
                            </div>
                          </div>

                          {/* Detalle exigido: Última Compra, Días sin Comprar, Último Precio Vendido ($), Promedio Mensual */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950/80 border border-slate-800/90 rounded-lg p-2 text-[11px]">
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase block font-bold">
                                Última Compra
                              </span>
                              <strong className="text-white">{item.lastSaleFormattedDate}</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase block font-bold">
                                Días Inactivo
                              </span>
                              <strong className="text-red-400">{item.daysWithoutPurchase} días</strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase block font-bold">
                                Último Precio Vendido
                              </span>
                              <strong className="text-sky-300">
                                ${item.lastUnitPriceSoldUsd.toFixed(2)}
                              </strong>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase block font-bold">
                                Promedio Habitual
                              </span>
                              <strong className="text-amber-300">
                                {item.avgMonthlyQtySold} {item.unitLabel}/mes
                              </strong>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                            {isCommitted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Incluido en Gestión / Cotización ({item.committedAt})
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                Reactivar con último precio referencial (${item.lastUnitPriceSoldUsd.toFixed(2)})
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCommitInactiveProduct(item)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                isCommitted
                                  ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-200'
                                  : 'bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-400 hover:to-amber-400 text-slate-950 shadow'
                              }`}
                            >
                              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {isCommitted
                                  ? '✓ En Gestión / Cotización'
                                  : '➕ Incluir en Gestión / Cotización'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* =====================================================================
                  SECCIÓN B: PRODUCTOS DEL MISMO SUBGRUPO QUE SE LE PUEDEN VENDER (EXPANSIÓN DE SUBGRUPO)
                  ===================================================================== */}
              {(activeCuadro2Mode === 'AMBOS' || activeCuadro2Mode === 'EXPANSION_SUBGRUPO') && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between bg-sky-950/40 border border-sky-500/40 rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-sky-200">
                        B) Productos del Mismo Subgrupo que se le Pueden Vender (Expansión)
                      </h4>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-sky-500/30 text-sky-200">
                      {filteredSubgroupExpansions.length} Subgrupos
                    </span>
                  </div>

                  {filteredSubgroupExpansions.map((group) => (
                    <div
                      key={group.subgrupo}
                      className="p-3 rounded-xl bg-slate-950/85 border border-sky-500/35 flex flex-col gap-2.5 shadow-md"
                    >
                      {/* Cabecera del Subgrupo */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                            SUBGRUPO
                          </span>
                          <span className="text-xs sm:text-sm font-black text-amber-300">
                            {group.subgrupo}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Línea: {group.productLine}
                        </span>
                      </div>

                      {/* 1. Lo que compra o dejó de comprar en este Subgrupo */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1">
                        <div className="text-[10px] font-black uppercase text-slate-400">
                          1. Lo que compra o dejó de comprar en este Subgrupo:
                        </div>
                        <div className="flex flex-col gap-1">
                          {group.clientCurrentOrPastProducts.map((curr) => (
                            <div
                              key={curr.sku}
                              className="flex flex-wrap items-center justify-between gap-1 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono text-amber-300 font-bold">
                                  {curr.sku}
                                </span>
                                <span className="text-slate-200 font-semibold truncate">
                                  {curr.productName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-sky-300 font-bold">
                                  Últ. Precio: ${curr.lastUnitPriceSoldUsd.toFixed(2)} ({curr.lastSaleFormattedDate})
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                    curr.status === 'DEJO_DE_COMPRAR'
                                      ? 'bg-red-500/25 text-red-300 border border-red-500/40'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  }`}
                                >
                                  {curr.status === 'DEJO_DE_COMPRAR' ? 'DEJÓ DE COMPRAR' : 'ACTIVO'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 2. Productos sugeridos del MISMO Subgrupo para venderle hoy */}
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-black uppercase text-sky-300 flex items-center gap-1">
                          <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            2. Productos sugeridos del MISMO Subgrupo ({group.subgrupo}) para venderle hoy:
                          </span>
                        </div>

                        {group.suggestedSameSubgroupProducts.map((sug) => {
                          const isCommitted = Boolean(sug.committedInVisit);
                          return (
                            <div
                              key={sug.id}
                              className="p-2.5 rounded-lg bg-sky-950/25 border border-sky-500/40 flex flex-col gap-1.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-xs font-black text-white">
                                    {sug.sku}
                                  </span>
                                  {sug.brand === 'LATINA' ? (
                                    <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-black">
                                      LATINA
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-sky-600 border border-amber-400 text-amber-200 text-[10px] font-black">
                                      INDULESS
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                                    Margen Est.: {sug.estimatedMarginPercent}%
                                  </span>
                                </div>
                                <span className="text-xs font-black text-emerald-400">
                                  Oportunidad: +${sug.estimatedMonthlyOpportunityUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}/mes
                                </span>
                              </div>

                              <div className="text-xs font-bold text-white">
                                {sug.productName}
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 bg-slate-950/70 px-2.5 py-1.5 rounded border border-slate-800">
                                <span>
                                  Precio Lista/Ref.:{' '}
                                  <strong className="text-sky-300">
                                    ${sug.referenceListPriceUsd.toFixed(2)}
                                  </strong>{' '}
                                  por {sug.unitLabel.slice(0, -1) || 'unid.'}
                                </span>
                                <span>
                                  Meta Sugerida:{' '}
                                  <strong className="text-amber-300">
                                    {sug.suggestedGoalQty} {sug.unitLabel}/mes
                                  </strong>
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                {isCommitted ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Incluido en Gestión / Cotización ({sug.committedAt})
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">
                                    Mismo Subgrupo: <strong className="text-amber-300">{sug.subgrupo}</strong>
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleCommitSubgroupSuggested(sug)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                    isCommitted
                                      ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-200'
                                      : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md'
                                  }`}
                                >
                                  <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {isCommitted
                                      ? '✓ Incluido en Gestión / Cotización'
                                      : '➕ Incluir en Gestión / Cotización'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
