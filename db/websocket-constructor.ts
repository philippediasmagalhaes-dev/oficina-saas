export function selectWebSocketConstructor<TNative, TFallback>(
  nativeConstructor: TNative | undefined,
  fallbackConstructor: TFallback,
): TNative | TFallback {
  return nativeConstructor ?? fallbackConstructor;
}
