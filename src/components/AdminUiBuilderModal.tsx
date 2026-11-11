/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 6: Estudio de Diseño y Estructura para el Administrador (UI Builder)
 * "🎨 Personalizar Plataforma (Diseño y Estructura)"
 * Exclusivo para rol ADMINISTRADOR / SISTEMAS (Nivel 4).
 * Guarda en localStorage bajo la llave `geolatina_ui_config` y aplica variables CSS (:root) en vivo.
 */

import React, { useState, useEffect } from 'react';
import {
  GeoLatinaUiConfig,
  DashboardBlockId,
  moveBlockInOrder,
} from '../services/uiConfigEngine';
import { canUserAccessTicConfig } from '../services/latinaApiEngine';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import { IndustrialLatinaLogoWall } from './IndustrialLatinaLogoWall';
import {
  Palette,
  Layout,
  X,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Download,
  RotateCcw,
  Upload,
  Sparkles,
} from 'lucide-react';

const BLOCK_LABELS: Record<DashboardBlockId, string> = {
  KPIS_RESUMEN: '📊 Panel de Estadísticas e Indicadores (KPIs Globales)',
  MAPA_Y_OPERACIONES: '🗺️ Mapa Satelital en Tiempo Real y Panel de Rutas/Geocercas',
  ALERTAS_RECIENTES: '🚨 Bloque de Alertas de Ubicación y Telemetría',
  RESUMEN_BITACORA: '📋 Tabla Resumen de Registros de Bitácora Diaria',
};

