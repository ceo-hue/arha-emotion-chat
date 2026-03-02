// Adapted from: hisol-unified-mcp/src/utils/logger.ts @ v1.0
// Browser-compatible version — no Node.js fs/path/chalk dependencies

const LOG_ENABLED = false; // PRO debug logs (set true for dev)

export const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    if (LOG_ENABLED) console.debug('%c[PRO]', 'color:#a78bfa', msg, ...args);
  },
  info: (msg: string, ...args: unknown[]) => {
    if (LOG_ENABLED) console.info('%c[PRO]', 'color:#60a5fa', msg, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    console.warn('%c[PRO]', 'color:#fbbf24', msg, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error('%c[PRO]', 'color:#f87171', msg, ...args);
  },
};
