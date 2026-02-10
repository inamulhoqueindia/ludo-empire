import winston from 'winston';

export class Logger {
    constructor(context) {
        this.context = context;
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.splat(),
                winston.format.json()
            ),
            defaultMeta: { service: 'ludo-empire' },
            transports: [
                new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                new winston.transports.File({ filename: 'logs/combined.log' }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                            let msg = `${timestamp} [${level}] [${this.context}]: ${message}`;
                            if (Object.keys(metadata).length > 0) {
                                msg += ` ${JSON.stringify(metadata)}`;
                            }
                            return msg;
                        })
                    )
                })
            ]
        });
    }

    info(message, meta = {}) {
        this.logger.info(message, { context: this.context, ...meta });
    }

    error(message, meta = {}) {
        this.logger.error(message, { context: this.context, ...meta });
    }

    warn(message, meta = {}) {
        this.logger.warn(message, { context: this.context, ...meta });
    }

    debug(message, meta = {}) {
        this.logger.debug(message, { context: this.context, ...meta });
    }
}