/**
 * Ganchos que la administración comercial (cliente ERP, límites, campos protegidos) aplica sobre
 * la cartera de empresas. Viven aparte para que el controlador de empresas no dependa del módulo SaaS
 * y las pruebas puedan reemplazarlos.
 */
import type { Request } from 'express';

export interface HookError {
  status: number;
  body: { error: string; errorMessage: string; [k: string]: any };
}

export interface CompanyClientHooks {
  beforeSave(ctx: { req: Request; user: any; existente: any | undefined; body: any }): Promise<HookError | null> | HookError | null;
  afterSave(ctx: { req: Request; user: any; cliente: any; creada: boolean }): Promise<void> | void;
  beforeCreateUser(ctx: { req: Request; user: any; empresa: any }): Promise<HookError | null> | HookError | null;
  /** true si un administrador (no SuperAdmin) puede registrar empresas nuevas en su cliente ERP. */
  allowAdminCreate(ctx: { user: any }): boolean;
}

const noop: CompanyClientHooks = {
  beforeSave: () => null,
  afterSave: () => undefined,
  beforeCreateUser: () => null,
  allowAdminCreate: () => false,
};

export const companyClientHooks: CompanyClientHooks = { ...noop };

export function registerCompanyClientHooks(hooks: Partial<CompanyClientHooks>): void {
  Object.assign(companyClientHooks, hooks);
}
