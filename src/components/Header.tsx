import React from 'react';
import { Settings, Sheet, Maximize2, Minimize2, Users, LogOut } from 'lucide-react';
import { BranchConfig } from '../types';

interface HeaderProps {
  config: BranchConfig;
  onOpenAdmin: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  sedeSwitcher?: React.ReactNode;
  userNickname: string;
  userRoleLabel: string;
  onLogout: () => void;
  canEditTargets: boolean;
  canManageUsers: boolean;
  onOpenUsers: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onOpenAdmin,
  isFullscreen,
  onToggleFullscreen,
  sedeSwitcher,
  userNickname,
  userRoleLabel,
  onLogout,
  canEditTargets,
  canManageUsers,
  onOpenUsers,
}) => {
  return (
    <header className="bg-zinc-900 border-b border-zinc-800 text-zinc-100 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

          {/* Logo y Título */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-yellow-400 shrink-0">
              <Sheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black tracking-tight text-zinc-100">
                  Gestión Diaria
                </h1>
                {config.isSaturdayMode && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-yellow-400 border border-zinc-700">
                    Sábado
                  </span>
                )}
                {sedeSwitcher}
              </div>
              <p className="text-xs text-zinc-400">
                {config.branchName} • <span className="text-zinc-200 font-semibold">{config.periodName}</span> • Día {config.currentWorkingDay} de {config.totalWorkingDays}
              </p>
            </div>
          </div>

          {/* Barra de Acciones */}
          <div className="flex items-center flex-wrap gap-2">
            {canManageUsers && (
              <button
                type="button"
                onClick={onOpenUsers}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer"
                title="Crear y administrar usuarios"
              >
                <Users className="h-4 w-4 text-yellow-400" />
                <span>Usuarios</span>
              </button>
            )}

            {canEditTargets && (
              <button
                id="btn-admin-panel"
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer"
                title="Configurar parámetros de sede, días y objetivos"
              >
                <Settings className="h-4 w-4 text-yellow-400" />
                <span>Configuración</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs transition cursor-pointer"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <div className="flex items-center gap-1.5 pl-1 ml-1 border-l border-zinc-800">
              <div className="text-right leading-tight">
                <div className="text-xs font-semibold text-zinc-200">{userNickname}</div>
                <div className="text-[10px] text-zinc-500">{userRoleLabel}</div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 transition cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
