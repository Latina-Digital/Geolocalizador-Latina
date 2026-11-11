import React, { useState } from 'react';
import { User } from '../types';
import { useGeoLatinaSystem } from '../context/GeoLatinaSystemContext';
import { SYSPRO_CONFIGURED_ROLES, canUserAccessTicConfig } from '../services/latinaApiEngine';
import {
  Lock,
  User as UserIcon,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  X,
  Building2,
  Settings,
  Server,
} from 'lucide-react';

interface LoginModalProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  currentUser,
  onSelectUser,
  onClose,
}) => {
  const {
    user: latinaSession,
    loginWithLatinaSoft,
    config,
    openSysConfigModal,
  } = useGeoLatinaSystem();

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRolesList, setShowRolesList] = useState(false);

  const isTicAuthorized = canUserAccessTicConfig(latinaSession);

  const handleSysproLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUser = usuario.trim();
    if (!cleanUser || !password) {
      setErrorMessage('Ingrese su usuario Syspro y contraseña para continuar.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginWithLatinaSoft({
        usuario: cleanUser,
        password,
        sucursal: config.defaultSucursal,
        apiKey: config.apiKey,
      });

      if (result.ok && result.session) {
        onSelectUser({
          id: result.session.mappedGeoLatinaUserId || `usr-${result.session.usuario.toLowerCase()}`,
          name: result.session.nombreCompleto || result.session.usuario,
          email: `${result.session.usuario.toLowerCase()}@industriallatina.com`,
          role: result.session.mappedGeoLatinaRole || 'DIRECTOR_GENERAL',
          phone: currentUser.phone || '+593 99 412 8890',
          zone: result.session.sucursal || config.defaultSucursal,
          avatar: currentUser.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
        });
        onClose();
      } else {
        setErrorMessage(result.error || 'Credenciales inválidas en Syspro.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error de comunicación con el servidor Syspro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="geo-modal-fullviewport bg-slate-900 border border-slate-700/80 rounded-2xl w-[96vw] max-w-2xl h-[92dvh] max-h-[92dvh] p-5 sm:p-6 shadow-2xl flex flex-col justify-between overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black">
              GL
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">GEOLATINA — Perfil y Control de Sesión</h2>
              <p className="text-xs text-slate-400">Autenticación en tiempo real conectada a Syspro</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Session Info Card */}
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Perfil Activo en Plataforma
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/70">
              {latinaSession?.rol || currentUser.role}
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-sm">
              {(latinaSession?.nombreCompleto || currentUser.name).charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">
                {latinaSession?.nombreCompleto || currentUser.name}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Usuario: <span className="font-mono text-amber-300">{latinaSession?.usuario || currentUser.email}</span>
                {latinaSession?.sucursal && ` · ${latinaSession.sucursal}`}
              </div>
            </div>
          </div>

          {/* Exclusivo dentro del perfil ADMIN y usuario XBRIONES: Acceso directo a Configuraciones de Conexiones TIC */}
          {isTicAuthorized && (
            <div className="pt-2.5 mt-2 border-t border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-300 font-bold flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-amber-400" />
                  Área de TIC — Configuración de Conexiones
                </span>
                <span className="font-mono text-[10px] text-emerald-300">
                  Autorizado ({latinaSession?.usuario} · {latinaSession?.rol})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openSysConfigModal();
                }}
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#0A2540] hover:bg-slate-800 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#F59E0B]" />
                  <span>⚙️ Abrir Configuraciones de Conexiones TIC / API</span>
                </span>
                <span className="text-[10px] text-slate-300">Gestionar →</span>
              </button>
            </div>
          )}
        </div>

        {/* Real Syspro Login / Switch User Form */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Cambiar de Cuenta Corporativa Syspro:
            </h3>
            <button
              type="button"
              onClick={() => setShowRolesList(!showRolesList)}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <Layers className="w-3 h-3" />
              <span>{showRolesList ? 'Ocultar Roles' : 'Ver 14 Roles Syspro'}</span>
            </button>
          </div>

          {/* Reference list of Syspro roles */}
          {showRolesList && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 max-h-36 overflow-y-auto space-y-1 scrollbar-thin">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                Roles Configurados en Syspro:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SYSPRO_CONFIGURED_ROLES.map((r) => (
                  <div key={r.codigo} className="p-1 rounded bg-slate-900 border border-slate-800 text-[10px] flex items-center justify-between">
                    <span className="font-mono text-slate-200 truncate">{r.codigo}</span>
                    <span className="text-[9px] text-amber-400 font-semibold shrink-0 ml-1">N{r.nivel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-700 flex items-start gap-2 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSysproLogin} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Usuario Syspro
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Ingrese usuario Syspro"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  disabled={isLoading}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  placeholder="Ingrese su contraseña Syspro"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando en Syspro...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Conectar Cuenta Syspro</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            Industrial Latina S.A.
          </span>
          <span>Conexiones TIC: Perfil ADMIN · XBRIONES</span>
        </div>
      </div>
    </div>
  );
};
