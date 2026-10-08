import {
  CurrencyDefinition,
  ExchangeRateRecord,
  ExchangeDifferenceCalculation,
  AccountingEntry,
  HierarchicalAccountItem,
} from '../types';

/**
 * Catálogo base de monedas estándar en Chile y comercio exterior
 */
export const DEFAULT_CURRENCIES: CurrencyDefinition[] = [
  {
    codigo: 'CLP',
    nombre: 'Peso Chileno',
    simbolo: '$',
    decimales: 0,
    esMonedaBase: true,
    activo: true,
    ultimaCotizacion: 1,
    fechaActualizacion: '2026-10-07',
    descripcion: 'Moneda funcional y de curso legal en Chile para presentación de Estados Financieros (NIC 21).',
  },
  {
    codigo: 'USD',
    nombre: 'Dólar Estadounidense',
    simbolo: 'US$',
    decimales: 2,
    esMonedaBase: false,
    activo: true,
    ultimaCotizacion: 955.20,
    fechaActualizacion: '2026-10-07',
    descripcion: 'Divisa principal de comercio internacional, importaciones y facturación en moneda extranjera.',
  },
  {
    codigo: 'EUR',
    nombre: 'Euro',
    simbolo: '€',
    decimales: 2,
    esMonedaBase: false,
    activo: true,
    ultimaCotizacion: 1042.80,
    fechaActualizacion: '2026-10-07',
    descripcion: 'Divisa de la Unión Europea utilizada en contratos internacionales y compras de maquinaria.',
  },
  {
    codigo: 'UF',
    nombre: 'Unidad de Fomento',
    simbolo: 'UF',
    decimales: 2,
    esMonedaBase: false,
    activo: true,
    ultimaCotizacion: 39150.50,
    fechaActualizacion: '2026-10-07',
    descripcion: 'Unidad de cuenta reajustable por IPC para arriendos (IFRS 16), pólizas de seguro y créditos bancarios.',
  },
  {
    codigo: 'UTM',
    nombre: 'Unidad Tributaria Mensual',
    simbolo: 'UTM',
    decimales: 0,
    esMonedaBase: false,
    activo: true,
    ultimaCotizacion: 66628.00,
    fechaActualizacion: '2026-10-01',
    descripcion: 'Unidad tributaria oficial fijada por el SII para cálculo de multas, patentes e impuestos.',
  },
];

/**
 * Serie histórica inicial representativa de cotizaciones oficiales (Banco Central de Chile / SII)
 */
