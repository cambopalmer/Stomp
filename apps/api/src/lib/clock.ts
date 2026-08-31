/** Wrapped so tests can freeze time. */
let frozen: number | null = null;

export const clock = {
  now(): number {
    return frozen ?? Date.now();
  },
  freeze(ms: number): void {
    frozen = ms;
  },
  unfreeze(): void {
    frozen = null;
  },
};
