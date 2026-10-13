// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function maskIdentifier(value: string, _type: string): string {
  if (!value) return "";
  const len = value.length;
  if (len <= 4) return "****";
  const visible = Math.min(4, Math.floor(len / 3));
  return value.slice(0, visible) + "•".repeat(len - visible * 2) + value.slice(-visible);
}

export function maskEmail(email: string): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = Math.min(2, local.length);
  return local.slice(0, visible) + "•••@" + domain;
}

export function maskPhone(phone: string): string {
  if (!phone) return "";
  const len = phone.length;
  if (len <= 4) return "****";
  return phone.slice(0, 4) + "•••" + phone.slice(-3);
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
