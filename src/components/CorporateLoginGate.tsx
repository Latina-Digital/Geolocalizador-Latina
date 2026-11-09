/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 1: Pantalla de Inicio de Sesión Corporativa (Login Gate)
 * GEOLATINA — Industrial Latina S.A. | Plataforma Corporativa LatinaSoft (IIS / SQL Server)
 */

import React, { useState } from 'react';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import { AUTHORIZED_CONTINGENCY_USERS } from '../services/latinaApiEngine';
import {
  MapPin,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Settings,
  Building2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Server,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export const CorporateLoginGate: React.FC = () => {
  const {
    config,
    apiSemaphore,
    loginWithLatinaSoft,
    openSysConfigModal,
    lastPingResult,
  } = useGeoLatinaSystem();

  const [usuario, setUsuario] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [sucursal, setSucursal] = useState<string>(config.defaultSucursal);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!usuario.trim() || !password) {
      setErrorMessage('Ingrese su Usuario LatinaSoft y Contraseña corporativa para continuar.');
      return;
    }

    setIsLoading(true);
    try {
      // Simular breve latencia visual si es instantáneo para mostrar el estado "Validando credenciales en LatinaSoft..."
      const [result] = await Promise.all([
        loginWithLatinaSoft({
          usuario: usuario.trim(),
          password,
          sucursal: sucursal.trim() || config.defaultSucursal,
        }),
        new Promise((resolve) => setTimeout(resolve, 450)),
      ]);

      if (!result.ok) {
        setErrorMessage(result.error || 'No se pudo autenticar la sesión en LatinaSoft.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string, s?: string) => {
    setUsuario(u);
    setPassword(p);
    if (s) setSucursal(s);
    setErrorMessage(null);
  };

  const renderServerStatusIndicator = () => {
    if (apiSemaphore === 'UNCONFIGURED') {
      return (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-red-950/50 border border-red-800/70 text-xs">
          <div className="flex items-center gap-2 text-red-200 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D32F2F] shrink-0" />
            <span>Estado API: Sin configurar</span>
          </div>
          <button
            type="button"
            onClick={openSysConfigModal}
            className="text-amber-400 hover:underline font-semibold"
          >
            Configurar URL
          </button>
        </div>
      );
    }

    if (apiSemaphore === 'CONNECTED') {
      return (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs">
          <div className="flex items-center gap-2 text-emerald-200 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
            <span>Estado Servidor API: Conectado (LatinaWebApi IIS)</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-300 tabular-nums">
            {lastPingResult ? `${lastPingResult.latencyMs} ms` : 'En línea'}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-amber-950/40 border border-amber-700/60 text-xs">
        <div className="flex items-center gap-2 text-amber-200 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
          <span>Estado Servidor API: Modo Contingencia / Híbrido Activo</span>
        </div>
        <span className="font-mono text-[11px] text-amber-300">
          IIS + Respaldo Local
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col justify-between font-sans selection:bg-[#F59E0B] selection:text-slate-950">
      {/* Top Corporate Bar with Technical Access Button */}
      <header className="w-full border-b border-slate-800/90 bg-[#0A2540]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F59E0B] text-slate-950 flex items-center justify-center font-black shadow">
            <MapPin className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-white">
              GEOLATINA — Industrial Latina S.A.
            </span>
            <span className="hidden md:inline-block ml-3 text-xs text-slate-300">
              · Pasarela Corporativa de Autenticación LatinaSoft
            </span>
          </div>
        </div>

        {/* Botón de acceso técnico en la esquina superior derecha */}
        <button
          type="button"
          onClick={openSysConfigModal}
          className="px-3.5 py-2 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-slate-100 border border-slate-600/80 text-xs font-semibold flex items-center gap-2 shadow transition-colors whitespace-nowrap shrink-0"
        >
          <Settings className="w-4 h-4 text-[#F59E0B]" />
          <span>⚙️ Configuración de Sistema / API</span>
        </button>
      </header>

      {/* Main Centered Login Gate Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Corporate Identity & Architecture Specs */}
          <div className="lg:col-span-5 bg-[#0A2540] border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col justify-between shadow-xl">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#F59E0B]">
                <ShieldCheck className="w-4 h-4" />
                <span>Plataforma Corporativa LatinaSoft</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  Control Satelital de Rutas y Fuerza Comercial
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Acceso unificado con validación de credenciales, perfiles{' '}
                  <code className="text-amber-300 font-mono">AdmUser</code> y matriz de permisos{' '}
                  <code className="text-amber-300 font-mono">AdmRelacionPermisoUsuario</code> sobre SQL Server / IIS.
                </p>
              </div>

              {/* Endpoint Technical Summary */}
              <div className="bg-[#0F172A]/90 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Interfaz API Configurada
                  </span>
                  <span className="font-mono text-[11px] text-amber-400">
                    {config.httpMethod} · {config.payloadFormat}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-400 break-all">
                  {config.baseUrl.replace(/\/+$/, '')}/{config.authEndpoint.replace(/^\/+/, '')}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Timeout: {config.timeoutMs} ms</span>
                  <span>·</span>
                  <span>Vigencia: {config.sessionExpirationHours}h</span>
                </div>
              </div>
            </div>

            {/* Quick Access Credentials Helper for Sistemas & Evaluation */}
            <div className="mt-8 pt-5 border-t border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Credenciales Autorizadas de Prueba
                </span>
                <span className="text-[11px] text-slate-400">Clic para autocompletar</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.enableTechCredentials && (
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickFill(
                        config.techUsername,
                        config.techPassword,
                        'Centro de Datos - Sistemas Matriz'
                      )
                    }
                    className="p-2.5 rounded-lg bg-[#1E293B] hover:bg-slate-800 border border-amber-500/40 text-left transition-colors"
                  >
                    <div className="text-xs font-bold text-amber-400">
                      Equipo de Sistemas (Root)
                    </div>
                    <div className="text-[11px] font-mono text-slate-300 mt-0.5">
                      Usr: {config.techUsername} · Clave: {config.techPassword}
                    </div>
                  </button>
                )}

                {AUTHORIZED_CONTINGENCY_USERS.slice(0, 3).map((cred) => (
                  <button
                    key={cred.usuario}
                    type="button"
                    onClick={() => handleQuickFill(cred.usuario, cred.password, cred.sucursal)}
                    className="p-2.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-800 text-left transition-colors"
                  >
                    <div className="text-xs font-bold text-white truncate">
                      {cred.nombreCompleto}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Usr: {cred.usuario} · {cred.rol}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Corporate Login Form Card (#1E293B) */}
          <div className="lg:col-span-7 bg-[#1E293B] border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-700/80">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Iniciar Sesión Corporativa
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ingrese sus credenciales de dominio LatinaSoft para desbloquear GEOLATINA
                  </p>
                </div>
                <span className="text-xs font-mono text-[#F59E0B] font-semibold">
                  APP: GEOLATINA
                </span>
              </div>

              {/* Indicador visual del estado del servidor API */}
              {renderServerStatusIndicator()}

              {/* Error Alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="bg-red-950/70 border border-[#D32F2F] rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-100"
                >
                  <AlertCircle className="w-4 h-4 text-[#D32F2F] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-white">Error de Autenticación</div>
                    <div>{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-usuario-latinasoft"
                    className="block text-xs font-semibold text-slate-200 mb-1.5"
                  >
                    Usuario LatinaSoft
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-usuario-latinasoft"
                      type="text"
                      autoComplete="username"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      placeholder="Ej. ralcivar, mparedes, cvera o sistemas"
                      disabled={isLoading}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F59E0B] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password-latinasoft"
                    className="block text-xs font-semibold text-slate-200 mb-1.5"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password-latinasoft"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingrese su contraseña de LatinaSoft"
                      disabled={isLoading}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F59E0B] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-sucursal-latinasoft"
                    className="block text-xs font-semibold text-slate-200 mb-1.5"
                  >
                    Sucursal / Planta Asignada
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-sucursal-latinasoft"
                      type="text"
                      value={sucursal}
                      onChange={(e) => setSucursal(e.target.value)}
                      disabled={isLoading}
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-[#F59E0B] transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-[#D32F2F] hover:bg-red-600 disabled:opacity-70 shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        <span>Validando credenciales en LatinaSoft...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Iniciar Sesión</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Footer Metadata inside Login Card */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>Sesión persistente cifrada en `geolatina_user_session`</span>
              <span>Industrial Latina S.A. · División Tecnología</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Corporate Bar */}
      <footer className="w-full border-t border-slate-800/70 px-6 py-3 text-center text-xs text-slate-500">
        GEOLATINA — Control de Rutas y Auditoría Satelital · Conectado con arquitectura LatinaWebApi (IIS / SQL Server)
      </footer>
    </div>
  );
};
