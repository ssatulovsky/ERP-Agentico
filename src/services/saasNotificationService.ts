/**
 * K4 · Avisos de cobranza por correo.
 *
 * Usa SMTP (nodemailer) si SMTP_HOST está configurado. Si no, el aviso queda registrado con estado
 * SIN_CANAL y se ve en el panel de administración: nunca se informa como enviado algo que no salió.
 *
 * Variables: SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (false), SMTP_USER, SMTP_PASS,
 *            SMTP_FROM (remitente), SAAS_ADMIN_EMAIL (copia a la administración del ERP).
 */
import crypto from 'node:crypto';
import { diskPersistence } from './diskPersistenceService';

export type SaasNotificationType =
  | 'AVISO_ATRASO'
  | 'ULTIMO_RECORDATORIO'
  | 'AVISO_BLOQUEO'
  | 'REACTIVACION'
  | 'FACTURA_EMITIDA'
  | 'CONTRATO_POR_VENCER'
  | 'BAJA';

export interface SaasNotification {
  id: string;
  fecha: string;
  clienteErpId: string;
  invoiceId?: string;
  tipo: SaasNotificationType;
  para: string[];
  asunto: string;
  cuerpo: string;
  estado: 'ENVIADO' | 'SIN_CANAL' | 'ERROR';
  error?: string;
}

type Transport = { sendMail: (msg: any) => Promise<any> };
let transportOverride: Transport | null | undefined;

/** Para pruebas: reemplaza el transporte de correo (null = sin canal). */
export function setMailTransportForTests(t: Transport | null | undefined): void {
  transportOverride = t;
}

async function getTransport(): Promise<Transport | null> {
  if (transportOverride !== undefined) return transportOverride;
  if (!process.env.SMTP_HOST) return null;
  const nodemailer = await import('nodemailer');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

export function listNotifications(clienteErpId?: string): SaasNotification[] {
  const all = ((diskPersistence.getSnapshot() as any).saasNotifications || []) as SaasNotification[];
  return clienteErpId ? all.filter((n) => n.clienteErpId === clienteErpId) : all;
}

export async function sendSaasNotification(n: Omit<SaasNotification, 'id' | 'fecha' | 'estado' | 'error'>): Promise<SaasNotification> {
  const para = [...new Set([...n.para, ...(process.env.SAAS_ADMIN_EMAIL ? [process.env.SAAS_ADMIN_EMAIL] : [])].filter(Boolean))];
  const record: SaasNotification = { ...n, para, id: `ntf-${crypto.randomUUID().slice(0, 12)}`, fecha: new Date().toISOString(), estado: 'SIN_CANAL' };
  try {
    const transport = await getTransport();
    if (transport && para.length) {
      await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: para.join(', '), subject: n.asunto, text: n.cuerpo });
      record.estado = 'ENVIADO';
    } else {
      record.error = para.length ? 'SMTP no configurado (SMTP_HOST): el aviso no salió.' : 'Sin destinatarios.';
    }
  } catch (err: any) {
    record.estado = 'ERROR';
    record.error = err?.message || String(err);
  }
  diskPersistence.updateCollection('saasNotifications', [record, ...listNotifications()].slice(0, 5000));
  return record;
}
