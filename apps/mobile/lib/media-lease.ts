// The composer owns the initial reference. An intent retains it before any await.
const references = new WeakMap<object, number>();
export function retainMedia(resource: object, dispose: () => void): () => void {
  references.set(resource, (references.get(resource) ?? 1) + 1);
  let released = false;
  return () => { if (!released) { released = true; releaseMedia(resource, dispose); } };
}
export function releaseMedia(resource: object, dispose: () => void): void {
  const remaining = (references.get(resource) ?? 1) - 1;
  references.set(resource, remaining);
  if (remaining === 0) dispose();
}
export function releaseImage(image: { uri: string }): void {
  if (process.env.EXPO_OS === 'web' && image.uri.startsWith('blob:')) URL.revokeObjectURL(image.uri);
}
