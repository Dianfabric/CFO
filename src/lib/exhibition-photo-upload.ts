export async function uploadSequentially<T, R>(
  items: readonly T[],
  upload: (item: T) => Promise<R>,
): Promise<R[]> {
  const uploaded: R[] = []
  for (const item of items) uploaded.push(await upload(item))
  return uploaded
}
