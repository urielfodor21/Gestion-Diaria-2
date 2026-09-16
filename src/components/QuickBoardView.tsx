import React, { useMemo } from 'react';
import { LayoutGrid, TrendingUp, TrendingDown } from 'lucide-react';
import { BranchConfig, GlobalCalculations, Seller } from '../types';
import { formatARS } from '../utils/formatters';
import { getMonthDays, parsePeriodString } from '../utils/calendar';

interface QuickBoardViewProps {
  sellers: Seller[];
  config: BranchConfig;
  globalMetrics: GlobalCalculations;
}

interface DayRow {
  dayNumber: number;
  label: string; // "1 Mar", "2 Mié", etc.
  isSunday: boolean;
  isSaturday: boolean;
  dayTotal: number;
  dayTarget: number;
  cumulativeTotal: number;
  cumulativeTarget: number;
}

export const QuickBoardView: React.FC<QuickBoardViewProps> = ({ sellers, config, globalMetrics }) => {
  const rows: DayRow[] = useMemo(() => {
    const { year, month } =
      config.calendarYear && config.calendarMonth
        ? { year: config.calendarYear, month: config.calendarMonth }
        : parsePeriodString(config.periodName);

    const monthDays = getMonthDays(year, month).filter((d) => d.isWorkingDay); // sin domingos

    let runningTotal = 0;
    let runningTarget = 0;

    return monthDays.map((d) => {
      const dayTotal = sellers.reduce((acc, s) => acc + (Number(s.dailySalesHistory?.[d.dayNumber]) || 0), 0);

      const override = config.dailyTargetOverrides?.[d.dayNumber];
      const dayTarget =
        override !== undefined && override > 0
          ? override
          : d.isSaturday
          ? config.saturdayBranchTarget || globalMetrics.saturdayTargetSede
          : config.customDailyTarget && config.customDailyTarget > 0
          ? config.customDailyTarget
          : globalMetrics.dailyTargetSede;

      runningTotal += dayTotal;
      runningTarget += dayTarget;

      return {
        dayNumber: d.dayNumber,
        label: `${d.dayNumber} ${d.shortDayName}`,
        isSunday: d.isSunday,
        isSaturday: d.isSaturday,
        dayTotal,
        dayTarget,
        cumulativeTotal: runningTotal,
        cumulativeTarget: runningTarget,
      };
    });
  }, [sellers, config, globalMetrics]);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <LayoutGrid className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-bold text-zinc-200">Vista Rápida — Pizarrón del Mes</h2>
      </div>
      <p className="text-[11px] text-zinc-600 mb-4">
        Solo lectura: un vistazo a todos los días del mes, con el total de cada día y el acumulado de la sede.
      </p>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
          <thead>
            <tr className="text-left text-[11px] font-bold text-zinc-500">
              <th className="py-2 pr-3 sticky left-0 bg-zinc-900/95">Día</th>
              <th className="py-2 pr-3 text-right">Total del Día</th>
              <th className="py-2 pr-3 text-right">Objetivo del Día</th>
              <th className="py-2 pr-3 text-right">Acumulado Sede</th>
              <th className="py-2 pr-3 text-right">Objetivo Acumulado</th>
              <th className="py-2 pr-2 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isCurrent = r.dayNumber === config.currentWorkingDay;
              const cumulativePositive = r.cumulativeTotal >= r.cumulativeTarget;
              const hasAnyData = r.dayTotal > 0 || r.dayNumber <= config.currentWorkingDay;

              return (
                <tr
                  key={r.dayNumber}
                  className={`border-b border-zinc-900 ${isCurrent ? 'bg-yellow-400/5' : ''}`}
                >
                  <td className={`py-2 pr-3 sticky left-0 ${isCurrent ? 'bg-zinc-900' : 'bg-zinc-950/40'} font-semibold`}>
                    <span className={isCurrent ? 'text-yellow-400' : 'text-zinc-300'}>{r.label}</span>
                    {r.isSaturday && <span className="ml-1.5 text-[10px] text-zinc-600">Sáb</span>}
                  </td>
                  <td className="py-2 pr-3 text-right text-zinc-200">
                    {r.dayTotal > 0 ? formatARS(r.dayTotal) : <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="py-2 pr-3 text-right text-zinc-500">{formatARS(r.dayTarget)}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-zinc-100">
                    {hasAnyData ? formatARS(r.cumulativeTotal) : <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="py-2 pr-3 text-right text-zinc-500">{formatARS(r.cumulativeTarget)}</td>
                  <td className="py-2 pr-2 text-right">
                    {hasAnyData && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold ${
                          cumulativePositive ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {cumulativePositive ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
