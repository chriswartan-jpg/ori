/**
 * Account value formatting.
 *
 * One place, because the same number is rendered three ways: exact in a contact's card,
 * compact in a headline ("€2.4M at risk"), and summed across a cluster. Changing currency
 * is a one-line change here rather than a search across components.
 */

/** The single currency in the app. There is no per-contact currency and no conversion. */
export const CURRENCY = "EUR";

const EXACT = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const COMPACT = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "€40,000". null in, null out, so a contact with no value renders as nothing. */
export function formatMoney(amount: number | null): string | null {
  if (amount === null || !Number.isFinite(amount)) return null;
  return EXACT.format(amount);
}

/** "€2.4M" — for headline numbers where the exact figure is noise. */
export function formatMoneyCompact(amount: number): string {
  if (!Number.isFinite(amount)) return COMPACT.format(0);
  // Below a thousand the compact form ("€900") equals the exact one, so it is used as is.
  return COMPACT.format(amount);
}
