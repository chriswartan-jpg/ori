/**
 * Row ids. Postgres used to hand these out; with no backend the browser does, and
 * `crypto.randomUUID` keeps the same shape so nothing downstream has to care.
 */
export function newId(): string {
  return crypto.randomUUID();
}
