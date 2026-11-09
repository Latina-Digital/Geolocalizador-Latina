/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo 7: Integración en la Barra Superior y Contexto Global
 * Muestra: Logo/Título dinámico, Estado de conexión LatinaWebApi,
 * Campana de Alertas GPS ("🚨 Alertas de Ubicación" solo para Supervisor o superior),
 * Acceso a "📋 Historial / PDF", Acceso a "🎨 Editor de Plataforma" (solo Administrador),
 * Acceso a "⚙️ Config API" y botón de "Cerrar Sesión".
 */

import React, { useState } from 'react';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import { getRoleHierarchyLevel } from '../services/latinaApiEngine';
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

  if (!user) return null;

  const roleLevel = getRoleHierarchyLevel(user.rol);
  const isSupervisorOrAbove = canUserAccessGpsFraudAlerts(user.rol);
  const isAdminLevel = roleLevel >= 4;

  const unacknowledgedFraudCount = gpsFraudAlerts.filter(
    (a) => !a.acknowledgedBySupervisor
  ).length;

  const getSemaphoreDot = () => {
    if (apiSemaphore === 'CONNECTED') {
      return {
        dotClass: 'bg-emerald-400',
        label: lastPingResult ? `LatinaWebApi (${lastPingResult.latencyMs}ms)` : 'LatinaWebApi Conectada',
        textClass: 'text-emerald-300',
      };
    }
    if (apiSemaphore === 'CONTINGENCY') {
      return {
        dotClass: 'bg-[#F59E0B]',
        label: 'LatinaWebApi Contingencia Híbrida',
        textClass: 'text-amber-300',
      };
    }
    return {
      dotClass: 'bg-[#D32F2F]',
      label: 'API Sin Configurar',
      textClass: 'text-red-300',
    };
  };

  const sem = getSemaphoreDot();

  return (
    <div
      style={{ backgroundColor: uiConfig.primaryColor || '#0A2540' }}
      className="border-b border-slate-700/80 text-slate-100 px-3 sm:px-6 py-2 z-40"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
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
            <span className="text-slate-500">|</span>
            <span className="hidden sm:inline">LatinaSoft Conectado</span>
          </span>

          <span className="text-slate-600 hidden sm:inline shrink-0">·</span>

          {/* Semáforo de estado de la API */}
          <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <span className={`w-2 h-2 rounded-full ${sem.dotClass} shrink-0`} />
            <span className={`font-medium ${sem.textClass}`}>{sem.label}</span>
          </div>
        </div>

        {/* Right: Enterprise Actions & Active User */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 ml-auto">
          {/* User Identity & Hierarchy Level */}
          <div className="hidden xl:flex items-center gap-1.5 text-slate-200 whitespace-nowrap mr-1">
            <Shield className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
            <span className="font-semibold text-white">{user.nombreCompleto}</span>
            <span className="text-slate-300 text-[11px]">
              ({user.rol} · N{roleLevel})
            </span>
          </div>

          {/* 1. Campana de Alertas GPS (SOLO para Supervisor Nivel 2 o superior) */}
          {isSupervisorOrAbove && uiConfig.roleVisibility.SUPERVISOR.showGpsFraudBell && (
            <button
              type="button"
              onClick={openGpsFraudDrawer}
              className="px-2.5 py-1.5 rounded-lg bg-red-950/90 hover:bg-red-900 text-red-100 border border-[#D32F2F] text-[11px] font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Auditoría Anti-Fraude GPS (Exclusivo Supervisores, Jefatura y Administración)"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>🚨 Alertas de Ubicación</span>
              <span className="px-1.5 py-0.2 rounded bg-[#D32F2F] text-white text-[10px] font-black tabular-nums">
                {unacknowledgedFraudCount > 0 ? unacknowledgedFraudCount : gpsFraudAlerts.length}
              </span>
            </button>
          )}

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

          {/* 3. Acceso a "🎨 Editor de Plataforma" (SOLO Administrador Nivel 4) */}
          {isAdminLevel && (
            <button
              type="button"
              onClick={openUiBuilderModal}
              className="px-2.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-amber-300 border border-amber-500/50 text-[11px] font-bold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Estudio de Diseño y Estructura (Exclusivo Rol ADMINISTRADOR)"
            >
              <Palette className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>🎨 Editor de Plataforma</span>
            </button>
          )}

          {/* 4. Acceso a "⚙️ Config API" */}
          <button
            type="button"
            onClick={openSysConfigModal}
            className="px-2.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-slate-100 border border-slate-600 text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Configuración de Sistema e Interfaz API LatinaSoft"
          >
            <Settings className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
            <span>⚙️ Config API</span>
          </button>

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
      </div>
    </div>
  );
};
