import React from 'react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { SellerCalculations } from '../types';
import { formatARS, formatPercent } from '../utils/formatters';

interface SellersDetailTabProps {
  sellerMetrics: SellerCalculations[];
}

export const SellersDetailTab: React.FC<SellersDetailTabProps> = ({ sellerMetrics }) => {
  // Los canales periódicos (Débitos/Gympass) no tienen objetivo diario dividido; se muestran con "—" en esas columnas
  const sorted = [...sellerMetrics].sort((a, b) => b.completionPercent - a.completionPercent);

  const projectedPercentOf = (m: SellerCalculations) =>
    m.seller.individualTarget > 0 ? (m.projectedMonthEnd / m.seller.individualTarget) * 100 : 0;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-4 w-4 text-yellow-400" />
        <h2 className="text-sm font-bold text-zinc-200">Detalle por Vendedor</h2>
      </div>

      {/* Vista de tabla (desktop) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-bold text-zinc-500 border-b border-zinc-800">
              <th className="py-2 pr-3">Vendedor</th>
              <th className="py-2 pr-3 text-right">Objetivo Mensual</th>
              <th className="py-2 pr-3 text-right">Venta Actual</th>
              <th className="py-2 pr-3 text-right">% Alcanzado</th>
              <th className="py-2 pr-3 text-right">% Esperado Hoy</th>
              <th className="py-2 pr-3 text-right">Vs. Esperado</th>
              <th className="py-2 pr-3 text-right">Proyección Cierre</th>
              <th className="py-2 pr-3 text-right">Objetivo Diario Estimado</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.seller.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="py-2.5 pr-3 font-semibold text-zinc-200">{m.seller.name}</td>
                <td className="py-2.5 pr-3 text-right text-zinc-400">
                  {m.seller.isPeriodicChannel ? '—' : formatARS(m.seller.individualTarget)}
                </td>
                <td className="py-2.5 pr-3 text-right text-zinc-200">{formatARS(m.seller.currentSales)}</td>
                <td className="py-2.5 pr-3 text-right font-bold">
                  <span className={m.isTargetSurpassed ? 'text-green-400' : 'text-zinc-200'}>
                    {formatPercent(m.completionPercent)}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right text-zinc-500">{formatPercent(m.expectedPercent)}</td>
                <td className="py-2.5 pr-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      m.isPacingPositive ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {m.isPacingPositive ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {formatPercent(Math.abs(m.pacingVariancePercent))}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-right text-zinc-200">
                  {m.seller.isPeriodicChannel ? (
                    '—'
                  ) : (
                    <>
                      {formatARS(m.projectedMonthEnd)}
                      <span className="text-zinc-500 ml-1">({projectedPercentOf(m).toFixed(1)}%)</span>
                    </>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right text-yellow-400 font-semibold">
                  {m.seller.isPeriodicChannel ? '—' : formatARS(m.dailyTarget100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vista de tarjetas (mobile) */}
      <div className="md:hidden space-y-3">
        {sorted.map((m) => (
          <div key={m.seller.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-zinc-100">{m.seller.name}</span>
              <span className={`text-sm font-bold ${m.isTargetSurpassed ? 'text-green-400' : 'text-zinc-200'}`}>
                {formatPercent(m.completionPercent)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              <span className="text-zinc-500">Venta actual</span>
              <span className="text-right text-zinc-200">{formatARS(m.seller.currentSales)}</span>

              {!m.seller.isPeriodicChannel && (
                <>
                  <span className="text-zinc-500">Objetivo mensual</span>
                  <span className="text-right text-zinc-400">{formatARS(m.seller.individualTarget)}</span>
                </>
              )}

              <span className="text-zinc-500">Vs. esperado</span>
              <span className={`text-right font-semibold ${m.isPacingPositive ? 'text-green-400' : 'text-red-400'}`}>
                {m.isPacingPositive ? '+' : '-'}
                {formatPercent(Math.abs(m.pacingVariancePercent))}
              </span>

              {!m.seller.isPeriodicChannel && (
                <>
                  <span className="text-zinc-500">Proyección cierre</span>
                  <span className="text-right text-zinc-200">
                    {formatARS(m.projectedMonthEnd)}
                    <span className="text-zinc-500 ml-1">({projectedPercentOf(m).toFixed(1)}%)</span>
                  </span>

                  <span className="text-zinc-500">Objetivo diario estimado</span>
                  <span className="text-right text-yellow-400 font-semibold">{formatARS(m.dailyTarget100)}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-zinc-600 mt-3">
        "Objetivo diario estimado" recalcula, según los días restantes y lo ya vendido, cuánto necesita vender por
        día cada vendedor para llegar al 100% de su objetivo mensual.
      </p>
    </div>
  );
};
