/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 1: Pantalla de Inicio de Sesión Corporativa (Login Gate)
 * GEOLATINA — Industrial Latina S.A. | Syspro Users API (LatinaSoft)
 *
 * Nota de Seguridad TIC:
 * Las configuraciones de conexiones del Área de TIC están restringidas
 * exclusivamente dentro de la sesión autenticada del perfil ADMIN y el usuario XBRIONES.
 */

import React, { useState } from 'react';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import { SYSPRO_CONFIGURED_ROLES } from '../services/latinaApiEngine';
import {
  MapPin,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Building2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  ShieldAlert,
} from 'lucide-react';

export const CorporateLoginGate: React.FC = () => {
  const {
    config,
    apiSemaphore,
    loginWithLatinaSoft,
    lastPingResult,
  } = useGeoLatinaSystem();

  const [usuario, setUsuario] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [sucursal, setSucursal] = useState<string>(config.defaultSucursal);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showRolesList, setShowRolesList] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = usuario.trim();
    if (!cleanUser || !password) {
      setErrorMessage('Por favor ingrese su Usuario Syspro y Contraseña corporativa.');
      return;
    }

    setIsLoading(true);
    try {
      const [result] = await Promise.all([
        loginWithLatinaSoft({
          usuario: cleanUser,
          password,
          sucursal: sucursal.trim() || config.defaultSucursal,
          apiKey: config.apiKey,
        }),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);

      if (!result.ok) {
        setErrorMessage(result.error || 'No fue posible validar las credenciales en Syspro.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error de comunicación con el servidor Syspro.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderServerStatusIndicator = () => {
    if (apiSemaphore === 'CONNECTED') {
      return (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs">
          <div className="flex items-center gap-2 text-emerald-200 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
            <span>Servicio Corporativo Syspro: En Línea</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-300 tabular-nums">
            {lastPingResult ? `${lastPingResult.latencyMs} ms` : 'Conectado'}
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs">
        <div className="flex items-center gap-2 text-slate-200 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
          <span>Autenticación Corporativa Syspro Activa</span>
        </div>
        <span className="font-mono text-[11px] text-amber-300">
          Verificación Segura
        </span>
      </div>
    );
  };

  return (
    <div className="w-screen max-w-full min-h-[100dvh] bg-[#0F172A] text-slate-100 flex flex-col justify-between font-sans selection:bg-[#F59E0B] selection:text-slate-950 overflow-x-hidden">
      {/* Top Corporate Bar (Sin botón de configuración pública; restringido al perfil ADMIN y usuario XBRIONES tras iniciar sesión) */}
      <header className="w-full border-b border-slate-800/90 bg-[#0A2540]/90 backdrop-blur-md px-3 sm:px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F59E0B] text-slate-950 flex items-center justify-center font-black shadow">
            <MapPin className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-white">
              GEOLATINA — Industrial Latina S.A.
            </span>
            <span className="hidden md:inline-block ml-3 text-xs text-slate-300">
              · Plataforma de Georreferenciación y Auditoría Comercial
            </span>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-2 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="hidden sm:inline">Acceso Corporativo Protegido</span>
          <span className="sm:hidden">Syspro Auth</span>
        </div>
      </header>

      {/* Main Full-Viewport Login Gate Container */}
      <main className="flex-1 w-full max-w-full flex items-stretch justify-center p-3 sm:p-4">
        <div className="w-full max-w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch geo-responsive-stack">
          {/* Left Column: Corporate Info & Syspro Roles */}
          <div className="lg:col-span-5 geo-fluid-card bg-[#0A2540] border border-slate-800 rounded-2xl p-5 sm:p-7 flex flex-col justify-between shadow-xl overflow-hidden">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#F59E0B]">
                <ShieldCheck className="w-4 h-4" />
                <span>Plataforma Corporativa LatinaSoft · Syspro</span>
              </div>

              <div className="space-y-1.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
                  Control Satelital de Rutas y Fuerza Comercial
                </h1>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Inicie sesión con sus credenciales corporativas. El sistema asigna automáticamente los privilegios operativos según el campo <code className="text-amber-300 font-mono">rol</code> configurado en Syspro.
                </p>
              </div>

              {/* Security Notice for TIC Connection Settings */}
              <div className="bg-[#0F172A]/90 border border-amber-500/30 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <ShieldAlert className="w-4 h-4 text-[#F59E0B] shrink-0" />
                  <span>Seguridad de Conexiones — Área de TIC</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Los parámetros técnicos de interconexión y llaves de API se encuentran disponibles exclusivamente tras iniciar sesión dentro del perfil <strong className="text-white font-mono">ADMIN</strong> y el usuario autorizado <strong className="text-amber-300 font-mono">XBRIONES</strong>.
                </p>
              </div>

              {/* Authorized Syspro Roles Reference Panel */}
              <div className="bg-[#0F172A]/70 border border-slate-800/90 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Roles Syspro Configurados ({SYSPRO_CONFIGURED_ROLES.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRolesList(!showRolesList)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showRolesList ? 'Ocultar' : 'Ver todos'}</span>
                    {showRolesList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Perfiles habilitados para ingreso según jerarquía corporativa:
                </p>

                {/* Collapsible list of 14 Syspro roles */}
                <div
                  className={`space-y-1.5 overflow-y-auto transition-all ${
                    showRolesList ? 'max-h-60' : 'max-h-36'
                  } pr-1 scrollbar-thin`}
                >
                  {SYSPRO_CONFIGURED_ROLES.map((r) => {
                    const badgeColor =
                      r.nivel === 4
                        ? 'bg-purple-950/70 border-purple-700/60 text-purple-300'
                        : r.nivel === 3
                        ? 'bg-blue-950/70 border-blue-700/60 text-blue-300'
                        : r.nivel === 2
                        ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
                        : 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300';

                    return (
                      <div
                        key={r.codigo}
                        className="flex items-center justify-between p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px]"
                      >
                        <span className="font-mono font-bold text-slate-200">
                          {r.codigo}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeColor}`}>
                          Nivel {r.nivel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Industrial Latina S.A. · Área de TIC</span>
              <span>Syspro v2026.1</span>
            </div>
          </div>

          {/* Right Column: Syspro Login Form Card (#1E293B) */}
          <div className="lg:col-span-7 bg-[#1E293B] border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-700/80">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Iniciar Sesión Corporativa
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ingrese su usuario y clave registrados en el sistema Syspro para acceder
                  </p>
                </div>
                <span className="text-xs font-mono text-[#F59E0B] font-semibold bg-amber-950/50 px-2.5 py-1 rounded-md border border-amber-800/60 self-start sm:self-auto">
                  GEOLATINA
                </span>
              </div>

              {/* Indicador visual del estado del servidor */}
              {renderServerStatusIndicator()}

              {/* Error Alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="bg-red-950/80 border border-[#D32F2F] rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-100 shadow-md animate-in fade-in duration-200"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-white">Error de Autenticación</div>
                    <div className="text-red-200">{errorMessage}</div>
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="syspro-user"
                    className="block text-xs font-semibold text-slate-200 mb-1.5"
                  >
                    Usuario Corporativo
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="syspro-user"
                      type="text"
                      autoComplete="username"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      placeholder="Ingrese su usuario Syspro"
                      disabled={isLoading}
                      required
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F59E0B] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="syspro-pass"
                    className="block text-xs font-semibold text-slate-200 mb-1.5"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="syspro-pass"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingrese su contraseña"
                      disabled={isLoading}
                      required
                      className="w-full bg-[#0F172A] border border-slate-700 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F59E0B] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="syspro-sucursal"
                    className="block text-xs font-semibold text-slate-200 mb-1.5"
                  >
                    Sucursal / Planta Asignada
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="syspro-sucursal"
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
                        <span>Validando credenciales en Syspro...</span>
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
              <span>Sesión persistente y rol cargado desde Syspro</span>
              <span>Industrial Latina S.A. · Área de TIC</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Corporate Bar */}
      <footer className="w-full border-t border-slate-800/70 px-6 py-3 text-center text-xs text-slate-500">
        GEOLATINA — Control de Rutas y Auditoría Satelital · Industrial Latina S.A.
      </footer>
    </div>
  );
};