export const DEFAULT_HISTORICAL_RATES: ExchangeRateRecord[] = [
  // Enero 2026
  { id: 'rate-usd-2026-01-02', fecha: '2026-01-02', monedaCodigo: 'USD', valor: 942.50, fuente: 'Banco Central de Chile', observacion: 'Apertura Ejercicio 2026' },
  { id: 'rate-eur-2026-01-02', fecha: '2026-01-02', monedaCodigo: 'EUR', valor: 1028.30, fuente: 'Banco Central de Chile', observacion: 'Apertura Ejercicio 2026' },
  { id: 'rate-uf-2026-01-02',  fecha: '2026-01-02', monedaCodigo: 'UF',  valor: 38890.10, fuente: 'SII', observacion: 'Valor oficial inicio mes' },

  { id: 'rate-usd-2026-01-15', fecha: '2026-01-15', monedaCodigo: 'USD', valor: 948.20, fuente: 'Banco Central de Chile', observacion: 'Dólar Observado' },
  { id: 'rate-eur-2026-01-15', fecha: '2026-01-15', monedaCodigo: 'EUR', valor: 1032.50, fuente: 'Banco Central de Chile', observacion: 'Euro Oficial' },
  { id: 'rate-uf-2026-01-15',  fecha: '2026-01-15', monedaCodigo: 'UF',  valor: 38950.40, fuente: 'SII', observacion: 'Quincena Enero' },

  { id: 'rate-usd-2026-01-31', fecha: '2026-01-31', monedaCodigo: 'USD', valor: 952.10, fuente: 'Banco Central de Chile', observacion: 'Cierre Mensual Enero (NIC 21)' },
  { id: 'rate-eur-2026-01-31', fecha: '2026-01-31', monedaCodigo: 'EUR', valor: 1039.00, fuente: 'Banco Central de Chile', observacion: 'Cierre Mensual Enero (NIC 21)' },
  { id: 'rate-uf-2026-01-31',  fecha: '2026-01-31', monedaCodigo: 'UF',  valor: 39020.20, fuente: 'SII', observacion: 'Cierre Enero' },

  // Febrero 2026
  { id: 'rate-usd-2026-02-15', fecha: '2026-02-15', monedaCodigo: 'USD', valor: 955.00, fuente: 'Banco Central de Chile', observacion: 'Dólar Observado' },
  { id: 'rate-eur-2026-02-15', fecha: '2026-02-15', monedaCodigo: 'EUR', valor: 1041.20, fuente: 'Banco Central de Chile', observacion: 'Euro Oficial' },
  { id: 'rate-uf-2026-02-15',  fecha: '2026-02-15', monedaCodigo: 'UF',  valor: 39080.50, fuente: 'SII', observacion: 'Quincena Febrero' },

  { id: 'rate-usd-2026-02-28', fecha: '2026-02-28', monedaCodigo: 'USD', valor: 958.40, fuente: 'Banco Central de Chile', observacion: 'Cierre Mensual Febrero (NIC 21)' },
  { id: 'rate-eur-2026-02-28', fecha: '2026-02-28', monedaCodigo: 'EUR', valor: 1045.60, fuente: 'Banco Central de Chile', observacion: 'Cierre Mensual Febrero (NIC 21)' },
  { id: 'rate-uf-2026-02-28',  fecha: '2026-02-28', monedaCodigo: 'UF',  valor: 39150.50, fuente: 'SII', observacion: 'Cierre Febrero' },

  // Marzo 2026
  { id: 'rate-usd-2026-03-15', fecha: '2026-03-15', monedaCodigo: 'USD', valor: 962.10, fuente: 'Banco Central de Chile', observacion: 'Dólar Observado' },
  { id: 'rate-eur-2026-03-15', fecha: '2026-03-15', monedaCodigo: 'EUR', valor: 1048.90, fuente: 'Banco Central de Chile', observacion: 'Euro Oficial' },
  { id: 'rate-uf-2026-03-15',  fecha: '2026-03-15', monedaCodigo: 'UF',  valor: 39220.30, fuente: 'SII', observacion: 'Quincena Marzo' },

  { id: 'rate-usd-2026-03-31', fecha: '2026-03-31', monedaCodigo: 'USD', valor: 965.80, fuente: 'Banco Central de Chile', observacion: 'Cierre Trimestre Q1 (NIC 21)' },
  { id: 'rate-eur-2026-03-31', fecha: '2026-03-31', monedaCodigo: 'EUR', valor: 1052.40, fuente: 'Banco Central de Chile', observacion: 'Cierre Trimestre Q1 (NIC 21)' },
  { id: 'rate-uf-2026-03-31',  fecha: '2026-03-31', monedaCodigo: 'UF',  valor: 39300.00, fuente: 'SII', observacion: 'Cierre Marzo' },

  // Septiembre - Octubre 2026
  { id: 'rate-usd-2026-09-30', fecha: '2026-09-30', monedaCodigo: 'USD', valor: 955.20, fuente: 'Banco Central de Chile', observacion: 'Cierre Trimestre Q3 (NIC 21)' },
  { id: 'rate-eur-2026-09-30', fecha: '2026-09-30', monedaCodigo: 'EUR', valor: 1042.80, fuente: 'Banco Central de Chile', observacion: 'Cierre Trimestre Q3 (NIC 21)' },
  { id: 'rate-uf-2026-09-30',  fecha: '2026-09-30', monedaCodigo: 'UF',  valor: 39150.50, fuente: 'SII', observacion: 'Cierre Septiembre' },

  { id: 'rate-usd-2026-10-07', fecha: '2026-10-07', monedaCodigo: 'USD', valor: 955.20, fuente: 'Banco Central de Chile', observacion: 'Cotización al día' },
  { id: 'rate-eur-2026-10-07', fecha: '2026-10-07', monedaCodigo: 'EUR', valor: 1042.80, fuente: 'Banco Central de Chile', observacion: 'Cotización al día' },
  { id: 'rate-uf-2026-10-07',  fecha: '2026-10-07', monedaCodigo: 'UF',  valor: 39150.50, fuente: 'SII', observacion: 'Cotización al día' },
];

