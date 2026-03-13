export function stripStoryPrefix(title: string): string {
  if (!title) return title;
  const stripped = title.replace(/^(?:User\s+)?Story\s+\d+[:\s-]+/i, '').trim();
  return stripped || title; // fallback to original if nothing is left
}
