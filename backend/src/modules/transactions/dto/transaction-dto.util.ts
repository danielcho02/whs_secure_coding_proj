import { TransformFnParams } from 'class-transformer';

export function optionalInteger({ value }: TransformFnParams): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return Number(value);
}

export function optionalTrimmedString({ value }: TransformFnParams): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