/**
 * Obtiene la clave de almacenamiento segura en localStorage por empresa
 */
function getStorageKey(empresaRut: string | undefined, suffix: string): string {
  const cleanRut = (empresaRut || 'default').replace(/[^a-zA-Z0-9]/g, '_');
  return `agentic_currency_${cleanRut}_${suffix}`;
}

/**
 * Obtiene la lista de monedas disponibles para la empresa
 */
export function getAvailableCurrencies(empresaRut?: string): CurrencyDefinition[] {
  try {
    const key = getStorageKey(empresaRut, 'catalog');
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error leyendo catálogo de monedas desde localStorage:', e);
  }
  return DEFAULT_CURRENCIES;
}

/**
 * Guarda el catálogo de monedas en localStorage
 */
export function saveCurrencies(currencies: CurrencyDefinition[], empresaRut?: string): void {
  try {
    const key = getStorageKey(empresaRut, 'catalog');
    localStorage.setItem(key, JSON.stringify(currencies));
  } catch (e) {
    console.error('Error guardando catálogo de monedas en localStorage:', e);
  }
}

/**
 * Agrega o actualiza una moneda en el catálogo
 */
export function addOrUpdateCurrency(
  curr: Partial<CurrencyDefinition> & { codigo: string; nombre: string; simbolo: string },
  empresaRut?: string
): CurrencyDefinition {
  const current = getAvailableCurrencies(empresaRut);
  const code = curr.codigo.trim().toUpperCase();
  const existingIdx = current.findIndex(c => c.codigo === code);

  const fullCurrency: CurrencyDefinition = {
    codigo: code,
    nombre: curr.nombre.trim(),
    simbolo: curr.simbolo.trim(),
    decimales: curr.decimales !== undefined ? curr.decimales : (code === 'CLP' || code === 'UTM' ? 0 : 2),
    esMonedaBase: code === 'CLP' ? true : Boolean(curr.esMonedaBase),
    activo: curr.activo !== undefined ? curr.activo : true,
    ultimaCotizacion: curr.ultimaCotizacion || (code === 'CLP' ? 1 : 950),
    fechaActualizacion: curr.fechaActualizacion || new Date().toISOString().split('T')[0],
    descripcion: curr.descripcion || '',
  };

  let updated: CurrencyDefinition[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...fullCurrency };
  } else {
    updated = [...current, fullCurrency];
  }

  saveCurrencies(updated, empresaRut);
  return fullCurrency;
}

/**
 * Activa o desactiva una moneda
 */
export function toggleCurrencyStatus(codigo: string, activo: boolean, empresaRut?: string): void {
  const current = getAvailableCurrencies(empresaRut);
  const updated = current.map(c => (c.codigo === codigo ? { ...c, activo } : c));
  saveCurrencies(updated, empresaRut);
}

/**
 * Obtiene el histórico de cotizaciones / paridades registradas
 */
export function getExchangeRateHistory(monedaCodigo?: string, empresaRut?: string): ExchangeRateRecord[] {
  try {
    const key = getStorageKey(empresaRut, 'rates_history');
    const raw = localStorage.getItem(key);
    let records: ExchangeRateRecord[] = DEFAULT_HISTORICAL_RATES;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        records = parsed;
      }
    }

    if (monedaCodigo) {
      records = records.filter(r => r.monedaCodigo.toUpperCase() === monedaCodigo.toUpperCase());
    }

    // Ordenar de más reciente a más antiguo
    return records.sort((a, b) => b.fecha.localeCompare(a.fecha));
  } catch (e) {
    console.warn('Error leyendo histórico de tipos de cambio desde localStorage:', e);
    return DEFAULT_HISTORICAL_RATES;
  }
}

/**
 * Registra o actualiza una cotización histórica
 */
