export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function formatDate(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

export function formatDateTime(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function initials(name: string): string {
  return name
    .replace(/^(dr\.|dr|a\.md|s\.)/i, "")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function age(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const diff = Date.now() - dob.getTime()
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000))
}
