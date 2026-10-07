import React from 'react';
import { DteDocumentLayoutConfig, BillingEmissionDraft, DteType, CompanyProfile, ClientCompany } from '../../types';
import { formatCLP, formatNumberCL } from '../../utils/chileanAccounting';
import { numberToWordsCLP } from '../../utils/numberToWordsCL';
import { TedBarcodeDisplay } from './TedBarcodeDisplay';

interface InvoiceDocumentSheetProps {
  layout: DteDocumentLayoutConfig;
  draft: BillingEmissionDraft;
  company: CompanyProfile | ClientCompany;
  tipoDteOverride?: DteType;
  folioOverride?: number;
  tipoEjemplarOverride?: string;
  zoom?: number;
  showWatermark?: boolean;
}

export const InvoiceDocumentSheet: React.FC<InvoiceDocumentSheetProps> = ({
  layout,
  draft,
  company,
  tipoDteOverride,
  folioOverride,
  tipoEjemplarOverride,
  zoom = 1,
  showWatermark = true,
}) => {
  const currentTipoDte = tipoDteOverride || draft.tipoDte;
  const currentFolio = folioOverride || draft.folioSugerido || 1420;

  // Determinar Nombre del Documento según tipo DTE oficial del SII
  const getDocumentTitle = (tipo: DteType) => {
    switch (tipo) {
      case '33': return 'FACTURA ELECTRÓNICA';
      case '34': return 'FACTURA NO AFECTA O EXENTA ELECTRÓNICA';
      case '39': return 'BOLETA ELECTRÓNICA';
      case '41': return 'BOLETA NO AFECTA O EXENTA ELECTRÓNICA';
      case '52': return 'GUÍA DE DESPACHO ELECTRÓNICA';
      case '56': return 'NOTA DE DÉBITO ELECTRÓNICA';
      case '61': return 'NOTA DE CRÉDITO ELECTRÓNICA';
      case '110': return 'FACTURA DE EXPORTACIÓN ELECTRÓNICA';
      default: return 'DOCUMENTO TRIBUTARIO ELECTRÓNICO';
    }
  };

  const docTitle = getDocumentTitle(currentTipoDte);
  const isExenta = currentTipoDte === '34' || currentTipoDte === '41';

  // Cálculos de Totales
  const neto = draft.montoNeto || 0;
  const exento = draft.montoExento || 0;
  const iva = isExenta ? 0 : (draft.montoIva || Math.round(neto * 0.19));
  const total = draft.montoTotal || (neto + exento + iva);

  // Datos del emisor combinando la configuración de la empresa y los overrides del diseñador
  const emisorRut = layout.emisorRut || company.rut || '76.123.456-7';
  const emisorRazon = layout.emisorRazonSocial || company.razonSocial || 'SOCIEDAD INDUSTRIAL EJEMPLO SPA';
  const emisorGiro = layout.emisorGiro || (company as any).giro || 'SERVICIOS INDUSTRIALES';
  const emisorDireccion = layout.emisorDireccion || (company as any).direccion || 'Av. Principal 1000';
  const emisorComuna = layout.emisorComuna || (company as any).comuna || 'PUERTO MONTT';
  const emisorCiudad = layout.emisorCiudad || (company as any).ciudad || 'PUERTO MONTT';
  const emisorUnidad = layout.emisorUnidadSii || 'S.I.I. - PUERTO MONTT';
  const emisorTelefono = layout.emisorTelefono || (company as any).telefono || '';
  const emisorEmail = layout.emisorEmail || (company as any).email || '';
  const emisorWeb = layout.emisorWeb || '';

  // Dimensiones de Logo
  const getLogoSizeClass = () => {
    switch (layout.logoSize) {
      case 'sm': return 'max-h-12 max-w-[140px]';
      case 'md': return 'max-h-16 max-w-[180px]';
      case 'lg': return 'max-h-20 max-w-[230px]';
      case 'xl': return 'max-h-24 max-w-[280px]';
      default: return 'max-h-16 max-w-[180px]';
    }
  };

  // Familia Tipográfica
  const getFontFamilyStyle = () => {
    switch (layout.fontFamily) {
      case 'serif': return 'font-serif';
      case 'mono': return 'font-mono';
      default: return 'font-sans';
    }
  };

  const tipoEjemplarText = tipoEjemplarOverride || (() => {
    switch (layout.tipoEjemplar) {
      case 'CEDIBLE_MERITO_EJECUTIVO': return 'CEDIBLE CON MÉRITO EJECUTIVO (LEY 19.983)';
      case 'CEDIBLE': return 'COPIA CEDIBLE';
      case 'TRIPLICADO_CONTROL': return 'TRIPLICADO CONTROL TRIBUTARIO';
      default: return 'ORIGINAL: CLIENTE';
    }
  })();

  return (
    <div
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: 'top center',
      }}
      className="transition-transform duration-150 ease-out inline-block"
    >
      {/* Contenedor Hoja de Factura Tamaño Carta / A4 */}
      <div
        id="dte-printable-invoice"
        className={`bg-white text-slate-900 border border-slate-300 shadow-2xl relative select-text overflow-hidden ${getFontFamilyStyle()}`}
        style={{
          width: '210mm',
          minHeight: '297mm', // Proporción A4 estándar internacional
          padding: layout.marginSize === 'compact' ? '12mm 14mm' : layout.marginSize === 'wide' ? '20mm 22mm' : '15mm 16mm',
          color: layout.textColor || '#0f172a',
          fontSize: layout.fontSize === 'sm' ? '11px' : layout.fontSize === 'lg' ? '13px' : '12px',
        }}
      >
        {/* Marca de Agua (Watermark) */}
        {showWatermark && layout.watermark && layout.watermark !== 'NONE' && (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
          >
            <span
              className="text-[72px] font-black tracking-widest uppercase opacity-8 transform -rotate-36 border-4 border-current px-12 py-3 rounded-xl"
              style={{ color: layout.primaryColor }}
            >
              {layout.watermark === 'MERITO_EJECUTIVO'
                ? 'MÉRITO EJECUTIVO'
                : layout.watermark}
            </span>
          </div>
        )}

        <div className="relative z-10 space-y-4">
          {/* ============================================================== */}
          {/* 1. SECCIÓN SUPERIOR: LOGO, DATOS EMISOR & RECUADRO ROJO SII    */}
          {/* ============================================================== */}
          <div className="flex items-start justify-between gap-4">
            {/* Columna Izquierda: Logo & Razón Social Emisor */}
            <div className={`flex-1 ${layout.logoPosition === 'center' ? 'text-center' : 'text-left'}`}>
              <div className={`flex flex-col ${layout.logoPosition === 'center' ? 'items-center' : 'items-start'} gap-2`}>
                {layout.logoUrl ? (
                  <img
                    src={layout.logoUrl}
                    alt={emisorRazon}
                    className={`${getLogoSizeClass()} object-contain`}
                  />
                ) : (
                  <div
                    className="p-2 rounded font-bold tracking-tight text-white flex items-center gap-2"
                    style={{ backgroundColor: layout.primaryColor }}
                  >
                    <span className="text-sm font-black uppercase">
                      {layout.nombreFantasia || emisorRazon.substring(0, 24)}
                    </span>
                  </div>
                )}

                {layout.showCompanyNameWithLogo && (
                  <div>
                    <h2
                      className="font-bold text-base tracking-tight leading-snug uppercase"
                      style={{ color: layout.primaryColor }}
                    >
                      {emisorRazon}
                    </h2>
                    {layout.nombreFantasia && (
                      <div className="text-xs text-slate-500 font-semibold">
                        {layout.nombreFantasia}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Datos de contacto y tributarios del Emisor */}
              <div className="mt-2 text-[11px] leading-relaxed text-slate-700 space-y-0.5">
                <div className="font-bold text-slate-900 uppercase">
                  Giro: <span className="font-medium">{emisorGiro}</span>
                </div>
                <div>
                  Casa Matriz: <span className="font-medium">{emisorDireccion}, {emisorComuna} - {emisorCiudad}</span>
                </div>
                {layout.emisorActecoTexto && (
                  <div>
                    ACTECO: <span className="font-mono">{layout.emisorActecoTexto}</span>
                  </div>
                )}
                {layout.emisorSucursalesTexto && (
                  <div className="text-[10px] text-slate-500 italic">
                    {layout.emisorSucursalesTexto}
                  </div>
                )}
                <div className="flex items-center gap-3 pt-0.5 text-slate-600">
                  {emisorTelefono && <span>Tel: {emisorTelefono}</span>}
                  {emisorEmail && <span>Email: {emisorEmail}</span>}
                  {emisorWeb && <span>Web: {emisorWeb}</span>}
                </div>
              </div>
            </div>

            {/* Columna Derecha: RECUADRO ROJO REGLAMENTARIO DEL SII (Res. Ex. N° 11) */}
            <div
              className="w-[260px] shrink-0 text-center select-none"
              style={{
                borderWidth: `${layout.recuadroRojoBorderWidth || 3}px`,
                borderStyle: layout.recuadroRojoBorderStyle || 'double',
                borderColor: layout.recuadroRojoColor || '#dc2626',
                padding: '10px 8px',
                backgroundColor: '#ffffff',
              }}
            >
              <div
                className="font-black text-sm tracking-wider uppercase font-mono"
                style={{ color: layout.recuadroRojoColor || '#dc2626' }}
              >
                R.U.T.: {emisorRut}
              </div>

              <div
                className="font-black text-xs uppercase my-1.5 leading-snug tracking-tight px-1 py-1"
                style={{
                  color: layout.recuadroRojoColor || '#dc2626',
                }}
              >
                {docTitle}
              </div>

              <div
                className="font-black text-base font-mono tracking-tight"
                style={{ color: layout.recuadroRojoColor || '#dc2626' }}
              >
                {layout.customFolioPrefix || 'N°'} {String(currentFolio).padStart(6, '0')}
              </div>

              <div
                className="text-[9px] font-bold uppercase tracking-wider mt-1.5 pt-1 border-t"
                style={{
                  color: layout.recuadroRojoColor || '#dc2626',
                  borderColor: `${layout.recuadroRojoColor || '#dc2626'}40`,
                }}
              >
                {emisorUnidad}
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 2. DATOS DE IDENTIFICACIÓN DEL RECEPTOR & FECHAS              */}
          {/* ============================================================== */}
          <div
            className="border rounded-xs p-3 text-[11px] space-y-2 bg-slate-50/50"
            style={{ borderColor: `${layout.primaryColor}30` }}
          >
            <div className="grid grid-cols-12 gap-x-4 gap-y-1.5">
              <div className="col-span-8 flex items-baseline">
                <span className="font-bold w-24 shrink-0 uppercase text-slate-600">Señor(es):</span>
                <span className="font-bold text-slate-900 uppercase">
                  {draft.razonSocialReceptor || 'SALMONES DEL SUR S.A.'}
                </span>
              </div>
              <div className="col-span-4 flex items-baseline justify-end">
                <span className="font-bold mr-2 uppercase text-slate-600">R.U.T.:</span>
                <span className="font-bold font-mono text-slate-900">
                  {draft.rutReceptor || '76.123.456-7'}
                </span>
              </div>

              <div className="col-span-8 flex items-baseline">
                <span className="font-bold w-24 shrink-0 uppercase text-slate-600">Giro:</span>
                <span className="text-slate-800 uppercase">
                  {draft.giroReceptor || 'ACUICULTURA Y CULTIVO DE ESPECIES MARINAS'}
                </span>
              </div>
              <div className="col-span-4 flex items-baseline justify-end">
                <span className="font-bold mr-2 uppercase text-slate-600">Fecha Emisión:</span>
                <span className="font-semibold font-mono text-slate-900">
                  {draft.fechaEmision || new Date().toISOString().split('T')[0]}
                </span>
              </div>

              <div className="col-span-8 flex items-baseline">
                <span className="font-bold w-24 shrink-0 uppercase text-slate-600">Dirección:</span>
                <span className="text-slate-800">
                  {draft.direccionReceptor || 'Av. Diego Portales 2000, Piso 4'}, {draft.comunaReceptor || 'Puerto Montt'}
                </span>
              </div>
              <div className="col-span-4 flex items-baseline justify-end">
                <span className="font-bold mr-2 uppercase text-slate-600">Fecha Vence:</span>
                <span className="font-semibold font-mono text-slate-900">
                  {draft.fechaVencimiento || '30 Días'}
                </span>
              </div>

              <div className="col-span-8 flex items-baseline">
                <span className="font-bold w-24 shrink-0 uppercase text-slate-600">Ciudad / Comuna:</span>
                <span className="text-slate-800">
                  {draft.ciudadReceptor || 'Puerto Montt'} / {draft.comunaReceptor || 'Puerto Montt'}
                </span>
              </div>
              <div className="col-span-4 flex items-baseline justify-end">
                <span className="font-bold mr-2 uppercase text-slate-600">Forma de Pago:</span>
                <span className="font-bold text-slate-900 uppercase">
                  {draft.condicionVenta === 'CONTADO' ? 'CONTADO' : 'CRÉDITO 30 DÍAS'}
                </span>
              </div>

              {draft.emailReceptorDte && (
                <div className="col-span-12 flex items-baseline pt-0.5 text-slate-500">
                  <span className="font-bold w-24 shrink-0 uppercase">Email DTE:</span>
                  <span className="font-mono">{draft.emailReceptorDte}</span>
                </div>
              )}
            </div>

            {/* Referencias Oficiales (DTE 61, 56 o Guías de Despacho) */}
            {draft.referencia && (
              <div className="mt-1 pt-1.5 border-t border-slate-200 text-[10px] text-slate-600 flex items-center justify-between">
                <span>
                  <strong>Documento de Referencia:</strong> DTE {draft.referencia.tipoDocRef} Folio N° {draft.referencia.folioRef} de fecha {draft.referencia.fechaRef}
                </span>
                <span className="italic">
                  Motivo: {draft.referencia.razonRef}
                </span>
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* 3. TABLA DE DETALLE DE ÍTEMS Y SERVICIOS                      */}
          {/* ============================================================== */}
          <div className="overflow-hidden">
            <table className="w-full text-left border-collapse" style={{ fontSize: '11px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: layout.headerStyle === 'filled' ? layout.primaryColor : '#f8fafc',
                    color: layout.headerStyle === 'filled' ? '#ffffff' : layout.primaryColor,
                    borderTop: `1px solid ${layout.primaryColor}`,
                    borderBottom: `2px solid ${layout.primaryColor}`,
                  }}
                >
                  <th className="py-1.5 px-2 font-bold uppercase text-[10px] text-center w-8">#</th>
                  {layout.showItemCode && (
                    <th className="py-1.5 px-2 font-bold uppercase text-[10px] w-24">Código</th>
                  )}
                  <th className="py-1.5 px-2 font-bold uppercase text-[10px]">Descripción / Ítem</th>
                  {layout.showItemUnit && (
                    <th className="py-1.5 px-2 font-bold uppercase text-[10px] text-center w-14">Unidad</th>
                  )}
                  <th className="py-1.5 px-2 font-bold uppercase text-[10px] text-right w-16">Cant.</th>
                  <th className="py-1.5 px-2 font-bold uppercase text-[10px] text-right w-24">P. Unitario</th>
                  {layout.showItemDiscount && (
                    <th className="py-1.5 px-2 font-bold uppercase text-[10px] text-right w-14">Desc.</th>
                  )}
                  <th className="py-1.5 px-2 font-bold uppercase text-[10px] text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${layout.tableBorders === 'full' ? 'border' : ''}`}
                style={{ borderColor: `${layout.primaryColor}20` }}
              >
                {draft.items && draft.items.length > 0 ? (
                  draft.items.map((it, idx) => (
                    <tr
                      key={it.id || idx}
                      className={layout.stripedRows && idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                      style={{
                        borderBottom: layout.tableBorders === 'minimal' ? '1px solid #f1f5f9' : undefined,
                      }}
                    >
                      <td className="py-2 px-2 text-center text-slate-500 font-mono text-[10px]">
                        {idx + 1}
                      </td>
                      {layout.showItemCode && (
                        <td className="py-2 px-2 font-mono text-[10px] text-slate-600">
                          {`ITM-${String(idx + 1).padStart(3, '0')}`}
                        </td>
                      )}
                      <td className="py-2 px-2">
                        <div className="font-semibold text-slate-900 leading-snug">
                          {it.nombre}
                        </div>
                        {layout.showItemDescription && it.descripcion && (
                          <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                            {it.descripcion}
                          </div>
                        )}
                        {layout.showCostCenterTag && it.centroCostoNombre && (
                          <div className="text-[9px] text-blue-700 mt-0.5">
                            C. Costo: {it.centroCostoNombre}
                          </div>
                        )}
                      </td>
                      {layout.showItemUnit && (
                        <td className="py-2 px-2 text-center text-slate-600 font-mono text-[10px]">
                          {it.unidadMedida || 'C/U'}
                        </td>
                      )}
                      <td className="py-2 px-2 text-right font-mono font-medium text-slate-800">
                        {formatNumberCL(it.cantidad)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-800">
                        {formatCLP(it.precioUnitario)}
                      </td>
                      {layout.showItemDiscount && (
                        <td className="py-2 px-2 text-right font-mono text-slate-500 text-[10px]">
                          0%
                        </td>
                      )}
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                        {formatCLP(it.montoTotal || it.cantidad * it.precioUnitario)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Sin ítems cargados en el documento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ============================================================== */}
          {/* 4. TOTAL EN PALABRAS (LEGAL)                                    */}
          {/* ============================================================== */}
          {layout.showTotalInWords && (
            <div className="p-2 bg-slate-50 border border-slate-200 text-[10px] text-slate-700 font-medium">
              <strong className="uppercase text-slate-900 mr-1.5">Son:</strong>
              <span className="font-mono font-semibold">{numberToWordsCLP(total)}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* 5. SECCIÓN INFERIOR: TED BARCODE, LIQUIDACIÓN Y TOTALES         */}
          {/* ============================================================== */}
          <div className="flex items-start justify-between gap-4 pt-2">
            {/* Columna Izquierda: Timbre Electrónico DTE (TED) */}
            <div className="w-[300px] shrink-0 space-y-2">
              {layout.showTedBarcode && (
                <TedBarcodeDisplay
                  rutEmisor={emisorRut}
                  tipoDte={currentTipoDte}
                  folio={currentFolio}
                  montoTotal={total}
                  fechaEmision={draft.fechaEmision || new Date().toISOString().split('T')[0]}
                  rutReceptor={draft.rutReceptor || '76.123.456-7'}
                  leyenda={layout.tedLeyendaTexto}
                />
              )}

              {/* Indicador de Tipo de Ejemplar (Ej: CEDIBLE CON MÉRITO EJECUTIVO) */}
              <div className="text-center font-bold text-[10px] tracking-wider uppercase text-slate-700 py-1 border border-slate-300 bg-slate-50">
                {tipoEjemplarText}
              </div>
            </div>

            {/* Columna Derecha: Liquidación de Impuestos & Totales */}
            <div className="flex-1 max-w-[280px] ml-auto">
              <div className="border border-slate-300 divide-y divide-slate-200 text-xs">
                {!isExenta && (
                  <div className="flex justify-between py-1.5 px-3 bg-white font-medium">
                    <span className="text-slate-600">MONTO NETO</span>
                    <span className="font-mono font-bold text-slate-900">{formatCLP(neto)}</span>
                  </div>
                )}

                {isExenta ? (
                  <div className="flex justify-between py-1.5 px-3 bg-white font-medium">
                    <span className="text-slate-600">MONTO EXENTO</span>
                    <span className="font-mono font-bold text-slate-900">{formatCLP(exento || total)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between py-1.5 px-3 bg-white font-medium">
                    <span className="text-slate-600">19% I.V.A.</span>
                    <span className="font-mono font-bold text-slate-900">{formatCLP(iva)}</span>
                  </div>
                )}

                <div
                  className="flex justify-between py-2 px-3 text-white font-black"
                  style={{ backgroundColor: layout.primaryColor }}
                >
                  <span className="tracking-wide">TOTAL CLP</span>
                  <span className="font-mono text-sm tracking-tight">{formatCLP(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 6. RECUADRO DE ACUSE DE RECIBO / LEY 19.983 (MÉRITO EJECUTIVO)   */}
          {/* ============================================================== */}
          {layout.showLey19983Cedible && (
            <div className="border border-slate-300 p-2.5 text-[9px] text-slate-700 space-y-1.5 bg-slate-50/40">
              <div className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-1.5 font-sans">
                <div>
                  <span className="font-bold text-slate-800 block">NOMBRE:</span>
                  <div className="border-b border-dotted border-slate-400 h-4 mt-0.5" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">R.U.T.:</span>
                  <div className="border-b border-dotted border-slate-400 h-4 mt-0.5" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">FECHA:</span>
                  <div className="border-b border-dotted border-slate-400 h-4 mt-0.5" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">RECINTO / FIRMA:</span>
                  <div className="border-b border-dotted border-slate-400 h-4 mt-0.5" />
                </div>
              </div>
              <p className="text-[8.5px] text-slate-500 leading-tight italic">
                El acuse de recibo que se declara en este acto, de acuerdo a lo dispuesto en la letra b) del Art. 4°, y la letra c) del Art. 5° de la Ley 19.983, acredita que la entrega de mercaderías o servicio(s) prestado(s) ha(n) sido recibido(s).
              </p>
            </div>
          )}

          {/* ============================================================== */}
          {/* 7. DATOS BANCARIOS & NOTAS COMERCIALES                           */}
          {/* ============================================================== */}
          {(layout.showBankDetails || layout.commercialNotes) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] pt-1">
              {layout.showBankDetails && layout.bankDetailsText && (
                <div className="p-2 border border-slate-200 rounded-xs bg-slate-50">
                  <div className="font-bold text-slate-800 uppercase mb-0.5" style={{ color: layout.primaryColor }}>
                    Datos para Transferencia Bancaria:
                  </div>
                  <div className="text-slate-600 leading-tight">
                    {layout.bankDetailsText}
                  </div>
                </div>
              )}

              {layout.commercialNotes && (
                <div className="p-2 border border-slate-200 rounded-xs bg-slate-50">
                  <div className="font-bold text-slate-800 uppercase mb-0.5">
                    Observaciones Comerciales:
                  </div>
                  <div className="text-slate-600 leading-tight">
                    {layout.commercialNotes}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Disclaimer de pie de página */}
          {layout.footerDisclaimer && (
            <div className="text-center text-[8.5px] text-slate-400 pt-1 border-t border-slate-200">
              {layout.footerDisclaimer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
