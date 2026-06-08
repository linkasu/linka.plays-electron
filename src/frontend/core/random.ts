export type NonRepeatingRandomIndexGenerator = {
  next: () => number | undefined;
  reset: () => void;
};

export function createNonRepeatingRandomIndexGenerator(size: number, random = Math.random): NonRepeatingRandomIndexGenerator {
  if (!Number.isInteger(size) || size < 0) throw new Error("Generator size must be a non-negative integer.");

  let pool: number[] = [];
  let previous: number | undefined;

  function refill() {
    pool = Array.from({ length: size }, (_, index) => index);
    for (let index = pool.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(random() * (index + 1));
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }

    if (size > 1 && pool[0] === previous) {
      const swapIndex = 1 + Math.floor(random() * (pool.length - 1));
      [pool[0], pool[swapIndex]] = [pool[swapIndex], pool[0]];
    }
  }

  function next() {
    if (size === 0) return undefined;
    if (pool.length === 0) refill();

    const value = pool.shift();
    previous = value;
    return value;
  }

  function reset() {
    pool = [];
    previous = undefined;
  }

  return { next, reset };
}
