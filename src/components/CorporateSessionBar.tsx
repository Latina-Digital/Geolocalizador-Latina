/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 7: Integración en la Barra Superior y Contexto Global (Adaptable Multi-Dispositivo)
 * - En Escritorio y Tablet (>= 768px): muestra todos los controles en línea.
 * - En Smartphones (<= 767px): compacta la barra mostrando el título GEOLATINA, el semáforo de conexión API,
 *   la campana de alertas GPS y agrupa las opciones secundarias (Historial/PDF, Config API, Editor Admin,
 *   Cerrar Sesión) en un menú desplegable táctil (Drawer / Hamburger Menu).
 */

import React, { useState } from 'react';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import { getRoleHierarchyLevel, canUserAccessTicConfig } from '../services/latinaApiEngine';
import { canUserAccessGpsFraudAlerts } from '../services/geoIntegrityGuard';
import {
  Settings,
  LogOut,
  Shield,
  ClipboardList,
  Palette,
  ShieldAlert,
  Check,
  X,
  Menu,
} from 'lucide-react';

export const CorporateSessionBar: React.FC = () => {
  const {
    user,
    uiConfig,
    apiSemaphore,
    gpsFraudAlerts,
    openSysConfigModal,
    openAuditHistoryModal,
    openGpsFraudDrawer,
    openUiBuilderModal,
    logoutLatinaSession,
    lastPingResult,
  } = useGeoLatinaSystem();

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const roleLevel = getRoleHierarchyLevel(user.rol, user.usuario);
  const isSupervisorOrAbove = canUserAccessGpsFraudAlerts(user.rol);
  const isTicAuthorized = canUserAccessTicConfig(user);

  const unacknowledgedFraudCount = gpsFraudAlerts.filter(
    (a) => !a.acknowledgedBySupervisor
  ).length;

  const getSemaphoreDot = () => {
    if (apiSemaphore === 'CONNECTED') {
      return {
        dotClass: 'bg-emerald-400',
        label: lastPingResult ? `LatinaWebApi (${lastPingResult.latencyMs}ms)` : 'LatinaWebApi Conectada',
        shortLabel: 'API OK',
        textClass: 'text-emerald-300',
      };
    }
    if (apiSemaphore === 'CONTINGENCY') {
      return {
        dotClass: 'bg-[#F59E0B]',
        label: 'LatinaWebApi Contingencia Híbrida',
        shortLabel: 'API Híbrida',
        textClass: 'text-amber-300',
      };
    }
    return {
      dotClass: 'bg-[#D32F2F]',
      label: 'API Sin Configurar',
      shortLabel: 'Sin API',
      textClass: 'text-red-300',
    };
  };

  const sem = getSemaphoreDot();

  return (
    <div
      style={{ backgroundColor: uiConfig.primaryColor || '#0A2540' }}
      className="w-full border-b border-slate-700/80 text-slate-100 px-3 sm:px-4 py-2 z-40 shrink-0 relative"
    >
      <div className="w-full max-w-full flex items-center justify-between gap-2 text-xs">
        {/* Left: Dynamic Logo/Title + LatinaWebApi Connection Status */}
        <div className="flex items-center gap-2 min-w-0">
          {uiConfig.logoUrlOrBase64 && (
            <img
              src={uiConfig.logoUrlOrBase64}
              alt={uiConfig.appTitle}
              referrerPolicy="no-referrer"
              className="w-6 h-6 rounded object-contain bg-white/10 p-0.5 shrink-0"
            />
          )}
          <span className="font-extrabold tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <span style={{ color: uiConfig.secondaryColor || '#F59E0B' }}>
              {uiConfig.appTitle || 'GEOLATINA'}
            </span>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="hidden sm:inline">LatinaSoft Conectado</span>
          </span>

          <span className="text-slate-600 shrink-0">·</span>

          {/* Semáforo de estado de la API (Compacto en móvil, completo en tablet/PC) */}
          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <span className={`w-2.5 h-2.5 rounded-full ${sem.dotClass} shrink-0`} />
            <span className={`font-medium hidden sm:inline ${sem.textClass}`}>{sem.label}</span>
            <span className={`font-semibold sm:hidden text-[11px] ${sem.textClass}`}>{sem.shortLabel}</span>
          </div>
        </div>

        {/* Right: Enterprise Actions & Active User */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          {/* User Identity & Hierarchy Level (Desktop XL) */}
          <div className="hidden xl:flex items-center gap-1.5 text-slate-200 whitespace-nowrap mr-1">
            <Shield className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
            <span className="font-semibold text-white">{user.nombreCompleto}</span>
            <span className="text-slate-300 text-[11px]">
              ({user.rol} · N{roleLevel})
            </span>
          </div>

          {/* 1. Campana de Alertas GPS (Visible siempre tanto en Móvil como en Escritorio para Supervisor+) */}
          {isSupervisorOrAbove && uiConfig.roleVisibility.SUPERVISOR.showGpsFraudBell && (
            <button
              type="button"
              onClick={openGpsFraudDrawer}
              className="px-2.5 py-1.5 rounded-lg bg-red-950/90 hover:bg-red-900 text-red-100 border border-[#D32F2F] text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Auditoría Anti-Fraude GPS (Exclusivo Supervisores, Jefatura y Administración)"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="hidden sm:inline">🚨 Alertas de Ubicación</span>
              <span className="sm:hidden">🚨 GPS</span>
              <span className="px-1.5 py-0.2 rounded bg-[#D32F2F] text-white text-[10px] font-black tabular-nums">
                {unacknowledgedFraudCount > 0 ? unacknowledgedFraudCount : gpsFraudAlerts.length}
              </span>
            </button>
          )}

          {/* Controles secundarios en línea (Tablet / Escritorio >= 768px) */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
            {/* 2. Acceso a "📋 Historial / PDF" */}
            {uiConfig.roleVisibility.SUPERVISOR.showAuditHistoryButton && (
              <button
                type="button"
                onClick={openAuditHistoryModal}
                className="px-2.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-slate-100 border border-slate-600 text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Abrir Bitácora Diaria Automática y Descargas (CSV, JSON, PDF)"
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>📋 Historial / PDF</span>
              </button>
            )}

            {/* 3. Acceso a "🎨 Editor de Plataforma" (Exclusivo Perfil ADMIN y Usuario XBRIONES) */}
            {isTicAuthorized && (
              <button
                type="button"
                onClick={openUiBuilderModal}
                className="px-2.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-amber-300 border border-amber-500/50 text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Estudio de Diseño y Estructura (Exclusivo Perfil ADMIN y Usuario XBRIONES)"
              >
                <Palette className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>🎨 Editor de Plataforma</span>
              </button>
            )}

            {/* 4. Acceso a "⚙️ Conexiones TIC / API" (Exclusivo Perfil ADMIN y Usuario XBRIONES) */}
            {isTicAuthorized && (
              <button
                type="button"
                onClick={openSysConfigModal}
                className="px-2.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-slate-100 border border-amber-500/50 text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Configuración de Conexiones — Área de TIC (Exclusivo Perfil ADMIN y Usuario XBRIONES)"
              >
                <Settings className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                <span>⚙️ Conexiones TIC / API</span>
              </button>
            )}

            {/* 5. Botón "Cerrar Sesión" con confirmación */}
            {!confirmingLogout ? (
              <button
                type="button"
                onClick={() => setConfirmingLogout(true)}
                className="px-2.5 py-1.5 rounded-lg bg-[#D32F2F] hover:bg-red-600 text-white text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Cerrar sesión activa de LatinaSoft"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Cerrar Sesión</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-slate-900 border border-red-500/80 rounded-lg px-2 py-1 whitespace-nowrap">
                <span className="text-[11px] text-red-200 font-semibold mr-1">¿Salir?</span>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingLogout(false);
                    logoutLatinaSession();
                  }}
                  aria-label="Confirmar cierre de sesión"
                  className="px-2 py-0.5 rounded bg-[#D32F2F] hover:bg-red-600 text-white text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>Sí, salir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingLogout(false)}
                  aria-label="Cancelar cierre de sesión"
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Botón Menú Desplegable Táctil (Hamburger Menu — Smartphones <= 767px) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Abrir menú corporativo móvil"
            aria-expanded={mobileMenuOpen}
            className="md:hidden px-2.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-amber-400 border border-slate-600 flex items-center gap-1 font-bold text-xs cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span>Menú</span>
          </button>
        </div>
      </div>

      {/* Drawer / Menú Desplegable Táctil para Smartphones (<= 767px) */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 pt-2.5 border-t border-slate-700/90 bg-slate-950/95 rounded-xl p-3 space-y-2 shadow-2xl animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between text-xs px-1 pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Shield className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <span className="font-bold text-white">{user.nombreCompleto}</span>
            </div>
            <span className="text-[11px] text-amber-400 font-mono">
              {user.rol} · Nivel {roleLevel}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {uiConfig.roleVisibility.SUPERVISOR.showAuditHistoryButton && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuditHistoryModal();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1E293B] hover:bg-slate-700 text-slate-100 border border-slate-600 text-xs font-bold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-amber-400" />
                  <span>📋 Historial de Bitácora / PDF</span>
                </span>
                <span className="text-[10px] text-slate-400">Abrir →</span>
              </button>
            )}

            {isTicAuthorized && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openUiBuilderModal();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1E293B] hover:bg-slate-700 text-amber-300 border border-amber-500/50 text-xs font-bold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-400" />
                  <span>🎨 Editor de Plataforma (TIC / Admin)</span>
                </span>
                <span className="text-[10px] text-amber-300">Configurar →</span>
              </button>
            )}

            {isTicAuthorized && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openSysConfigModal();
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1E293B] hover:bg-slate-700 text-slate-100 border border-amber-500/50 text-xs font-bold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#F59E0B]" />
                  <span>⚙️ Conexiones TIC / API</span>
                </span>
                <span className="text-[10px] text-slate-400">{sem.shortLabel}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                logoutLatinaSession();
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#D32F2F] hover:bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión Corporativa</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
