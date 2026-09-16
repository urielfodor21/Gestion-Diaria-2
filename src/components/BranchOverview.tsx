import React, { useState } from 'react';
import {
  Target,
  Edit3,
  Check,
  X,
  Zap,
  TrendingUp,
  TrendingDown,
  Ban,
} from 'lucide-react';
import { BranchConfig, GlobalCalculations } from '../types';
import { formatARS, formatPercent } from '../utils/formatters';

interface BranchOverviewProps {
  config: BranchConfig;
  metrics: GlobalCalculations;
  onUpdateGlobalTarget: (newTarget: number) => void;
  onUpdateDailyTarget: (newDailyTarget: number) => void;
  onUpdateSaturdayTarget?: (newSaturdayTarget: number) => void;
  onToggleSaturdayMode: () => void;
  readOnly?: boolean;
}

export const BranchOverview: React.FC<BranchOverviewProps> = ({
  config,
  metrics,
  onUpdateGlobalTarget,
  onUpdateDailyTarget,
  onUpdateSaturdayTarget,
  onToggleSaturdayMode,
  readOnly = false,
}) => {
  // Edición rápida de objetivo mensual de sede
  const [isEditingMonthlyTarget, setIsEditingMonthlyTarget] = useState(false);
  const [monthlyTargetInput, setMonthlyTargetInput] = useState(config.globalTarget.toString());

  // Edición rápida de objetivo diario regular (Lunes a Viernes)
  const [isEditingDailyTarget, setIsEditingDailyTarget] = useState(false);
  const [dailyTargetInput, setDailyTargetInput] = useState(
    (config.customDailyTarget || metrics.baseDailyTarget).toString()
  );

  // Edición rápida de objetivo diario de sábados
  const [isEditingSaturdayTarget, setIsEditingSaturdayTarget] = useState(false);
  const [saturdayTargetInput, setSaturdayTargetInput] = useState(
    (config.saturdayBranchTarget || metrics.saturdayTargetSede).toString()
  );

  const handleSaveMonthlyTarget = () => {
    const num = parseFloat(monthlyTargetInput.replace(/[^0-9]/g, ''));
    if (!isNaN(num) && num > 0) {
      onUpdateGlobalTarget(num);
    }
    setIsEditingMonthlyTarget(false);
  };

  const handleCancelMonthlyTarget = () => {
    setMonthlyTargetInput(config.globalTarget.toString());
    setIsEditingMonthlyTarget(false);
  };

  const handleSaveDailyTarget = () => {
    const num = parseFloat(dailyTargetInput.replace(/[^0-9]/g, ''));
    if (!isNaN(num) && num > 0) {
      onUpdateDailyTarget(num);
    }
    setIsEditingDailyTarget(false);
  };

  const handleCancelDailyTarget = () => {
    setDailyTargetInput((config.customDailyTarget || metrics.baseDailyTarget).toString());
    setIsEditingDailyTarget(false);
  };

  const handleSaveSaturdayTarget = () => {
    const num = parseFloat(saturdayTargetInput.replace(/[^0-9]/g, ''));
    if (!isNaN(num) && num > 0 && onUpdateSaturdayTarget) {
      onUpdateSaturdayTarget(num);
    }
    setIsEditingSaturdayTarget(false);
  };

  const handleCancelSaturdayTarget = () => {
    setSaturdayTargetInput((config.saturdayBranchTarget || metrics.saturdayTargetSede).toString());
    setIsEditingSaturdayTarget(false);
  };

  const handleSetAutoDaily100 = () => {
    onUpdateDailyTarget(metrics.dailyTargetSede100 > 0 ? metrics.dailyTargetSede100 : metrics.baseDailyTarget);
    setIsEditingDailyTarget(false);
  };

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 sm:p-5 shadow-xl mb-5 text-zinc-100">
      
      {/* Grilla Principal de 2 Bloques: Objetivo Mensual, Objetivo Diario Sede / Sábados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pb-4 border-b border-zinc-800">
        
        {/* BLOQUE 1: Objetivo Mensual de Sede */}
        <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-yellow-400">
                <Target className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-zinc-400">
                Objetivo Mensual
              </span>
            </div>
            {!isEditingMonthlyTarget && !config.autoSumGlobalTarget && !readOnly && (
              <button
                onClick={() => {
                  setMonthlyTargetInput(metrics.totalTarget.toString());
                  setIsEditingMonthlyTarget(true);
                }}
                className="p-1 text-zinc-500 hover:text-yellow-400 rounded transition cursor-pointer"
                title="Modificar objetivo mensual de la sede"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {isEditingMonthlyTarget ? (
            <div className="my-1 flex items-center gap-1.5">
              <span className="text-zinc-500 font-bold">$</span>
              <input
                type="number"
                value={monthlyTargetInput}
                onChange={(e) => setMonthlyTargetInput(e.target.value)}
                className="w-full bg-zinc-900 border border-yellow-400 text-zinc-100 font-mono font-bold text-sm px-2 py-1 rounded focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveMonthlyTarget}
                className="p-1.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 rounded font-bold cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleCancelMonthlyTarget}
                className="p-1.5 bg-zinc-800 text-zinc-400 rounded cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="my-1">
              <div className="text-xl sm:text-2xl font-mono font-black text-zinc-100 tracking-tight">
                {formatARS(metrics.totalTarget)}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1.5 border-t border-zinc-800/80">
            <span>Acumulado: <strong className="text-zinc-200 font-mono">{formatARS(metrics.totalSales)}</strong></span>
            <span className="font-mono font-bold text-yellow-400">{formatPercent(metrics.completionPercent)}</span>
          </div>
        </div>

        {/* BLOQUE 2: Objetivos Diarios de Sede (Regular vs Sábados) */}
        <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-yellow-400">
                <Zap className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-zinc-400">
                Objetivos Diarios Sede
              </span>
            </div>
            
            {!readOnly && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSetAutoDaily100}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-medium transition cursor-pointer"
                  title="Calcular objetivo diario regular según saldo restante del 100%"
                >
                  Auto (100%)
                </button>
              </div>
            )}
          </div>

          {/* Comparativa de Objetivos: Regular vs Sábados */}
          <div className="my-1 space-y-1.5">
            {/* 1. Objetivo Regular (Lun a Vie) */}
            <div className="flex items-center justify-between bg-zinc-900/90 px-2 py-1 rounded-lg border border-zinc-800/70">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-zinc-300">Lun-Vie:</span>
                {isEditingDailyTarget ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={dailyTargetInput}
                      onChange={(e) => setDailyTargetInput(e.target.value)}
                      className="w-24 bg-zinc-950 border border-yellow-400 text-zinc-100 font-mono text-xs px-1.5 py-0.5 rounded"
                      autoFocus
                    />
                    <button onClick={handleSaveDailyTarget} className="text-yellow-400 hover:text-yellow-300">
                      <Check className="h-3 w-3" />
                    </button>
                    <button onClick={handleCancelDailyTarget} className="text-zinc-500">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <strong className="font-mono text-xs text-zinc-100 font-bold">
                    {formatARS(config.customDailyTarget || metrics.baseDailyTarget)}
                  </strong>
                )}
              </div>
              {!isEditingDailyTarget && !readOnly && (
                <button
                  onClick={() => setIsEditingDailyTarget(true)}
                  className="text-zinc-500 hover:text-yellow-400 p-0.5 transition cursor-pointer"
                  title="Editar objetivo Lun-Vie"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* 2. Objetivo Sábados */}
            <div className="flex items-center justify-between bg-yellow-950/20 px-2 py-1 rounded-lg border border-yellow-900/40">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-yellow-400 flex items-center gap-1">
                  <span>Sábados:</span>
                </span>
                {isEditingSaturdayTarget ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={saturdayTargetInput}
                      onChange={(e) => setSaturdayTargetInput(e.target.value)}
                      className="w-24 bg-zinc-950 border border-yellow-400 text-yellow-300 font-mono text-xs px-1.5 py-0.5 rounded"
                      autoFocus
                    />
                    <button onClick={handleSaveSaturdayTarget} className="text-yellow-400 hover:text-yellow-300">
                      <Check className="h-3 w-3" />
                    </button>
                    <button onClick={handleCancelSaturdayTarget} className="text-zinc-500">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <strong className="font-mono text-xs text-yellow-400 font-bold">
                    {formatARS(config.saturdayBranchTarget || metrics.saturdayTargetSede)}
                  </strong>
                )}
              </div>
              {!isEditingSaturdayTarget && !readOnly && (
                <button
                  onClick={() => setIsEditingSaturdayTarget(true)}
                  className="text-yellow-500 hover:text-yellow-300 p-0.5 transition cursor-pointer"
                  title="Editar objetivo de Sábados"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-800/80">
            <span className="text-zinc-400">Objetivo de hoy: <strong className="text-yellow-400 font-mono">{formatARS(metrics.todaySedeGoal)}</strong></span>
            <span className="text-zinc-400">Hoy: <strong className="text-zinc-200 font-mono">{formatARS(metrics.totalTodaySales)}</strong></span>
          </div>
        </div>

      </div>

      {/* Barra Inferior Acotada con Estado Global de la Sede */}
      <div className="pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">Estado de Sede:</span>
          <span className={`px-2 py-0.5 rounded font-bold text-xs inline-flex items-center gap-1 ${
            metrics.isTargetSurpassed
              ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40'
              : metrics.isPacingPositive
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
          }`}>
            {metrics.isTargetSurpassed
              ? '¡100% Mensual Superado!'
              : metrics.isPacingPositive
              ? 'Por encima de lo esperado'
              : 'Por debajo de lo esperado'}
          </span>

          <span className="text-zinc-500 text-[11px] hidden sm:inline">•</span>
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Ban className="h-3 w-3 text-rose-400" />
            <span>Domingos: cerrado sin venta</span>
          </span>
        </div>

        <div className="text-zinc-400 font-mono text-xs">
          Proyección Cierre: <strong className="text-zinc-100">{formatARS(metrics.projectedMonthEnd)}</strong>
        </div>
      </div>

    </div>
  );
};