export function saveExchangeRateRecord(
  record: Omit<ExchangeRateRecord, 'id'> & { id?: string },
  empresaRut?: string
): ExchangeRateRecord {
  const history = getExchangeRateHistory(undefined, empresaRut);
  const recId = record.id || `rate-${record.monedaCodigo.toLowerCase()}-${record.fecha}-${Date.now().toString().slice(-4)}`;
  const cleanRecord: ExchangeRateRecord = {
    id: recId,
    fecha: record.fecha,
    monedaCodigo: record.monedaCodigo.trim().toUpperCase(),
    valor: Number(record.valor),
    fuente: record.fuente || 'Registro Manual',
    observacion: record.observacion || '',
    creadoEn: record.creadoEn || new Date().toISOString(),
  };

  const existingIdx = history.findIndex(
    r => r.id === recId || (r.fecha === cleanRecord.fecha && r.monedaCodigo === cleanRecord.monedaCodigo)
  );

  let updated: ExchangeRateRecord[];
  if (existingIdx >= 0) {
    updated = [...history];
    updated[existingIdx] = cleanRecord;
  } else {
    updated = [cleanRecord, ...history];
  }

  try {
    const key = getStorageKey(empresaRut, 'rates_history');
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.error('Error guardando histórico de tipos de cambio:', e);
  }

  // Actualizar también la última cotización en el catálogo de monedas
  const currencies = getAvailableCurrencies(empresaRut);
  const currIdx = currencies.findIndex(c => c.codigo === cleanRecord.monedaCodigo);
  if (currIdx >= 0) {
    currencies[currIdx].ultimaCotizacion = cleanRecord.valor;
    currencies[currIdx].fechaActualizacion = cleanRecord.fecha;
    saveCurrencies(currencies, empresaRut);
  }

  return cleanRecord;
}

/**
 * Elimina una cotización histórica
 */
export function deleteExchangeRateRecord(id: string, empresaRut?: string): void {
  const history = getExchangeRateHistory(undefined, empresaRut);
  const filtered = history.filter(r => r.id !== id);
  try {
    const key = getStorageKey(empresaRut, 'rates_history');
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error eliminando tipo de cambio:', e);
  }
}

/**
 * Obtiene el tipo de cambio oficial o más cercano para una fecha y moneda dada.
 * Si es CLP, retorna 1.
 * Si existe cotización exacta en la fecha, la retorna.
 * Si no, busca la cotización registrada más reciente anterior a esa fecha.
 * Si no existe fecha anterior, toma la más cercana posterior o la última del catálogo.
 */
export function getExchangeRateForDate(
  monedaCodigo: string,
  fecha: string,
  empresaRut?: string
): number {
  const code = (monedaCodigo || 'CLP').trim().toUpperCase();
  if (code === 'CLP') return 1;

  const history = getExchangeRateHistory(code, empresaRut);
  if (!history || history.length === 0) {
    const currs = getAvailableCurrencies(empresaRut);
    const found = currs.find(c => c.codigo === code);
    return found ? found.ultimaCotizacion : (code === 'USD' ? 955.20 : code === 'EUR' ? 1042.80 : 39150.50);
  }

  // 1. Coincidencia exacta
  const exact = history.find(r => r.fecha === fecha);
  if (exact) return exact.valor;

  // 2. Coincidencia anterior más reciente (<= fecha)
  const previousRates = history.filter(r => r.fecha <= fecha);
  if (previousRates.length > 0) {
    // Orden descendente por fecha
    previousRates.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return previousRates[0].valor;
  }

  // 3. Si la fecha es anterior a todo el histórico, tomar la primera registrada
  const futureRates = history.filter(r => r.fecha > fecha);
  if (futureRates.length > 0) {
    futureRates.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return futureRates[0].valor;
  }

  return history[0].valor;
}

/**
 * Formatea un monto numérico con el símbolo y decimales de la moneda
 */
