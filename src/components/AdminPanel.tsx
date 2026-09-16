import React, { useState } from 'react';
import {
  X,
  Settings,
  Target,
  Users,
  Save,
  RotateCcw,
  Divide,
  Building2,
  Zap,
  Plus,
  Trash2,
  History,
  Download,
} from 'lucide-react';
import { BranchConfig, Seller, SedeHistoryEntry } from '../types';
import { formatARS } from '../utils/formatters';
import { fetchSedeHistoryList, fetchSedeHistoryEntryFull } from '../lib/sedeData';
import { buildSedeMonthCSV, downloadCSV } from '../utils/csvExport';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: BranchConfig;
  sellers: Seller[];
  sedeId: string | null;
  onSaveConfig: (newConfig: BranchConfig, newSellers: Seller[]) => void;
  onResetTodaySales: () => void;
  onResetMonthSales: () => void;
  onLoadDemoData: () => void;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  config,
  sellers,
  sedeId,
  onSaveConfig,
  onResetTodaySales,
  onResetMonthSales,
  onLoadDemoData,
}) => {
  const [branchName, setBranchName] = useState(config.branchName);
  const [globalTarget, setGlobalTarget] = useState(config.globalTarget);
  const [autoSumGlobalTarget, setAutoSumGlobalTarget] = useState(config.autoSumGlobalTarget);

  // Parámetros de gestión diaria y sábados
  const [customDailyTarget, setCustomDailyTarget] = useState(
    config.customDailyTarget || Math.round(config.globalTarget / Math.max(1, config.totalWorkingDays))
  );
  const [isSaturdayMode, setIsSaturdayMode] = useState(config.isSaturdayMode || false);
  const [saturdayBranchTarget, setSaturdayBranchTarget] = useState(
    config.saturdayBranchTarget || Math.round((config.globalTarget / Math.max(1, config.totalWorkingDays)) * 0.6)
  );

  const [localSellers, setLocalSellers] = useState<Seller[]>([...sellers]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Histórico de meses anteriores
  const [historyList, setHistoryList] = useState<SedeHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSellerChange = (index: number, field: keyof Seller, value: any) => {
    const updated = [...localSellers];
    updated[index] = { ...updated[index], [field]: value };
    setLocalSellers(updated);

    if (autoSumGlobalTarget && field === 'individualTarget') {
      const sum = updated.reduce((acc, s) => acc + (Number(s.individualTarget) || 0), 0);
      setGlobalTarget(sum);
    }
  };

  // Distribuir el objetivo global equitativamente entre los vendedores
  const handleDistributeEqually = () => {
    if (localSellers.length === 0) return;
    const share = Math.round(globalTarget / localSellers.length);
    const satShare = Math.round((share / Math.max(1, config.totalWorkingDays)) * 0.6);
    const updated = localSellers.map((s) => ({
      ...s,
      individualTarget: share,
      saturdayTarget: s.saturdayTarget || satShare,
    }));
    setLocalSellers(updated);
  };

  // Sumar objetivos de sábados de los vendedores a la sede
  const handleSumSaturdaysToGlobal = () => {
    const sum = localSellers.reduce((acc, s) => acc + (Number(s.saturdayTarget) || 0), 0);
    setSaturdayBranchTarget(sum);
  };

  // Calcular la suma de los vendedores y asignarla como objetivo global
  const handleSumSellersToGlobal = () => {
    const sum = localSellers.reduce((acc, s) => acc + (Number(s.individualTarget) || 0), 0);
    setGlobalTarget(sum);
  };

  // Añadir nuevo vendedor
  const handleAddSeller = () => {
    const newId = `seller-${Date.now()}`;
    const newSeller: Seller = {
      id: newId,
      name: `Vendedor ${localSellers.length + 1}`,
      avatarColor: 'bg-zinc-800 text-yellow-400 border border-zinc-700',
      individualTarget: 15000000,
      saturdayTarget: 350000,
      currentSales: 0,
      todaySales: 0,
      dailySalesHistory: {},
      transactionsCount: 0,
    };
    const updated = [...localSellers, newSeller];
    setLocalSellers(updated);
    if (autoSumGlobalTarget) {
      const sum = updated.reduce((acc, s) => acc + (Number(s.individualTarget) || 0), 0);
      setGlobalTarget(sum);
    }
  };

  // Eliminar vendedor
  const handleRemoveSeller = (sellerId: string) => {
    if (localSellers.length <= 1) return;
    const updated = localSellers.filter((s) => s.id !== sellerId);
    setLocalSellers(updated);
    if (autoSumGlobalTarget) {
      const sum = updated.reduce((acc, s) => acc + (Number(s.individualTarget) || 0), 0);
      setGlobalTarget(sum);
    }
  };

  const handleSave = () => {
    const newConfig: BranchConfig = {
      ...config,
      branchName: branchName.trim() || 'Sede Central',
      globalTarget: Number(globalTarget) || 1,
      autoSumGlobalTarget,
      customDailyTarget: Number(customDailyTarget) || undefined,
      isSaturdayMode,
      saturdayBranchTarget: Number(saturdayBranchTarget) || undefined,
    };

    onSaveConfig(newConfig, localSellers);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 500);
  };

  const handleLoadHistory = async () => {
    if (!sedeId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const list = await fetchSedeHistoryList(sedeId);
      setHistoryList(list);
    } catch (err: any) {
      setHistoryError(err.message || 'No se pudo cargar el histórico.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExportHistoryEntry = async (entry: SedeHistoryEntry) => {
    setExportingId(entry.id);
    try {
      const full = await fetchSedeHistoryEntryFull(entry.id);
      if (!full) throw new Error('No se encontró ese mes.');
      const csv = buildSedeMonthCSV(full.config, full.sellers);
      const fileName = `${entry.branchName}_${MONTH_NAMES_ES[entry.month - 1]}_${entry.year}.csv`.replace(/\s+/g, '_');
      downloadCSV(fileName, csv);
    } catch (err: any) {
      setHistoryError(err.message || 'No se pudo exportar ese mes.');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl text-zinc-100 overflow-hidden">
        
        {/* Header del Panel Administrativo */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-yellow-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-100 tracking-tight">
                Panel Administrativo
              </h3>
              <p className="text-xs text-zinc-400">
                Parámetros de sede, metas mensuales, objetivos diarios y de sábados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido deslizable del panel */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
          
          {/* Sección 1: Gestión de Objetivos Diarios de la Sede & Sábados */}
          <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-yellow-400 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <span>Objetivo Diario de Sede & Modo Sábado</span>
              </h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSaturdayMode}
                  onChange={(e) => setIsSaturdayMode(e.target.checked)}
                  className="rounded bg-zinc-800 border-zinc-700 text-yellow-400 focus:ring-yellow-400 h-4 w-4 cursor-pointer"
                />
                <span className={`text-xs font-bold ${isSaturdayMode ? 'text-yellow-400' : 'text-zinc-400'}`}>
                  Modo Sábado Activo
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Objetivo Diario Regular Sede ($ ARS)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={customDailyTarget}
                  onChange={(e) => setCustomDailyTarget(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 font-mono font-bold text-xs focus:outline-none focus:border-yellow-400"
                  placeholder="Ej: 3400000"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  {formatARS(customDailyTarget)} por día regular
                </span>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    Objetivo Especial Sábados Sede ($ ARS)
                  </label>
                  <button
                    type="button"
                    onClick={handleSumSaturdaysToGlobal}
                    className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                  >
                    Sumar de vendedores
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={saturdayBranchTarget}
                  onChange={(e) => setSaturdayBranchTarget(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-yellow-400 font-mono font-bold text-xs focus:outline-none focus:border-yellow-400"
                  placeholder="Ej: 1900000"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  {formatARS(saturdayBranchTarget)} para jornada reducida
                </span>
              </div>
            </div>
          </div>

          {/* Sección 2: Parámetros de Sede */}
          <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800">
            <h4 className="text-xs font-bold text-zinc-400 mb-2.5 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-yellow-400" />
              <span>Parámetros de Sede</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nombre de la Sede / Sucursal
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 text-xs focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Período (automático)
                </label>
                <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-400 text-xs">
                  {config.periodName} — Día {config.currentWorkingDay} de {config.totalWorkingDays}
                </div>
              </div>
            </div>
          </div>

          {/* Sección 3: Objetivo Mensual de Sede */}
          <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                <Target className="h-4 w-4 text-yellow-400" />
                <span>Objetivo Mensual de Sede ($ ARS)</span>
              </h4>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDistributeEqually}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] border border-zinc-700 cursor-pointer"
                >
                  <Divide className="h-3 w-3 text-yellow-400" />
                  <span>Distribuir equitativamente</span>
                </button>
                <button
                  type="button"
                  onClick={handleSumSellersToGlobal}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] border border-zinc-700 cursor-pointer"
                >
                  <span>Sumar Vendedores</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1 w-full relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-zinc-500">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={globalTarget}
                  disabled={autoSumGlobalTarget}
                  onChange={(e) => setGlobalTarget(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg py-1.5 pl-7 pr-3 font-mono font-bold text-zinc-100 text-sm focus:outline-none focus:border-yellow-400 disabled:opacity-50"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSumGlobalTarget}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAutoSumGlobalTarget(checked);
                    if (checked) {
                      const sum = localSellers.reduce((acc, s) => acc + (Number(s.individualTarget) || 0), 0);
                      setGlobalTarget(sum);
                    }
                  }}
                  className="rounded bg-zinc-800 border-zinc-700 text-yellow-400 focus:ring-yellow-400 h-4 w-4"
                />
                <span>Auto-sumar</span>
              </label>
            </div>
          </div>

          {/* Sección 4: Configuración de Vendedores y Canales */}
          <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                <Users className="h-4 w-4 text-yellow-400" />
                <span>Vendedores y Canales ({localSellers.length})</span>
              </h4>
              <button
                type="button"
                onClick={handleAddSeller}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-zinc-950 text-xs font-bold transition cursor-pointer shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Añadir Vendedor</span>
              </button>
            </div>

            <div className="space-y-2">
              {localSellers.map((seller, idx) => (
                <div
                  key={seller.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 p-2 rounded-lg bg-zinc-900 border border-zinc-800"
                >
                  <div className="flex items-center gap-2 w-full sm:w-1/4">
                    <div className="h-6 w-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-yellow-400 font-bold text-[10px] shrink-0">
                      {idx + 1}
                    </div>
                    <input
                      type="text"
                      value={seller.name}
                      onChange={(e) => handleSellerChange(idx, 'name', e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-yellow-400"
                      placeholder="Nombre"
                    />
                  </div>

                  <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-0.5">Objetivo Mensual:</span>
                      <input
                        type="number"
                        min="0"
                        step="100000"
                        value={seller.individualTarget}
                        onChange={(e) =>
                          handleSellerChange(idx, 'individualTarget', Number(e.target.value))
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono font-bold focus:outline-none focus:border-yellow-400"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-yellow-400 block mb-0.5">Objetivo Sábado:</span>
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={seller.saturdayTarget || 0}
                        onChange={(e) =>
                          handleSellerChange(idx, 'saturdayTarget', Number(e.target.value))
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-yellow-400 font-mono font-bold focus:outline-none focus:border-yellow-400"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 block mb-0.5">Obj. Artículos ($, mensual):</span>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        value={seller.articulosTarget || 0}
                        onChange={(e) =>
                          handleSellerChange(idx, 'articulosTarget', Number(e.target.value))
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-mono font-bold focus:outline-none focus:border-yellow-400"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-blue-400 block mb-0.5">Obj. Débitos (cant., mensual):</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={seller.debitosAutomaticosTarget || 0}
                        onChange={(e) =>
                          handleSellerChange(idx, 'debitosAutomaticosTarget', Number(e.target.value))
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-blue-300 font-mono font-bold focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>

                  {localSellers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSeller(seller.id)}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition cursor-pointer self-end sm:self-center"
                      title="Eliminar este vendedor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sección 5: Histórico de Meses Anteriores */}
          <div className="bg-zinc-950 rounded-xl p-3.5 border border-zinc-800">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                <History className="h-4 w-4 text-yellow-400" />
                <span>Histórico de Meses Anteriores</span>
              </h4>
              {historyList === null && (
                <button
                  type="button"
                  onClick={handleLoadHistory}
                  disabled={historyLoading}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[11px] font-semibold cursor-pointer disabled:opacity-60"
                >
                  {historyLoading ? 'Cargando...' : 'Ver histórico'}
                </button>
              )}
            </div>

            {historyError && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-400">
                {historyError}
              </div>
            )}

            {historyList !== null && (
              historyList.length === 0 ? (
                <p className="text-[11px] text-zinc-500">
                  Todavía no hay meses archivados — se van a ir guardando solos cada vez que empiece un mes nuevo.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {historyList.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800"
                    >
                      <span className="text-xs text-zinc-200 font-semibold">
                        {MONTH_NAMES_ES[entry.month - 1]} {entry.year}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExportHistoryEntry(entry)}
                        disabled={exportingId === entry.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-yellow-400 text-[11px] font-bold cursor-pointer disabled:opacity-60"
                      >
                        <Download className="h-3 w-3" />
                        {exportingId === entry.id ? 'Exportando...' : 'Descargar CSV'}
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Sección 6: Mantenimiento */}
          <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">
            <h4 className="text-xs font-bold text-zinc-400 mb-2 flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-yellow-400" />
              <span>Acciones de Mantenimiento</span>
            </h4>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onResetTodaySales}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-medium transition cursor-pointer"
              >
                Restablecer hoy a $ 0
              </button>
              <button
                type="button"
                onClick={onResetMonthSales}
                className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-medium transition cursor-pointer"
              >
                Reiniciar ventas acumuladas
              </button>
              <button
                type="button"
                onClick={onLoadDemoData}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-medium transition cursor-pointer"
              >
                Restaurar datos demo
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-800 flex items-center justify-between bg-zinc-950">
          <span className="text-[11px] text-zinc-500">
            Cambios guardados localmente
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{savedSuccess ? '¡Guardado!' : 'Guardar Parámetros'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
