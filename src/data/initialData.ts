import { BranchConfig, Seller } from '../types';

export const INITIAL_BRANCH_CONFIG: BranchConfig = {
  branchName: 'Sede Central - Buenos Aires',
  periodName: 'Septiembre 2026',
  calendarYear: 2026,
  calendarMonth: 9,
  globalTarget: 110000000, // $ 110.000.000 ARS
  autoSumGlobalTarget: false,
  totalWorkingDays: 26, // 30 días del mes - 4 domingos cerrados = 26 días laborables
  currentWorkingDay: 9,
  customDailyTarget: 3400000, // $ 3.400.000 ARS objetivo diario regular (Lunes a Viernes)
  isSaturdayMode: false,
  saturdayBranchTarget: 1900000, // $ 1.900.000 ARS Objetivo Diario Sábados
  dailyTargetOverrides: {},
  dailyTargetNotes: {},
};

// Generador de historial diario para los primeros 9 días
// Excluyendo días domingo (cerrado, 0 venta)
const createInitialHistory = (dailyAverage: number, todayAmount: number): Record<number, number> => {
  const history: Record<number, number> = {};
  for (let day = 1; day <= 8; day++) {
    // Día 6 en Septiembre 2026 es Domingo: Cerrado, sin venta
    if (day === 6) {
      history[day] = 0;
      continue;
    }
    // Día 5 en Septiembre 2026 es Sábado: jornada reducida (~60%)
    if (day === 5) {
      history[day] = Math.round(dailyAverage * 0.62);
      continue;
    }
    // Días hábiles regulares
    const variance = (day % 3 === 0 ? 1.08 : day % 2 === 0 ? 0.95 : 1.0);
    history[day] = Math.round(dailyAverage * variance);
  }
  history[9] = todayAmount;
  return history;
};

const historySeller1 = createInitialHistory(850000, 850000);
const sumSeller1 = Object.values(historySeller1).reduce((a, b) => a + b, 0);

const historySeller2 = createInitialHistory(650000, 1200000);
const sumSeller2 = Object.values(historySeller2).reduce((a, b) => a + b, 0);

const historySeller3 = createInitialHistory(540000, 480000);
const sumSeller3 = Object.values(historySeller3).reduce((a, b) => a + b, 0);

const historySeller4 = createInitialHistory(740000, 980000);
const sumSeller4 = Object.values(historySeller4).reduce((a, b) => a + b, 0);

const historySeller5 = createInitialHistory(550000, 620000);
const sumSeller5 = Object.values(historySeller5).reduce((a, b) => a + b, 0);

// Débitos y Gympass en 0 para carga manual puntual por el usuario
const historyDebitos: Record<number, number> = {};
const sumDebitos = 0;

const historyGympass: Record<number, number> = {};
const sumGympass = 0;

export const INITIAL_SELLERS: Seller[] = [
  {
    id: 'seller-1',
    name: 'Martín González',
    avatarColor: 'bg-zinc-800 text-yellow-400 border border-zinc-700',
    individualTarget: 18000000,
    saturdayTarget: 450000,
    currentSales: sumSeller1,
    todaySales: 850000,
    dailySalesHistory: historySeller1,
    transactionsCount: 14,
  },
  {
    id: 'seller-2',
    name: 'Valentina Rossi',
    avatarColor: 'bg-zinc-800 text-yellow-400 border border-zinc-700',
    individualTarget: 16000000,
    saturdayTarget: 400000,
    currentSales: sumSeller2,
    todaySales: 1200000,
    dailySalesHistory: historySeller2,
    transactionsCount: 11,
  },
  {
    id: 'seller-3',
    name: 'Lucas Benítez',
    avatarColor: 'bg-zinc-800 text-yellow-400 border border-zinc-700',
    individualTarget: 15000000,
    saturdayTarget: 350000,
    currentSales: sumSeller3,
    todaySales: 480000,
    dailySalesHistory: historySeller3,
    transactionsCount: 9,
  },
  {
    id: 'seller-4',
    name: 'Camila Fernández',
    avatarColor: 'bg-zinc-800 text-yellow-400 border border-zinc-700',
    individualTarget: 16000000,
    saturdayTarget: 400000,
    currentSales: sumSeller4,
    todaySales: 980000,
    dailySalesHistory: historySeller4,
    transactionsCount: 13,
  },
  {
    id: 'seller-5',
    name: 'Matías Romero',
    avatarColor: 'bg-zinc-800 text-yellow-400 border border-zinc-700',
    individualTarget: 15000000,
    saturdayTarget: 350000,
    currentSales: sumSeller5,
    todaySales: 620000,
    dailySalesHistory: historySeller5,
    transactionsCount: 10,
  },
  {
    id: 'seller-debitos',
    name: 'Débitos Automáticos',
    avatarColor: 'bg-blue-950/80 text-blue-400 border border-blue-700/60',
    individualTarget: 20000000,
    saturdayTarget: 0,
    currentSales: 0,
    todaySales: 0,
    dailySalesHistory: historyDebitos,
    transactionsCount: 0,
    isPeriodicChannel: true,
  },
  {
    id: 'seller-gympass',
    name: 'Gympass',
    avatarColor: 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60',
    individualTarget: 10000000,
    saturdayTarget: 0,
    currentSales: 0,
    todaySales: 0,
    dailySalesHistory: historyGympass,
    transactionsCount: 0,
    isPeriodicChannel: true,
  },
];
