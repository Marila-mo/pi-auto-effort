export async function withDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  caller?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(caller?.reason);
  if (caller?.aborted) abort();
  else caller?.addEventListener("abort", abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listener: (() => void) | undefined;
  try {
    controller.signal.throwIfAborted();
    const cancelled = new Promise<never>((_, reject) => {
      listener = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", listener, { once: true });
      timer = setTimeout(
        () => controller.abort(new Error("Selector deadline exceeded")),
        timeoutMs,
      );
    });
    return await Promise.race([
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return run(controller.signal);
      }),
      cancelled,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (listener) controller.signal.removeEventListener("abort", listener);
    caller?.removeEventListener("abort", abort);
  }
}
