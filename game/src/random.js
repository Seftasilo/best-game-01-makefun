// A small seeded random number generator (mulberry32): the same seed gives the
// same stream of numbers, which is what makes the screenshot scenes repeatable
// and the headless logic runs byte-identical. Nothing else in the game rolls dice
// except through a generator built here.

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max) from the given generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** One of the array's entries, picked by the given generator. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}
