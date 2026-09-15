/**
 * Utilidades para formateo de moneda en Pesos Argentinos (ARS),
 * porcentajes y fechas.
 */

// Formateador estándar de Pesos Argentinos sin decimales para montos enteros
export const formatARS = (amount: number, includeDecimals = false): string => {
  if (isNaN(amount) || !isFinite(amount)) return '$ 0';
  
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(amount);
};

// Formato compacto para números grandes (ej: $ 1,5 M)
export const formatARSCompact = (amount: number): string => {
  if (isNaN(amount) || !isFinite(amount)) return '$ 0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}$ ${(abs / 1_000_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$ ${(abs / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  }
  if (abs >= 1_000) {
    return `${sign}$ ${(abs / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })} K`;
  }
  return `${sign}$ ${abs.toLocaleString('es-AR')}`;
};

// Formato de porcentaje con signo opcional
export const formatPercent = (percent: number, showSign = false): string => {
  if (isNaN(percent) || !isFinite(percent)) return '0.0%';
  const sign = showSign && percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(1).replace('.', ',')}%`;
};

// Formato con signo para diferencia de dinero (+ $ 150.000 / - $ 40.000)
export const formatSignedARS = (amount: number): string => {
  if (isNaN(amount) || !isFinite(amount)) return '$ 0';
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  const formatted = formatARS(Math.abs(amount));
  return `${sign} ${formatted}`;
};
