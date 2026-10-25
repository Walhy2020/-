export function randomSeed() { return Math.floor(Math.random() * 4294967296); }

/** Seeded randomness keeps a streamed cell stable until it is regenerated. */
export function makeRandom(seed = randomSeed()) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
