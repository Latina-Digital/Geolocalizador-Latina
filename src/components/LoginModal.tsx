import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../data/mockData';
import { ShieldCheck, Briefcase, Compass, Truck, Lock, Mail, ArrowRight } from 'lucide-react';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = INITIAL_USERS.find(
      u => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (foundUser) {
      onSelectUser(foundUser);
      onClose();
    } else {
      setErrorMessage('Credenciales incorrectas. Seleccione un perfil de acceso rápido abajo para probar.');
    }
  };

  const handleQuickSelect = (user: User) => {
    onSelectUser(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black">
              GL
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">GEO LATINA - Control de Acceso</h2>
              <p className="text-xs text-slate-400">Industrial Latina | Autenticación Jerárquica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        {/* Quick Role Switcher Buttons */}
        <div>
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
            Perfiles de Prueba por Nivel Jerárquico:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {INITIAL_USERS.slice(0, 4).map((u) => {
              const isCurrent = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  onClick={() => handleQuickSelect(u)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                    isCurrent
                      ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/50'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800'
                  }`}
                >
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{u.name}</div>
                    <div className="text-[10px] text-amber-400 font-semibold truncate">
                      {u.role === 'DIRECTOR_GENERAL'
                        ? 'Director General'
                        : u.role === 'SUPERVISOR_REGIONAL'
                        ? (u.zone.includes('Norte') ? 'Supervisora Norte' : 'Supervisor Sur')
                        : u.role === 'EJECUTIVO_VENTAS'
                        ? 'Ejecutivo en Ruta'
                        : 'Transportista'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Fifth user: transportista */}
          <div className="mt-2">
            <button
              onClick={() => handleQuickSelect(INITIAL_USERS[6])} // Manuel Quintero
              className={`w-full p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                currentUser.id === INITIAL_USERS[6].id
                  ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/50'
                  : 'bg-slate-950 hover:bg-slate-800 border-slate-800'
              }`}
            >
              <img
                src={INITIAL_USERS[6].avatar}
                alt={INITIAL_USERS[6].name}
                className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{INITIAL_USERS[6].name}</div>
                <div className="text-[10px] text-emerald-400 font-semibold truncate">
                  Conductor Logístico / Transportista (Camión Hino #24)
                </div>
              </div>
              <span className="text-xs text-slate-400 shrink-0">Fase 2 Pronta Integración</span>
            </button>
          </div>
        </div>

        {/* Manual Login Form */}
        <div className="pt-2 border-t border-slate-800">
          <form onSubmit={handleManualLogin} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Correo Corporativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  placeholder="ejemplo@industriallatina.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Contraseña Segura
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {errorMessage && (
              <p className="text-xs text-red-400 font-medium">{errorMessage}</p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5"
            >
              <span>Acceder con Credenciales</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
