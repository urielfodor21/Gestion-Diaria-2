/**
 * Utilidades de Calendario Comercial
 * Excluye los días domingo (sede cerrada, sin venta)
 * e identifica automáticamente los días sábado con objetivo especial.
 */

export interface CalendarDayInfo {
  dayNumber: number;          // Día del mes (1..31)
  date: Date;
  dateString: string;         // YYYY-MM-DD
  dayOfWeek: number;          // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  dayName: string;            // 'Domingo', 'Lunes', etc.
  shortDayName: string;       // 'Dom', 'Lun', 'Mar', etc.
  dayShort: string;           // Alias corto ('Dom', 'Lun', etc.)
  isSunday: boolean;          // true = Cerrado (descartado)
  isSaturday: boolean;        // true = Objetivo especial de sábado
  isWorkingDay: boolean;      // true si NO es domingo
  workingDayIndex?: number;   // 1..N (índice entre días laborables del mes)
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];

const SHORT_DAY_NAMES_ES = [
  'Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb',
];

/**
 * Obtiene la cantidad de días de un mes (28, 29, 30 o 31).
 */
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

/**
 * Genera la lista de todos los días del mes con su información de calendario,
 * excluyendo domingos de los días laborables.
 */
export const getMonthDays = (year: number, month: number): CalendarDayInfo[] => {
  const totalDays = getDaysInMonth(year, month);
  const result: CalendarDayInfo[] = [];
  let workingCounter = 1;

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const isWorkingDay = !isSunday;

    const padDay = String(day).padStart(2, '0');
    const padMonth = String(month).padStart(2, '0');
    const dateString = `${year}-${padMonth}-${padDay}`;

    result.push({
      dayNumber: day,
      date,
      dateString,
      dayOfWeek,
      dayName: DAY_NAMES_ES[dayOfWeek],
      shortDayName: SHORT_DAY_NAMES_ES[dayOfWeek],
      dayShort: SHORT_DAY_NAMES_ES[dayOfWeek],
      isSunday,
      isSaturday,
      isWorkingDay,
      workingDayIndex: isWorkingDay ? workingCounter++ : undefined,
    });
  }

  return result;
};

/**
 * Cuenta cuántos días laborables (Lunes a Sábado, descartando domingos)
 * tiene un mes determinado.
 */
export const countWorkingDays = (year: number, month: number): number => {
  const days = getMonthDays(year, month);
  return days.filter((d) => d.isWorkingDay).length;
};

/**
 * Cuenta cuántos sábados tiene el mes.
 */
export const countSaturdays = (year: number, month: number): number => {
  const days = getMonthDays(year, month);
  return days.filter((d) => d.isSaturday).length;
};

/**
 * Cuenta cuántos domingos cerrados tiene el mes.
 */
export const countSundays = (year: number, month: number): number => {
  const days = getMonthDays(year, month);
  return days.filter((d) => d.isSunday).length;
};

/**
 * Extrae año y mes de un string de período como "Septiembre 2026"
 * o devuelve los valores del mes actual si no coincide.
 */
export const parsePeriodString = (periodName: string): { year: number; month: number } => {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  if (!periodName || typeof periodName !== 'string') {
    return { year: defaultYear, month: defaultMonth };
  }

  const parts = periodName.trim().split(/\s+/);
  let month = defaultMonth;
  let year = defaultYear;

  for (const part of parts) {
    const num = parseInt(part, 10);
    if (!isNaN(num) && num >= 2020 && num <= 2035) {
      year = num;
    } else {
      const lower = part.toLowerCase();
      const idx = MONTH_NAMES_ES.findIndex((m) => m.toLowerCase().startsWith(lower.slice(0, 3)));
      if (idx >= 0) {
        month = idx + 1;
      }
    }
  }

  return { year, month };
};

/**
 * Formatea mes y año en español, ej: "Septiembre 2026"
 */
export const formatPeriodName = (year: number, month: number): string => {
  const monthName = MONTH_NAMES_ES[month - 1] || 'Mes';
  return `${monthName} ${year}`;
};

/**
 * Devuelve la lista de nombres de meses en español
 */
export const getMonthNames = (): string[] => [...MONTH_NAMES_ES];

/**
 * Determina si un día particular del mes es Domingo (cerrado)
 */
export const isDaySunday = (dayNumber: number, year: number, month: number): boolean => {
  const date = new Date(year, month - 1, dayNumber);
  return date.getDay() === 0;
};

/**
 * Determina si un día particular del mes es Sábado
 */
export const isDaySaturday = (dayNumber: number, year: number, month: number): boolean => {
  const date = new Date(year, month - 1, dayNumber);
  return date.getDay() === 6;
};
