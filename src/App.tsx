import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { BranchConfig, Seller, GlobalCalculations, SellerCalculations, SedeSummary } from './types';
import { calculateGlobalMetrics, calculateSellerMetrics } from './utils/calculations';
import { INITIAL_BRANCH_CONFIG, INITIAL_SELLERS } from './data/initialData';
import { Header } from './components/Header';
import { BranchOverview } from './components/BranchOverview';
import { DailyClosingBoard } from './components/DailyClosingBoard';
import { DailySalesHistoryTable } from './components/DailySalesHistoryTable';
import { AdminPanel } from './components/AdminPanel';
import { SellersDetailTab } from './components/SellersDetailTab';
import { QuickBoardView } from './components/QuickBoardView';
import { SedeSwitcher } from './components/SedeSwitcher';
import { UserManagementPanel } from './components/UserManagementPanel';
import { LoginScreen } from './components/LoginScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { fetchAccessibleSedes, fetchSede, saveSede, subscribeToSede, createSede, archiveSedeMonth } from './lib/sedeData';
import { ROLE_LABELS, canEditTargets as canEditTargetsFn, canManageUsers as canManageUsersFn } from './lib/roles';
import { getAutoPeriodInfo } from './utils/calendar';

type Tab = 'pizarra' | 'vendedores' | 'vista-rapida';

