import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Save,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  RotateCcw,
  CreditCard,
  Activity,
  Check,
  X,
  Target,
  ArrowUpRight,
  Ban,
  Zap,
  CalendarDays,
  Sheet,
} from 'lucide-react';
import { BranchConfig, GlobalCalculations, Seller, SellerCalculations } from '../types';
import { formatARS } from '../utils/formatters';
import {
  getMonthDays,
  parsePeriodString,
  getDaysInMonth,
} from '../utils/calendar';

interface DailyClosingBoardProps {
  sellers: Seller[];
  sellerMetrics: SellerCalculations[];
  globalMetrics: GlobalCalculations;
  config: BranchConfig;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  onUpdateDailySale: (sellerId: string, dayNumber: number, exactAmount: number) => void;
  onUpdateDayTarget: (dayNumber: number, target: number, note?: string) => void;
  onResetDayTarget: (dayNumber: number) => void;
  onAddSeller: (name: string, target: number, saturdayTarget?: number) => void;
  onAddPeriodicSaleAndAdjustTarget?: (
    channelType: 'debitos' | 'gympass',
    dayNumber: number,
    amount: number,
    adjustDayTarget: boolean
  ) => void;
  onOpenCalendar?: () => void;
  readOnly?: boolean;
  onUpdateArticulos: (sellerId: string, dayNumber: number, amount: number) => void;
  onAdjustDebitosCount: (sellerId: string, delta: number) => void;
  onUpdateDebitosTarget: (sellerId: string, target: number) => void;
}

