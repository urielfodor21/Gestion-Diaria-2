import React, { useMemo } from 'react';
import { LayoutGrid, TrendingUp, TrendingDown } from 'lucide-react';
import { BranchConfig, GlobalCalculations, Seller } from '../types';
import { formatARS } from '../utils/formatters';
import { getMonthDays, parsePeriodString } from '../utils/calendar';

interface QuickBoardViewProps {
  sellers: Seller[];
  config: BranchConfig;
  globalMetrics: GlobalCalculations;
  onUpdateNote: (key: string, value: string) => void;
  readOnly?: boolean;
}

interface DayCell {
  dayNumber: number;
  isSaturday: boolean;
  dayTotal: number;
  dayTarget: number;
  cumulativeTotal: number; // acumulado de la sede HASTA este día (incluido)
  cumulativeTarget: number;
}

const COLUMN_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const QuickBoardView: React.FC<QuickBoardViewProps> = ({
  sellers,
  config,
  globalMetrics,
  onUpdateNote,
  readOnly = false,
}) => {
  const { year, month } =
    config.calendarYear && config.calendarMonth
      ? { year: config.calendarYear, month: config.calendarMonth }
      : parsePeriodString(config.periodName);

  const { weeks, finalCumulativeTotal, finalCumulativeTarget } = useMemo(() => {
    const allDays = getMonthDays(year, month);

    let runningTotal = 0;
    let runningTarget = 0;

    const weeksResult: (DayCell | null)[][] = [];
    let currentWeek: (DayCell | null)[] = new Array(6).fill(null);
    let weekStarted = false;

    for (const d of allDays) {
      if (d.isSunday) continue; // La sede no opera los domingos: sin columna para ese día

      const colIndex = d.dayOfWeek - 1; // Lunes(1)->0 ... Sábado(6)->5

      if (colIndex === 0 && weekStarted) {
        weeksResult.push(currentWeek);
        currentWeek = new Array(6).fill(null);
      }

      const dayTotal = sellers.reduce((acc, s) => acc + (Number(s.dailySalesHistory?.[d.dayNumber]) || 0), 0);

      const override = config.dailyTargetOverrides?.[d.dayNumber];
      const dayTarget =
        override !== undefined && override > 0
          ? override
          : d.isSaturday
          ? config.saturdayBranchTarget || globalMetrics.saturdayTargetSede
          : config.customDailyTarget && config.customDailyTarget > 0
          ? config.customDailyTarget
          : globalMetrics.baseDailyTarget; // objetivo parejo (no la tasa de "recuperación" del día de hoy)

      runningTotal += dayTotal;
      // El objetivo acumulado ("esperado") solo suma los días que YA pasaron (hasta hoy inclusive).
      // Sumar días futuros infla el esperado por encima del objetivo mensual real.
      if (d.dayNumber <= config.currentWorkingDay) {
        runningTarget += dayTarget;
      }

      currentWeek[colIndex] = {
        dayNumber: d.dayNumber,
        isSaturday: d.isSaturday,
        dayTotal,
        dayTarget,
        cumulativeTotal: runningTotal,
        cumulativeTarget: runningTarget,
      };
      weekStarted = true;
    }
    if (weekStarted) weeksResult.push(currentWeek);

    return { weeks: weeksResult, finalCumulativeTotal: runningTotal, finalCumulativeTarget: runningTarget };
  }, [sellers, config, globalMetrics]);

  const sedePositive = finalCumulativeTotal >= finalCumulativeTarget;
  const projectedPercent = globalMetrics.totalTarget > 0
    ? (globalMetrics.projectedMonthEnd / globalMetrics.totalTarget) * 100
    : 0;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <LayoutGrid className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-bold text-zinc-200">Vista Rápida — Pizarrón del Mes</h2>
      </div>
      <p className="text-[11px] text-zinc-600 mb-4">
        Solo lectura: un vistazo tipo calendario a todo el mes, con el total vendido cada día.
      </p>

      <div className="overflow-x-auto -mx-2 px-2">
        <div className="min-w-[640px]">
          {/* Encabezado de columnas (días de la semana) */}
          <div className="grid grid-cols-6 gap-1.5 mb-1.5">
            {COLUMN_LABELS.map((label) => (
              <div key={label} className="text-center text-[11px] font-bold text-zinc-500 py-1">
                {label}
              </div>
            ))}
          </div>

          {/* Filas: una por semana */}
          <div className="space-y-1.5">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-6 gap-1.5">
                {week.map((cell, colIdx) => {
                  if (!cell) {
                    const noteKey = `${year}-${month}-w${weekIdx}c${colIdx}`;
                    const noteValue = config.quickBoardNotes?.[noteKey] || '';
                    return (
                      <textarea
                        key={colIdx}
                        defaultValue={noteValue}
                        disabled={readOnly}
                        onBlur={(e) => onUpdateNote(noteKey, e.target.value)}
                        placeholder={readOnly ? '' : 'Nota libre...'}
                        className="rounded-lg bg-zinc-950/30 border border-zinc-900 min-h-[104px] p-2 text-[11px] text-zinc-300 placeholder-zinc-700 resize-none focus:outline-none focus:border-yellow-400 focus:bg-zinc-950/60 disabled:cursor-default transition"
                      />
                    );
                  }

                  const isCurrent = cell.dayNumber === config.currentWorkingDay;
                  const hasData = cell.dayTotal > 0;
                  const dayPositive = cell.dayTotal >= cell.dayTarget;
                  const cumulativeHasData = cell.dayNumber <= config.currentWorkingDay;
                  const cumulativeDelta = cell.cumulativeTotal - cell.cumulativeTarget;
                  const cumulativePositive = cumulativeDelta >= 0;

                  return (
                    <div
                      key={colIdx}
                      title={`Día ${cell.dayNumber}: ${formatARS(cell.dayTotal)} de ${formatARS(cell.dayTarget)} — Acumulado a la fecha: ${formatARS(cell.cumulativeTotal)}`}
                      className={`rounded-lg border min-h-[104px] p-2 flex flex-col justify-between gap-1 transition ${
                        isCurrent
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : hasData
                          ? dayPositive
                            ? 'border-emerald-800/60 bg-emerald-500/10'
                            : 'border-rose-800/60 bg-rose-500/10'
                          : 'border-zinc-800 bg-zinc-950/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold ${isCurrent ? 'text-yellow-400' : 'text-zinc-400'}`}>
                          {cell.dayNumber}
                        </span>
                        {cell.isSaturday && <span className="text-[9px] text-zinc-600">Sáb</span>}
                      </div>

                      <div className="space-y-0.5">
                        {/* Total del día */}
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[9px] text-zinc-600 shrink-0">Día</span>
                          {hasData ? (
                            <span
                              className={`text-[11px] font-mono font-bold ${
                                dayPositive ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {formatARS(cell.dayTotal)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-700">—</span>
                          )}
                        </div>

                        {/* Total acumulado de la sede a la fecha */}
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[9px] text-zinc-600 shrink-0">Acum.</span>
                          {cumulativeHasData ? (
                            <span className="text-[11px] font-mono font-semibold text-zinc-200">
                              {formatARS(cell.cumulativeTotal)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-700">—</span>
                          )}
                        </div>

                        {/* Verde/rojo acumulado: monto exacto por encima o debajo del objetivo acumulado */}
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[9px] text-zinc-600 shrink-0">Vs. obj.</span>
                          {cumulativeHasData ? (
                            <span
                              className={`text-[11px] font-mono font-bold ${
                                cumulativePositive ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {cumulativePositive ? '+' : '-'}
                              {formatARS(Math.abs(cumulativeDelta))}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-700">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumen: acumulado total de la sede */}
      <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] text-zinc-500 block">Acumulado Sede (a la fecha)</span>
          <span className="text-lg font-bold text-zinc-100">{formatARS(finalCumulativeTotal)}</span>
          <span className="text-xs text-zinc-600 ml-2">de {formatARS(finalCumulativeTarget)} esperado</span>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
              sedePositive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}
          >
            {sedePositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {sedePositive ? 'Arriba de lo esperado' : 'Abajo de lo esperado'}
          </span>
          <div className="text-[11px] text-zinc-500 mt-1">
            Proyección de cierre: <strong className="text-zinc-300 font-mono">{formatARS(globalMetrics.projectedMonthEnd)}</strong>
            <span className="ml-1">({projectedPercent.toFixed(1)}% del objetivo)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
