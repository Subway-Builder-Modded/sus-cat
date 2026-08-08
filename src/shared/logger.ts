type LogDetails = Error | Record<string, unknown>;

export const logger = {
  info(message: string, details?: LogDetails): void {
    write("INFO", message, details);
  },
  warn(message: string, details?: LogDetails): void {
    write("WARN", message, details);
  },
  error(message: string, details?: LogDetails): void {
    write("ERROR", message, details);
  },
};

function write(level: string, message: string, details?: LogDetails): void {
  const timestamp = new Date().toISOString();
  const output = `[${timestamp}] [${level}] ${message}`;
  const method = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;

  if (details) method(output, details);
  else method(output);
}
