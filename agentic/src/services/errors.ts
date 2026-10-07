/**
 * Errores de Servicios Externos y Cumplimiento Normativo Chileno
 */

export class ExternalServiceError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly serviceName: string;
  public readonly details?: any;

  constructor(
    serviceName: string,
    message: string,
    code = 'EXTERNAL_SERVICE_ERROR',
    statusCode?: number,
    details?: any
  ) {
    super(`[${serviceName}] ${message}`);
    this.name = 'ExternalServiceError';
    this.serviceName = serviceName;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class SiiGatewayError extends ExternalServiceError {
  constructor(message: string, code = 'SII_GATEWAY_ERROR', statusCode?: number, details?: any) {
    super('SII_GATEWAY', message, code, statusCode, details);
    this.name = 'SiiGatewayError';
  }
}