export const DailyClosingBoard: React.FC<DailyClosingBoardProps> = ({
  sellers,
  sellerMetrics,
  globalMetrics,
  config,
  selectedDay,
  onSelectDay,
  onUpdateDailySale,
  onUpdateDayTarget,
  onResetDayTarget,
  onAddSeller,
  onAddPeriodicSaleAndAdjustTarget,
  onOpenCalendar,
  readOnly = false,
  onUpdateArticulos,
  onAdjustDebitosCount,
  onUpdateDebitosTarget,
}) => {
  // Inputs numéricos de ventas de cada vendedor para el día seleccionado
  const [inputValues, setInputValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    sellers.forEach((s) => {
      const val = s.dailySalesHistory?.[selectedDay] ?? (selectedDay === config.currentWorkingDay ? s.todaySales : 0);
      initial[s.id] = val > 0 ? val.toString() : '';
    });
    return initial;
  });

  // Venta en Artículos (desglose informativo, no se suma aparte del total)
  const [articulosInputValues, setArticulosInputValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    sellers.forEach((s) => {
      const val = s.articulosHistory?.[selectedDay] ?? 0;
      initial[s.id] = val > 0 ? val.toString() : '';
    });
    return initial;
  });

  // Edición inline del objetivo de Débitos Automáticos por vendedor
  const [editingDebitosTargetId, setEditingDebitosTargetId] = useState<string | null>(null);
  const [debitosTargetInput, setDebitosTargetInput] = useState<string>('');

  const [savedSuccessMap, setSavedSuccessMap] = useState<Record<string, boolean>>({});

  // Editor del objetivo específico del día
  const [isEditingDayTarget, setIsEditingDayTarget] = useState<boolean>(false);
  const [customTargetInput, setCustomTargetInput] = useState<string>('');
  const [customNoteInput, setCustomNoteInput] = useState<string>('');
  const [targetSavedFeedback, setTargetSavedFeedback] = useState<boolean>(false);

  // Modal rápido: "Sumar Débitos / Gympass y ajustar objetivo"
  const [periodicModalChannel, setPeriodicModalChannel] = useState<'debitos' | 'gympass' | null>(null);
  const [periodicModalAmount, setPeriodicModalAmount] = useState<string>('');
  const [periodicModalAdjustTarget, setPeriodicModalAdjustTarget] = useState<boolean>(true);
  const [periodicModalFeedback, setPeriodicModalFeedback] = useState<boolean>(false);

  // Modal para añadir vendedor
  const [isAddSellerOpen, setIsAddSellerOpen] = useState<boolean>(false);
  const [newSellerName, setNewSellerName] = useState<string>('');
  const [newSellerTarget, setNewSellerTarget] = useState<string>('15000000');
  const [newSellerSatTarget, setNewSellerSatTarget] = useState<string>('350000');

  // Filtro en la barra de días: mostrar todos o solo laborables
  const [showAllCalendarDays, setShowAllCalendarDays] = useState<boolean>(true);

  // Detección de calendario
  const { year, month } = config.calendarYear && config.calendarMonth
    ? { year: config.calendarYear, month: config.calendarMonth }
    : parsePeriodString(config.periodName);

  const monthCalendarDays = getMonthDays(year, month);
  const selectedDayInfo = monthCalendarDays.find((d) => d.dayNumber === selectedDay);
  const isSelectedSunday = selectedDayInfo?.isSunday ?? false;
  const isSelectedSaturday = (selectedDayInfo?.isSaturday ?? false) || (config.isSaturdayMode && selectedDay === config.currentWorkingDay);

  // Sincronizar inputs cuando cambia el día seleccionado o los vendedores
  useEffect(() => {
    const updated: Record<string, string> = {};
    sellers.forEach((s) => {
      const val = s.dailySalesHistory?.[selectedDay] ?? (selectedDay === config.currentWorkingDay ? s.todaySales : 0);
      updated[s.id] = val > 0 ? val.toString() : '';
    });
    setInputValues(updated);

    // Sincronizar inputs de Artículos del día seleccionado
    const updatedArticulos: Record<string, string> = {};
    sellers.forEach((s) => {
      const val = s.articulosHistory?.[selectedDay] ?? 0;
      updatedArticulos[s.id] = val > 0 ? val.toString() : '';
    });
    setArticulosInputValues(updatedArticulos);

    // Actualizar campos del editor de objetivo del día
    const currentOverride = config.dailyTargetOverrides?.[selectedDay];
    const currentNote = config.dailyTargetNotes?.[selectedDay] || '';
    if (currentOverride !== undefined) {
      setCustomTargetInput(String(currentOverride));
      setCustomNoteInput(currentNote);
    } else {
      let defaultGoal = config.customDailyTarget || globalMetrics.baseDailyTarget;
      if (isSelectedSunday) {
        defaultGoal = 0;
      } else if (isSelectedSaturday) {
        defaultGoal = config.saturdayBranchTarget || globalMetrics.saturdayTargetSede;
      }
      setCustomTargetInput(String(defaultGoal));
      setCustomNoteInput('');
    }
    setIsEditingDayTarget(false);
  }, [selectedDay, sellers, config, isSelectedSunday, isSelectedSaturday]);

  const handleInputChange = (sellerId: string, val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setInputValues((prev) => ({ ...prev, [sellerId]: clean }));
  };

  const handleApplyAmount = (sellerId: string) => {
    const raw = inputValues[sellerId] || '0';
    const amount = parseInt(raw, 10) || 0;
    onUpdateDailySale(sellerId, selectedDay, amount);

    setSavedSuccessMap((prev) => ({ ...prev, [sellerId]: true }));
    setTimeout(() => {
      setSavedSuccessMap((prev) => ({ ...prev, [sellerId]: false }));
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sellerId: string) => {
    if (e.key === 'Enter') {
      handleApplyAmount(sellerId);
    }
  };

  // --- Venta en Artículos (desglose informativo) ---
  const handleArticulosInputChange = (sellerId: string, val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setArticulosInputValues((prev) => ({ ...prev, [sellerId]: clean }));
  };

  const handleApplyArticulos = (sellerId: string) => {
    const raw = articulosInputValues[sellerId] || '0';
    const amount = parseInt(raw, 10) || 0;
    onUpdateArticulos(sellerId, selectedDay, amount);
  };

  const handleArticulosKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sellerId: string) => {
    if (e.key === 'Enter') {
      handleApplyArticulos(sellerId);
    }
  };

  // --- Débitos Automáticos por vendedor (objetivo + conteo, sin monto) ---
  const handleStartEditDebitosTarget = (sellerId: string, currentTarget: number) => {
    setEditingDebitosTargetId(sellerId);
    setDebitosTargetInput(currentTarget > 0 ? String(currentTarget) : '');
  };

  const handleSaveDebitosTarget = (sellerId: string) => {
    const value = parseInt(debitosTargetInput.replace(/[^0-9]/g, ''), 10) || 0;
    onUpdateDebitosTarget(sellerId, value);
    setEditingDebitosTargetId(null);
  };

  // Suma total cargada en este día seleccionado
  const totalDaySales = sellers.reduce((acc, s) => {
    const val = s.dailySalesHistory?.[selectedDay] ?? (selectedDay === config.currentWorkingDay ? s.todaySales : 0);
    return acc + val;
  }, 0);

  // Objetivo específico de este día
  const dayOverride = config.dailyTargetOverrides?.[selectedDay];
  const dayNote = config.dailyTargetNotes?.[selectedDay];
  const hasOverride = dayOverride !== undefined && dayOverride > 0;

  const effectiveDayGoal = hasOverride
    ? dayOverride
    : isSelectedSunday
    ? 0
    : isSelectedSaturday
    ? (config.saturdayBranchTarget || globalMetrics.saturdayTargetSede)
    : (config.customDailyTarget && config.customDailyTarget > 0 ? config.customDailyTarget : globalMetrics.dailyTargetSede);

  const dayVariance = totalDaySales - effectiveDayGoal;
  const isDayPositive = dayVariance >= 0;

  // Guardar nuevo objetivo para este día
  const handleSaveDayTarget = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTarget = parseInt(customTargetInput.replace(/[^0-9]/g, ''), 10) || 0;
    onUpdateDayTarget(selectedDay, cleanTarget, customNoteInput.trim());
    setTargetSavedFeedback(true);
    setTimeout(() => {
      setTargetSavedFeedback(false);
      setIsEditingDayTarget(false);
    }, 1000);
  };

  // Ajustar objetivo del día exactamente con lo que ingresó
  const handleSetTargetToEnteredSales = () => {
    setCustomTargetInput(String(totalDaySales));
    onUpdateDayTarget(selectedDay, totalDaySales, customNoteInput.trim() || 'Ajustado a ingreso real');
    setTargetSavedFeedback(true);
    setTimeout(() => {
      setTargetSavedFeedback(false);
      setIsEditingDayTarget(false);
    }, 1000);
  };

  // Abrir modal de sumar Débitos o Gympass en el día seleccionado
  const handleOpenPeriodicModal = (channel: 'debitos' | 'gympass') => {
    const targetSeller = sellers.find((s) => {
      const name = s.name.toLowerCase();
      if (channel === 'debitos') return name.includes('débito') || name.includes('debito');
      return name.includes('gympass');
    });
    const currentVal = targetSeller?.dailySalesHistory?.[selectedDay] ?? 0;
    setPeriodicModalChannel(channel);
    setPeriodicModalAmount(currentVal > 0 ? String(currentVal) : '');
    setPeriodicModalAdjustTarget(true);
    setPeriodicModalFeedback(false);
  };

  // Confirmar suma de Débitos / Gympass
  const handleConfirmPeriodicSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodicModalChannel) return;

    const amount = parseInt(periodicModalAmount.replace(/[^0-9]/g, ''), 10) || 0;

    if (onAddPeriodicSaleAndAdjustTarget) {
      onAddPeriodicSaleAndAdjustTarget(
        periodicModalChannel,
        selectedDay,
        amount,
        periodicModalAdjustTarget
      );
    } else {
      const targetSeller = sellers.find((s) => {
        const name = s.name.toLowerCase();
        if (periodicModalChannel === 'debitos') return name.includes('débito') || name.includes('debito');
        return name.includes('gympass');
      });
      if (targetSeller) {
        onUpdateDailySale(targetSeller.id, selectedDay, amount);
      }
      if (periodicModalAdjustTarget) {
        const baseTarget = isSelectedSaturday
          ? (config.saturdayBranchTarget || globalMetrics.saturdayTargetSede)
          : (config.customDailyTarget || globalMetrics.baseDailyTarget);
        const note = periodicModalChannel === 'debitos' ? 'Cobro Débitos Automáticos' : 'Liquidación Gympass';
        onUpdateDayTarget(selectedDay, baseTarget + amount, note);
      }
    }

    setPeriodicModalFeedback(true);
    setTimeout(() => {
      setPeriodicModalFeedback(false);
      setPeriodicModalChannel(null);
    }, 800);
  };

  // Guardar nuevo vendedor
  const handleCreateSeller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSellerName.trim()) return;
    const targetNum = parseInt(newSellerTarget.replace(/[^0-9]/g, ''), 10) || 15000000;
    const satTargetNum = parseInt(newSellerSatTarget.replace(/[^0-9]/g, ''), 10) || Math.round(targetNum * 0.025);
    onAddSeller(newSellerName.trim(), targetNum, satTargetNum);
    setNewSellerName('');
    setIsAddSellerOpen(false);
  };

  // Lista de días a mostrar según calendario
  const displayedDays = showAllCalendarDays
    ? monthCalendarDays
    : monthCalendarDays.filter((d) => !d.isSunday);

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 sm:p-5 shadow-xl">
      
      {/* 1. Selector de Día con Strip Horizontal */}
      <div className="pb-4 border-b border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
              <Calendar className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-100 tracking-tight flex items-center gap-2">
                <span>Pizarra Diaria</span>
                <span className="text-xs font-normal px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {config.periodName}
                </span>
              </h2>
              <span className="text-xs text-zinc-400">
                Selecciona un día para revisar o cargar ventas (domingos cerrados, sábados con meta propia)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Botón Calendario Mensual */}
            {onOpenCalendar && (
              <button
                type="button"
                onClick={onOpenCalendar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-yellow-400 text-xs font-bold border border-zinc-700 shadow-sm cursor-pointer transition"
                title="Abrir vista de calendario mensual completo"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Ver Calendario</span>
              </button>
            )}

            {/* Botón rápido para sumar Débitos */}
            {!readOnly && (
            <button
              type="button"
              onClick={() => handleOpenPeriodicModal('debitos')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/70 hover:bg-blue-900/90 text-blue-300 text-xs font-bold border border-blue-700/60 shadow-sm cursor-pointer transition"
              title="Sumar Débitos Automáticos en este día y ajustar el objetivo"
            >
              <CreditCard className="h-3.5 w-3.5 text-blue-400" />
              <span>Sumar Débitos</span>
            </button>
            )}

            {/* Botón rápido para sumar Gympass */}
            {!readOnly && (
            <button
              type="button"
              onClick={() => handleOpenPeriodicModal('gympass')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 text-xs font-bold border border-emerald-700/60 shadow-sm cursor-pointer transition"
              title="Sumar Gympass en este día y ajustar el objetivo"
            >
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span>Sumar Gympass</span>
            </button>
            )}

            <button
              onClick={() => onSelectDay(Math.max(1, selectedDay - 1))}
              disabled={selectedDay <= 1}
              className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-950 cursor-pointer transition"
              title="Día anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onSelectDay(config.currentWorkingDay)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                selectedDay === config.currentWorkingDay
                  ? 'bg-yellow-400 text-zinc-950 border-yellow-400'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
              }`}
            >
              Hoy (Día {config.currentWorkingDay})
            </button>
            <button
              onClick={() => onSelectDay(Math.min(monthCalendarDays.length, selectedDay + 1))}
              disabled={selectedDay >= monthCalendarDays.length}
              className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-950 cursor-pointer transition"
              title="Día siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-barra con toggle de filtro y leyenda */}
        <div className="flex items-center justify-between gap-2 mb-2 text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              <span>Sábados: meta especial</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Domingos: cerrado</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAllCalendarDays(!showAllCalendarDays)}
            className="text-[11px] px-2 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
          >
            {showAllCalendarDays ? 'Ocultar domingos de la tira' : 'Mostrar mes completo (30 días)'}
          </button>
        </div>

        {/* Barra desplazable de días */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {displayedDays.map((d) => {
            const isSelected = d.dayNumber === selectedDay;
            const isCurrent = d.dayNumber === config.currentWorkingDay;
            const hasSpecial = config.dailyTargetOverrides?.[d.dayNumber] !== undefined;
            const specialNote = config.dailyTargetNotes?.[d.dayNumber];
            const hasSalesRecorded = sellers.some(
              (s) => (s.dailySalesHistory?.[d.dayNumber] ?? 0) > 0
            );

            return (
              <button
                key={d.dayNumber}
                onClick={() => onSelectDay(d.dayNumber)}
                className={`relative px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold flex flex-col items-center justify-center min-w-[58px] shrink-0 transition cursor-pointer ${
                  isSelected
                    ? 'bg-yellow-400 text-zinc-950 border-yellow-400 shadow-md scale-105 z-10'
                    : d.isSunday
                    ? 'bg-rose-950/30 border-rose-900/60 text-rose-300 hover:bg-rose-900/40'
                    : d.isSaturday
                    ? 'bg-amber-950/30 border-amber-800/60 text-amber-300 hover:bg-amber-900/40'
                    : isCurrent
                    ? 'bg-zinc-950 border-yellow-400/60 text-yellow-400 hover:bg-zinc-800'
                    : hasSpecial
                    ? 'bg-zinc-950 border-blue-600/60 text-blue-300 hover:bg-zinc-800'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
                title={
                  d.isSunday
                    ? `Día ${d.dayNumber} (${d.dayName}): Domingo cerrado, sin venta`
                    : d.isSaturday
                    ? `Día ${d.dayNumber} (${d.dayName}): Jornada de Sábado con meta propia`
                    : hasSpecial
                    ? `Día ${d.dayNumber}: ${specialNote || 'Objetivo especial'}`
                    : `Día ${d.dayNumber} (${d.dayName})`
                }
              >
                <div className="flex items-center gap-1">
                  <span>Día {d.dayNumber}</span>
                </div>
                <span className={`text-[9px] uppercase font-bold mt-0.5 ${
                  isSelected
                    ? 'text-zinc-950'
                    : d.isSunday
                    ? 'text-rose-400'
                    : d.isSaturday
                    ? 'text-yellow-400'
                    : 'text-zinc-400'
                }`}>
                  {d.isSunday ? 'Cerrado' : d.dayShort}
                </span>

                {hasSpecial && !d.isSunday && (
                  <span className={`text-[8px] font-sans font-extrabold uppercase px-1 rounded mt-0.5 ${
                    isSelected ? 'bg-zinc-950 text-yellow-400' : 'bg-blue-950 text-blue-300 border border-blue-800'
                  }`}>
                    {specialNote ? specialNote.slice(0, 6) : 'Esp'}
                  </span>
                )}
                {!hasSpecial && hasSalesRecorded && (
                  <span className={`h-1.5 w-1.5 rounded-full mt-0.5 ${
                    isSelected ? 'bg-zinc-950' : 'bg-emerald-400'
                  }`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Tarjeta del Objetivo y Resultados del Día Seleccionado */}
      <div className="my-4 bg-zinc-950/80 rounded-2xl p-4 border border-zinc-800">
        
        {/* Banner contextual de Domingo Cerrado */}
        {isSelectedSunday && (
          <div className="mb-3 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center gap-2.5 text-rose-300 text-xs">
            <Ban className="h-5 w-5 text-rose-400 shrink-0" />
            <div>
              <strong className="text-rose-200">Domingo Cerrado (Descartado):</strong> La sede permanece cerrada los domingos. Este día no suma al objetivo ni genera requerimiento comercial.
            </div>
          </div>
        )}

        {/* Banner contextual de Sábado con Objetivo Propio */}
        {isSelectedSaturday && !isSelectedSunday && (
          <div className="mb-3 p-3 rounded-xl bg-yellow-950/30 border border-yellow-700/50 flex items-center justify-between gap-2.5 text-yellow-300 text-xs">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400 shrink-0" />
              <div>
                <strong className="text-yellow-200">Objetivo Diario Sábados:</strong> Jornada con meta diferenciada de sede de <span className="font-mono font-bold text-yellow-400">{formatARS(effectiveDayGoal)}</span>.
              </div>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 text-[10px] font-bold uppercase border border-yellow-400/30">
              Sábado Activo
            </span>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-zinc-400">
                Día {selectedDay} ({selectedDayInfo?.dayName || 'Día'})
              </span>
              {isSelectedSunday && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  Cerrado (Descartado)
                </span>
              )}
              {isSelectedSaturday && !isSelectedSunday && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-400/20 text-yellow-400 border border-yellow-400/30">
                  Objetivo Sábado
                </span>
              )}
              {hasOverride && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {dayNote || 'Objetivo Especial'}
                </span>
              )}
            </div>
            <div className="text-lg sm:text-xl font-black text-zinc-100 mt-0.5">
              Objetivo del Día: <span className="text-yellow-400 font-mono">
                {isSelectedSunday ? '$ 0 (Cerrado)' : formatARS(effectiveDayGoal)}
              </span>
            </div>
          </div>

          {/* Botones de acción del objetivo del día */}
          {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsEditingDayTarget(!isEditingDayTarget)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 transition cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5 text-yellow-400" />
              <span>{isEditingDayTarget ? 'Ocultar Edición' : 'Modificar Objetivo del Día'}</span>
            </button>

            {hasOverride && (
              <button
                type="button"
                onClick={() => onResetDayTarget(selectedDay)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium border border-zinc-800 transition cursor-pointer"
                title="Restablecer este día al objetivo estándar diario"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
          )}
        </div>

        {/* Editor de Objetivo del Día (Desplegable) */}
        {isEditingDayTarget && !readOnly && (
          <form onSubmit={handleSaveDayTarget} className="mt-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-yellow-400 flex items-center gap-1.5">
                <Target className="h-4 w-4" />
                <span>Configurar Objetivo Específico para el Día {selectedDay}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsEditingDayTarget(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Monto Objetivo del Día ($ ARS)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={customTargetInput}
                  onChange={(e) => setCustomTargetInput(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-zinc-100 focus:outline-none focus:border-yellow-400"
                  placeholder="Ej: 25000000"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                  Motivo / Nota del Día
                </label>
                <input
                  type="text"
                  value={customNoteInput}
                  onChange={(e) => setCustomNoteInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-yellow-400"
                  placeholder="Ej: Cobro Débitos Automáticos / Gympass"
                />
              </div>
            </div>

            {/* Accesos rápidos */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-zinc-400 font-medium">Atajos rápidos:</span>
              <button
                type="button"
                onClick={() => {
                  setCustomTargetInput('25000000');
                  setCustomNoteInput('Cobro Débitos Automáticos');
                }}
                className="px-2.5 py-1 rounded-lg bg-blue-950/60 hover:bg-blue-900/80 border border-blue-700/50 text-blue-300 text-xs font-semibold cursor-pointer transition"
              >
                + Débitos Automáticos ($ 25M)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomTargetInput('11000000');
                  setCustomNoteInput('Liquidación Gympass');
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 text-emerald-300 text-xs font-semibold cursor-pointer transition"
              >
                + Gympass ($ 11M)
              </button>
              <button
                type="button"
                onClick={handleSetTargetToEnteredSales}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-yellow-400 text-xs font-bold cursor-pointer transition"
              >
                Ajustar a lo ingresado hoy ({formatARS(totalDaySales)})
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsEditingDayTarget(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{targetSavedFeedback ? '¡Guardado!' : 'Guardar Objetivo'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Métricas del día */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div className="bg-zinc-900/80 rounded-xl p-3 border border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
              Objetivo del Día
            </span>
            <div className="text-base sm:text-lg font-mono font-black text-yellow-400">
              {formatARS(effectiveDayGoal)}
            </div>
          </div>

          <div className="bg-zinc-900/80 rounded-xl p-3 border border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
              Total Ingresado en el Día
            </span>
            <div className="text-base sm:text-lg font-mono font-black text-zinc-100">
              {formatARS(totalDaySales)}
            </div>
          </div>

          <div className="bg-zinc-900/80 rounded-xl p-3 border border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">
              Resultado del Día
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-base sm:text-lg font-mono font-black ${
                  isDayPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isDayPositive ? '+' : '-'}{formatARS(Math.abs(dayVariance))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Cabecera de Vendedores y Botón Añadir Vendedor */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-bold text-zinc-400 flex items-center gap-2">
          <span>Vendedores y Canales</span>
          <span className="text-zinc-600">({sellers.length})</span>
        </h3>

        {!readOnly && (
        <button
          type="button"
          onClick={() => setIsAddSellerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-zinc-950 font-bold text-xs shadow transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Añadir Vendedor</span>
        </button>
        )}
      </div>

      {/* Modal para Añadir Vendedor */}
      {isAddSellerOpen && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Plus className="h-4 w-4 text-yellow-400" />
                <span>Añadir Nuevo Vendedor / Canal</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSellerOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSeller} className="space-y-3 mt-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSellerName}
                  onChange={(e) => setNewSellerName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-yellow-400"
                  placeholder="Ej: Sofía Martínez"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Objetivo Mensual ($ ARS)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newSellerTarget}
                  onChange={(e) => setNewSellerTarget(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-100 focus:outline-none focus:border-yellow-400"
                  placeholder="15000000"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Objetivo Sábados ($ ARS)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newSellerSatTarget}
                  onChange={(e) => setNewSellerSatTarget(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-yellow-400 focus:outline-none focus:border-yellow-400"
                  placeholder="350000"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddSellerOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Crear Vendedor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Lista de Carga por Vendedor para el Día Seleccionado */}
      <div className="space-y-2.5">
        {sellerMetrics.map((item) => {
          const { seller } = item;
          const currentDayRecorded = seller.dailySalesHistory?.[selectedDay] ?? (selectedDay === config.currentWorkingDay ? seller.todaySales : 0);
          
          const isDebitos = seller.name.toLowerCase().includes('débito') || seller.name.toLowerCase().includes('debito');
          const isGympass = seller.name.toLowerCase().includes('gympass');
          const isPeriodic = isDebitos || isGympass || seller.isPeriodicChannel;

          const sellerDayTarget = isPeriodic
            ? 0
            : isSelectedSunday
            ? 0
            : isSelectedSaturday
            ? (seller.saturdayTarget || 0)
            : item.dailyTarget100;

          const diff = currentDayRecorded - sellerDayTarget;
          const isPositive = diff >= 0;
          const isPending = currentDayRecorded === 0;
          const isSaved = savedSuccessMap[seller.id];

          return (
            <div
              key={seller.id}
              className={`rounded-xl p-3 border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                isDebitos
                  ? 'bg-blue-950/25 border-blue-900/60 hover:border-blue-700'
                  : isGympass
                  ? 'bg-emerald-950/25 border-emerald-900/60 hover:border-emerald-700'
                  : isSelectedSunday
                  ? 'bg-zinc-950/40 border-zinc-800/60 opacity-80'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Información del Vendedor */}
              <div className="flex items-center gap-3 min-w-[220px]">
                <div className={`h-9 w-9 rounded-lg border font-bold flex items-center justify-center text-xs shrink-0 ${
                  isDebitos
                    ? 'bg-blue-950 border-blue-700 text-blue-400'
                    : isGympass
                    ? 'bg-emerald-950 border-emerald-700 text-emerald-400'
                    : 'bg-zinc-800 border-zinc-700 text-yellow-400'
                }`}>
                  {isDebitos ? (
                    <CreditCard className="h-4 w-4" />
                  ) : isGympass ? (
                    <Activity className="h-4 w-4" />
                  ) : (
                    seller.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-zinc-100 text-xs sm:text-sm">
                      {seller.name}
                    </h4>
                    {isDebitos && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Cobro puntual (sin meta diaria)
                      </span>
                    )}
                    {isGympass && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Cobro puntual (sin meta diaria)
                      </span>
                    )}
                    {isSelectedSunday && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        Domingo cerrado
                      </span>
                    )}
                    {isSelectedSaturday && !isPeriodic && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        Objetivo Sábado
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                    <span>Objetivo del día:</span>
                    <strong className="font-mono text-yellow-400">
                      {isPeriodic
                        ? '$ 0 (Puntual / Sin meta diaria)'
                        : isSelectedSunday
                        ? '$ 0 (Domingo cerrado)'
                        : isSelectedSaturday
                        ? `${formatARS(sellerDayTarget)} (Sábado)`
                        : formatARS(sellerDayTarget)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Indicador de Estado del Día */}
              <div className="flex items-center gap-2 text-xs font-mono">
                {isPending ? (
                  <span className="px-2.5 py-1 rounded-md bg-zinc-800/60 text-zinc-400 border border-zinc-700/60 text-[11px] font-medium">
                    Sin monto cargado hoy
                  </span>
                ) : isPeriodic ? (
                  <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-xs flex items-center gap-1">
                    <span>Ingreso cargado: {formatARS(currentDayRecorded)}</span>
                  </span>
                ) : isPositive ? (
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>+{formatARS(diff)}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span>-{formatARS(Math.abs(diff))}</span>
                  </span>
                )}
              </div>

              {/* Input y Acciones para Cargar el Monto del Día */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={inputValues[seller.id] !== undefined ? inputValues[seller.id] : ''}
                    onChange={(e) => handleInputChange(seller.id, e.target.value)}
                    onBlur={() => handleApplyAmount(seller.id)}
                    onKeyDown={(e) => handleKeyDown(e, seller.id)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-7 pr-3 py-1.5 text-xs sm:text-sm font-mono font-bold text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyAmount(seller.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSaved
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-yellow-400 hover:bg-yellow-300 text-zinc-950 shadow-sm'
                  }`}
                  title="Guardar monto de este vendedor"
                >
                  {isSaved ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Guardado</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Cargar</span>
                    </>
                  )}
                </button>

                {/* Botón directo para ajustar el objetivo del día con este ingreso puntual */}
                {isPeriodic && !readOnly && (
                  <button
                    type="button"
                    onClick={() => handleOpenPeriodicModal(isDebitos ? 'debitos' : 'gympass')}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-yellow-400 border border-zinc-700 text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                    title={`Ajustar el objetivo del Día ${selectedDay} sumando este cobro`}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Ajustar Objetivo</span>
                  </button>
                )}
              </div>

              {/* Artículos (desglose informativo) y Débitos Automáticos por vendedor */}
              {!isPeriodic && (
                <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 mt-1 border-t border-zinc-800/70">
                  {/* Venta en Artículos */}
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[11px] text-zinc-500 shrink-0 flex items-center gap-1">
                      <Sheet className="h-3 w-3" />
                      Artículos:
                    </span>
                    <div className="relative flex-1 max-w-[160px]">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-600">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        disabled={readOnly}
                        value={articulosInputValues[seller.id] !== undefined ? articulosInputValues[seller.id] : ''}
                        onChange={(e) => handleArticulosInputChange(seller.id, e.target.value)}
                        onBlur={() => handleApplyArticulos(seller.id)}
                        onKeyDown={(e) => handleArticulosKeyDown(e, seller.id)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-6 pr-2 py-1 text-[11px] font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-yellow-400 disabled:opacity-50 transition"
                        title="De la venta ya cargada, cuánto corresponde a artículos (no se suma aparte)"
                      />
                    </div>
                  </div>

                  {/* Débitos Automáticos: objetivo + conteo */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-500 shrink-0 flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      D.A.:
                    </span>
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      {seller.debitosAutomaticosCount || 0}
                    </span>
                    <span className="text-[11px] text-zinc-600">/</span>
                    {editingDebitosTargetId === seller.id ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        value={debitosTargetInput}
                        onChange={(e) => setDebitosTargetInput(e.target.value.replace(/[^0-9]/g, ''))}
                        onBlur={() => handleSaveDebitosTarget(seller.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveDebitosTarget(seller.id)}
                        className="w-12 bg-zinc-900 border border-yellow-400 rounded-md px-1 py-0.5 text-[11px] font-mono text-zinc-100 focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => handleStartEditDebitosTarget(seller.id, seller.debitosAutomaticosTarget || 0)}
                        className="text-[11px] font-mono text-zinc-400 hover:text-yellow-400 underline decoration-dotted disabled:no-underline disabled:hover:text-zinc-400"
                        title="Click para modificar el objetivo de Débitos Automáticos de este vendedor"
                      >
                        {seller.debitosAutomaticosTarget || 0}
                      </button>
                    )}

                    {!readOnly && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          onClick={() => onAdjustDebitosCount(seller.id, -1)}
                          className="h-6 w-6 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-400 hover:bg-zinc-800 text-xs font-bold flex items-center justify-center cursor-pointer"
                          title="Restar un Débito Automático (por error de carga)"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustDebitosCount(seller.id, 1)}
                          className="h-6 px-2 rounded-md bg-blue-500/15 border border-blue-500/40 text-blue-300 hover:bg-blue-500/25 text-[11px] font-bold flex items-center justify-center gap-0.5 cursor-pointer"
                          title="Sumar un Débito Automático de este vendedor"
                        >
                          +1 D.A.
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Modal para Sumar Débitos o Gympass en el día seleccionado y ajustar objetivo */}
      {periodicModalChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                {periodicModalChannel === 'debitos' ? (
                  <CreditCard className="h-5 w-5 text-blue-400" />
                ) : (
                  <Activity className="h-5 w-5 text-emerald-400" />
                )}
                <div>
                  <h3 className="font-bold text-sm text-zinc-100">
                    {periodicModalChannel === 'debitos' ? 'Sumar Débitos Automáticos' : 'Sumar Liquidación Gympass'}
                  </h3>
                  <span className="text-xs text-yellow-400 font-mono">
                    Aplicar al Día {selectedDay} del mes
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPeriodicModalChannel(null)}
                className="text-zinc-400 hover:text-zinc-200 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPeriodicSale} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Monto Ingresado ($ ARS)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    placeholder="Ej: 25000000"
                    value={periodicModalAmount}
                    onChange={(e) => setPeriodicModalAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-8 pr-4 py-2.5 text-base font-mono font-bold text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-yellow-400"
                  />
                </div>
                {periodicModalAmount && (
                  <span className="text-[11px] text-zinc-400 font-mono mt-1 block">
                    {formatARS(parseInt(periodicModalAmount, 10) || 0)}
                  </span>
                )}
              </div>

              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={periodicModalAdjustTarget}
                    onChange={(e) => setPeriodicModalAdjustTarget(e.target.checked)}
                    className="mt-0.5 rounded bg-zinc-800 border-zinc-700 text-yellow-400 focus:ring-yellow-400 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">
                      Ajustar el objetivo diario de este día
                    </span>
                    <span className="text-[11px] text-zinc-400 leading-tight block mt-0.5">
                      Se suma al objetivo base del día ({formatARS(config.isSaturdayMode ? (config.saturdayBranchTarget || globalMetrics.saturdayTargetSede) : (config.customDailyTarget || globalMetrics.baseDailyTarget))}).
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPeriodicModalChannel(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-zinc-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  {periodicModalFeedback ? (
                    <>
                      <Check className="h-4 w-4 text-zinc-950" />
                      <span>¡Aplicado con éxito!</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Aplicar al Día {selectedDay}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
