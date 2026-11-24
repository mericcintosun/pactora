// Display formatters shared by server pages and client components.

export function formatTusd(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} tUSD8`;
}

export function formatUtc(iso: string): string {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

export function shortHex(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}
