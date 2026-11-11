import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_CLIENT_PORTFOLIO,
  INITIAL_RECEIVABLE_INVOICES,
  analyzeClientProductOpportunities,
  analyzeSubgroupAndChurnIntelligence,
  applyInvoiceFollowUpToCollection,
  buildConsolidatedPortfolioVirtualClient,
  calculateReceivablesKpis,
  classifyInvoiceMaturitySemaphore,
  filterInvoicesByCascade,
  filterPortfolioByCascade,
  rankAndFilterClientPurchases12M,
  resolveEffectiveCascadeFilter,
  sortReceivableInvoices,
} from './commercialIntelligenceEngine';

describe('commercialIntelligenceEngine — Motor ERP/CRM en Cascada, 12M DESC, Subgrupo, Último Precio y Cobranzas', () => {
  it('restringe correctamente el Filtro Jerárquico en Cascada según el rol (Nivel 1, Nivel 2, Nivel 3/4)', () => {
    const execCascade = resolveEffectiveCascadeFilter(
      {
        rol: 'EJECUTIVO_VENTAS',
        usuario: 'cvera',
        mappedGeoLatinaUserId: 'agt-1',
      },
      { supervisorId: 'ALL', executiveId: 'ALL', clientId: 'ALL' }
    );
    assert.equal(execCascade.hierarchyLevel, 1);
    assert.equal(execCascade.canSelectSupervisor, false);
    assert.equal(execCascade.canSelectExecutive, false);
    assert.equal(execCascade.effectiveExecutiveId, 'agt-1');

    const supCascade = resolveEffectiveCascadeFilter(
      {
        rol: 'SUPERVISOR',
        usuario: 'mparedes',
        mappedGeoLatinaUserId: 'usr-sup-norte',
      },
      { supervisorId: 'ALL', executiveId: 'agt-2', clientId: 'ALL' }
    );
    assert.equal(supCascade.hierarchyLevel, 2);
    assert.equal(supCascade.canSelectSupervisor, false);
    assert.equal(supCascade.canSelectExecutive, true);
    assert.equal(supCascade.effectiveSupervisorId, 'usr-sup-norte');
    assert.equal(supCascade.effectiveExecutiveId, 'agt-2');

    const adminCascade = resolveEffectiveCascadeFilter(
      {
        rol: 'ADMIN',
        usuario: 'CYAGUACHI',
        mappedGeoLatinaUserId: 'usr-dir',
      },
      { supervisorId: 'ALL', executiveId: 'ALL', clientId: 'ALL' }
    );
    assert.equal(adminCascade.hierarchyLevel, 4);
    assert.equal(adminCascade.canSelectSupervisor, true);
    assert.equal(adminCascade.canSelectExecutive, true);
    assert.equal(adminCascade.effectiveSupervisorId, 'ALL');
  });

  it('construye el Consolidado General de Toda la Cartera cuando no hay cliente individual seleccionado (id: ALL)', () => {
    const consolidated = buildConsolidatedPortfolioVirtualClient(
      INITIAL_CLIENT_PORTFOLIO,
      'Todos los Clientes de la Cartera Visible'
    );
    assert.equal(consolidated.id, 'ALL');
    assert.ok(consolidated.razonSocial.includes('CONSOLIDADO GENERAL'));
    assert.ok(consolidated.purchases12M.length >= 6);
    assert.ok(
      consolidated.cupoCreditoUsd > INITIAL_CLIENT_PORTFOLIO[0].cupoCreditoUsd,
      'Debe sumar el cupo de crédito de todos los clientes visibles'
    );
  });

  it('ordena el Historial de Compras de 12 Meses DESC e incluye Subgrupo y Último Precio Vendido ($)', () => {
    const client = INITIAL_CLIENT_PORTFOLIO[0]; // Ferretería El Tornillo

    // 1. Por Mayor Valor de Venta ($ USD) DESC
    const byValue = rankAndFilterClientPurchases12M(client.purchases12M, 'VALOR_DESC', 'TODOS');
    assert.ok(byValue.items.length >= 4);
    for (let i = 1; i < byValue.items.length; i++) {
      assert.ok(
        byValue.items[i - 1].totalSalesUsd12M >= byValue.items[i].totalSalesUsd12M,
        'Debe estar ordenado de MAYOR a MENOR en Valor USD'
      );
    }
    assert.equal(byValue.items[0].rankPosition, 1);
    assert.ok(byValue.items[0].subgrupo.length > 0, 'Debe incluir la columna Subgrupo');
    assert.ok(
      byValue.items[0].lastUnitPriceSoldUsd > 0,
      'Debe incluir Último Precio Vendido ($) mayor a 0'
    );
    assert.ok(
      byValue.items[0].lastSaleFormattedDate.includes('/'),
      'Debe incluir fecha compacta de última venta (DD/Mes/YYYY)'
    );

    // 2. Por Mayor Cantidad Comprada DESC
    const byQty = rankAndFilterClientPurchases12M(client.purchases12M, 'CANTIDAD_DESC', 'TODOS');
    for (let i = 1; i < byQty.items.length; i++) {
      assert.ok(
        byQty.items[i - 1].totalQuantity12M >= byQty.items[i].totalQuantity12M,
        'Debe estar ordenado de MAYOR a MENOR en Cantidad comprada'
      );
    }

    // 3. Filtro rápido por Subgrupo en Cuadro 1
    const bySubgrupo = rankAndFilterClientPurchases12M(
      client.purchases12M,
      'VALOR_DESC',
      'TODOS',
      'Pinturas Caucho Interior'
    );
    assert.ok(bySubgrupo.items.length > 0);
    assert.ok(bySubgrupo.items.every((item) => item.subgrupo === 'Pinturas Caucho Interior'));
  });

  it('detecta A) Productos que ha Dejado de Comprar (>45/60/90d) y B) Productos hermanos del MISMO Subgrupo', () => {
    const client = INITIAL_CLIENT_PORTFOLIO[0];
    const subIntel = analyzeSubgroupAndChurnIntelligence(client, {});

    assert.ok(
      subIntel.inactiveProducts.length > 0,
      'Debe detectar productos inactivos (>45/60/90 días sin facturar)'
    );
    for (const inact of subIntel.inactiveProducts) {
      assert.ok(inact.daysWithoutPurchase >= 45);
      assert.ok(inact.lastUnitPriceSoldUsd > 0);
      assert.ok(inact.valueAtRiskUsd > 0);
      assert.ok(inact.subgrupo.length > 0);
    }

    assert.ok(
      subIntel.subgroupExpansions.length > 0,
      'Debe recomendar productos hermanos del MISMO Subgrupo que el cliente aún no compra'
    );
    for (const grp of subIntel.subgroupExpansions) {
      assert.ok(grp.suggestedSameSubgroupProducts.length > 0);
      for (const sug of grp.suggestedSameSubgroupProducts) {
        assert.equal(
          sug.subgrupo,
          grp.subgrupo,
          'El producto sugerido debe pertenecer exactamente al mismo Subgrupo'
        );
        assert.ok(sug.referenceListPriceUsd > 0);
      }
    }
  });

  it('genera oportunidades accionables clásicas de Venta Cruzada, Reactivación y Up-Selling', () => {
    const client = INITIAL_CLIENT_PORTFOLIO[0];
    const analysis = analyzeClientProductOpportunities(client, {});

    assert.ok(analysis.crossSell.length > 0);
    assert.ok(analysis.reactivation.length > 0);
    assert.ok(analysis.upSell.length > 0);
    assert.ok(analysis.totalMonthlyPotentialUsd > 0);
  });

  it('clasifica el semáforo de días para vencer, calcula los 5 KPIs de cartera y aplica seguimientos de cobro', () => {
    assert.equal(classifyInvoiceMaturitySemaphore(-5).level, 'RED_CRITICAL');
    assert.equal(classifyInvoiceMaturitySemaphore(0).level, 'RED_CRITICAL');
    assert.equal(classifyInvoiceMaturitySemaphore(4).level, 'AMBER_URGENT');
    assert.equal(classifyInvoiceMaturitySemaphore(10).level, 'YELLOW_SOON');
    assert.equal(classifyInvoiceMaturitySemaphore(22).level, 'GREEN_PREVENTIVE');

    const kpis = calculateReceivablesKpis(INITIAL_RECEIVABLE_INVOICES);
    assert.equal(kpis.totalInvoicesCount, INITIAL_RECEIVABLE_INVOICES.length);
    assert.ok(kpis.overdueMoraUsd > 0);
    assert.ok(kpis.critical0To5DaysUsd > 0);

    const sortedUrgentFirst = sortReceivableInvoices(INITIAL_RECEIVABLE_INVOICES, 'DAYS_ASC');
    assert.ok(sortedUrgentFirst[0].daysToMaturity <= sortedUrgentFirst[1].daysToMaturity);

    const result = applyInvoiceFollowUpToCollection(INITIAL_RECEIVABLE_INVOICES, {
      invoiceId: 'inv-003',
      status: 'Abono Parcial Recibido',
      promiseDate: '2026-11-18',
      reminderTime: '11:00',
      receiptNumber: 'REC-9901',
      committedOrPaidAmountUsd: 2000,
      notes: 'Abono parcial recibido con cheque a fecha.',
      registeredBy: 'Carlos Vera',
      registeredRole: 'VENDEDOR',
    });

    assert.ok(result.targetInvoice);
    assert.equal(result.targetInvoice?.pendingBalanceUsd, 6000);
    assert.equal(result.targetInvoice?.followUps[0].receiptNumber, 'REC-9901');
  });

  it('filtra clientes y facturas según el alcance en cascada seleccionado', () => {
    const northExec1Clients = filterPortfolioByCascade(INITIAL_CLIENT_PORTFOLIO, {
      effectiveSupervisorId: 'usr-sup-norte',
      effectiveExecutiveId: 'agt-1',
      effectiveClientId: 'ALL',
    });
    assert.ok(northExec1Clients.length > 0);
    assert.ok(northExec1Clients.every((c) => c.executiveId === 'agt-1'));

    const southInvoices = filterInvoicesByCascade(INITIAL_RECEIVABLE_INVOICES, {
      effectiveSupervisorId: 'usr-sup-sur',
      effectiveExecutiveId: 'ALL',
      effectiveClientId: 'ALL',
    });
    assert.ok(southInvoices.length > 0);
    assert.ok(southInvoices.every((inv) => inv.supervisorId === 'usr-sup-sur'));
  });
});