const AuthenticatedApp: React.FC<{ profile: NonNullable<ReturnType<typeof useAuth>['profile']>; signOut: () => Promise<void> }> = ({
  profile,
  signOut,
}) => {
  const role = profile.role;
  const editable = canEditTargetsFn(role);
  const manageUsers = canManageUsersFn(role);

  // --- Sedes accesibles y sede activa ---
  const [sedes, setSedes] = useState<SedeSummary[]>([]);
  const [currentSedeId, setCurrentSedeId] = useState<string | null>(null);
  const [sedesLoading, setSedesLoading] = useState(true);
  const [sedeLoading, setSedeLoading] = useState(true);

  const loadSedes = useCallback(async () => {
    setSedesLoading(true);
    try {
      const list = await fetchAccessibleSedes(profile);
      setSedes(list);
      setCurrentSedeId((prev) => prev || list[0]?.id || null);
    } catch (err) {
      console.error('No se pudieron cargar las sedes', err);
    } finally {
      setSedesLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadSedes();
  }, [loadSedes]);

  // --- Datos de la sede activa (config + vendedores), sincronizados con Supabase ---
  const [config, setConfig] = useState<BranchConfig | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const remoteUpdateRef = useRef(false);

  useEffect(() => {
    if (!currentSedeId) return;
    let active = true;
    setSedeLoading(true);
    fetchSede(currentSedeId)
      .then((state) => {
        if (!active || !state) return;
        remoteUpdateRef.current = true;
        setConfig(state.config);
        setSellers(state.sellers);
        setSelectedDay(state.config.currentWorkingDay);
      })
      .finally(() => active && setSedeLoading(false));

    const unsubscribe = subscribeToSede(currentSedeId, (state) => {
      remoteUpdateRef.current = true;
      setConfig(state.config);
      setSellers(state.sellers);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentSedeId]);

  // Sincronizar el día/mes automáticamente con el calendario real (sin tocar nada a mano).
  // Si cambió el mes desde la última vez que se abrió la app, primero archiva el mes
  // anterior completo en el histórico y después resetea la pizarra para el mes nuevo,
  // conservando los objetivos de cada vendedor (solo se reinician las ventas cargadas).
  useEffect(() => {
    if (!config || !currentSedeId) return;
    const auto = getAutoPeriodInfo();
    const sameMonth = config.calendarYear === auto.year && config.calendarMonth === auto.month;

    if (sameMonth) {
      if (config.currentWorkingDay !== auto.day) {
        setConfig((prev) => (prev ? { ...prev, currentWorkingDay: auto.day } : prev));
      }
      return;
    }

    (async () => {
      try {
        await archiveSedeMonth(currentSedeId, config, sellers);
      } catch (err) {
        console.error('No se pudo archivar el mes anterior en el histórico', err);
      }
      const resetSellers = sellers.map((s) => ({
        ...s,
        currentSales: 0,
        todaySales: 0,
        dailySalesHistory: {},
        articulosHistory: {},
        debitosAutomaticosCount: 0,
        transactionsCount: 0,
      }));
      setSellers(resetSellers);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              calendarYear: auto.year,
              calendarMonth: auto.month,
              periodName: auto.periodName,
              totalWorkingDays: auto.totalWorkingDays,
              currentWorkingDay: auto.day,
              dailyTargetOverrides: {},
              dailyTargetNotes: {},
              quickBoardNotes: {},
              isSaturdayMode: false,
            }
          : prev
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.calendarYear, config?.calendarMonth, currentSedeId]);

  // Guardar en Supabase cuando config/sellers cambian LOCALMENTE (no por eco de Realtime)
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    if (!currentSedeId || !config) return;
    if (remoteUpdateRef.current) {
      remoteUpdateRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      saveSede(currentSedeId, config, sellers)
        .then(() => setSaveError(false))
        .catch((err) => {
          console.error('Error al guardar la sede', err);
          setSaveError(true);
        });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, sellers]);

  // --- Día seleccionado, modales, pantalla completa, tabs ---
  const [selectedDay, setSelectedDay] = useState<number>(1);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('pizarra');

  useEffect(() => {
    if (config && selectedDay > config.totalWorkingDays) {
      setSelectedDay(config.totalWorkingDays);
    }
  }, [config, selectedDay]);

  // --- Cálculos de negocio ---
  const globalMetrics: GlobalCalculations | null = useMemo(
    () => (config ? calculateGlobalMetrics(sellers, config) : null),
    [sellers, config]
  );
  const sellerMetrics: SellerCalculations[] = useMemo(
    () => (config ? sellers.map((s) => calculateSellerMetrics(s, config)) : []),
    [sellers, config]
  );

  // --- Handlers de datos (todos actúan sobre la sede activa) ---
  const handleUpdateDailySale = (sellerId: string, dayNumber: number, exactAmount: number) => {
    if (!config) return;
    setSellers((prev) =>
      prev.map((s) => {
        if (s.id !== sellerId) return s;
        const history = { ...(s.dailySalesHistory || {}), [dayNumber]: exactAmount };
        const newCurrentSales = Object.values(history).reduce((acc: number, v: number) => acc + (Number(v) || 0), 0);
        const isCurrentDay = dayNumber === config.currentWorkingDay;
        return {
          ...s,
          dailySalesHistory: history,
          currentSales: newCurrentSales,
          todaySales: isCurrentDay ? exactAmount : s.todaySales || 0,
        };
      })
    );
  };

  // Venta en Artículos: desglose informativo de cuánto de la venta YA cargada fue en artículos.
  // No modifica dailySalesHistory ni currentSales — es solo para poder verlo aparte.
  const handleUpdateArticulos = (sellerId: string, dayNumber: number, amount: number) => {
    setSellers((prev) =>
      prev.map((s) => {
        if (s.id !== sellerId) return s;
        return { ...s, articulosHistory: { ...(s.articulosHistory || {}), [dayNumber]: amount } };
      })
    );
  };

  // Débitos Automáticos por vendedor: solo cuenta cantidad de operaciones, no suma montos al total
  const handleAdjustDebitosCount = (sellerId: string, delta: number) => {
    setSellers((prev) =>
      prev.map((s) => {
        if (s.id !== sellerId) return s;
        const nextCount = Math.max(0, (s.debitosAutomaticosCount || 0) + delta);
        return { ...s, debitosAutomaticosCount: nextCount };
      })
    );
  };

  // Nota libre en una celda vacía de la Vista Rápida (no corresponde a ningún día real del mes)
  const handleUpdateQuickBoardNote = (key: string, value: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const notes = { ...(prev.quickBoardNotes || {}) };
      if (value.trim()) {
        notes[key] = value;
      } else {
        delete notes[key];
      }
      return { ...prev, quickBoardNotes: notes };
    });
  };

  const handleUpdateDayTarget = (dayNumber: number, target: number, note?: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const overrides = { ...(prev.dailyTargetOverrides || {}) };
      const notes = { ...(prev.dailyTargetNotes || {}) };
      if (target > 0) {
        overrides[dayNumber] = target;
        if (note) notes[dayNumber] = note;
      } else {
        delete overrides[dayNumber];
        delete notes[dayNumber];
      }
      return { ...prev, dailyTargetOverrides: overrides, dailyTargetNotes: notes };
    });
  };

  const handleResetDayTarget = (dayNumber: number) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const overrides = { ...(prev.dailyTargetOverrides || {}) };
      const notes = { ...(prev.dailyTargetNotes || {}) };
      delete overrides[dayNumber];
      delete notes[dayNumber];
      return { ...prev, dailyTargetOverrides: overrides, dailyTargetNotes: notes };
    });
  };

  const handleAddPeriodicSaleAndAdjustTarget = (
    channelType: 'debitos' | 'gympass',
    dayNumber: number,
    amount: number,
    adjustDayTarget: boolean
  ) => {
    if (!config || !globalMetrics) return;
    const targetSeller = sellers.find((s) => {
      const name = s.name.toLowerCase();
      return channelType === 'debitos' ? name.includes('débito') || name.includes('debito') : name.includes('gympass');
    });
    if (!targetSeller) return;

    const history = { ...(targetSeller.dailySalesHistory || {}), [dayNumber]: amount };
    const newCurrentSales = Object.values(history).reduce((acc: number, v: number) => acc + (Number(v) || 0), 0);
    const isCurrentDay = dayNumber === config.currentWorkingDay;
    const updatedSeller: Seller = {
      ...targetSeller,
      dailySalesHistory: history,
      currentSales: newCurrentSales,
      todaySales: isCurrentDay ? amount : targetSeller.todaySales || 0,
    };
    setSellers((prev) => prev.map((s) => (s.id === targetSeller.id ? updatedSeller : s)));

    if (adjustDayTarget) {
      setConfig((prev) => {
        if (!prev) return prev;
        const defaultBaseTarget = prev.isSaturdayMode
          ? prev.saturdayBranchTarget || globalMetrics.saturdayTargetSede
          : prev.customDailyTarget || globalMetrics.baseDailyTarget;
        const newTarget = defaultBaseTarget + amount;
        const noteName = channelType === 'debitos' ? 'Cobro Débitos Automáticos' : 'Liquidación Gympass';
        return {
          ...prev,
          dailyTargetOverrides: { ...(prev.dailyTargetOverrides || {}), [dayNumber]: newTarget },
          dailyTargetNotes: { ...(prev.dailyTargetNotes || {}), [dayNumber]: noteName },
        };
      });
    }
  };

  const handleAddSeller = (name: string, target: number, saturdayTarget?: number) => {
    const newSeller: Seller = {
      id: `seller-${Date.now()}`,
      name: name.trim() || `Vendedor ${sellers.length + 1}`,
      avatarColor: 'bg-zinc-800 text-yellow-400 border border-zinc-700',
      individualTarget: target || 15000000,
      saturdayTarget: saturdayTarget || 350000,
      currentSales: 0,
      todaySales: 0,
      dailySalesHistory: {},
      transactionsCount: 0,
    };
    setSellers((prev) => [...prev, newSeller]);
    setConfig((prev) => {
      if (!prev) return prev;
      if (!prev.autoSumGlobalTarget) return prev;
      return { ...prev, globalTarget: prev.globalTarget + newSeller.individualTarget };
    });
  };

  const handleUpdateGlobalTarget = (newTarget: number) => setConfig((p) => (p ? { ...p, globalTarget: newTarget } : p));
  const handleUpdateDailyTarget = (v: number) => setConfig((p) => (p ? { ...p, customDailyTarget: v } : p));
  const handleUpdateSaturdayTarget = (v: number) => setConfig((p) => (p ? { ...p, saturdayBranchTarget: v } : p));
  const handleToggleSaturdayMode = () => setConfig((p) => (p ? { ...p, isSaturdayMode: !p.isSaturdayMode } : p));

  const handleSaveConfig = (newConfig: BranchConfig, newSellers: Seller[]) => {
    setConfig(newConfig);
    setSellers(newSellers);
  };

  const handleResetTodaySales = () => {
    if (!config) return;
    setSellers((prev) =>
      prev.map((s) => {
        const history = { ...(s.dailySalesHistory || {}) };
        history[config.currentWorkingDay] = 0;
        const total = Object.values(history).reduce((acc: number, v: number) => acc + (Number(v) || 0), 0);
        return { ...s, todaySales: 0, dailySalesHistory: history, currentSales: total };
      })
    );
  };

  const handleResetMonthSales = () => {
    setSellers((prev) => prev.map((s) => ({ ...s, currentSales: 0, todaySales: 0, dailySalesHistory: {}, transactionsCount: 0 })));
  };

  const handleLoadDemoData = () => {
    setConfig({ ...INITIAL_BRANCH_CONFIG, branchName: config?.branchName || INITIAL_BRANCH_CONFIG.branchName });
    setSellers(INITIAL_SELLERS);
    setSelectedDay(INITIAL_BRANCH_CONFIG.currentWorkingDay);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleCreateSede = async (name: string) => {
    const nueva = await createSede(name);
    await loadSedes();
    setCurrentSedeId(nueva.id);
  };

  // --- Estados de carga / vacío ---
  if (sedesLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm">
        Cargando sedes...
      </div>
    );
  }

  if (!currentSedeId || sedes.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-sm text-zinc-400">Todavía no tenés ninguna sede asignada.</p>
          <p className="text-xs text-zinc-600">Pedile a un Administrador que te asigne una sede, o que cree la primera.</p>
          <button type="button" onClick={signOut} className="text-xs text-yellow-400 hover:underline">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (sedeLoading || !config || !globalMetrics) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm">
        Cargando pizarra...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-yellow-400 selection:text-zinc-950">
      {saveError && (
        <div className="bg-red-500/15 border-b border-red-500/30 text-red-300 text-xs text-center py-1.5 px-4">
          No se pudieron guardar los últimos cambios. Revisá tu conexión — se van a reintentar solos al seguir cargando datos.
        </div>
      )}
      <Header
        config={config}
        onOpenAdmin={() => setIsAdminOpen(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        sedeSwitcher={
          <SedeSwitcher
            sedes={sedes}
            currentSedeId={currentSedeId}
            onSelectSede={setCurrentSedeId}
            canCreateSede={manageUsers}
            onCreateSede={handleCreateSede}
          />
        }
        userNickname={profile.nickname}
        userRoleLabel={ROLE_LABELS[role]}
        onLogout={signOut}
        canEditTargets={editable}
        canManageUsers={manageUsers}
        onOpenUsers={() => setIsUsersOpen(true)}
      />

      {/* Navegación de solapas */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('pizarra')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'pizarra' ? 'bg-yellow-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Pizarra Diaria
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vendedores')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'vendedores' ? 'bg-yellow-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Vendedores
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vista-rapida')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'vista-rapida' ? 'bg-yellow-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Vista Rápida
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {activeTab === 'pizarra' ? (
          <>
            <BranchOverview
              config={config}
              metrics={globalMetrics}
              onUpdateGlobalTarget={handleUpdateGlobalTarget}
              onUpdateDailyTarget={handleUpdateDailyTarget}
              onUpdateSaturdayTarget={handleUpdateSaturdayTarget}
              onToggleSaturdayMode={handleToggleSaturdayMode}
              readOnly={!editable}
            />

            <DailyClosingBoard
              sellers={sellers}
              sellerMetrics={sellerMetrics}
              globalMetrics={globalMetrics}
              config={config}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onUpdateDailySale={handleUpdateDailySale}
              onUpdateDayTarget={handleUpdateDayTarget}
              onResetDayTarget={handleResetDayTarget}
              onAddSeller={handleAddSeller}
              onAddPeriodicSaleAndAdjustTarget={handleAddPeriodicSaleAndAdjustTarget}
              onUpdateArticulos={handleUpdateArticulos}
              onAdjustDebitosCount={handleAdjustDebitosCount}
              readOnly={!editable}
            />

            <DailySalesHistoryTable
              sellers={sellers}
              config={config}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              onUpdateDailySale={handleUpdateDailySale}
            />
          </>
        ) : activeTab === 'vendedores' ? (
          <SellersDetailTab sellerMetrics={sellerMetrics} />
        ) : (
          <QuickBoardView
            sellers={sellers}
            config={config}
            globalMetrics={globalMetrics}
            onUpdateNote={handleUpdateQuickBoardNote}
            readOnly={!editable}
          />
        )}
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-3 text-center text-xs text-zinc-600">
        <span>Gestión Diaria • {config.branchName}</span>
      </footer>

      {editable && (
        <AdminPanel
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          config={config}
          sellers={sellers}
          sedeId={currentSedeId}
          onSaveConfig={handleSaveConfig}
          onResetTodaySales={handleResetTodaySales}
          onResetMonthSales={handleResetMonthSales}
          onLoadDemoData={handleLoadDemoData}
        />
      )}

      {manageUsers && isUsersOpen && <UserManagementPanel sedes={sedes} onClose={() => setIsUsersOpen(false)} />}
    </div>
  );
};

const Gate: React.FC = () => {
  const { loading, session, profile, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-sm">
        Cargando...
      </div>
    );
  }

  if (!session || !profile) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp profile={profile} signOut={signOut} />;
};

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
