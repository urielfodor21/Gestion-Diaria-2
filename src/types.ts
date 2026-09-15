export interface Seller {
  id: string;
  name: string;
  avatarColor: string;
  individualTarget: number; // en Pesos Argentinos (ARS)
  saturdayTarget: number;   // Objetivo individual exclusivo para días sábado ($ ARS)
  currentSales: number;     // Venta acumulada total del mes en ARS
  todaySales: number;       // Venta del día de hoy en ARS
  dailySalesHistory: Record<number, number>; // Ventas cargadas día por día { [díaLaborable]: montoExacto }
  transactionsCount: number;
  isPeriodicChannel?: boolean; // Canal de liquidación única/puntual (ej. Débitos o Gympass) sin meta diaria dividida
}

export interface BranchConfig {
  branchName: string;
  periodName: string;
  calendarYear?: number;        // Año comercial (ej: 2026)
  calendarMonth?: number;       // Mes comercial (1..12)
  globalTarget: number;         // Objetivo global mensual de sede en ARS
  autoSumGlobalTarget: boolean; // Si es true, el objetivo global es la suma de los vendedores
  totalWorkingDays: number;     // Días laborables totales del mes (descartando domingos)
  currentWorkingDay: number;    // Día del mes actual transcurrido
  customDailyTarget?: number;   // Objetivo diario regular de la sede (Lunes a Viernes, $ ARS)
  isSaturdayMode?: boolean;     // Indicador si la jornada corresponde a día sábado
  saturdayBranchTarget?: number;// Objetivo especial de la sede para el día sábado ($ ARS)
  dailyTargetOverrides?: Record<number, number>; // { [dayNumber]: objetivoEspecialDelDia }
  dailyTargetNotes?: Record<number, string>;     // { [dayNumber]: "Débitos Automáticos" | "Gympass" | nota }
}

export interface DailyCloseEntry {
  sellerId: string;
  dayNumber: number;
  amount: number;
}

export interface SellerCalculations {
  seller: Seller;
  completionPercent: number;        // % de la meta alcanzada
  expectedPercent: number;          // % esperado según día actual
  pacingVariancePercent: number;    // % por encima o por debajo de lo esperado
  expectedSalesToDate: number;      // Venta esperada en ARS al día de hoy
  pacingVarianceAmount: number;     // $ por encima (+) o debajo (-) de la venta esperada
  isPacingPositive: boolean;        // true si está por encima o igual a lo esperado
  diffTotalTarget: number;          // Venta actual - Objetivo total ($)
  isTargetSurpassed: boolean;       // true si ya superó el 100% de la meta
  baseDailyTarget: number;          // Objetivo diario base ($ / total días)
  remainingDailyTargetNeeded: number; // Objetivo diario necesario para alcanzar el 100%
  dailyTarget100: number;           // Objetivo diario actualizado para alcanzar el 100%
  dailyTarget140: number;           // Objetivo diario actualizado para alcanzar el 140%
  isTarget100Surpassed: boolean;    // true si ya completó el 100%
  isTarget140Surpassed: boolean;    // true si ya completó el 140%
  target140Total: number;           // Meta total al 140% ($ ARS)
  saturdayTarget: number;           // Objetivo específico del día sábado ($ ARS)
  todayGoal: number;                // Meta específica del día de hoy (según si es sábado o regular)
  todayVariance: number;            // todaySales - todayGoal
  isTodayPositive: boolean;         // true si la venta de hoy superó la meta diaria
  remainingDays: number;
  projectedMonthEnd: number;        // Proyección de cierre de mes de este vendedor según su ritmo actual
}

export interface GlobalCalculations {
  totalTarget: number;
  totalSales: number;
  totalTodaySales: number;
  totalTransactions: number;
  completionPercent: number;
  expectedPercent: number;
  expectedSalesToDate: number;
  pacingVarianceAmount: number;
  pacingVariancePercent: number;
  isPacingPositive: boolean;
  diffTotalTarget: number;
  isTargetSurpassed: boolean;
  baseDailyTarget: number;
  remainingDailyTargetNeeded: number;
  projectedMonthEnd: number;
  dailyTargetSede: number;
  dailyTargetSede100: number;
  dailyTargetSede140: number;
  saturdayTargetSede: number;
  todaySedeGoal: number;
  todaySedeVariance: number;
  isTodaySedePositive: boolean;
  remainingDays: number;
  sundaysClosedCount?: number;   // Domingos descartados en el mes
  saturdaysCount?: number;       // Cantidad de sábados en el mes
  isTodaySaturday?: boolean;     // Si el día actual es sábado
  isTodaySunday?: boolean;       // Si el día actual es domingo (cerrado)
}

export interface SaleRecord {
  id: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  timestamp: string;
  clientName?: string;
  note?: string;
}


// ==================== Usuarios, roles y sedes (multi-sede) ====================

export type UserRole = 'vendedor' | 'coordinador' | 'regional' | 'administrador';

export interface UserProfile {
  id: string;          // uuid, igual al id de auth.users
  nickname: string;
  role: UserRole;
  sedeIds: string[];   // sedes a las que tiene acceso (ignorado para 'administrador', que ve todas)
}

export interface SedeSummary {
  id: string;
  name: string;
  updatedAt?: string;
}
