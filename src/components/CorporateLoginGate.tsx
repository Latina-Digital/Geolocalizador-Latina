/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pantalla Ejecutiva de Inicio de Sesión — INDUSTRIAL LATINA S.A.
 * Diseño Arquitectónico Split-Screen (100vw x 100dvh):
 * - Panel Izquierdo / Principal de Marca: Muro arquitectónico en Azul Pizarra mate (#1B2A3A / #152230)
 *   con iluminación cálida ambiental lateral y el Logo Oficial "INDUSTRIAL LATINA", su escarapela con la "L"
 *   y el eslogan inalterable "SOLUCIONES INTEGRALES PARA LA CONSTRUCCIÓN".
 * - Panel Derecho / Tarjeta Ejecutiva de Acceso: Cristal esmerilado oscuro (backdrop-filter: blur(16px),
 *   rgba(15, 23, 42, 0.85), borde 1px solid rgba(255, 255, 255, 0.12)) con únicamente dos campos:
 *   1. "Usuario"
 *   2. "Contraseña" (con botón de mostrar/ocultar caracteres)
 *   (La sucursal por defecto de `geolatina_sys_config` se envía internamente en el fetch sin mostrarse en UI).
 * - Accesos técnicos compactos y discretos en la esquina inferior: "⚙️ Config API" y "📲 Descargar APK".
 */

import React, { useState } from 'react';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import { IndustrialLatinaLogoWall } from './IndustrialLatinaLogoWall';
import { ApkDownloadModal } from './ApkDownloadModal';
import {
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Settings,
  Upload,
  CheckCircle2,
  X,
  RotateCcw,
  Server,
} from 'lucide-react';

export const CorporateLoginGate: React.FC = () => {
  const {
    config,
    uiConfig,
    updateUiConfig,
    updateSysConfig,
    loginWithLatinaSoft,
    runServerPing,
    lastPingResult,
  } = useGeoLatinaSystem();

  const [usuario, setUsuario] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modales discretos de esquina inferior ("📲 Descargar APK" y "⚙️ Config API")
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);
  const [isSystemsDrawerOpen, setIsSystemsDrawerOpen] = useState<boolean>(false);

  // Estado local del panel compacto de Sistemas ("⚙️ Config API" & Logo Oficial Base64/URL)
  const [draftLogoUrl, setDraftLogoUrl] = useState<string>(uiConfig.logoUrlOrBase64 || '');
  const [draftBaseUrl, setDraftBaseUrl] = useState<string>(config.baseUrl || '');
  const [draftLoginEndpoint, setDraftLoginEndpoint] = useState<string>(config.authEndpoint || '');
  const [systemsFeedback, setSystemsFeedback] = useState<string | null>(null);
  const [isTestingPing, setIsTestingPing] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = usuario.trim();
    if (!cleanUser || !password) {
      setErrorMessage('Por favor ingrese su Usuario y Contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      // Nota técnica: se envía internamente la sucursal por defecto guardada en `geolatina_sys_config`
      // sin mostrar jamás el campo Sucursal en la pantalla de Login.
      const [result] = await Promise.all([
        loginWithLatinaSoft({
          usuario: cleanUser,
          password,
          sucursal: config.defaultSucursal,
          apiKey: config.apiKey,
        }),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);

      if (!result.ok) {
        setErrorMessage(result.error || 'Credenciales incorrectas. Verifique su usuario y contraseña.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error de comunicación con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = String(ev.target?.result || '');
      setDraftLogoUrl(base64);
      updateUiConfig({
        ...uiConfig,
        logoUrlOrBase64: base64,
      });
      setSystemsFeedback('Imagen oficial cargada en Base64 y fijada en el muro corporativo.');
      setTimeout(() => setSystemsFeedback(null), 3500);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSystemsQuickConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateUiConfig({
      ...uiConfig,
      logoUrlOrBase64: draftLogoUrl.trim(),
    });
    updateSysConfig({
      ...config,
      baseUrl: draftBaseUrl.trim() || config.baseUrl,
      authEndpoint: draftLoginEndpoint.trim() || config.authEndpoint,
    });
    setSystemsFeedback('Configuración de API y Logo Oficial guardada correctamente.');
    setTimeout(() => setSystemsFeedback(null), 3500);
  };

  const handleRestoreDefaultLogo = () => {
    setDraftLogoUrl('');
    updateUiConfig({
      ...uiConfig,
      logoUrlOrBase64: '',
    });
    setSystemsFeedback('Emblema vectorial oficial 3D restaurado.');
    setTimeout(() => setSystemsFeedback(null), 3000);
  };

  const handleQuickPing = async () => {
    setIsTestingPing(true);
    try {
      await runServerPing({
        ...config,
        baseUrl: draftBaseUrl.trim() || config.baseUrl,
        authEndpoint: draftLoginEndpoint.trim() || config.authEndpoint,
      });
    } finally {
      setIsTestingPing(false);
    }
  };

  return (
    <div
      className="w-screen max-w-full min-h-[100dvh] h-[100dvh] bg-[#152230] text-white flex flex-col lg:flex-row items-stretch overflow-x-hidden overflow-y-auto lg:overflow-hidden select-none"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* ===================================================================
          PANEL IZQUIERDO / PRINCIPAL DE MARCA (MURO ARQUITECTÓNICO #1B2A3A)
          =================================================================== */}
      <section
        aria-label="Identidad Corporativa Industrial Latina"
        className="relative w-full lg:w-[58%] xl:w-[62%] lg:min-h-full lg:h-full bg-[#1B2A3A] flex flex-col items-center justify-center px-4 py-5 sm:px-10 sm:py-7 lg:px-16 overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 shrink-0"
      >
        {/* Textura de muro arquitectónico en tono azul pizarra mate con iluminación cálida ambiental en los bordes laterales */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 0% 50%, rgba(245, 183, 0, 0.14) 0%, rgba(245, 183, 0, 0.03) 26%, transparent 55%),
              radial-gradient(circle at 100% 50%, rgba(245, 183, 0, 0.12) 0%, rgba(211, 47, 47, 0.04) 28%, transparent 55%),
              radial-gradient(ellipse at 50% 42%, #223549 0%, #1B2A3A 58%, #152230 100%)
            `,
          }}
        />

        {/* Sutiles haces de luz arquitectónica vertical en los extremos laterales del muro */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-transparent via-[#F5B700]/45 to-transparent opacity-80"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-transparent via-[#F5B700]/25 to-transparent opacity-60"
        />

        {/* Contenedor Central del Emblema Oficial y Eslogan Inalterable */}
        <div className="relative z-10 w-full max-w-[640px] flex flex-col items-center justify-center">
          <IndustrialLatinaLogoWall customLogoUrlOrBase64={uiConfig.logoUrlOrBase64} />
        </div>
      </section>

      {/* ===================================================================
          PANEL DERECHO / TARJETA EJECUTIVA DE ACCESO
          =================================================================== */}
      <main className="relative w-full lg:w-[42%] xl:w-[38%] flex-1 lg:h-full bg-[#152230] flex flex-col justify-between px-4 py-4 sm:px-10 sm:py-6 lg:px-12 xl:px-14 overflow-y-auto">
        {/* Resplandor ambiental sutil detrás de la tarjeta de cristal */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(27, 42, 58, 0.9) 0%, rgba(21, 34, 48, 1) 100%)',
          }}
        />

        {/* Espaciador superior para centrado vertical en escritorio */}
        <div className="hidden lg:block" />

        {/* Tarjeta Ejecutiva con efecto cristal esmerilado oscuro */}
        <div className="relative z-10 w-full max-w-[430px] mx-auto my-auto">
          <div
            className="w-full rounded-2xl p-5 sm:p-8 lg:p-9 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            {/* 1. Encabezado limpio y directo: "Bienvenido" / "Acceso al Sistema" */}
            <div className="mb-5 sm:mb-7">
              <span className="block text-xs font-bold uppercase tracking-[0.2em] text-[#F5B700] mb-1">
                Bienvenido
              </span>
              <h1 className="text-xl sm:text-[26px] font-extrabold text-white tracking-tight">
                Acceso al Sistema
              </h1>
              <div className="mt-2.5 h-0.5 w-12 bg-gradient-to-r from-[#D32F2F] to-[#F5B700] rounded-full" />
            </div>

            {/* Alerta de Error de Credenciales */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 bg-red-950/80 border border-[#D32F2F]/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-100 shadow-md animate-in fade-in duration-150"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-white">Acceso Denegado</div>
                  <div className="text-red-200 leading-relaxed">{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Formulario con ÚNICAMENTE 2 campos: Usuario y Contraseña */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
              {/* 2. Campo "Usuario" */}
              <div>
                <label
                  htmlFor="syspro-user"
                  className="block text-xs font-semibold text-slate-200 mb-1.5 tracking-wide"
                >
                  Usuario
                </label>
                <div className="relative group">
                  <UserIcon className="w-4 h-4 text-slate-400 group-focus-within:text-[#F5B700] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors" />
                  <input
                    id="syspro-user"
                    type="text"
                    autoComplete="username"
                    value={usuario}
                    onChange={(e) => setUsuario(e.target.value)}
                    placeholder="Ingrese su usuario"
                    disabled={isLoading}
                    required
                    className="w-full bg-[#152230]/90 border border-white/15 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-sm text-white placeholder:text-slate-400/70 focus:outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#1E40AF]/40 transition-all"
                  />
                </div>
              </div>

              {/* 3. Campo "Contraseña" con botón para visualizar caracteres */}
              <div>
                <label
                  htmlFor="syspro-pass"
                  className="block text-xs font-semibold text-slate-200 mb-1.5 tracking-wide"
                >
                  Contraseña
                </label>
                <div className="relative group">
                  <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-[#F5B700] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors" />
                  <input
                    id="syspro-pass"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingrese su contraseña"
                    disabled={isLoading}
                    required
                    className="w-full bg-[#152230]/90 border border-white/15 rounded-xl pl-10 pr-11 py-2.5 sm:py-3 text-sm text-white placeholder:text-slate-400/70 focus:outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#1E40AF]/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 4. Botón principal de acción "Iniciar Sesión" en degradado Rojo Corporativo (#C62828 a #E53935) */}
              <div className="pt-1.5">
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    backgroundImage: 'linear-gradient(135deg, #C62828 0%, #E53935 100%)',
                  }}
                  className="w-full py-3 sm:py-3.5 px-6 rounded-xl font-bold text-sm text-white shadow-[0_10px_25px_-5px_rgba(211,47,47,0.55)] hover:shadow-[0_16px_32px_-4px_rgba(229,57,53,0.7)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 transition-all duration-150 flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#F5B700]" />
                      <span>Verificando acceso...</span>
                    </>
                  ) : (
                    <span>Iniciar Sesión</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 5. Esquina inferior discreta: Accesos técnicos compactos ("⚙️ Config API" y "📲 Descargar APK") */}
        <footer className="relative z-10 w-full max-w-[430px] mx-auto pt-3 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="text-[11px] text-slate-400/80 font-medium tracking-wide">
            Industrial Latina S.A.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftLogoUrl(uiConfig.logoUrlOrBase64 || '');
                setDraftBaseUrl(config.baseUrl || '');
                setDraftLoginEndpoint(config.authEndpoint || '');
                setIsSystemsDrawerOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-800/90 text-slate-300 hover:text-white border border-white/10 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="Configuración de API y Logo Oficial (Sistemas)"
            >
              <span>⚙️ Config API</span>
            </button>

            <button
              type="button"
              onClick={() => setIsApkModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-800/90 text-slate-300 hover:text-white border border-white/10 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="Descargar instalador móvil Android (.APK) o instalar PWA"
            >
              <span>📲 Descargar APK</span>
            </button>
          </div>
        </footer>
      </main>

      {/* ===================================================================
          MODAL COMPACTO DE SISTEMAS ("⚙️ Config API" & IMAGEN OFICIAL DEL LOGO)
          =================================================================== */}
      {isSystemsDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-systems-config-title"
        >
          <div className="w-full max-w-xl bg-[#152230] border border-white/15 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="bg-[#1B2A3A] px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-[#F5B700] shrink-0" />
                <div>
                  <h2 id="login-systems-config-title" className="text-sm sm:text-base font-bold text-white">
                    ⚙️ Config API & Identidad Corporativa (Sistemas)
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Parámetros de conexión LatinaWebApi e imagen oficial del muro corporativo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSystemsDrawerOpen(false)}
                aria-label="Cerrar configuración de sistemas"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {systemsFeedback && (
              <div className="bg-emerald-950/90 border-b border-emerald-700/80 px-5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{systemsFeedback}</span>
              </div>
            )}

            <form onSubmit={handleSaveSystemsQuickConfig} className="p-5 space-y-4">
              {/* Carga o fijación de la Imagen Oficial de INDUSTRIAL LATINA en Base64 / URL */}
              <div className="bg-[#0F172A]/80 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label htmlFor="login-official-logo-input" className="block text-xs font-bold text-white">
                      Imagen Oficial INDUSTRIAL LATINA (Base64 o URL)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Fije la imagen oficial corporativa o utilice el respaldo vectorial SVG 3D de alta fidelidad.
                    </p>
                  </div>
                  {draftLogoUrl && (
                    <button
                      type="button"
                      onClick={handleRestoreDefaultLogo}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restaurar SVG 3D</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="login-official-logo-input"
                    type="text"
                    value={draftLogoUrl}
                    onChange={(e) => setDraftLogoUrl(e.target.value)}
                    placeholder="Pegue URL o Data URI (data:image/png;base64,...)"
                    className="flex-1 bg-[#152230] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#F5B700]"
                  />
                  <label className="px-3.5 py-2 rounded-xl bg-[#F5B700]/20 hover:bg-[#F5B700]/30 text-[#F5B700] border border-[#F5B700]/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir Imagen</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Endpoint LatinaWebApi */}
              <div className="bg-[#0F172A]/80 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[#F5B700]" />
                    <span>Servidor LatinaWebApi (Syspro)</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleQuickPing}
                    disabled={isTestingPing}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-semibold text-slate-200 cursor-pointer"
                  >
                    {isTestingPing
                      ? 'Probando...'
                      : lastPingResult
                      ? `Ping: ${lastPingResult.latencyMs} ms`
                      : 'Probar Conexión'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label htmlFor="login-api-base-url" className="block text-[11px] text-slate-300 mb-1">
                      URL Base del Servidor
                    </label>
                    <input
                      id="login-api-base-url"
                      type="text"
                      value={draftBaseUrl}
                      onChange={(e) => setDraftBaseUrl(e.target.value)}
                      className="w-full bg-[#152230] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#F5B700]"
                    />
                  </div>
                  <div>
                    <label htmlFor="login-api-endpoint" className="block text-[11px] text-slate-300 mb-1">
                      Endpoint Login
                    </label>
                    <input
                      id="login-api-endpoint"
                      type="text"
                      value={draftLoginEndpoint}
                      onChange={(e) => setDraftLoginEndpoint(e.target.value)}
                      className="w-full bg-[#152230] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#F5B700]"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  La sucursal predeterminada (<code className="text-slate-200">{config.defaultSucursal}</code>) se transmite internamente en la petición de autenticación.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSystemsDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, #C62828 0%, #E53935 100%)',
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Descarga de App Móvil (.APK) y Modo Nativo PWA */}
      <ApkDownloadModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
        config={config}
      />
    </div>
  );
};
