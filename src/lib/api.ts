export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error || 'Something went wrong' }
    return { data: json }
  } catch {
    return { error: 'Network error' }
  }
}
