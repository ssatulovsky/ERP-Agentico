import * as XLSX from 'xlsx';
import { BankStatementMovement } from '../types';

/**
 * Normaliza una fecha en formato YYYY-MM-DD
 * Soporta DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD y números seriales de Excel
 */
export function normalizeChileanDate(rawDate: any): string {
  if (!rawDate) return new Date().toISOString().split('T')[0];

  // Si es un número serial de Excel (ej: 46280)
  if (typeof rawDate === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(rawDate);
    if (dateObj) {
      const y = dateObj.y;
      const m = String(dateObj.m).padStart(2, '0');
      const d = String(dateObj.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(rawDate).trim();

  // YYYY-MM-DD o YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const parts = str.split(/[-/]/);
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].slice(0, 2).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY o DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(str)) {
    const parts = str.split(/[-/]/);
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2].slice(0, 4);
    return `${y}-${m}-${d}`;
  }

  // Si viene con formato texto Date estándar
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Limpia y convierte un monto en moneda chilena a número
 * Ejemplos: "$ 1.500.000" -> 1500000, "-24.990" -> -24990, "(15.000)" -> -15000
 */
export function parseChileanAmount(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.round(val);

  let str = String(val).trim();
  if (str === '-' || str === '.') return 0;

  // Detectar formato entre paréntesis para negativos: (15.000) -> -15000
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  }

  // Quitar signo peso, espacios y letras
  str = str.replace(/[$A-Za-z\s]/g, '');

  // Formato chileno estándar: los puntos son miles y las comas decimales (o viceversa)
  if (str.includes('.') && str.includes(',')) {
    // ej: 1.500.000,50 o 1,500,000.50
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // 1.500.000,50 -> quitar puntos y reemplazar coma por punto
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,500,000.50 -> quitar comas
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.') && !str.includes(',')) {
    // Si tiene puntos como separador de miles: 1.500.000 -> 1500000
    // A menos que sea decimal (ej: 12.50)
    const dotParts = str.split('.');
    if (dotParts.length > 2 || dotParts[dotParts.length - 1].length === 3) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',') && !str.includes('.')) {
    // Si solo tiene comas: 1,500,000 o 25000,50
    const commaParts = str.split(',');
    if (commaParts.length > 2 || commaParts[commaParts.length - 1].length === 3) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  const finalAmount = Math.round(isNegative ? -num : num);
  return finalAmount;
}

export interface StatementParseResult {
  success: boolean;
  bancoDetectado?: string;
  movements: BankStatementMovement[];
  count: number;
  totalCargos: number;
  totalAbonos: number;
  saldoInicial?: number;
  saldoFinal?: number;
  error?: string;
}

/**
 * Parser Universal de Cartolas Bancarias en formato Excel (.xlsx, .xls) o CSV
 * Soporta Santander, Banco de Chile, BCI, BancoEstado, Scotiabank, Itaú, etc.
 */
