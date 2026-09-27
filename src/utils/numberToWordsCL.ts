/**
 * Conversor numérico a texto legal en español chileno para facturas electrónicas y DTEs.
 * Ej: 10115000 -> "SON: DIEZ MILLONES CIENTO QUINCE MIL PESOS CHILENOS"
 */

function unidades(num: number): string {
  switch (num) {
    case 1: return 'UN';
    case 2: return 'DOS';
    case 3: return 'TRES';
    case 4: return 'CUATRO';
    case 5: return 'CINCO';
    case 6: return 'SEIS';
    case 7: return 'SIETE';
    case 8: return 'OCHO';
    case 9: return 'NUEVE';
    default: return '';
  }
}

function decenasY(strSin: string, numUnidades: number): string {
  if (numUnidades > 0) return `${strSin} Y ${unidades(numUnidades)}`;
  return strSin;
}

function decenas(num: number): string {
  const ten = Math.floor(num / 10);
  const u = num - ten * 10;

  switch (ten) {
    case 1:
      switch (u) {
        case 0: return 'DIEZ';
        case 1: return 'ONCE';
        case 2: return 'DOCE';
        case 3: return 'TRECE';
        case 4: return 'CATORCE';
        case 5: return 'QUINCE';
        default: return `DIECI${unidades(u)}`;
      }
    case 2:
      if (u === 0) return 'VEINTE';
      return `VEINTI${unidades(u)}`;
    case 3: return decenasY('TREINTA', u);
    case 4: return decenasY('CUARENTA', u);
    case 5: return decenasY('CINCUENTA', u);
    case 6: return decenasY('SESENTA', u);
    case 7: return decenasY('SETENTA', u);
    case 8: return decenasY('OCHENTA', u);
    case 9: return decenasY('NOVENTA', u);
    case 0: return unidades(u);
    default: return '';
  }
}

function centenas(num: number): string {
  const c = Math.floor(num / 100);
  const d = num - c * 100;

  switch (c) {
    case 1:
      if (d > 0) return `CIENTO ${decenas(d)}`;
      return 'CIEN';
    case 2: return `DOSCIENTOS ${decenas(d)}`.trim();
    case 3: return `TRESCIENTOS ${decenas(d)}`.trim();
    case 4: return `CUATROCIENTOS ${decenas(d)}`.trim();
    case 5: return `QUINIENTOS ${decenas(d)}`.trim();
    case 6: return `SEISCIENTOS ${decenas(d)}`.trim();
    case 7: return `SETECIENTOS ${decenas(d)}`.trim();
    case 8: return `OCHOCIENTOS ${decenas(d)}`.trim();
    case 9: return `NOVECIENTOS ${decenas(d)}`.trim();
    default: return decenas(d);
  }
}

function seccion(num: number, divisor: number, strSingular: string, strPlural: string): string {
  const cientos = Math.floor(num / divisor);
  const resto = num - cientos * divisor;
  let letras = '';

  if (cientos > 0) {
    if (cientos > 1) {
      letras = `${centenas(cientos)} ${strPlural}`;
    } else {
      letras = strSingular;
    }
  }

  if (resto > 0) {
    letras += '';
  }

  return letras;
}

export function numberToWordsCLP(monto: number): string {
  const cleanMonto = Math.round(Math.abs(monto));
  if (cleanMonto === 0) return 'CERO PESOS CHILENOS';

  const millones = Math.floor(cleanMonto / 1000000);
  let resto = cleanMonto - millones * 1000000;

  const miles = Math.floor(resto / 1000);
  resto = resto - miles * 1000;

  const partes: string[] = [];

  if (millones > 0) {
    if (millones === 1) {
      partes.push('UN MILLÓN');
    } else {
      partes.push(`${centenas(millones)} MILLONES`);
    }
  }

  if (miles > 0) {
    if (miles === 1) {
      partes.push('MIL');
    } else {
      partes.push(`${centenas(miles)} MIL`);
    }
  }

  if (resto > 0) {
    partes.push(centenas(resto));
  }

  const texto = partes.join(' ').replace(/\s+/g, ' ').trim();
  return `${texto} PESOS CHILENOS`;
}
