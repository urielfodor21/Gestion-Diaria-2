import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  Edit3,
  TrendingUp,
  Check,
  CreditCard,
  Activity,
  Ban,
  Calendar,
  Filter,
} from 'lucide-react';
import { BranchConfig, Seller } from '../types';
import { formatARS, formatPercent } from '../utils/formatters';
import {
  getMonthDays,
  parsePeriodString,
  CalendarDayInfo,
} from '../utils/calendar';

interface DailySalesHistoryTableProps {
  sellers: Seller[];
  config: BranchConfig;
  selectedDay?: number;
  onSelectDay?: (day: number) => void;
  onUpdateDailySale: (sellerId: string, dayNumber: number, exactAmount: number) => void;
}

export const DailySalesHistoryTable: React.FC<DailySalesHistoryTableProps> = ({
  sellers,
  config,
  selectedDay,
  onSelectDay,
  onUpdateDailySale,
}) => {
  // Estado para la celda en edición directa
  const [editingCell, setEditingCell] = useState<{
    sellerId: string;
    dayNumber: number;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [lastSavedCell, setLastSavedCell] = useState<string | null>(null);

  // Por defecto ocultar domingos ya que la sede está cerrada y no se vende
  const [hideSundays, setHideSundays] = useState<boolean>(true);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-foco cuando se entra en edición de celda
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Obtener días del calendario
  const { year, month } = config.calendarYear && config.calendarMonth
    ? { year: config.calendarYear, month: config.calendarMonth }
    : parsePeriodString(config.periodName);

  const monthCalendarDays = getMonthDays(year, month);
  const sundaysCount = monthCalendarDays.filter((d) => d.isSunday).length;
  const saturdaysCount = monthCalendarDays.filter((d) => d.isSaturday).length;

  const displayedDays: CalendarDayInfo[] = hideSundays
    ? monthCalendarDays.filter((d) => !d.isSunday)
    : monthCalendarDays;

  // Iniciar edición de una celda
  const handleStartEdit = (sellerId: string, dayNumber: number, currentAmount: number) => {
    setEditingCell({ sellerId, dayNumber });
    setEditValue(currentAmount > 0 ? currentAmount.toString() : '');
  };

  // Confirmar y guardar edición de celda
  const handleCommitEdit = () => {
    if (!editingCell) return;
    const cleanValue = editValue.replace(/[^0-9]/g, '');
    const amount = parseInt(cleanValue, 10) || 0;
    onUpdateDailySale(editingCell.sellerId, editingCell.dayNumber, amount);

    const cellKey = `${editingCell.sellerId}-${editingCell.dayNumber}`;
    setLastSavedCell(cellKey);
    setTimeout(() => setLastSavedCell(null), 1200);

    setEditingCell(null);
    setEditValue('');
  };

  // Navegación con teclado en la tabla
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    currentSellerIndex: number,
    currentDay: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCommitEdit();
      const currentIdxInDisplayed = displayedDays.findIndex((d) => d.dayNumber === currentDay);
      if (e.shiftKey) {
        if (currentIdxInDisplayed > 0) {
          const prevDay = displayedDays[currentIdxInDisplayed - 1].dayNumber;
          const prevVal = sellers[currentSellerIndex]?.dailySalesHistory?.[prevDay] || 0;
          handleStartEdit(sellers[currentSellerIndex].id, prevDay, prevVal);
        }
      } else {
        if (currentIdxInDisplayed < displayedDays.length - 1) {
          const nextDay = displayedDays[currentIdxInDisplayed + 1].dayNumber;
          const nextVal = sellers[currentSellerIndex]?.dailySalesHistory?.[nextDay] || 0;
          handleStartEdit(sellers[currentSellerIndex].id, nextDay, nextVal);
        }
      }
    }
  };

  // Totales por día
  const totalPerDay: Record<number, number> = {};
  monthCalendarDays.forEach((d) => {
    totalPerDay[d.dayNumber] = sellers.reduce((acc, s) => {
      const val = s.dailySalesHistory?.[d.dayNumber] ?? 0;
      return acc + val;
    }, 0);
  });

  // Gran Total Sede Acumulado
  const grandTotalSede = Object.values(totalPerDay).reduce((a, b) => a + b, 0);

  // Exportar a CSV
  const handleExportCSV = () => {
    const headers = [
      'Vendedor',
      ...displayedDays.map((d) => `Dia_${d.dayNumber}_${d.dayShort}`),
      'Total_Acumulado',
      'Meta_Mensual',
      'Porcentaje_Cumplimiento',
    ];

    const rows = sellers.map((s) => {
      const history = s.dailySalesHistory || {};
      const historyValues = Object.values(history) as number[];
      const total: number = historyValues.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
      const target: number = s.individualTarget || 1;
      const pct: number = Math.round((total / target) * 100);

      return [
        `"${s.name}"`,
        ...displayedDays.map((d) => history[d.dayNumber] || 0),
        total,
        target,
        `"${pct}%"`,
      ].join(',');
    });

    const sedeRow = [
      '"TOTAL SEDE"',
      ...displayedDays.map((d) => totalPerDay[d.dayNumber] || 0),
      grandTotalSede,
      config.globalTarget,
      `"${config.globalTarget > 0 ? Math.round((grandTotalSede / config.globalTarget) * 100) : 0}%"`,
    ].join(',');

    const csvContent = [headers.join(','), ...rows, sedeRow].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `historico_ventas_${config.branchName.toLowerCase().replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header de la Planilla */}
      <div className="p-3.5 sm:p-4 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400"></span>
          <h3 className="text-sm font-bold text-zinc-100 tracking-tight">
            Planilla Histórica de Ventas
          </h3>
          <span className="text-xs text-zinc-400">
            • Clic en celda para editar • <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-300">Enter</kbd> guardar
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle para ocultar o mostrar domingos */}
          <button
            type="button"
            onClick={() => setHideSundays(!hideSundays)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
            title={hideSundays ? 'Mostrar todos los días incluyendo domingos cerrados' : 'Ocultar domingos cerrados'}
          >
            <Filter className="h-3.5 w-3.5 text-yellow-400" />
            <span>{hideSundays ? `Domingos descartados (${sundaysCount} d cerrados)` : 'Mostrando mes completo'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition cursor-pointer"
            title="Descargar datos en CSV"
          >
            <Download className="h-3.5 w-3.5 text-yellow-400" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Sub-barra informativa de calendario */}
      <div className="px-4 py-2 bg-zinc-950/50 border-b border-zinc-800/80 flex items-center justify-between gap-3 text-xs text-zinc-400 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-zinc-300">
            <Calendar className="h-3.5 w-3.5 text-yellow-400" />
            <span>{config.periodName}: {config.totalWorkingDays} días laborables</span>
          </span>
          <span className="flex items-center gap-1 text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>{saturdaysCount} Sábados (objetivo especial)</span>
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <Ban className="h-3 w-3" />
            <span>{sundaysCount} Domingos cerrados (descartados de meta)</span>
          </span>
        </div>

        <div className="text-[11px] text-zinc-500">
          Mostrando {displayedDays.length} columnas de días
        </div>
      </div>

      {/* Tabla con scroll horizontal */}
      <div className="overflow-x-auto max-w-full">
        <table className="w-full border-collapse text-left text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">
              {/* Columna Vendedor fija */}
              <th scope="col" className="sticky left-0 z-20 bg-zinc-950 px-4 py-3 min-w-[200px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] border-r border-zinc-800">
                Vendedor / Canal
              </th>

              {/* Columnas para cada día */}
              {displayedDays.map((d) => {
                const isSelected = d.dayNumber === selectedDay;
                const isCurrentDay = d.dayNumber === config.currentWorkingDay;
                const override = config.dailyTargetOverrides?.[d.dayNumber];
                const note = config.dailyTargetNotes?.[d.dayNumber];
                const hasSpecial = override !== undefined;

                return (
                  <th
                    key={d.dayNumber}
                    scope="col"
                    onClick={() => onSelectDay && onSelectDay(d.dayNumber)}
                    className={`px-3 py-2 text-center min-w-[105px] border-r border-zinc-800/60 font-mono transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-yellow-400/20 text-yellow-300 font-black border-b-2 border-b-yellow-400'
                        : d.isSunday
                        ? 'bg-rose-950/20 text-rose-300'
                        : d.isSaturday
                        ? 'bg-amber-950/20 text-amber-300 font-bold'
                        : isCurrentDay
                        ? 'bg-yellow-400/10 text-yellow-400 font-black'
                        : hasSpecial
                        ? 'bg-blue-950/30 text-blue-300'
                        : 'hover:bg-zinc-800/60'
                    }`}
                    title={
                      d.isSunday
                        ? `Día ${d.dayNumber}: Domingo cerrado (descartado)`
                        : d.isSaturday
                        ? `Día ${d.dayNumber}: Jornada de Sábado con meta propia`
                        : hasSpecial
                        ? `Día ${d.dayNumber}: Objetivo especial ${formatARS(override)} (${note || ''})`
                        : `Día ${d.dayNumber}`
                    }
                  >
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <span>Día {d.dayNumber}</span>
                        {isCurrentDay && (
                          <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-yellow-400 text-zinc-950">
                            Hoy
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[9px] font-sans font-bold uppercase ${
                          d.isSunday ? 'text-rose-400' : d.isSaturday ? 'text-yellow-400' : 'text-zinc-500'
                        }`}>
                          {d.dayShort}
                        </span>
                        {d.isSunday && (
                          <span className="text-[8px] px-1 rounded bg-rose-950 text-rose-300 border border-rose-800">
                            Cerrado
                          </span>
                        )}
                        {d.isSaturday && (
                          <span className="text-[8px] px-1 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            Sáb
                          </span>
                        )}
                        {hasSpecial && !d.isSunday && (
                          <span className="text-[8px] font-sans font-extrabold uppercase px-1 rounded bg-blue-500/20 text-blue-300">
                            {note ? note.slice(0, 6) : 'Esp'}
                          </span>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}

              {/* Columnas de Totales a la derecha */}
              <th scope="col" className="px-4 py-3 text-right min-w-[130px] font-mono text-zinc-200 border-l border-zinc-800 bg-zinc-950">
                Total Acumulado
              </th>
              <th scope="col" className="px-4 py-3 text-right min-w-[120px] font-mono text-zinc-400 bg-zinc-950">
                Objetivo Mensual
              </th>
              <th scope="col" className="px-4 py-3 text-center min-w-[90px] text-zinc-400 bg-zinc-950">
                % Meta
              </th>
              <th scope="col" className="px-4 py-3 text-right min-w-[120px] font-mono text-zinc-400 bg-zinc-950">
                Diferencia
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800/70">
            {sellers.map((seller, sellerIdx) => {
              const sellerHistory = seller.dailySalesHistory || {};
              const historyValues = Object.values(sellerHistory) as number[];
              const sellerTotal: number = historyValues.reduce((a: number, b: number) => a + (Number(b) || 0), 0);
              const target: number = seller.individualTarget || 1;
              const completionPct: number = (sellerTotal / target) * 100;
              const diff: number = sellerTotal - target;
              const isOverTarget = diff >= 0;

              const isDebitos = seller.name.toLowerCase().includes('débito') || seller.name.toLowerCase().includes('debito');
              const isGympass = seller.name.toLowerCase().includes('gympass');

              return (
                <tr
                  key={seller.id}
                  className={`transition-colors group ${
                    isDebitos
                      ? 'bg-blue-950/10 hover:bg-blue-950/20'
                      : isGympass
                      ? 'bg-emerald-950/10 hover:bg-emerald-950/20'
                      : 'hover:bg-zinc-800/40'
                  }`}
                >
                  {/* Columna Vendedor (Fija a la izquierda) */}
                  <td className="sticky left-0 z-10 bg-zinc-900 group-hover:bg-zinc-850 px-4 py-2.5 font-semibold text-zinc-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] border-r border-zinc-800">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          isDebitos
                            ? 'bg-blue-950 border border-blue-700 text-blue-400'
                            : isGympass
                            ? 'bg-emerald-950 border border-emerald-700 text-emerald-400'
                            : 'bg-zinc-800 border border-zinc-700 text-yellow-400'
                        }`}
                      >
                        {isDebitos ? (
                          <CreditCard className="h-3.5 w-3.5" />
                        ) : isGympass ? (
                          <Activity className="h-3.5 w-3.5" />
                        ) : (
                          seller.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div>
                        <span className="block font-bold text-zinc-100 leading-tight">
                          {seller.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono font-normal">
                          Objetivo: {formatARS(seller.individualTarget)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Celdas de cada día */}
                  {displayedDays.map((d) => {
                    const day = d.dayNumber;
                    const amount = sellerHistory[day] || 0;
                    const isSelected = day === selectedDay;
                    const isCurrentDay = day === config.currentWorkingDay;
                    const isEditing = editingCell?.sellerId === seller.id && editingCell?.dayNumber === day;
                    const cellKey = `${seller.id}-${day}`;
                    const isJustSaved = lastSavedCell === cellKey;

                    return (
                      <td
                        key={day}
                        onClick={() => !d.isSunday && !isEditing && handleStartEdit(seller.id, day, amount)}
                        className={`px-2 py-2 text-center border-r border-zinc-800/60 font-mono transition cursor-pointer select-none relative ${
                          isSelected
                            ? 'bg-yellow-400/10'
                            : d.isSunday
                            ? 'bg-rose-950/10'
                            : d.isSaturday
                            ? 'bg-amber-950/10'
                            : isCurrentDay
                            ? 'bg-yellow-400/5'
                            : ''
                        } ${
                          isJustSaved
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isEditing
                            ? 'bg-yellow-400/10 p-1'
                            : d.isSunday
                            ? 'text-zinc-600 cursor-not-allowed'
                            : amount > 0
                            ? 'text-zinc-100 hover:bg-zinc-800/70 font-semibold'
                            : 'text-zinc-600 hover:bg-zinc-800/50'
                        }`}
                        title={
                          d.isSunday
                            ? `Día ${day}: Domingo cerrado`
                            : `Clic para editar venta de ${seller.name} en Día ${day}`
                        }
                      >
                        {d.isSunday ? (
                          <span className="text-zinc-600 text-[10px] italic">Cerrado</span>
                        ) : isEditing ? (
                          <div className="relative">
                            <input
                              ref={inputRef}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value.replace(/[^0-9]/g, ''))}
                              onBlur={handleCommitEdit}
                              onKeyDown={(e) => handleCellKeyDown(e, sellerIdx, day)}
                              className="w-full px-1.5 py-1 text-center bg-zinc-950 border-2 border-yellow-400 rounded text-xs font-mono font-bold text-yellow-300 focus:outline-none shadow-md"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1 group/cell">
                            {amount > 0 ? (
                              <span className={isSelected || isCurrentDay ? 'text-yellow-400 font-bold' : 'text-zinc-100'}>
                                {formatARS(amount)}
                              </span>
                            ) : (
                              <span className="text-zinc-600 font-light">-</span>
                            )}
                            <Edit3 className="h-3 w-3 text-zinc-500 opacity-0 group-hover/cell:opacity-100 transition-opacity ml-0.5" />
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Total Acumulado */}
                  <td className="px-4 py-2.5 text-right font-mono font-black text-yellow-400 border-l border-zinc-800 bg-zinc-900/60">
                    {formatARS(sellerTotal)}
                  </td>

                  {/* Objetivo Mensual */}
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-zinc-400">
                    {formatARS(seller.individualTarget)}
                  </td>

                  {/* % Cumplimiento */}
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                        completionPct >= 100
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : completionPct >= (config.currentWorkingDay / config.totalWorkingDays) * 100
                          ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                      }`}
                    >
                      {formatPercent(completionPct)}
                    </span>
                  </td>

                  {/* Diferencia */}
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-bold ${
                      isOverTarget ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isOverTarget ? `+${formatARS(diff)}` : `-${formatARS(Math.abs(diff))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Fila TOTAL SEDE DÍA POR DÍA */}
          <tfoot>
            <tr className="border-t-2 border-zinc-700 bg-zinc-950 font-mono text-xs">
              {/* Etiqueta Fija */}
              <th
                scope="row"
                className="sticky left-0 z-20 bg-zinc-950 px-4 py-3 text-left font-black text-yellow-400 uppercase tracking-wider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] border-r border-zinc-800"
              >
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-yellow-400" />
                  <span>TOTAL SEDE</span>
                </div>
              </th>

              {/* Suma por cada día */}
              {displayedDays.map((d) => {
                const day = d.dayNumber;
                const daySum = totalPerDay[day] || 0;
                const isSelected = day === selectedDay;
                const isCurrentDay = day === config.currentWorkingDay;
                return (
                  <td
                    key={day}
                    className={`px-3 py-3 text-center font-black border-r border-zinc-800/80 ${
                      isSelected
                        ? 'bg-yellow-400/25 text-yellow-300'
                        : d.isSunday
                        ? 'bg-rose-950/20 text-rose-400'
                        : d.isSaturday
                        ? 'bg-amber-950/20 text-amber-300'
                        : isCurrentDay
                        ? 'bg-yellow-400/15 text-yellow-400'
                        : daySum > 0
                        ? 'text-zinc-100'
                        : 'text-zinc-600'
                    }`}
                  >
                    {d.isSunday ? (
                      <span className="text-rose-400 text-[10px] font-normal">Cerrado</span>
                    ) : daySum > 0 ? (
                      formatARS(daySum)
                    ) : (
                      '-'
                    )}
                  </td>
                );
              })}

              {/* Gran Total Acumulado */}
              <td className="px-4 py-3 text-right font-black text-yellow-400 text-sm border-l border-zinc-800 bg-zinc-950">
                {formatARS(grandTotalSede)}
              </td>

              {/* Objetivo Global Sede */}
              <td className="px-4 py-3 text-right font-bold text-zinc-300">
                {formatARS(config.globalTarget)}
              </td>

              {/* % Global Sede */}
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-yellow-400 text-zinc-950">
                  {config.globalTarget > 0 ? formatPercent((grandTotalSede / config.globalTarget) * 100) : '0%'}
                </span>
              </td>

              {/* Diferencia Global Sede */}
              <td
                className={`px-4 py-3 text-right font-black ${
                  grandTotalSede >= config.globalTarget ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {grandTotalSede >= config.globalTarget
                  ? `+${formatARS(grandTotalSede - config.globalTarget)}`
                  : `-${formatARS(Math.abs(grandTotalSede - config.globalTarget))}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

