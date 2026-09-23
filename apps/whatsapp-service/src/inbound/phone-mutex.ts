const chains = new Map<string, Promise<void>>();

export async function withPhoneMutex<T>(
  normalizedPhone: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = chains.get(normalizedPhone) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  chains.set(normalizedPhone, tail);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (chains.get(normalizedPhone) === tail) {
      chains.delete(normalizedPhone);
    }
  }
}
