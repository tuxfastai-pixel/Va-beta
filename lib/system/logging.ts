export function logEvent(event: unknown) {
  console.log({
    timestamp: Date.now(),
    event,
  });
}