export function parseExcelOrCsvBankStatement(
  fileBuffer: ArrayBuffer,
  cuentaId: string,
  initialAccountSaldo: number = 0
): StatementParseResult {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, movements: [], count: 0, totalCargos: 0, totalAbonos: 0, error: 'El archivo Excel no contiene hojas de cálculo.' };
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return { success: false, movements: [], count: 0, totalCargos: 0, totalAbonos: 0, error: 'La hoja de cálculo está vacía.' };
    }

    // 1. Detectar Banco y Fila de Encabezados
    let headerRowIdx = -1;
    let colFecha = -1;
    let colGlosa = -1;
    let colDoc = -1;
    let colCargo = -1;
    let colAbono = -1;
    let colMontoUnico = -1;
    let colSaldo = -1;
    let bancoDetectado = 'Banco Nacional';

    for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
      const row = rawRows[r].map((cell: any) => String(cell).toLowerCase().trim());
      const rowStr = row.join(' ');

      if (rowStr.includes('santander')) bancoDetectado = 'Banco Santander Chile';
      else if (rowStr.includes('banco de chile') || rowStr.includes('edwards')) bancoDetectado = 'Banco de Chile';
      else if (rowStr.includes('bci') || rowStr.includes('credito e inversiones')) bancoDetectado = 'BCI';
      else if (rowStr.includes('estado')) bancoDetectado = 'BancoEstado';
      else if (rowStr.includes('scotiabank')) bancoDetectado = 'Scotiabank Chile';
      else if (rowStr.includes('itau')) bancoDetectado = 'Banco Itaú';

      // Buscar si esta fila contiene los nombres de columnas
      const fIdx = row.findIndex((c: string) => c.includes('fecha') || c.includes('f.oper') || c.includes('f. oper'));
      const gIdx = row.findIndex((c: string) => c.includes('glosa') || c.includes('descrip') || c.includes('detalle') || c.includes('concepto') || c.includes('movimiento'));
      const cIdx = row.findIndex((c: string) => c.includes('cargo') || c.includes('débito') || c.includes('debito') || c.includes('egreso') || c.includes('retiro'));
      const aIdx = row.findIndex((c: string) => c.includes('abono') || c.includes('crédito') || c.includes('credito') || c.includes('ingreso') || c.includes('deposito'));
      const mIdx = row.findIndex((c: string) => c === 'monto' || c === 'importe' || c.includes('monto ($)'));

      if (fIdx !== -1 && (gIdx !== -1 || cIdx !== -1 || aIdx !== -1 || mIdx !== -1)) {
        headerRowIdx = r;
        colFecha = fIdx;
        colGlosa = gIdx !== -1 ? gIdx : 1;
        colDoc = row.findIndex((c: string) => c.includes('doc') || c.includes('comprob') || c.includes('nro') || c.includes('operación') || c.includes('operacion') || c.includes('cheque') || c.includes('ref'));
        colCargo = cIdx;
        colAbono = aIdx;
        colMontoUnico = mIdx;
        colSaldo = row.findIndex((c: string) => c.includes('saldo'));
        break;
      }
    }

    // Si no encontró cabecera explícita, asumir columnas estándar 0=Fecha, 1=Doc, 2=Glosa, 3=Cargo, 4=Abono, 5=Saldo
    if (headerRowIdx === -1) {
      headerRowIdx = 0;
      colFecha = 0;
      colDoc = 1;
      colGlosa = 2;
      colCargo = 3;
      colAbono = 4;
      colSaldo = 5;
    }

    const parsedMovements: BankStatementMovement[] = [];
    let runningSaldo = initialAccountSaldo;
    let totalCargos = 0;
    let totalAbonos = 0;

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const rawFecha = row[colFecha];
      if (!rawFecha || String(rawFecha).trim() === '') continue;

      const fecha = normalizeChileanDate(rawFecha);
      const glosa = String(row[colGlosa] || 'Movimiento Bancario').trim();
      if (!glosa || glosa.toLowerCase().includes('total') || glosa.toLowerCase().includes('saldo anterior')) {
        continue;
      }

      const docRef = colDoc !== -1 && row[colDoc] ? String(row[colDoc]).trim() : `MOV-${r}`;

      let cargo = 0;
      let abono = 0;

      if (colCargo !== -1 && colAbono !== -1) {
        cargo = Math.abs(parseChileanAmount(row[colCargo]));
        abono = Math.abs(parseChileanAmount(row[colAbono]));
      } else if (colMontoUnico !== -1) {
        const monto = parseChileanAmount(row[colMontoUnico]);
        if (monto > 0) abono = monto;
        else if (monto < 0) cargo = Math.abs(monto);
      }

      if (cargo === 0 && abono === 0) continue;

      const montoNeto = abono > 0 ? abono : -cargo;
      totalCargos += cargo;
      totalAbonos += abono;

      // Saldo posterior
      let saldo = 0;
      if (colSaldo !== -1 && row[colSaldo] !== '' && row[colSaldo] !== undefined) {
        saldo = parseChileanAmount(row[colSaldo]);
        runningSaldo = saldo;
      } else {
        runningSaldo += montoNeto;
        saldo = runningSaldo;
      }

      const movement: BankStatementMovement = {
        id: `imp-${Date.now()}-${r}`,
        cuentaId,
        fecha,
        glosaBancaria: glosa.toUpperCase(),
        numeroReferencia: docRef,
        cargo,
        abono,
        saldo,
        montoNeto,
        estado: 'PENDIENTE',
        matchCerteza: 0,
      };

      parsedMovements.push(movement);
    }

    if (parsedMovements.length === 0) {
      return {
        success: false,
        movements: [],
        count: 0,
        totalCargos: 0,
        totalAbonos: 0,
        error: 'No se pudieron extraer movimientos válidos de la cartola. Verifique que contenga columnas de Fecha, Glosa y Montos.',
      };
    }

    return {
      success: true,
      bancoDetectado,
      movements: parsedMovements,
      count: parsedMovements.length,
      totalCargos,
      totalAbonos,
      saldoInicial: initialAccountSaldo,
      saldoFinal: runningSaldo,
    };
  } catch (err: any) {
    return {
      success: false,
      movements: [],
      count: 0,
      totalCargos: 0,
      totalAbonos: 0,
      error: `Error al procesar archivo: ${err.message}`,
    };
  }
}

