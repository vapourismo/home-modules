export const LS_DEFAULT_LIMIT = 500;
export const LS_MAX_LIMIT = 500;
export const FIND_DEFAULT_LIMIT = 1000;
export const FIND_MAX_LIMIT = 1000;
export const GREP_DEFAULT_LIMIT = 100;
export const GREP_MAX_LIMIT = 100;
export const GREP_DEFAULT_CONTEXT = 0;
export const GREP_MAX_CONTEXT = 10;
export const COMMAND_OUTPUT_MAX_BYTES = 50 * 1024;
export const GREP_MAX_LINE_LENGTH = 500;

export function validateIntegerParameter(value, { name, defaultValue, minimum, maximum }) {
  if (value === undefined) return defaultValue;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)
    || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}
