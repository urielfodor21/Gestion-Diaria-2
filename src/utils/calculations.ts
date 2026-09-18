import { BranchConfig, GlobalCalculations, Seller, SellerCalculations } from '../types';
import { isDaySaturday, isDaySunday, parsePeriodString, countSundays, countSaturdays } from './calendar';

/**
 * Calcula, día por día, cuánto se esperaba vender hasta el día actual (inclusive),
 * respetando los objetivos especiales de cada día (sábados con objetivo propio y
 * anulaciones manuales) — el mismo criterio, día a día, que usa la grilla de
 * "Vista Rápida". Un reparto parejo (objetivo ÷ días totales × días transcurridos)
 * no sirve como referencia porque no refleja que los sábados suelen tener un
 * objetivo distinto (normalmente menor), y eso hacía que "lo esperado" (y todo lo
 * que depende de él: el estado arriba/abajo, y la proyección de cierre) no
 * coincidiera entre la Pantalla Principal, Vendedores y Vista Rápida.
 */
const calculateWeightedExpected = (
  year: number,
  month: number,
  uptoDay: number,
  weekdayTarget: number,
  saturdayTarget: number,
  overrides?: Record<number, number>
): number => {
  let expected = 0;
  for (let day = 1; day <= uptoDay; day++) {
    if (isDaySunday(day, year, month)) continue;
    const override = overrides?.[day];
    if (override !== undefined && override > 0) {
      expected += override;
      continue;
    }
    expected += isDaySaturday(day, year, month) ? saturdayTarget : weekdayTarget;
  }
  return expected;
};

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

  // Canales periódicos/lump sum (Débitos, Gympass) no tienen objetivo diario dividido
  const isPeriodic = seller.isPeriodicChannel ||
    seller.name.toLowerCase().includes('débito') ||
    seller.name.toLowerCase().includes('debito') ||
    seller.name.toLowerCase().includes('gympass');

  // 2. Objetivo diario base (promedio general del mes)
  const baseDailyTarget = isPeriodic || totalWorkingDays <= 0 ? 0 : Math.round(target / totalWorkingDays);

  // Detección de día sábado o domingo según calendario
  const { year, month } = config.calendarYear && config.calendarMonth
    ? { year: config.calendarYear, month: config.calendarMonth }
    : parsePeriodString(config.periodName);
  const isTodaySat = isSaturdayMode || isDaySaturday(currentWorkingDay, year, month);
  const isTodaySun = isDaySunday(currentWorkingDay, year, month);

  // Objetivo específico de sábado
  const saturdayTarget = isPeriodic ? 0 : (seller.saturdayTarget || Math.round(baseDailyTarget * 0.6));

  // 3. Venta esperada en pesos al día de hoy — sumando día por día, respetando sábados
  const expectedSalesToDate = isPeriodic
    ? 0
    : calculateWeightedExpected(year, month, currentWorkingDay, baseDailyTarget, saturdayTarget);

  // 4. Porcentaje esperado según lo ya calculado arriba (consistente con expectedSalesToDate)
  const expectedPercent = target > 0 ? (expectedSalesToDate / target) * 100 : 0;

  // 5. Desvío por sobre o por debajo de la venta esperada a la fecha
  const pacingVarianceAmount = sales - expectedSalesToDate;
  const pacingVariancePercent = completionPercent - expectedPercent;
  const isPacingPositive = pacingVarianceAmount >= 0;

  // 6. Diferencia total contra la meta
  const diffTotalTarget = sales - target;
  const isTargetSurpassed = sales >= target;

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
  // % de cumplimiento respecto de lo esperado a la fecha (ya calculado día por día arriba).
  // Así, estar arriba de lo esperado implica necesariamente proyectar arriba del 100%.
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

  const baseDailyTarget = totalWorkingDays > 0 ? Math.round(effectiveGlobalTarget / totalWorkingDays) : 0;

  // Objetivo Sábado de la sede (Objetivo Diario Sábados) — se necesita antes de calcular
  // "lo esperado", porque el reparto día por día usa este valor para los sábados.
  const saturdayTargetSede = saturdayBranchTarget && saturdayBranchTarget > 0
    ? saturdayBranchTarget
    : (sellersSaturdaySum > 0 ? sellersSaturdaySum : Math.round(baseDailyTarget * 0.6));

  const weekdayTargetForExpected = customDailyTarget && customDailyTarget > 0 ? customDailyTarget : baseDailyTarget;

  // Venta esperada a la fecha — sumando día por día (sábados y anulaciones manuales
  // incluidas), igual que la grilla de "Vista Rápida", para que ambas pantallas coincidan.
  const expectedSalesToDate = calculateWeightedExpected(
    year,
    month,
    currentWorkingDay,
    weekdayTargetForExpected,
    saturdayTargetSede,
    config.dailyTargetOverrides
  );
  const expectedPercent = effectiveGlobalTarget > 0 ? (expectedSalesToDate / effectiveGlobalTarget) * 100 : 0;

  const pacingVarianceAmount = totalSales - expectedSalesToDate;
  const pacingVariancePercent = completionPercent - expectedPercent;
  const isPacingPositive = pacingVarianceAmount >= 0;

  const diffTotalTarget = totalSales - effectiveGlobalTarget;
  const isTargetSurpassed = totalSales >= effectiveGlobalTarget;

  // Objetivos de sede al 100% y al 140%
  const globalTarget140 = Math.round(effectiveGlobalTarget * 1.4);
  const dailyTargetSede100 = isTargetSurpassed
    ? 0
    : Math.max(0, Math.round((effectiveGlobalTarget - totalSales) / remainingDays));
  const dailyTargetSede140 = totalSales >= globalTarget140
    ? 0
    : Math.max(0, Math.round((globalTarget140 - totalSales) / remainingDays));

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
  // respecto de lo esperado a la fecha (ya calculado día por día arriba, igual que en
  // "Vista Rápida"). Antes se usaba una tasa diaria promedio que no guardaba relación
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
