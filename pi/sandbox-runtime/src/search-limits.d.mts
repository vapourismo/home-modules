export const LS_DEFAULT_LIMIT: number;
export const LS_MAX_LIMIT: number;
export const FIND_DEFAULT_LIMIT: number;
export const FIND_MAX_LIMIT: number;
export const GREP_DEFAULT_LIMIT: number;
export const GREP_MAX_LIMIT: number;
export const GREP_DEFAULT_CONTEXT: number;
export const GREP_MAX_CONTEXT: number;
export const COMMAND_OUTPUT_MAX_BYTES: number;
export const GREP_MAX_LINE_LENGTH: number;

export interface IntegerParameterOptions {
  name: string;
  defaultValue: number;
  minimum: number;
  maximum: number;
}

export function validateIntegerParameter(
  value: unknown,
  options: IntegerParameterOptions,
): number;