export const AdminUiBuilderModal: React.FC = () => {
  const {
    user,
    uiConfig,
    isUiBuilderOpen,
    closeUiBuilderModal,
    updateUiConfig,
    resetUiConfigToDefaults,
    recordAuditAction,
  } = useGeoLatinaSystem();

  const [activeTab, setActiveTab] = useState<'marca' | 'estructura'>('marca');
  const [draft, setDraft] = useState<GeoLatinaUiConfig>(uiConfig);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // New custom field inputs
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  useEffect(() => {
    if (isUiBuilderOpen) {
      setDraft(uiConfig);
      setStatusBanner(null);
    }
  }, [isUiBuilderOpen, uiConfig]);

  // Exclusivo para Perfil ADMIN y Usuario XBRIONES
  if (!isUiBuilderOpen || !canUserAccessTicConfig(user)) {
    return null;
  }

  const handleApplyLive = (e: React.FormEvent) => {
    e.preventDefault();
    updateUiConfig(draft);
    recordAuditAction({
      eventType: 'CONFIG_SISTEMA',
      alertState: 'NORMAL',
      detail: `Administrador aplicó cambios en vivo en Estudio de Diseño y Estructura (geolatina_ui_config).`,
    });
    setStatusBanner('Cambios aplicados en vivo (:root CSS y estructura) y guardados en geolatina_ui_config.');
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = String(ev.target?.result || '');
      setDraft({ ...draft, logoUrlOrBase64: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleMoveBlock = (blockId: DashboardBlockId, dir: 'UP' | 'DOWN') => {
    const nextOrder = moveBlockInOrder(draft.dashboardBlocksOrder, blockId, dir);
    setDraft({ ...draft, dashboardBlocksOrder: nextOrder });
  };

  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    const nextField = {
      id: `cf-${Date.now()}`,
      label: newFieldLabel.trim(),
      placeholder: newFieldPlaceholder.trim() || 'Ingrese valor...',
      required: newFieldRequired,
      type: 'text' as const,
    };
    setDraft({
      ...draft,
      customFormFields: [...draft.customFormFields, nextField],
    });
    setNewFieldLabel('');
    setNewFieldPlaceholder('');
    setNewFieldRequired(false);
  };

  const handleRemoveCustomField = (id: string) => {
    setDraft({
      ...draft,
      customFormFields: draft.customFormFields.filter((f) => f.id !== id),
    });
  };

  const handleExportTemplateJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geolatina_ui_template_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusBanner('Plantilla de Diseño (.JSON) exportada correctamente.');
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const handleRestoreDefaults = () => {
    const restored = resetUiConfigToDefaults();
    setDraft(restored);
    setStatusBanner('Diseño y estructura originales restaurados.');
    setTimeout(() => setStatusBanner(null), 3500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-ui-builder-title"
    >
      <div className="geo-modal-fullviewport bg-[#1E293B] border border-slate-700 rounded-2xl w-[96vw] max-w-[96vw] h-[92dvh] max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A2540] px-5 py-4 border-b border-slate-700 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 id="admin-ui-builder-title" className="text-base sm:text-lg font-bold text-white">
                🎨 Personalizar Plataforma (Diseño y Estructura)
              </h2>
              <p className="text-xs text-slate-300">
                Estudio Exclusivo para Rol ADMINISTRADOR · Variables `:root` en vivo y persistencia `geolatina_ui_config`
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeUiBuilderModal}
            aria-label="Cerrar Personalizar Plataforma"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-[#0F172A] px-5 border-b border-slate-800 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('marca')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'marca'
                ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>A. Diseño Visual, Marca y Colores (:root)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('estructura')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'estructura'
                ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layout className="w-4 h-4" />
            <span>B. Estructura, Bloques y Campos Personalizados</span>
          </button>
        </div>

        {statusBanner && (
          <div className="bg-emerald-950/90 border-b border-emerald-700 px-6 py-2.5 text-xs text-emerald-200 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
        )}

        <form onSubmit={handleApplyLive} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB A: DISEÑO VISUAL Y MARCA */}
          {activeTab === 'marca' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ui-app-title" className="block text-xs font-semibold text-slate-200 mb-1">
                    Nombre / Título de la Aplicación
                  </label>
                  <input
                    id="ui-app-title"
                    type="text"
                    value={draft.appTitle}
                    onChange={(e) => setDraft({ ...draft, appTitle: e.target.value })}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label htmlFor="ui-app-subtitle" className="block text-xs font-semibold text-slate-200 mb-1">
                    Subtítulo Corporativo
                  </label>
                  <input
                    id="ui-app-subtitle"
                    type="text"
                    value={draft.appSubtitle}
                    onChange={(e) => setDraft({ ...draft, appSubtitle: e.target.value })}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Logo Oficial INDUSTRIAL LATINA (URL o Carga en Base64 para Login y Cabecera) */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label htmlFor="ui-logo-url" className="block text-xs font-bold text-white">
                      Logo Oficial INDUSTRIAL LATINA — Pantalla de Login y Cabecera (URL o Base64)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Suba o fije la imagen oficial corporativa en Base64/URL. Si está vacío, se muestra el emblema vectorial 3D oficial con su eslogan inalterable.
                    </p>
                  </div>
                  {draft.logoUrlOrBase64 && (
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, logoUrlOrBase64: '' })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      Usar Respaldo Vectorial SVG 3D
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="ui-logo-url"
                    type="text"
                    value={draft.logoUrlOrBase64}
                    onChange={(e) => setDraft({ ...draft, logoUrlOrBase64: e.target.value })}
                    placeholder="https://... o suba la imagen oficial en Base64"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <label className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir Imagen Oficial (Base64)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Vista previa en vivo del muro arquitectónico de Login */}
                <div className="rounded-xl bg-[#1B2A3A] border border-slate-700/80 p-4 flex items-center justify-center overflow-hidden">
                  <IndustrialLatinaLogoWall
                    customLogoUrlOrBase64={draft.logoUrlOrBase64}
                    compact
                  />
                </div>
              </div>

              {/* Paleta de Colores en Vivo (:root) */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-white">
                  Paleta de Colores Corporativa Aplicada en `:root`
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'primaryColor', label: 'Color Primario Corporativo' },
                    { key: 'secondaryColor', label: 'Color Secundario / Dorado' },
                    { key: 'accentRedColor', label: 'Acento / Rojo Corporativo' },
                    { key: 'pageBgColor', label: 'Fondo de Página' },
                    { key: 'cardBgColor', label: 'Fondo de Tarjetas' },
                    { key: 'textColor', label: 'Color de Texto Principal' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-200 truncate">
                          {item.label}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {(draft as any)[item.key]}
                        </div>
                      </div>
                      <input
                        type="color"
                        aria-label={item.label}
                        value={(draft as any)[item.key]}
                        onChange={(e) => setDraft({ ...draft, [item.key]: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer border border-slate-600 bg-transparent shrink-0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Tipografía, Tamaño Base y Radio de Bordes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="ui-font-family" className="block text-xs font-semibold text-slate-200 mb-1">
                    Tipografía del Sistema
                  </label>
                  <select
                    id="ui-font-family"
                    value={draft.fontFamily}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        fontFamily: e.target.value as GeoLatinaUiConfig['fontFamily'],
                      })
                    }
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans (Corporativa)</option>
                    <option value="System Sans">System Neo-Grotesque Sans</option>
                    <option value="JetBrains Mono">JetBrains Mono (Técnica)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ui-font-size" className="block text-xs font-semibold text-slate-200 mb-1">
                    Tamaño Base de Fuente ({draft.baseFontSizePx}px)
                  </label>
                  <input
                    id="ui-font-size"
                    type="range"
                    min={14}
                    max={18}
                    value={draft.baseFontSizePx}
                    onChange={(e) =>
                      setDraft({ ...draft, baseFontSizePx: Number(e.target.value) || 16 })
                    }
                    className="w-full accent-amber-500 mt-2"
                  />
                </div>

                <div>
                  <label htmlFor="ui-border-radius" className="block text-xs font-semibold text-slate-200 mb-1">
                    Estilo de Bordes
                  </label>
                  <select
                    id="ui-border-radius"
                    value={draft.borderRadiusStyle}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        borderRadiusStyle: e.target.value as GeoLatinaUiConfig['borderRadiusStyle'],
                      })
                    }
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="minimal_square">Minimalista Cuadrado (4px)</option>
                    <option value="modern_rounded">Corporativo Redondeado (12px)</option>
                    <option value="pill_soft">Suave Orgánico (20px)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB B: ESTRUCTURA Y DISPOSICIÓN DE LA PLATAFORMA */}
          {activeTab === 'estructura' && (
            <div className="space-y-5">
              {/* Posición de la Navegación */}
              <div>
                <span className="block text-xs font-bold text-white mb-2">
                  Posición de la Navegación Principal
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'TOP_BAR', label: 'Barra Superior Clásica' },
                    { id: 'LEFT_SIDEBAR', label: 'Menú Lateral Izquierdo' },
                    { id: 'RIGHT_SIDEBAR', label: 'Menú Lateral Derecho' },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          navPosition: pos.id as GeoLatinaUiConfig['navPosition'],
                        })
                      }
                      className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        draft.navPosition === pos.id
                          ? 'bg-[#0A2540] border-amber-500 text-amber-400'
                          : 'bg-[#0F172A] border-slate-800 text-slate-300'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reordenar bloques y paneles principales */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-white">
                  Reordenar Bloques Principales de la Pantalla (Subir / Bajar)
                </h4>
                <div className="space-y-2">
                  {draft.dashboardBlocksOrder.map((blockId, idx) => (
                    <div
                      key={blockId}
                      className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs"
                    >
                      <span className="font-semibold text-slate-200">
                        {idx + 1}. {BLOCK_LABELS[blockId] || blockId}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveBlock(blockId, 'UP')}
                          aria-label={`Subir bloque ${blockId}`}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-400"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.dashboardBlocksOrder.length - 1}
                          onClick={() => handleMoveBlock(blockId, 'DOWN')}
                          aria-label={`Bajar bloque ${blockId}`}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-amber-400"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visibilidad de Módulos por Rol */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-amber-400">
                    Módulos Visibles para EJECUTIVO_VENTAS
                  </h4>
                  {[
                    { key: 'showMapTab', label: 'Mostrar Mapa & Tachuelas' },
                    { key: 'showEfficiencyTab', label: 'Mostrar Tablero de Eficiencia' },
                    { key: 'showSosButton', label: 'Habilitar Botón SOS Pánico' },
                    { key: 'showPdfReportButton', label: 'Permitir Exportar Informe PDF' },
                  ].map((m) => (
                    <label
                      key={m.key}
                      className="flex items-center justify-between text-xs text-slate-300 py-1 cursor-pointer"
                    >
                      <span>{m.label}</span>
                      <input
                        type="checkbox"
                        checked={(draft.roleVisibility.EJECUTIVO_VENTAS as any)[m.key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            roleVisibility: {
                              ...draft.roleVisibility,
                              EJECUTIVO_VENTAS: {
                                ...draft.roleVisibility.EJECUTIVO_VENTAS,
                                [m.key]: e.target.checked,
                              },
                            },
                          })
                        }
                        className="rounded border-slate-600 text-amber-500"
                      />
                    </label>
                  ))}
                </div>

                <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-sky-400">
                    Módulos Visibles para SUPERVISOR
                  </h4>
                  {[
                    { key: 'showGeofenceBuilder', label: 'Editor de Geocercas Poligonales' },
                    { key: 'showAuditHistoryButton', label: 'Acceso a Bitácora y Descargas' },
                    { key: 'showGpsFraudBell', label: 'Campana de Alertas Anti-Fraude GPS' },
                    { key: 'showSimulationControls', label: 'Controles de Simulación en Ruta' },
                  ].map((m) => (
                    <label
                      key={m.key}
                      className="flex items-center justify-between text-xs text-slate-300 py-1 cursor-pointer"
                    >
                      <span>{m.label}</span>
                      <input
                        type="checkbox"
                        checked={(draft.roleVisibility.SUPERVISOR as any)[m.key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            roleVisibility: {
                              ...draft.roleVisibility,
                              SUPERVISOR: {
                                ...draft.roleVisibility.SUPERVISOR,
                                [m.key]: e.target.checked,
                              },
                            },
                          })
                        }
                        className="rounded border-slate-600 text-amber-500"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Campos Personalizados en Formularios */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white">
                  Campos Personalizados Adicionales en Formularios de Visita / Tachuela
                </h4>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="Nombre del campo (ej. N° Guía Remisión)"
                    className="flex-1 min-w-[180px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newFieldPlaceholder}
                    onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                    placeholder="Placeholder..."
                    className="flex-1 min-w-[150px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Campo</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {draft.customFormFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{field.label}</span>
                        <span className="text-slate-400 ml-2">({field.placeholder})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(field.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportTemplateJson}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Exportar Plantilla (.JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreDefaults}
                className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/70 text-red-200 border border-red-800/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                <span>Restaurar Diseño Original</span>
              </button>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Aplicar Cambios en Vivo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
