import { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { type ZodType, ZodError } from 'zod';
import { randomUUID } from 'node:crypto';

/**
 * Interface para especificar qué partes de la solicitud HTTP serán validadas.
 */
export interface RequestValidationSchemas<B = any, P = any, Q = any> {
  body?: ZodType<B>;
  params?: ZodType<P>;
  query?: ZodType<Q>;
}

/**
 * Middleware generador de validación con Zod y observabilidad de traceId.
 * Garantiza respuestas HTTP 400 semánticas ante fallos de contrato.
 */
export function validateRequest<B = any, P = any, Q = any>(
  schemas: RequestValidationSchemas<B, P, Q>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // a) Garantía de Observabilidad: Extracción o generación de traceId
    const incomingTraceId =
      (req.headers['x-trace-id'] as string) ||
      (req.query?.traceId as string) ||
      (req.body?.traceId as string);

    const traceId = incomingTraceId && incomingTraceId.trim() !== ''
      ? incomingTraceId.trim()
      : `trace-${randomUUID().slice(0, 8)}`;

    res.locals.traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);

    const validationErrors: Array<{
      target: 'body' | 'params' | 'query';
      field: string;
      message: string;
    }> = [];

    // b) Validación de Params
    if (schemas.params) {
      const result = await schemas.params.safeParseAsync(req.params);
      if (!result.success) {
        collectZodErrors('params', result.error, validationErrors);
      } else {
        req.params = result.data as any;
      }
    }

    // c) Validación de Query
    if (schemas.query) {
      const result = await schemas.query.safeParseAsync(req.query);
      if (!result.success) {
        collectZodErrors('query', result.error, validationErrors);
      } else {
        req.query = result.data as any;
      }
    }

    // d) Validación de Body
    if (schemas.body) {
      // Inyectar traceId en el cuerpo si no viene presente
      if (req.body && typeof req.body === 'object' && !req.body.traceId) {
        req.body.traceId = traceId;
      }

      const result = await schemas.body.safeParseAsync(req.body);
      if (!result.success) {
        collectZodErrors('body', result.error, validationErrors);
      } else {
        req.body = result.data as any;
      }
    }

    // e) Si existen discrepancias de contrato, responder con HTTP 400 estandarizado
    if (validationErrors.length > 0) {
      res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        traceId,
        message: 'Los datos suministrados no cumplen con el contrato de la API.',
        timestamp: new Date().toISOString(),
        errors: validationErrors,
      });
      return;
    }

    next();
  };
}

/**
 * Función auxiliar para aplanar errores de Zod en un array homogéneo.
 */
function collectZodErrors(
  target: 'body' | 'params' | 'query',
  error: ZodError,
  accumulator: Array<{ target: 'body' | 'params' | 'query'; field: string; message: string }>
) {
  for (const issue of error.issues) {
    const field = issue.path.join('.') || target;
    accumulator.push({
      target,
      field,
      message: issue.message,
    });
  }
}
