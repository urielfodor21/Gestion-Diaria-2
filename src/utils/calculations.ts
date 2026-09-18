import { BranchConfig, GlobalCalculations, Seller, SellerCalculations } from '../types';
import { isDaySaturday, isDaySunday, parsePeriodString, countSundays, countSaturdays } from './calendar';

/**
 * Calcula las métricas individuales de cada vendedor:
 * - % alcanzado
 * - % esperado según día actual transcurrido
 * - Desvío positivo (+) o negativo (-) respecto al ritmo esperado
 * - Desvío respecto a la meta total
 * - Objetivo diario necesario para alcanzar el 100% de su meta
 * - Objetivo diario necesario para alcanzar el 140% de su meta (Acelerador)
 * - Objetivo individual para días sábado
 * - Meta y resultado del día de hoy (cierre diario)
 */
export const calculateSellerMetrics = (
  seller: Seller,
  config: BranchConfig
): SellerCalculations => {
  const { totalWorkingDays, currentWorkingDay, isSaturdayMode } = config;
  const target = Math.max(1, seller.individualTarget);
  // El total de ventas SIEMPRE se recalcula a partir del historial diario (fuente de verdad),
  // en vez de confiar en seller.currentSales, que podía desincronizarse por ediciones desde
  // varios dispositivos a la vez (condición de carrera del guardado automático).
  const history = seller.dailySalesHistory || {};
  const sales = Math.max(
    0,
    Object.values(history).reduce((acc: number, v: number) => acc + (Number(v) || 0), 0)
  );
  const todaySalesValue = Number(history[currentWorkingDay]) || 0;
  
  // Días restantes para el cálculo del ritmo diario (mínimo 1)
  const remainingDays = Math.max(1, totalWorkingDays - currentWorkingDay);

  // 1. Porcentaje total alcanzado
  const completionPercent = (sales / target) * 100;

  // 2. Porcentaje esperado según los días transcurridos
  const expectedPercent = totalWorkingDays > 0 ? (currentWorkingDay / totalWorkingDays) * 100 : 0;

  // 3. Venta esperada en pesos al día de hoy
  const expectedSalesToDate = (target * expectedPercent) / 100;

  // 4. Desvío por sobre o por debajo de la venta esperada a la fecha
  const pacingVarianceAmount = sales - expectedSalesToDate;
  const pacingVariancePercent = completionPercent - expectedPercent;
  const isPacingPositive = pacingVarianceAmount >= 0;

  // 5. Diferencia total contra la meta
  const diffTotalTarget = sales - target;
  const isTargetSurpassed = sales >= target;

  // Canales periódicos/lump sum (Débitos, Gympass) no tienen objetivo diario dividido
  const isPeriodic = seller.isPeriodicChannel ||
    seller.name.toLowerCase().includes('débito') ||
    seller.name.toLowerCase().includes('debito') ||
    seller.name.toLowerCase().includes('gympass');

  // 6. Objetivo diario base (promedio general del mes)
  const baseDailyTarget = isPeriodic || totalWorkingDays <= 0 ? 0 : Math.round(target / totalWorkingDays);

  // 7. Metas al 100% y al 140%
  const isTarget100Surpassed = sales >= target;
  const target140Total = Math.round(target * 1.4);
  const isTarget140Surpassed = sales >= target140Total;

  // Objetivo diario necesario para alcanzar el 100%
  const dailyTarget100 = isPeriodic || isTarget100Surpassed
    ? 0
    : Math.max(0, Math.round((target - sales) / remainingDays));

  // Objetivo diario necesario para alcanzar el 140%
  const dailyTarget140 = isPeriodic || isTarget140Surpassed
    ? 0
    : Math.max(0, Math.round((target140Total - sales) / remainingDays));

  // Objetivo específico de sábado
  const saturdayTarget = isPeriodic ? 0 : (seller.saturdayTarget || Math.round(baseDailyTarget * 0.6));

  // Detección de día sábado o domingo según calendario
  const { year, month } = config.calendarYear && config.calendarMonth
    ? { year: config.calendarYear, month: config.calendarMonth }
    : parsePeriodString(config.periodName);
  const isTodaySat = isSaturdayMode || isDaySaturday(currentWorkingDay, year, month);
  const isTodaySun = isDaySunday(currentWorkingDay, year, month);

  // Meta específica del día de hoy
  let todayGoal = 0;
  if (!isPeriodic) {
    if (isTodaySun) {
      todayGoal = 0; // Domingo cerrado, sin meta
    } else if (isTodaySat) {
      todayGoal = saturdayTarget; // Sábado con meta especial de sábado
    } else {
      todayGoal = dailyTarget100 > 0 ? dailyTarget100 : baseDailyTarget;
    }
  }

  const todayVariance = todaySalesValue - todayGoal;
  const isTodayPositive = todayVariance >= 0;

  // Proyección de cierre de mes para este vendedor: se escala el objetivo mensual por el
  // % de cumplimiento respecto de lo esperado a la fecha (mismo criterio que "Vista Rápida").
  // Así, estar arriba de lo esperado implica necesariamente proyectar arriba del 100%.
  // Antes se usaba una tasa diaria promedio (ventas / día actual * días totales) que no
  // guardaba relación directa con "lo esperado" y podía dar resultados contradictorios
  // (ej: ir arriba del ritmo esperado pero proyectar un cierre por debajo del objetivo).
  const currentDailyRate = currentWorkingDay > 0 ? sales / currentWorkingDay : 0;
  const linearProjection = Math.round(currentDailyRate * totalWorkingDays);
  const performanceRatio = expectedSalesToDate > 0 ? sales / expectedSalesToDate : null;
  const projectedMonthEnd = performanceRatio !== null ? Math.round(target * performanceRatio) : linearProjection;

  return {
    seller,
    completionPercent,
    expectedPercent,
    pacingVariancePercent,
    expectedSalesToDate,
    pacingVarianceAmount,
    isPacingPositive,
    diffTotalTarget,
    isTargetSurpassed,
    baseDailyTarget,
    remainingDailyTargetNeeded: dailyTarget100,
    dailyTarget100,
    dailyTarget140,
    isTarget100Surpassed,
    isTarget140Surpassed,
    target140Total,
    saturdayTarget,
    todayGoal,
    todayVariance,
    isTodayPositive,
    remainingDays,
    projectedMonthEnd,
  };
};

