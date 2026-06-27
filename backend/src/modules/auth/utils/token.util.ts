const DURATION_UNITS_IN_SECONDS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
} as const;

type DurationUnit = keyof typeof DURATION_UNITS_IN_SECONDS;

export function parseDurationToSeconds(duration: string): number {
  const trimmed = duration.trim();
  const numericOnly = Number(trimmed);

  if (Number.isInteger(numericOnly) && numericOnly > 0) {
    return numericOnly;
  }

  const match = /^(\d+)([smhd])$/.exec(trimmed);

  if (!match) {
    throw new Error('Invalid duration format');
  }

  const value = Number(match[1]);
  const unit = match[2] as DurationUnit;
  return value * DURATION_UNITS_IN_SECONDS[unit];
}