/**
 * Parser para texto copiado y pegado directamente desde la web bancaria (Clipboard / Web Banking)
 * El usuario selecciona la tabla en Santander / Banco de Chile / BCI, presiona Ctrl+C y la pega.
 */
export function parsePastedTextBankStatement(
  text: string,
  cuentaId: string,
  initialAccountSaldo: number = 0
): StatementParseResult {
  try {
    if (!text || !text.trim()) {
      return { success: false, movements: [], count: 0, totalCargos: 0, totalAbonos: 0, error: 'El texto ingresado está vacío.' };
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedMovements: BankStatementMovement[] = [];
    let runningSaldo = initialAccountSaldo;
    let totalCargos = 0;
    let totalAbonos = 0;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      // Saltar líneas de encabezados comunes
      if (line.toLowerCase().includes('fecha') && (line.toLowerCase().includes('glosa') || line.toLowerCase().includes('monto'))) {
        continue;
      }

      // Separar por tabulaciones o por 2 o más espacios consecutivos
      let parts = line.split('\t');
      if (parts.length < 3) {
        parts = line.split(/\s{2,}/);
      }
      if (parts.length < 3) {
        parts = line.split(';');
      }

      if (parts.length >= 3) {
        const rawFecha = parts[0].trim();
        const fecha = normalizeChileanDate(rawFecha);

        let glosa = parts[1].trim();
        let docRef = `WEB-${idx + 1}`;
        let cargo = 0;
        let abono = 0;

        if (parts.length === 3) {
          // Fecha, Glosa, Monto
          const amt = parseChileanAmount(parts[2]);
          if (amt > 0) abono = amt;
          else if (amt < 0) cargo = Math.abs(amt);
        } else if (parts.length === 4) {
          // Fecha, Glosa/Doc, Cargo, Abono
          const num1 = parseChileanAmount(parts[2]);
          const num2 = parseChileanAmount(parts[3]);
          cargo = Math.abs(num1);
          abono = Math.abs(num2);
        } else if (parts.length >= 5) {
          // Fecha, Doc, Glosa, Cargo, Abono, [Saldo]
          docRef = parts[1].trim() || docRef;
          glosa = parts[2].trim() || glosa;
          cargo = Math.abs(parseChileanAmount(parts[3]));
          abono = Math.abs(parseChileanAmount(parts[4]));
        }

        if (cargo === 0 && abono === 0) continue;

        const montoNeto = abono > 0 ? abono : -cargo;
        totalCargos += cargo;
        totalAbonos += abono;
        runningSaldo += montoNeto;

        parsedMovements.push({
          id: `paste-${Date.now()}-${idx}`,
          cuentaId,
          fecha,
          glosaBancaria: glosa.toUpperCase(),
          numeroReferencia: docRef,
          cargo,
          abono,
          saldo: runningSaldo,
          montoNeto,
          estado: 'PENDIENTE',
          matchCerteza: 0,
        });
      }
    }

    if (parsedMovements.length === 0) {
      return {
        success: false,
        movements: [],
        count: 0,
        totalCargos: 0,
        totalAbonos: 0,
        error: 'No se detectaron movimientos tabulados. Asegúrese de copiar las filas completas de la cartola desde su portal bancario.',
      };
    }

    return {
      success: true,
      bancoDetectado: 'Web Banking / Copia Directa',
      movements: parsedMovements,
      count: parsedMovements.length,
      totalCargos,
      totalAbonos,
      saldoInicial: initialAccountSaldo,
      saldoFinal: runningSaldo,
    };
  } catch (err: any) {
    return {
      success: false,
      movements: [],
      count: 0,
      totalCargos: 0,
      totalAbonos: 0,
      error: `Error al procesar texto: ${err.message}`,
    };
  }
}