/**
 * Calcula las métricas globales para toda la sede:
 * - Total y porcentaje alcanzado
 * - Gestión del objetivo diario de la sede (manual o automático)
 * - Ritmo diario necesario para 100% y 140% de la sede
 * - Distinción para días sábado (Objetivo Diario Sábados)
 * - Descarte de domingos cerrados
 */
export const calculateGlobalMetrics = (
  sellers: Seller[],
  config: BranchConfig
): GlobalCalculations => {
  const {
    totalWorkingDays,
    currentWorkingDay,
    globalTarget,
    autoSumGlobalTarget,
    customDailyTarget,
    isSaturdayMode = false,
    saturdayBranchTarget,
  } = config;

  const { year, month } = config.calendarYear && config.calendarMonth
    ? { year: config.calendarYear, month: config.calendarMonth }
    : parsePeriodString(config.periodName);

  const isTodaySat = isSaturdayMode || isDaySaturday(currentWorkingDay, year, month);
  const isTodaySun = isDaySunday(currentWorkingDay, year, month);
  const sundaysClosedCount = countSundays(year, month);
  const saturdaysCount = countSaturdays(year, month);

  // Igual que en calculateSellerMetrics: se recalcula desde el historial diario real de cada
  // vendedor, no desde el campo currentSales/todaySales que podía quedar desincronizado.
  const sellerTotals = (s: Seller) => {
    const history = s.dailySalesHistory || {};
    const total = Object.values(history).reduce((acc: number, v: number) => acc + (Number(v) || 0), 0);
    const today = Number(history[currentWorkingDay]) || 0;
    return { total, today };
  };
  const totalSales = sellers.reduce((acc, s) => acc + sellerTotals(s).total, 0);
  const totalTodaySales = sellers.reduce((acc, s) => acc + sellerTotals(s).today, 0);
  const totalTransactions = sellers.reduce((acc, s) => acc + s.transactionsCount, 0);
  const sellersTargetSum = sellers.reduce((acc, s) => acc + s.individualTarget, 0);
  const sellersSaturdaySum = sellers.reduce((acc, s) => acc + (s.saturdayTarget || 0), 0);

  const effectiveGlobalTarget = autoSumGlobalTarget ? sellersTargetSum : Math.max(1, globalTarget);
  const remainingDays = Math.max(1, totalWorkingDays - currentWorkingDay);

  const completionPercent = effectiveGlobalTarget > 0 ? (totalSales / effectiveGlobalTarget) * 100 : 0;
  const expectedPercent = totalWorkingDays > 0 ? (currentWorkingDay / totalWorkingDays) * 100 : 0;
  const expectedSalesToDate = (effectiveGlobalTarget * expectedPercent) / 100;

  const pacingVarianceAmount = totalSales - expectedSalesToDate;
  const pacingVariancePercent = completionPercent - expectedPercent;
  const isPacingPositive = pacingVarianceAmount >= 0;

  const diffTotalTarget = totalSales - effectiveGlobalTarget;
  const isTargetSurpassed = totalSales >= effectiveGlobalTarget;

  const baseDailyTarget = totalWorkingDays > 0 ? Math.round(effectiveGlobalTarget / totalWorkingDays) : 0;

  // Objetivos de sede al 100% y al 140%
  const globalTarget140 = Math.round(effectiveGlobalTarget * 1.4);
  const dailyTargetSede100 = isTargetSurpassed
    ? 0
    : Math.max(0, Math.round((effectiveGlobalTarget - totalSales) / remainingDays));
  const dailyTargetSede140 = totalSales >= globalTarget140
    ? 0
    : Math.max(0, Math.round((globalTarget140 - totalSales) / remainingDays));

  // Objetivo Sábado de la sede (Objetivo Diario Sábados)
  const saturdayTargetSede = saturdayBranchTarget && saturdayBranchTarget > 0
    ? saturdayBranchTarget
    : (sellersSaturdaySum > 0 ? sellersSaturdaySum : Math.round(baseDailyTarget * 0.6));

  // Objetivo Diario Efectivo de la Sede
  const currentDayOverride = config.dailyTargetOverrides?.[currentWorkingDay];
  let dailyTargetSede = baseDailyTarget;

  if (currentDayOverride !== undefined && currentDayOverride > 0) {
    dailyTargetSede = currentDayOverride;
  } else if (isTodaySun) {
    // Domingo cerrado: objetivo 0
    dailyTargetSede = 0;
  } else if (isTodaySat) {
    // Sábado: objetivo diario sábado
    dailyTargetSede = saturdayTargetSede;
  } else if (customDailyTarget && customDailyTarget > 0) {
    // Lunes a Viernes regular
    dailyTargetSede = customDailyTarget;
  } else if (!isTargetSurpassed) {
    dailyTargetSede = dailyTargetSede100;
  }

  const todaySedeGoal = dailyTargetSede;
  const todaySedeVariance = totalTodaySales - todaySedeGoal;
  const isTodaySedePositive = todaySedeVariance >= 0;

  // Proyección de cierre de mes: se escala el objetivo total por el % de cumplimiento
  // respecto de lo esperado a la fecha (mismo criterio que "Vista Rápida" y que cada
  // vendedor individual). Antes se usaba una tasa diaria promedio que no guardaba relación
  // directa con "lo esperado" y podía mostrar, por ejemplo, "arriba de lo esperado" junto
  // con una proyección de cierre por debajo del 100% del objetivo — una contradicción.
  const currentDailyRate = currentWorkingDay > 0 ? totalSales / currentWorkingDay : 0;
  const linearProjection = Math.round(currentDailyRate * totalWorkingDays);
  const performanceRatio = expectedSalesToDate > 0 ? totalSales / expectedSalesToDate : null;
  const projectedMonthEnd =
    performanceRatio !== null ? Math.round(effectiveGlobalTarget * performanceRatio) : linearProjection;

  return {
    totalTarget: effectiveGlobalTarget,
    totalSales,
    totalTodaySales,
    totalTransactions,
    completionPercent,
    expectedPercent,
    expectedSalesToDate,
    pacingVarianceAmount,
    pacingVariancePercent,
    isPacingPositive,
    diffTotalTarget,
    isTargetSurpassed,
    baseDailyTarget,
    remainingDailyTargetNeeded: dailyTargetSede100,
    dailyTargetSede,
    dailyTargetSede100,
    dailyTargetSede140,
    saturdayTargetSede,
    todaySedeGoal,
    todaySedeVariance,
    isTodaySedePositive,
    projectedMonthEnd,
    remainingDays,
    sundaysClosedCount,
    saturdaysCount,
    isTodaySaturday: isTodaySat,
    isTodaySunday: isTodaySun,
  };
};
