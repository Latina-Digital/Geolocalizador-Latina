import React from 'react';
import { User, UserRole, SuspiciousAlert } from '../types';
import { 
  ShieldCheck, 
  MapPin, 
  Bell, 
  FileText, 
  LogOut, 
  UserCheck, 
  Compass, 
  Truck, 
  Briefcase 
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onOpenAlerts: () => void;
  onOpenReports: () => void;
  onSwitchUser: () => void;
  activeAlerts: SuspiciousAlert[];
  isTrackingActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAlerts,
  onOpenReports,
  onSwitchUser,
  activeAlerts,
  isTrackingActive = false,
}) => {
  const unreadAlerts = activeAlerts.filter(a => !a.resolved).length;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'DIRECTOR_GENERAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-900/50 text-purple-200 border border-purple-700/60">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            Super Administrador
          </span>
        );
      case 'SUPERVISOR_REGIONAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-900/50 text-blue-200 border border-blue-700/60">
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            Supervisor Regional
          </span>
        );
      case 'EJECUTIVO_VENTAS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-900/50 text-amber-200 border border-amber-700/60">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            Ejecutivo Comercial
          </span>
        );
      case 'TRANSPORTISTA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/50 text-emerald-200 border border-emerald-700/60">
            <Truck className="w-3.5 h-3.5 text-emerald-400" />
            Transportista Logístico
          </span>
        );
    }
  };

  return (
    <header className="w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 shadow-md shrink-0">
      <div className="w-full max-w-full px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        {/* Brand & App Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-black shadow-lg shadow-amber-500/20 border border-amber-400/40">
            <MapPin className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-wider text-white">
                GEO <span className="text-amber-500">LATINA</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] tracking-widest uppercase font-bold px-1.5 py-0.5 bg-slate-800 text-amber-400 rounded border border-slate-700">
                INDUSTRIAL LATINA
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Control de Rutas & Telemetría en Tiempo Real
            </p>
          </div>
        </div>

        {/* Center Live GPS Status */}
        <div className="hidden md:flex items-center gap-3 bg-slate-950/60 px-3 py-1.5 rounded-full border border-slate-800">
          <span className={`w-2.5 h-2.5 rounded-full ${isTrackingActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-xs text-slate-300">
            {isTrackingActive ? 'GPS Satelital Activo (Frecuencia: 3s)' : 'Modo Supervisión y Monitoreo'}
          </span>
          <span className="text-xs text-slate-500">|</span>
          <span className="text-xs text-slate-400 font-mono">
            {currentUser.zone}
          </span>
        </div>

        {/* Right Actions & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Suspicious Alerts Notification Bell */}
          <button
            onClick={onOpenAlerts}
            className="relative p-2 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-lg border border-slate-700 transition-colors"
            title="Ver alertas de actividad sospechosa"
            aria-label="Alertas y actividades sospechosas"
          >
            <Bell className="w-5 h-5 text-slate-200" />
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-lg animate-bounce">
                {unreadAlerts}
              </span>
            )}
          </button>

          {/* Reports Modal Trigger */}
          <button
            onClick={onOpenReports}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800/90 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            title="Informes y Cierres de Jornada"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Informes PDF</span>
          </button>

          {/* User Profile & Switcher */}
          <div className="flex items-center gap-2 pl-1 sm:pl-3 border-l border-slate-800">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-9 h-9 rounded-full object-cover border-2 border-amber-500/80 shadow"
            />
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1">
                {currentUser.name}
              </div>
              <div className="mt-0.5">{getRoleBadge(currentUser.role)}</div>
            </div>

            {/* Quick Switch / Login modal button */}
            <button
              onClick={onSwitchUser}
              className="p-2 text-xs font-medium text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Cambiar usuario o rol jerárquico"
              aria-label="Cambiar de usuario o rol"
            >
              <UserCheck className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
