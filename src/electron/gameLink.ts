export function gameIdFromArguments(args: string[]): string | undefined {
  for (const arg of args) {
    if (!arg.startsWith("linka-play://")) continue;
    try {
      const url = new URL(arg);
      const id = url.pathname.slice(1);
      if (
        url.host === "game" &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) &&
        arg === `linka-play://game/${id}`
      ) {
        return id;
      }
    } catch {
      // Ignore malformed arguments from external applications.
    }
  }
  return undefined;
}