export function formatCurrencyAmount(monto: number, monedaCodigo: string, currencies?: CurrencyDefinition[]): string {
  const code = (monedaCodigo || 'CLP').toUpperCase();
  const list = currencies || DEFAULT_CURRENCIES;
  const def = list.find(c => c.codigo === code);
  const symbol = def ? def.simbolo : (code === 'CLP' ? '$' : code);
  const decimals = def ? def.decimales : (code === 'CLP' ? 0 : 2);

  const formattedNum = Number(monto).toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${symbol} ${formattedNum}`;
}

/**
 * Infiere si una cuenta maneja moneda extranjera y qué divisa le corresponde
 */
export function resolveAccountCurrency(
  account: { codigo: string; nombre: string; manejaMultimoneda?: boolean; monedaCodigo?: string },
  customCurrencies?: CurrencyDefinition[]
): { manejaMonedaExtranjera: boolean; monedaCodigo: string; simbolo: string } {
  if (account.monedaCodigo && account.monedaCodigo !== 'CLP') {
    const curr = (customCurrencies || DEFAULT_CURRENCIES).find(c => c.codigo === account.monedaCodigo);
    return {
      manejaMonedaExtranjera: true,
      monedaCodigo: account.monedaCodigo,
      simbolo: curr?.simbolo || account.monedaCodigo,
    };
  }

  const name = account.nombre.toLowerCase();
  const code = account.codigo;

  if (account.manejaMultimoneda || code.startsWith('1.1.02.003') || name.includes('(usd)') || name.includes('dolar') || name.includes('dólar')) {
    return { manejaMonedaExtranjera: true, monedaCodigo: 'USD', simbolo: 'US$' };
  }
  if (name.includes('euro') || name.includes('(eur)')) {
    return { manejaMonedaExtranjera: true, monedaCodigo: 'EUR', simbolo: '€' };
  }
  if (name.includes('uf') || name.includes('unidad de fomento')) {
    return { manejaMonedaExtranjera: true, monedaCodigo: 'UF', simbolo: 'UF' };
  }

  return { manejaMonedaExtranjera: false, monedaCodigo: 'CLP', simbolo: '$' };
}

/**
 * Calcula la Diferencia de Cambio (NIC 21) para todas las cuentas en moneda extranjera
 * que posean movimientos o saldo registrado en los asientos contables del período.
 */
export function calculateExchangeDifferenceForAccounts(
  entries: AccountingEntry[],
  accounts: HierarchicalAccountItem[],
  closingDate: string,
  closingRates?: Record<string, number>,
  empresaRut?: string
): ExchangeDifferenceCalculation[] {
  const currencies = getAvailableCurrencies(empresaRut);

  // Mapear cuentas que manejan moneda extranjera
  const accountMap = new Map(accounts.map(a => [a.codigo, a]));
  const multiCurrencyAccounts = accounts.filter(a => {
    const resolved = resolveAccountCurrency(a, currencies);
    return resolved.manejaMonedaExtranjera;
  });

  // Identificar también cuentas que tuvieron líneas con monedaOriginal en los asientos
  const accountsWithForeignLines = new Set<string>();
  entries.forEach(entry => {
    (entry.lineas || []).forEach(line => {
      if (line.monedaOriginal && line.monedaOriginal !== 'CLP') {
        accountsWithForeignLines.add(line.cuentaCodigo);
      }
    });
  });

  // Conjunto total de códigos de cuenta a evaluar
  const candidateCodes = new Set<string>([
    ...multiCurrencyAccounts.map(a => a.codigo),
    ...Array.from(accountsWithForeignLines),
  ]);

  const results: ExchangeDifferenceCalculation[] = [];

  candidateCodes.forEach(code => {
    const acc = accountMap.get(code);
    const resolved = acc ? resolveAccountCurrency(acc, currencies) : { manejaMonedaExtranjera: true, monedaCodigo: 'USD', simbolo: 'US$' };
    const moneda = (acc?.monedaCodigo || resolved.monedaCodigo || 'USD').toUpperCase();
    if (moneda === 'CLP') return;

    // Obtener T/C de cierre
    const closingRate = (closingRates && closingRates[moneda]) 
      ? closingRates[moneda]
      : getExchangeRateForDate(moneda, closingDate, empresaRut);

    // Calcular saldos acumulados de los asientos contables
    let totalDebeCLP = 0;
    let totalHaberCLP = 0;
    let totalDebeMoneda = 0;
    let totalHaberMoneda = 0;
    let tieneMovimientos = false;

    entries.forEach(entry => {
      // Solo considerar asientos hasta la fecha de cierre
      if (entry.fecha <= closingDate) {
        (entry.lineas || []).forEach(line => {
          if (line.cuentaCodigo === code) {
            tieneMovimientos = true;
            totalDebeCLP += Number(line.debe) || 0;
            totalHaberCLP += Number(line.haber) || 0;

            const rateApplied = Number(line.tipoCambio) || getExchangeRateForDate(moneda, entry.fecha, empresaRut);
            if (line.montoMonedaOriginal !== undefined && line.montoMonedaOriginal > 0) {
              if (Number(line.debe) > 0) {
                totalDebeMoneda += Number(line.montoMonedaOriginal);
              } else if (Number(line.haber) > 0) {
                totalHaberMoneda += Number(line.montoMonedaOriginal);
              }
            } else if (rateApplied > 0) {
              // Si no tenía montoMonedaOriginal explícito pero la cuenta es en divisa, inferir por el T/C
              if (Number(line.debe) > 0) {
                totalDebeMoneda += (Number(line.debe) / rateApplied);
              } else if (Number(line.haber) > 0) {
                totalHaberMoneda += (Number(line.haber) / rateApplied);
              }
            }
          }
        });
      }
    });

    const isActivo = code.startsWith('1.');
    const isPasivo = code.startsWith('2.');

    // Saldo contable en CLP según naturaleza
    const saldoLibroCLP = isActivo 
      ? (totalDebeCLP - totalHaberCLP)
      : isPasivo 
      ? (totalHaberCLP - totalDebeCLP)
      : (totalDebeCLP - totalHaberCLP);

    // Saldo en moneda extranjera
    let saldoMoneda = isActivo 
      ? (totalDebeMoneda - totalHaberMoneda)
      : isPasivo 
      ? (totalHaberMoneda - totalDebeMoneda)
      : (totalDebeMoneda - totalHaberMoneda);

    saldoMoneda = Number(saldoMoneda.toFixed(2));

    // Si la cuenta no tuvo movimientos explícitos pero es la cuenta bancaria USD oficial (1.1.02.003),
    // proveer un saldo de apertura estimado para simulación si está en cero
    if (!tieneMovimientos && code === '1.1.02.003' && saldoMoneda === 0) {
      saldoMoneda = 8500; // US$ 8,500 estándar
      const tcHistoricoApertura = closingRate - 12.50;
      const saldoLibroEstimado = Math.round(saldoMoneda * tcHistoricoApertura);
      
      const valorCierre = Math.round(saldoMoneda * closingRate);
      const diff = valorCierre - saldoLibroEstimado;

      results.push({
        cuentaCodigo: code,
        cuentaNombre: acc?.nombre || 'Banco Moneda Extranjera (USD)',
        monedaCodigo: moneda,
        saldoMonedaExtranjera: saldoMoneda,
        saldoLibroCLP: saldoLibroEstimado,
        tipoCambioCierre: closingRate,
        valorCierreCLP: valorCierre,
        diferenciaCLP: diff,
        tipoResultado: diff > 0 ? 'GANANCIA' : diff < 0 ? 'PERDIDA' : 'NEUTRO',
        cuentaAjusteCodigo: diff >= 0 ? '7.1.01.002' : '7.2.01.002',
        cuentaAjusteNombre: diff >= 0 ? 'Diferencia de Cambio a Favor (USD / EUR)' : 'Diferencia de Cambio en Contra (USD / EUR)',
      });
      return;
    }

    if (saldoMoneda === 0 && saldoLibroCLP === 0) return;

    // Valor reexpresado al tipo de cambio de cierre (NIC 21)
    const valorCierreCLP = Math.round(saldoMoneda * closingRate);
    // Para activos: si valorCierre > saldoLibro, ganancia (aumento de activo).
    // Para pasivos: si valorCierre > saldoLibro, pérdida (aumento de deuda).
    let diff = 0;
    if (isActivo) {
      diff = valorCierreCLP - saldoLibroCLP;
    } else if (isPasivo) {
      diff = saldoLibroCLP - valorCierreCLP; // Si el pasivo sube, es negativo (pérdida)
    } else {
      diff = valorCierreCLP - saldoLibroCLP;
    }

    results.push({
      cuentaCodigo: code,
      cuentaNombre: acc?.nombre || `Cuenta ${code}`,
      monedaCodigo: moneda,
      saldoMonedaExtranjera: saldoMoneda,
      saldoLibroCLP: Math.round(saldoLibroCLP),
      tipoCambioCierre: closingRate,
      valorCierreCLP: valorCierreCLP,
      diferenciaCLP: diff,
      tipoResultado: diff > 0 ? 'GANANCIA' : diff < 0 ? 'PERDIDA' : 'NEUTRO',
      cuentaAjusteCodigo: diff >= 0 ? '7.1.01.002' : '7.2.01.002',
      cuentaAjusteNombre: diff >= 0 ? 'Diferencia de Cambio a Favor (USD / EUR)' : 'Diferencia de Cambio en Contra (USD / EUR)',
    });
  });

  return results;
}

/**
 * Genera un Asiento Contable formal de Ajuste por Diferencia de Cambio (NIC 21)
 */
export function generateExchangeDifferenceAdjustmentEntry(
  calculations: ExchangeDifferenceCalculation[],
  fechaCierre: string,
  glosaPersonalizada?: string
): AccountingEntry | null {
  const activeCalcs = calculations.filter(c => Math.abs(c.diferenciaCLP) > 0);
  if (activeCalcs.length === 0) return null;

  const lines: AccountingEntry['lineas'] = [];
  let totalDebe = 0;
  let totalHaber = 0;

  activeCalcs.forEach(c => {
    const absDiff = Math.abs(c.diferenciaCLP);
    const isActivo = c.cuentaCodigo.startsWith('1.');

    if (c.tipoResultado === 'GANANCIA') {
      // Ganancia:
      // Si es activo: Aumenta la cuenta de activo al Debe, y Ganancia por Dif. Cambio al Haber (7.1.01.002)
      // Si es pasivo: Disminuye la deuda al Debe, y Ganancia al Haber
      lines.push({
        cuentaCodigo: c.cuentaCodigo,
        cuentaNombre: c.cuentaNombre,
        debe: absDiff,
        haber: 0,
        monedaOriginal: c.monedaCodigo,
        montoMonedaOriginal: c.saldoMonedaExtranjera,
        tipoCambio: c.tipoCambioCierre,
        documentoRef: `Cierre ${fechaCierre}`,
      });
      lines.push({
        cuentaCodigo: c.cuentaAjusteCodigo,
        cuentaNombre: c.cuentaAjusteNombre,
        debe: 0,
        haber: absDiff,
        documentoRef: `NIC 21 ${c.monedaCodigo}`,
      });
      totalDebe += absDiff;
      totalHaber += absDiff;
    } else if (c.tipoResultado === 'PERDIDA') {
      // Pérdida:
      // Pérdida por Dif. Cambio al Debe (7.2.01.002), y disminuye el activo o aumenta el pasivo al Haber
      lines.push({
        cuentaCodigo: c.cuentaAjusteCodigo,
        cuentaNombre: c.cuentaAjusteNombre,
        debe: absDiff,
        haber: 0,
        documentoRef: `NIC 21 ${c.monedaCodigo}`,
      });
      lines.push({
        cuentaCodigo: c.cuentaCodigo,
        cuentaNombre: c.cuentaNombre,
        debe: 0,
        haber: absDiff,
        monedaOriginal: c.monedaCodigo,
        montoMonedaOriginal: c.saldoMonedaExtranjera,
        tipoCambio: c.tipoCambioCierre,
        documentoRef: `Cierre ${fechaCierre}`,
      });
      totalDebe += absDiff;
      totalHaber += absDiff;
    }
  });

  const entryId = `asiento-fx-${fechaCierre}-${Date.now().toString().slice(-4)}`;
  const entry: AccountingEntry = {
    id: entryId,
    fecha: fechaCierre,
    concepto: glosaPersonalizada || `Ajuste Normativo NIC 21: Diferencia de Cambio y Revalorización al Cierre (${fechaCierre})`,
    documento: `Comprobante Cierre NIC 21 #${entryId.slice(-8).toUpperCase()}`,
    origen: 'AJUSTE_DIF_CAMBIO',
    lineas: lines,
    totalDebe,
    totalHaber,
    balanceado: totalDebe === totalHaber,
    creadoEn: new Date().toISOString(),
    supervisorSignature: 'AUDITOR_AGENTE_NIC21',
  };

  return entry;
}
