import winston from 'winston';
import { APP_NAME, NODE_ENV } from './environment';
import { Logger } from './types/logger';
import { PROD_ENV, STAGING_ENV } from './constants';
import * as Sentry from '@sentry/node';

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  // Pad the levels and uppercase before they are colored
  winston.format(info => {
    info.level = info.level.toUpperCase().padStart(5);
    return info;
  })(),
);

// We want to make sure we aren't colorizing the logs that will
// be ingested by CloudWatch/etc
let colorFormat;
switch (NODE_ENV) {
  case PROD_ENV:
  case STAGING_ENV:
    colorFormat = baseFormat;
    break;
  default:
    colorFormat = winston.format.combine(baseFormat, winston.format.colorize());
    break;
}

const format = winston.format.combine(
  colorFormat,
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${APP_NAME}] ${level}: ${message}`;
  }),
);

const logger = winston.createLogger({
  level: 'info',
  format,
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

let nextScopeId = 1;

export function createScopedLogger(scope: string): Logger {
  const scopeId = nextScopeId++;

  const format = (msg: string) => `(${scopeId.toString().padStart(7)}) ${scope}: ${msg}`;

  return {
    debug: (msg: string) => logger.debug(format(msg)),
    info: (msg: string) => logger.info(format(msg)),
    warn: (msg: string) => logger.warn(format(msg)),
    error: (msg: string) => {
      Sentry.captureMessage(`${scope}: ${msg}`);
      logger.error(format(msg));
    },
  };
}

export function updateLogLevel(level: string) {
  const lg = createScopedLogger('updateLogLevel');

  switch (level) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      logger.level = level;
      lg.info(`Updated log level to ${level}`);
    case undefined:
      break;
    default:
      lg.warn(`Unknown log level "${level}". Defaulting to "info"`);
      break;
  }
}
