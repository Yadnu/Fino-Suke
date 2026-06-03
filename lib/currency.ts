/**
 * Currency conversion utilities.
 *
 * The `rates` map is expected to be Frankfurter-style: all values are
 * relative to a single implicit base currency (not present as a key).
 * Missing keys are therefore treated as 1.0 (i.e. the base currency itself).
 *
 * Formula: amount_in_base = amount / rates[from]  (rate = units-of-from per 1 base)
 *          result          = amount_in_base * rates[to]
 */

/**
 * Convert `amount` from `fromCurrency` to `toCurrency` using the provided
 * exchange-rate map.  Returns `amount` unchanged when either currency is
 * missing from `rates` and they happen to be equal, or when the map is empty.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;

  // Treat the base currency (not stored in the Frankfurter map) as rate 1.0
  const fromRate = rates[fromCurrency] ?? 1;
  const toRate = rates[toCurrency] ?? 1;

  if (fromRate === 0) return amount;

  return (amount / fromRate) * toRate;
}

/**
 * Convenience wrapper: return `amount` expressed in `userCurrency`,
 * converting from `txCurrency` if they differ.
 */
export function getDisplayAmount(
  amount: number,
  txCurrency: string,
  userCurrency: string,
  rates: Record<string, number>
): number {
  return convertAmount(amount, txCurrency, userCurrency, rates);
}
