/**
 * Creates a debounced function that delays execution by the specified time.
 * @param fn The original function to debounce.
 * @param ms The debounce time in milliseconds.
 * @returns A tuple containing the debounced function and a teardown function.
 */
export function debounce<A>(
  fn: (args?: A) => void,
  ms: number,
): [(args?: A) => void, { dispose: () => void }] {
  let timer: NodeJS.Timeout;

  const teardown = { dispose: () => clearTimeout(timer) };
  const debouncedFunc = (args?: A): void => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(args), ms);
  };

  return [debouncedFunc, teardown];
}
