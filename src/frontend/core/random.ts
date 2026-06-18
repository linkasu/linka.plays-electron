export type NonRepeatingRandomIndexGenerator = {
  next: () => number | undefined;
  reset: () => void;
};

export function randomInt(min: number, max: number, random = Math.random) {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  if (upper < lower) throw new Error("randomInt: max must be greater than or equal to min.");
  return lower + Math.floor(random() * (upper - lower + 1));
}

export function shuffleItems<T>(items: T[], random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index, random);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function sampleItems<T>(items: T[], count: number, exclude: T[] = [], random = Math.random) {
  const excluded = new Set(exclude);
  const pool = items.filter((item) => !excluded.has(item));
  const result: T[] = [];
  while (pool.length && result.length < count) {
    const index = randomInt(0, pool.length - 1, random);
    const [item] = pool.splice(index, 1);
    result.push(item);
  }
  return result;
}

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
