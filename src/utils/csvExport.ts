import { BranchConfig, Seller } from '../types';
import { getMonthDays } from './calendar';

// Arma el CSV de un mes completo de una sede: una fila por vendedor, con el total
// de cada día laborable, el acumulado y el % de cumplimiento. Se abre directo en
// Excel o Google Sheets como una planilla común.
export function buildSedeMonthCSV(config: BranchConfig, sellers: Seller[]): string {
  const year = config.calendarYear || new Date().getFullYear();
  const month = config.calendarMonth || new Date().getMonth() + 1;
  const days = getMonthDays(year, month).filter((d) => !d.isSunday);

  const header = [
    'Vendedor',
    'Objetivo Mensual',
    'Total Vendido',
    '% Cumplimiento',
    'Artículos',
    'Débitos Automáticos',
    ...days.map((d) => `Día ${d.dayNumber} (${d.shortDayName})`),
  ];
  const rows: string[][] = [header];

  sellers.forEach((s) => {
    const total = Object.values(s.dailySalesHistory || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    const articulos = Object.values(s.articulosHistory || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    const pct = s.individualTarget > 0 ? ((total / s.individualTarget) * 100).toFixed(1) + '%' : '';
    const row = [
      s.name,
      String(s.individualTarget || 0),
      String(total),
      pct,
      String(articulos),
      String(s.debitosAutomaticosCount || 0),
      ...days.map((d) => String(s.dailySalesHistory?.[d.dayNumber] || '')),
    ];
    rows.push(row);
  });

  const totalRow = [
    'TOTAL SEDE',
    '',
    String(sellers.reduce((acc, s) => acc + Object.values(s.dailySalesHistory || {}).reduce((a, v) => a + (Number(v) || 0), 0), 0)),
    '',
    '',
    '',
    ...days.map((d) => String(sellers.reduce((acc, s) => acc + (Number(s.dailySalesHistory?.[d.dayNumber]) || 0), 0))),
  ];
  rows.push(totalRow);

  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Dispara la descarga del archivo en el navegador. El BOM (\uFEFF) al principio
// es para que Excel reconozca bien los acentos en español.
export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
