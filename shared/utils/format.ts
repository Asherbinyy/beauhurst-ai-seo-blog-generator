export function formatMoney(pence: number): string {
  if (!Number.isSafeInteger(pence) || pence < 0)
    throw new RangeError('Money must be non-negative safe integer pence.')
  const exact = BigInt(pence)
  const pounds = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(exact / 100n)
  const remainder = exact % 100n
  return remainder ? `${pounds}.${String(remainder).padStart(2, '0')}` : pounds
}
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}
export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}
