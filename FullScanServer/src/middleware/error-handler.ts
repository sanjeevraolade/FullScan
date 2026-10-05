import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';

/**
 * Request-body failures raised by body-parser (`express.json`), by their `type`. Each
 * gets a fixed message: body-parser's own messages can quote the body (a JSON
 * `SyntaxError` does), and its errors carry the raw body on `err.body`, so they are
 * neither echoed nor logged.
 */
const BODY_PARSER_ERRORS: Readonly<Record<string, { readonly status: number; readonly message: string }>> = {
  'entity.parse.failed': { status: 400, message: 'Malformed JSON body' },
  'entity.too.large': { status: 413, message: 'Request body is too large' },
  'request.size.invalid': { status: 400, message: 'Request body does not match its Content-Length' },
  'request.aborted': { status: 400, message: 'Request aborted' },
  'charset.unsupported': { status: 415, message: 'Unsupported request charset' },
  'encoding.unsupported': { status: 415, message: 'Unsupported request content encoding' },
};

function bodyParserFailure(err: Error): { readonly status: number; readonly message: string } | undefined {
  return 'type' in err && typeof err.type === 'string' && Object.hasOwn(BODY_PARSER_ERRORS, err.type)
    ? BODY_PARSER_ERRORS[err.type]
    : undefined;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  const bodyFailure = bodyParserFailure(err);
  if (bodyFailure) {
    res.status(bodyFailure.status).json({ success: false, error: bodyFailure.message });
    return;
  }

  logger.error(err, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
}
