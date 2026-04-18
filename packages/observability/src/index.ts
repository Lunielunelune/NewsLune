import pino from "pino";

export function createLogger(name: string, level = process.env.LOG_LEVEL ?? "info") {
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

