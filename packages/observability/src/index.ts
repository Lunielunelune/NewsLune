import pino from "pino";

export type AppLogger = pino.Logger;

export function createLogger(name: string, level = process.env.LOG_LEVEL ?? "info"): AppLogger {
  return pino({
    name,
    level,
    transport:
      process.env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true
            }
          }
        : undefined
  });
}