/**
 * Parser para archivos de extracto bancario OFX (Open Financial Exchange)
 * Formato internacional estándar utilizado por Banco de Chile, Santander, BCI y otros.
 */
export function parseOfxBankStatement(
  ofxText: string,
  cuentaId: string,
  initialAccountSaldo: number = 0
): StatementParseResult {
  try {
    const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    const matches = Array.from(ofxText.matchAll(trnRegex));

    if (!matches || matches.length === 0) {
      return {
        success: false,
        movements: [],
        count: 0,
        totalCargos: 0,
        totalAbonos: 0,
        error: 'El archivo no contiene bloques de transacción válidos <STMTTRN> de formato OFX.',
      };
    }

    const parsedMovements: BankStatementMovement[] = [];
    let runningSaldo = initialAccountSaldo;
    let totalCargos = 0;
    let totalAbonos = 0;

    matches.forEach((m, idx) => {
      const block = m[1];

      // <DTPOSTED>20260902120000
      const dateMatch = block.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/i);
      const fecha = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        : new Date().toISOString().split('T')[0];

      // <TRNAMT>-24990.00
      const amtMatch = block.match(/<TRNAMT>([-\d.,]+)/i);
      const amt = amtMatch ? parseChileanAmount(amtMatch[1]) : 0;

      // <NAME> o <MEMO>
      const nameMatch = block.match(/<NAME>([^<\r\n]+)/i);
      const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i);
      const glosa = (nameMatch?.[1] || memoMatch?.[1] || 'TRANSACCION BANCARIA OFX').trim();

      // <FITID> o <CHECKNUM>
      const fitIdMatch = block.match(/<FITID>([^<\r\n]+)/i);
      const checkNumMatch = block.match(/<CHECKNUM>([^<\r\n]+)/i);
      const docRef = (checkNumMatch?.[1] || fitIdMatch?.[1] || `OFX-${idx + 1}`).trim();

      const cargo = amt < 0 ? Math.abs(amt) : 0;
      const abono = amt > 0 ? amt : 0;

      totalCargos += cargo;
      totalAbonos += abono;
      runningSaldo += amt;

      parsedMovements.push({
        id: `ofx-${Date.now()}-${idx}`,
        cuentaId,
        fecha,
        glosaBancaria: glosa.toUpperCase(),
        numeroReferencia: docRef,
        cargo,
        abono,
        saldo: runningSaldo,
        montoNeto: amt,
        estado: 'PENDIENTE',
        matchCerteza: 0,
      });
    });

    return {
      success: true,
      bancoDetectado: 'Extracto OFX Estándar',
      movements: parsedMovements,
      count: parsedMovements.length,
      totalCargos,
      totalAbonos,
      saldoInicial: initialAccountSaldo,
      saldoFinal: runningSaldo,
    };
  } catch (err: any) {
    return {
      success: false,
      movements: [],
      count: 0,
      totalCargos: 0,
      totalAbonos: 0,
      error: `Error al leer formato OFX: ${err.message}`,
    };
  }
}
