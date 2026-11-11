/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Panel Completo de Configuración del Sistema e Interfaz API (Para el Equipo de Sistemas)
 * Organizado en 4 pestañas:
 * A) Interconexión API LatinaSoft (LatinaWebApi)
 * B) Seguridad, Cabeceras y Red
 * C) Mapeo de Respuesta JSON (Adaptador Flexible para Sistemas)
 * D) Herramientas de Diagnóstico y Respaldo de Configuración
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  LatinaSysConfig,
  PingDiagnosticResult,
  adaptLatinaApiResponse,
  GOOGLE_MAPS_DEFAULT_LIBRARIES,
  buildGoogleMapsScriptUrl,
  saveGoogleMapsApiKeyToSysConfig,
  loadGoogleMapsScriptDynamically,
  canUserAccessTicConfig,
} from '../services/latinaApiEngine';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import {
  Settings,
  Server,
  Shield,
  FileJson,
  Activity,
  X,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  Lock,
  Eye,
  EyeOff,
  Sliders,
  Terminal,
  RefreshCw,
} from 'lucide-react';

type ConfigTabId = 'interconexion' | 'seguridad' | 'mapeo' | 'diagnostico';

export const SystemConfigModal: React.FC = () => {
  const {
    user,
    config,
    isSysConfigOpen,
    closeSysConfigModal,
    updateSysConfig,
    resetSysConfigToDefaults,
    runServerPing,
    lastPingResult,
  } = useGeoLatinaSystem();

  const [activeTab, setActiveTab] = useState<ConfigTabId>('interconexion');
  const [draft, setDraft] = useState<LatinaSysConfig>(config);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGoogleMapsKey, setShowGoogleMapsKey] = useState(true);
  const [showTechPass, setShowTechPass] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [gmapsScriptStatus, setGmapsScriptStatus] = useState<{
    loading: boolean;
    loaded: boolean;
    scriptUrl: string;
    error?: string;
  }>(() => ({
    loading: false,
    loaded: typeof window !== 'undefined' && Boolean((window as any).google?.maps),
    scriptUrl: buildGoogleMapsScriptUrl(config.googleMapsApiKey || '', GOOGLE_MAPS_DEFAULT_LIBRARIES),
  }));

  // Diagnostic ping state
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PingDiagnosticResult | null>(lastPingResult);

  // JSON Mapping live preview tester state
  const [sampleJsonInput, setSampleJsonInput] = useState<string>(() =>
    JSON.stringify(
      {
        estado: true,
        CodUsuario: 'USR-045',
        NombreUsuario: 'Ing. Roberto Alcívar',
        Perfil: 'ADMINISTRADOR',
        ListaPermisos: ['GEOLATINA_TOTAL_CONTROL', 'ADM_CONFIG_SISTEMA', 'ADM_GEOCERCAS_WRITE'],
        TokenSesion: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.LatinaSoftIIS',
        NombreSucursal: 'Matriz Guayaquil - Parque Industrial Latina',
      },
      null,
      2
    )
  );
  const [mappingPreviewResult, setMappingPreviewResult] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Función interna en SystemConfigModal para almacenar 'googleMapsApiKey' en 'geolatina_sys_config'
  // y cargar dinámicamente el script de Google Maps usando 'https://maps.googleapis.com/maps/api/js?key=' + apiKey con las librerías 'geometry,places,marker'
  const storeKeyAndLoadGoogleMapsScript = async (rawApiKey: string) => {
    const apiKey = (rawApiKey || '').trim();
    const updatedConfig: LatinaSysConfig = {
      ...draft,
      googleMapsApiKey: apiKey,
      lastUpdated: new Date().toISOString(),
    };

    try {
      const existingRaw = localStorage.getItem('geolatina_sys_config');
      const existingParsed = existingRaw ? JSON.parse(existingRaw) : {};
      const payloadToStore = {
        ...existingParsed,
        ...updatedConfig,
        googleMapsApiKey: apiKey,
      };
      localStorage.setItem('geolatina_sys_config', JSON.stringify(payloadToStore));
    } catch {
      // Fallback via engine helper
    }

    saveGoogleMapsApiKeyToSysConfig(apiKey);
    setDraft(updatedConfig);
    updateSysConfig(updatedConfig);

    const scriptSrc =
      'https://maps.googleapis.com/maps/api/js?key=' + apiKey + '&libraries=geometry,places,marker';

    if (!apiKey) {
      setGmapsScriptStatus({
        loading: false,
        loaded: false,
        scriptUrl: scriptSrc,
        error: 'Ingrese una Google Maps API Key válida.',
      });
      return { loaded: false, scriptUrl: scriptSrc };
    }

    setGmapsScriptStatus({
      loading: true,
      loaded: false,
      scriptUrl: scriptSrc,
    });

    if (typeof document !== 'undefined') {
      const existingEl = document.querySelector(
        'script[src*="maps.googleapis.com/maps/api/js"]'
      ) as HTMLScriptElement | null;

      if (!existingEl) {
        const script = document.createElement('script');
        script.id = 'geolatina-google-maps-sdk';
        script.type = 'text/javascript';
        script.src =
          'https://maps.googleapis.com/maps/api/js?key=' +
          apiKey +
          '&libraries=geometry,places,marker';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    const result = await loadGoogleMapsScriptDynamically(apiKey, 'geometry,places,marker');
    setGmapsScriptStatus({
      loading: false,
      loaded: result.loaded,
      scriptUrl: result.scriptUrl,
      error: result.error,
    });
    return result;
  };

  // Al iniciar o cuando cambia googleMapsApiKey en geolatina_sys_config, cargar dinámicamente el script de Google Maps
  useEffect(() => {
    let savedKey = (config.googleMapsApiKey || '').trim();
    try {
      const raw = localStorage.getItem('geolatina_sys_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.googleMapsApiKey) {
          savedKey = String(parsed.googleMapsApiKey).trim();
        }
      }
    } catch {
      // ignore
    }

    if (!savedKey) return;
    let active = true;
    const apiKey = savedKey;
    const scriptUrl =
      'https://maps.googleapis.com/maps/api/js?key=' + apiKey + '&libraries=geometry,places,marker';

    setGmapsScriptStatus((prev) => ({
      ...prev,
      loading: true,
      scriptUrl,
    }));

    loadGoogleMapsScriptDynamically(apiKey, 'geometry,places,marker').then((res) => {
      if (!active) return;
      setGmapsScriptStatus({
        loading: false,
        loaded: res.loaded,
        scriptUrl: res.scriptUrl,
        error: res.error,
      });
    });
    return () => {
      active = false;
    };
  }, [config.googleMapsApiKey]);

  useEffect(() => {
    if (isSysConfigOpen) {
      setDraft(config);
      setPingResult(lastPingResult);
      setSaveBanner(null);
    }
  }, [isSysConfigOpen, config, lastPingResult]);

  if (!isSysConfigOpen || !canUserAccessTicConfig(user)) return null;

  const handleSaveAndLoadGoogleMapsScript = async (customKey?: string) => {
    const cleanKey = (customKey !== undefined ? customKey : draft.googleMapsApiKey || '').trim();
    const result = await storeKeyAndLoadGoogleMapsScript(cleanKey);

    setSaveBanner(
      result.loaded
        ? 'googleMapsApiKey almacenada en geolatina_sys_config y script de Google Maps (geometry,places,marker) cargado dinámicamente.'
        : `googleMapsApiKey almacenada en geolatina_sys_config. ${result.error || ''}`
    );
    setTimeout(() => setSaveBanner(null), 4500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = (draft.googleMapsApiKey || '').trim();
    await storeKeyAndLoadGoogleMapsScript(cleanKey);

    setSaveBanner(
      'Configuración y googleMapsApiKey guardadas en localStorage (geolatina_sys_config) y script de Google Maps sincronizado.'
    );
    setTimeout(() => setSaveBanner(null), 4000);
  };

  const handlePingNow = async () => {
    setIsPinging(true);
    try {
      const res = await runServerPing(draft);
      setPingResult(res);
    } finally {
      setIsPinging(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(draft, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `geolatina_sys_config_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSaveBanner('Archivo de respaldo .JSON exportado correctamente.');
    setTimeout(() => setSaveBanner(null), 3500);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '{}'));
        if (parsed && typeof parsed === 'object' && parsed.baseUrl) {
          const merged: LatinaSysConfig = {
            ...draft,
            ...parsed,
            jsonMapping: {
              ...draft.jsonMapping,
              ...(parsed.jsonMapping || {}),
            },
          };
          setDraft(merged);
          updateSysConfig(merged);
          setSaveBanner('Configuración importada desde archivo .JSON y aplicada exitosamente.');
        } else {
          setSaveBanner('Error: El archivo JSON no contiene una estructura válida de geolatina_sys_config.');
        }
      } catch {
        setSaveBanner('Error al leer el archivo .JSON. Verifique que tenga formato JSON válido.');
      }
      setTimeout(() => setSaveBanner(null), 4500);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRestoreDefaults = () => {
    const restored = resetSysConfigToDefaults();
    setDraft(restored);
    setSaveBanner('Valores por defecto de fábrica restaurados en geolatina_sys_config.');
    setTimeout(() => setSaveBanner(null), 4000);
  };

  const handleTestJsonAdapter = () => {
    try {
      const raw = JSON.parse(sampleJsonInput);
      const adapted = adaptLatinaApiResponse(raw, draft, 'usuario.prueba', draft.defaultSucursal);
      if (adapted) {
        setMappingPreviewResult(JSON.stringify(adapted, null, 2));
      } else {
        setMappingPreviewResult(
          '⚠️ El adaptador devolvió NULL: Verifique que el campo de éxito (' +
            draft.jsonMapping.successField +
            ') tenga valor true / 1 / "ok" en el JSON.'
        );
      }
    } catch (err: any) {
      setMappingPreviewResult(`❌ Error de sintaxis JSON: ${err?.message || 'JSON inválido'}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sys-config-modal-title"
    >
      <div className="geo-modal-fullviewport bg-[#1E293B] border border-slate-700/90 rounded-2xl w-[96vw] max-w-[96vw] h-[92dvh] max-h-[92dvh] shadow-2xl overflow-hidden flex flex-col">
        {/* Corporate Modal Header */}
        <div className="bg-[#0A2540] px-6 py-4 border-b border-slate-700/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="sys-config-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Configuración de Conexiones — Área de TIC
                </h2>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-bold">
                  EXCLUSIVO PERFIL ADMIN · USUARIO XBRIONES
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Interconexión Syspro API (`POST /api/syspro/users`), Google Maps API Key y persistencia `geolatina_sys_config` · Operador: <strong className="text-amber-300">{user?.usuario} ({user?.rol})</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeSysConfigModal}
            aria-label="Cerrar Configuración de Sistema"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Navigation Tabs */}
        <div className="bg-[#0F172A] px-4 sm:px-6 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('interconexion')}
            className={`px-3 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'interconexion'
                ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5 shrink-0" />
            <span>A. Interconexión API</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('seguridad')}
            className={`px-3 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'seguridad'
                ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>B. Seguridad y Red</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mapeo')}
            className={`px-3 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'mapeo'
                ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileJson className="w-3.5 h-3.5 shrink-0" />
            <span>C. Mapeo JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostico')}
            className={`px-3 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'diagnostico'
                ? 'border-amber-500 text-amber-400 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>D. Diagnóstico y Respaldo</span>
          </button>
        </div>

        {/* Save confirmation banner */}
        {saveBanner && (
          <div className="bg-emerald-950/90 border-b border-emerald-700/60 px-6 py-2.5 flex items-center gap-2 text-xs text-emerald-200 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveBanner}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB A: INTERCONEXIÓN API LATINASOFT */}
          {activeTab === 'interconexion' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/70">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    A. Interconexión con Servidor IIS (`LatinaWebApi`)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Defina la URL base del servidor IIS corporativo y los endpoints de procedimientos almacenados / controladores.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Llave: geolatina_sys_config
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="cfg-base-url" className="block text-xs font-semibold text-slate-200 mb-1.5">
                    URL Base del Servidor API (IIS LatinaWebApi)
                  </label>
                  <input
                    id="cfg-base-url"
                    type="text"
                    value={draft.baseUrl}
                    onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                    placeholder="https://servidor-iis.industriallatina.com/LatinaWebApi"
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Ejemplo: https://servidor-iis.industriallatina.com/LatinaWebApi o http://192.168.10.15/LatinaWebApi
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="cfg-auth-endpoint" className="text-xs font-semibold text-slate-200">
                        Endpoint de Autenticación de Usuarios
                      </label>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, authEndpoint: '/api/Seguridad/spConsultaUsuario' })}
                          className="text-amber-400 hover:underline"
                        >
                          spConsultaUsuario
                        </button>
                        <span className="text-slate-600">·</span>
                        <button
                          type="button"
                          onClick={() => setDraft({ ...draft, authEndpoint: '/api/Usuarios/Login' })}
                          className="text-amber-400 hover:underline"
                        >
                          /api/Usuarios/Login
                        </button>
                      </div>
                    </div>
                    <input
                      id="cfg-auth-endpoint"
                      type="text"
                      value={draft.authEndpoint}
                      onChange={(e) => setDraft({ ...draft, authEndpoint: e.target.value })}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="cfg-perm-endpoint" className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Endpoint de Permisos y Roles (`AdmUser` / `AdmRelacionPermisoUsuario`)
                    </label>
                    <input
                      id="cfg-perm-endpoint"
                      type="text"
                      value={draft.permissionsEndpoint}
                      onChange={(e) => setDraft({ ...draft, permissionsEndpoint: e.target.value })}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cfg-sync-endpoint" className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Endpoint de Sincronización de Datos / Parámetros GEOLATINA
                    </label>
                    <input
                      id="cfg-sync-endpoint"
                      type="text"
                      value={draft.syncEndpoint}
                      onChange={(e) => setDraft({ ...draft, syncEndpoint: e.target.value })}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="cfg-default-sucursal" className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Sucursal / Planta Operativa por Defecto
                    </label>
                    <input
                      id="cfg-default-sucursal"
                      type="text"
                      value={draft.defaultSucursal}
                      onChange={(e) => setDraft({ ...draft, defaultSucursal: e.target.value })}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cfg-audit-endpoint" className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Endpoint de Bitácora Diaria (`GeoAuditLogger`)
                    </label>
                    <input
                      id="cfg-audit-endpoint"
                      type="text"
                      value={draft.auditLogEndpoint || '/api/GeoLatina/BitacoraDiaria'}
                      onChange={(e) => setDraft({ ...draft, auditLogEndpoint: e.target.value })}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="cfg-gps-alerts-endpoint" className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Endpoint de Alertas Anti-Fraude GPS (`GeoIntegrityGuard`)
                    </label>
                    <input
                      id="cfg-gps-alerts-endpoint"
                      type="text"
                      value={draft.gpsAlertsEndpoint || '/api/GeoLatina/AlertasFraudeGps'}
                      onChange={(e) => setDraft({ ...draft, gpsAlertsEndpoint: e.target.value })}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label htmlFor="cfg-http-method" className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Método HTTP para Login
                    </label>
                    <select
                      id="cfg-http-method"
                      value={draft.httpMethod}
                      onChange={(e) => setDraft({ ...draft, httpMethod: e.target.value as 'POST' | 'GET' })}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="POST">POST (Recomendado para credenciales en Body)</option>
                      <option value="GET">GET (Consulta por parámetros QueryString)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="cfg-payload-format" className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Formato de Envío de Datos
                    </label>
                    <select
                      id="cfg-payload-format"
                      value={draft.payloadFormat}
                      onChange={(e) =>
                        setDraft({ ...draft, payloadFormat: e.target.value as 'JSON' | 'FORM_URLENCODED' })
                      }
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="JSON">JSON (application/json)</option>
                      <option value="FORM_URLENCODED">Form URL-Encoded (application/x-www-form-urlencoded)</option>
                    </select>
                  </div>
                </div>

                {/* Google Maps API Key (Producción) & Cargador Dinámico de Script */}
                <div className="mt-2 pt-4 border-t border-slate-700/80 bg-[#0F172A]/90 p-4 rounded-xl border border-amber-500/40 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="cfg-gmaps-key" className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span>🗺️ Google Maps API Key (Producción)</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/60">
                        geolatina_sys_config.googleMapsApiKey
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          gmapsScriptStatus.loaded
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                            : gmapsScriptStatus.loading
                            ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400'
                        }`}
                      >
                        {gmapsScriptStatus.loading
                          ? '⏳ Cargando SDK...'
                          : gmapsScriptStatus.loaded
                          ? '✓ SDK Activo (geometry,places,marker)'
                          : 'SDK Pendiente'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <input
                        id="cfg-gmaps-key"
                        type={showGoogleMapsKey ? 'text' : 'password'}
                        value={draft.googleMapsApiKey || ''}
                        onChange={(e) => setDraft({ ...draft, googleMapsApiKey: e.target.value })}
                        placeholder="AIzaSy... (Google Maps Platform JavaScript API Key)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3.5 pr-9 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGoogleMapsKey(!showGoogleMapsKey)}
                        aria-label={showGoogleMapsKey ? 'Ocultar Google Maps API Key' : 'Mostrar Google Maps API Key'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showGoogleMapsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveAndLoadGoogleMapsScript(draft.googleMapsApiKey)}
                      className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap transition-colors shadow cursor-pointer"
                    >
                      Guardar y Cargar Script JS
                    </button>
                  </div>

                  <div className="bg-slate-950/90 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-[10px] text-slate-300 break-all">
                    <span className="text-slate-500">Script dinámico: </span>
                    <span className="text-amber-300">
                      {'https://maps.googleapis.com/maps/api/js?key=' +
                        (draft.googleMapsApiKey ? draft.googleMapsApiKey.trim() : 'TU_API_KEY') +
                        '&libraries=geometry,places,marker'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Almacena <code className="text-amber-300">googleMapsApiKey</code> en{' '}
                    <code className="text-amber-300">geolatina_sys_config</code> y carga dinámicamente el SDK oficial con las librerías{' '}
                    <code className="text-emerald-300">geometry,places,marker</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB B: SEGURIDAD, CABECERAS Y RED */}
          {activeTab === 'seguridad' && (
            <div className="space-y-5">
              <div className="pb-3 border-b border-slate-700/70">
                <h3 className="text-sm font-bold text-white">
                  B. Seguridad, Cabeceras de Autorización y Modo de Operación
                </h3>
                <p className="text-xs text-slate-400">
                  Configure tokens de aplicación, tiempos de espera (`AbortController`), vigencia de sesión y contingencia híbrida.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cfg-header-type" className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Esquema de Cabecera de Seguridad
                  </label>
                  <select
                    id="cfg-header-type"
                    value={draft.authHeaderType}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        authHeaderType: e.target.value as LatinaSysConfig['authHeaderType'],
                      })
                    }
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="X-Latina-ApiKey">Cabecera Corporativa (X-Latina-ApiKey)</option>
                    <option value="Authorization-Bearer">Estándar JWT (Authorization: Bearer)</option>
                    <option value="Both">Ambas Cabeceras (X-Latina-ApiKey + Authorization: Bearer)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="cfg-api-key" className="block text-xs font-semibold text-slate-200 mb-1.5">
                    API Key o Token de Aplicación (`LatinaWebApi`)
                  </label>
                  <div className="relative">
                    <input
                      id="cfg-api-key"
                      type={showApiKey ? 'text' : 'password'}
                      value={draft.apiKey}
                      onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-lg pl-3.5 pr-10 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      aria-label={showApiKey ? 'Ocultar API Key' : 'Mostrar API Key'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cfg-timeout" className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Tiempo Máximo de Espera / Timeout (ms)
                  </label>
                  <input
                    id="cfg-timeout"
                    type="number"
                    min={1000}
                    max={60000}
                    step={500}
                    value={draft.timeoutMs}
                    onChange={(e) => setDraft({ ...draft, timeoutMs: Number(e.target.value) || 10000 })}
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white font-mono tabular-nums focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Por defecto: 10000 ms (10 segundos) controlados vía AbortController.
                  </p>
                </div>

                <div>
                  <label htmlFor="cfg-session-exp" className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Tiempo de Expiración de Sesión (Horas)
                  </label>
                  <input
                    id="cfg-session-exp"
                    type="number"
                    min={1}
                    max={72}
                    value={draft.sessionExpirationHours}
                    onChange={(e) =>
                      setDraft({ ...draft, sessionExpirationHours: Number(e.target.value) || 8 })
                    }
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white font-mono tabular-nums focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Por defecto: 8 horas (jornada laboral estándar de Industrial Latina).
                  </p>
                </div>
              </div>

              {/* Selector de Modo de Operación */}
              <div className="pt-2">
                <span className="block text-xs font-semibold text-slate-200 mb-2">
                  Modo de Operación del Sistema
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, operationMode: 'PRODUCTION_LIVE' })}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      draft.operationMode === 'PRODUCTION_LIVE'
                        ? 'bg-[#0A2540] border-amber-500 text-white'
                        : 'bg-[#0F172A] border-slate-700/80 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">
                        1. Producción (API LatinaSoft en Vivo)
                      </span>
                      {draft.operationMode === 'PRODUCTION_LIVE' && (
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Exige validación HTTP en tiempo real contra el servidor IIS corporativo.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, operationMode: 'HYBRID_CONTINGENCY' })}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      draft.operationMode === 'HYBRID_CONTINGENCY'
                        ? 'bg-[#0A2540] border-amber-500 text-white'
                        : 'bg-[#0F172A] border-slate-700/80 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">
                        2. Híbrido / Contingencia (Alta Disponibilidad)
                      </span>
                      {draft.operationMode === 'HYBRID_CONTINGENCY' && (
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Intenta validar contra IIS y, ante corte de red/VPN, permite acceso local autorizado sin detener rutas.
                    </p>
                  </button>
                </div>
              </div>

              {/* Credencial Técnica de Sistemas */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Credencial Técnica de Configuración Inicial (Equipo de Sistemas)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Permite al departamento de Sistemas ingresar a configurar la interfaz aunque el servidor IIS aún no esté en línea.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={draft.enableTechCredentials}
                      onChange={(e) => setDraft({ ...draft, enableTechCredentials: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                    />
                    <span>Habilitada</span>
                  </label>
                </div>

                {draft.enableTechCredentials && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label htmlFor="cfg-tech-user" className="block text-[11px] font-medium text-slate-300 mb-1">
                        Usuario Técnico Sistemas
                      </label>
                      <input
                        id="cfg-tech-user"
                        type="text"
                        value={draft.techUsername}
                        onChange={(e) => setDraft({ ...draft, techUsername: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="cfg-tech-pass" className="block text-[11px] font-medium text-slate-300 mb-1">
                        Clave Técnica Sistemas
                      </label>
                      <div className="relative">
                        <input
                          id="cfg-tech-pass"
                          type={showTechPass ? 'text' : 'password'}
                          value={draft.techPassword}
                          onChange={(e) => setDraft({ ...draft, techPassword: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-9 py-1.5 text-xs text-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTechPass(!showTechPass)}
                          aria-label="Mostrar u ocultar clave técnica"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showTechPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB C: MAPEO DE RESPUESTA JSON */}
          {activeTab === 'mapeo' && (
            <div className="space-y-5">
              <div className="pb-3 border-b border-slate-700/70">
                <h3 className="text-sm font-bold text-white">
                  C. Mapeo de Respuesta JSON (Adaptador Flexible para Sistemas)
                </h3>
                <p className="text-xs text-slate-400">
                  Adapte los nombres de las propiedades devueltas por `LatinaWebApi` sin modificar el código fuente de GEOLATINA.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="map-success" className="block text-xs font-semibold text-slate-200 mb-1">
                    Campo de Éxito / Estado
                  </label>
                  <input
                    id="map-success"
                    type="text"
                    value={draft.jsonMapping.successField}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        jsonMapping: { ...draft.jsonMapping, successField: e.target.value },
                      })
                    }
                    placeholder="success o estado"
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400">Ej: estado, success, ok</span>
                </div>

                <div>
                  <label htmlFor="map-fullname" className="block text-xs font-semibold text-slate-200 mb-1">
                    Campo de Nombre de Usuario
                  </label>
                  <input
                    id="map-fullname"
                    type="text"
                    value={draft.jsonMapping.fullNameField}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        jsonMapping: { ...draft.jsonMapping, fullNameField: e.target.value },
                      })
                    }
                    placeholder="NombreUsuario o nombreCompleto"
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400">Ej: NombreUsuario, nombreCompleto</span>
                </div>

                <div>
                  <label htmlFor="map-role" className="block text-xs font-semibold text-slate-200 mb-1">
                    Campo de Rol / Perfil (`AdmUser`)
                  </label>
                  <input
                    id="map-role"
                    type="text"
                    value={draft.jsonMapping.roleField}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        jsonMapping: { ...draft.jsonMapping, roleField: e.target.value },
                      })
                    }
                    placeholder="Perfil o rol"
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400">Ej: Perfil, rol, AdmUser</span>
                </div>

                <div>
                  <label htmlFor="map-perms" className="block text-xs font-semibold text-slate-200 mb-1">
                    Campo de Permisos (`AdmRelacionPermisoUsuario`)
                  </label>
                  <input
                    id="map-perms"
                    type="text"
                    value={draft.jsonMapping.permissionsField}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        jsonMapping: { ...draft.jsonMapping, permissionsField: e.target.value },
                      })
                    }
                    placeholder="ListaPermisos o permisos"
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400">Ej: ListaPermisos, permisos</span>
                </div>

                <div>
                  <label htmlFor="map-token" className="block text-xs font-semibold text-slate-200 mb-1">
                    Campo de Token / Sesión JWT
                  </label>
                  <input
                    id="map-token"
                    type="text"
                    value={draft.jsonMapping.tokenField}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        jsonMapping: { ...draft.jsonMapping, tokenField: e.target.value },
                      })
                    }
                    placeholder="TokenSesion o token"
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400">Ej: TokenSesion, token, jwt</span>
                </div>

                <div>
                  <label htmlFor="map-branch" className="block text-xs font-semibold text-slate-200 mb-1">
                    Campo de Sucursal / Planta
                  </label>
                  <input
                    id="map-branch"
                    type="text"
                    value={draft.jsonMapping.branchField}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        jsonMapping: { ...draft.jsonMapping, branchField: e.target.value },
                      })
                    }
                    placeholder="NombreSucursal o sucursal"
                    className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400">Ej: NombreSucursal, sucursal</span>
                </div>
              </div>

              {/* Simulador de Mapeo JSON en Vivo */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      Validador de Adaptador JSON en Caliente
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Pegue una respuesta JSON real de `spConsultaUsuario` para verificar cómo GEOLATINA interpreta los campos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestJsonAdapter}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Probar Mapeo JSON
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="sample-json-textarea" className="block text-[11px] text-slate-400 mb-1">
                      JSON de Entrada (Respuesta IIS):
                    </label>
                    <textarea
                      id="sample-json-textarea"
                      rows={6}
                      value={sampleJsonInput}
                      onChange={(e) => setSampleJsonInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">
                      Objeto de Sesión GEOLATINA Resultante:
                    </span>
                    <pre className="w-full h-[142px] overflow-auto bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-emerald-300">
                      {mappingPreviewResult ||
                        'Haga clic en "Probar Mapeo JSON" para previsualizar el objeto de sesión adaptado.'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB D: HERRAMIENTAS DE DIAGNÓSTICO Y RESPALDO */}
          {activeTab === 'diagnostico' && (
            <div className="space-y-5">
              <div className="pb-3 border-b border-slate-700/70">
                <h3 className="text-sm font-bold text-white">
                  D. Herramientas de Diagnóstico de Red (Ping IIS) y Respaldo de Configuración
                </h3>
                <p className="text-xs text-slate-400">
                  Verifique la conectividad HTTP/CORS con el servidor `LatinaWebApi` y exporte o importe perfiles `.JSON`.
                </p>
              </div>

              {/* Botón Probar Conexión con API (Ping) */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-amber-400" />
                      Prueba de Enlace en Vivo con Servidor IIS
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      Destino: {draft.baseUrl.replace(/\/+$/, '')}/{draft.authEndpoint.replace(/^\/+/, '')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handlePingNow}
                    disabled={isPinging}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs rounded-lg shadow transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isPinging ? 'animate-spin' : ''}`} />
                    <span>{isPinging ? 'Ejecutando Ping a IIS...' : '🔌 Probar Conexión con API (Ping)'}</span>
                  </button>
                </div>

                {pingResult && (
                  <div
                    className={`rounded-xl border p-4 space-y-2.5 ${
                      pingResult.ok
                        ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-100'
                        : 'bg-amber-950/40 border-amber-700/60 text-amber-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        {pingResult.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span>{pingResult.diagnosticSummary}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                        <span>Latencia: {pingResult.latencyMs} ms</span>
                        <span>·</span>
                        <span>HTTP: {pingResult.httpStatus ?? 'SIN ENLACE DIRECTO'}</span>
                        <span>·</span>
                        <span>Hora: {pingResult.timestamp}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                      {pingResult.technicalDetails.map((line, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Exportar / Importar / Restaurar */}
              <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-200">
                  Gestión de Respaldo de Configuración (`geolatina_sys_config`)
                </h4>
                <p className="text-xs text-slate-400">
                  Exporte los parámetros actuales a un archivo `.JSON` para distribuirlos en terminales de supervisores o restaure los valores de fábrica.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Exportar Configuración (.JSON)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-blue-400" />
                    <span>Importar Configuración (.JSON)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportJson}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="px-4 py-2 bg-red-950/60 hover:bg-red-900/70 text-red-200 border border-red-800/60 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ml-auto"
                  >
                    <RotateCcw className="w-4 h-4 text-red-400" />
                    <span>Restaurar Valores por Defecto</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-700/80 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400 font-mono">
              Última actualización: {new Date(draft.lastUpdated).toLocaleString()}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeSysConfigModal}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cerrar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-bold bg-[#D32F2F] hover:bg-red-600 text-white shadow-lg flex items-center gap-2 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Configuración en Sistema</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
