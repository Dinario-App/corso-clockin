const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

export function formatAlertThresholdUsd(value: string): string | null {
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) return null;
  const whole = match[1]!;
  const fraction = match[2];
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (fraction === undefined) return `$${grouped}`;
  return `$${grouped}.${fraction}`;
}
