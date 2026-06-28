import { TransformFnParams } from 'class-transformer';

export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function optionalInteger({ value }: TransformFnParams): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
}
