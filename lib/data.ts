// Seed data for Pactora. Every campaign is a small maker that needs a minimum
// number of pre-orders before it can produce a batch. Buyers sign a tUSD8
// receiveWithAuthorization; nothing moves until the threshold is met.
//
// These records power mock mode (no NEXT_PUBLIC_CONTRACT_ADDRESS set). Hashes and
// addresses below are deterministic placeholders, not real Aevum transactions.

export type CampaignStatus = "open" | "settled" | "lapsed";
export type PledgeState = "signed" | "withdrawn" | "collected" | "expired";

export interface Pledge {
  buyer: string;
  address: `0x${string}`;
  signedAt: string; // ISO
  state: PledgeState;
  /** tUSD8 balance of the buyer when the campaign closed (same before and after on a lapsed batch). */
  balance: number;
}

export interface Campaign {
  id: string;
  poolId: number;
  maker: string;
  makerPerson: string;
  city: string;
  product: string;
  blurb: string;
  pricePerOrder: number; // tUSD8
  minOrders: number;
  maxOrders: number;
  createdAt: string; // ISO
  deadline: string; // ISO, equals validBefore of every signature
  status: CampaignStatus;
  seller: `0x${string}`;
  createTx: `0x${string}`;
  settleTx?: `0x${string}`;
  pledges: Pledge[];
}

// Deterministic hex so server and client render the same placeholder values.
export function hexFrom(seed: string, length: number): string {
  let out = "";
  let h = 2166136261;
  let i = 0;
  while (out.length < length) {
    h ^= seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h, 16777619) >>> 0;
    out += h.toString(16).padStart(8, "0");
    i++;
  }
  return out.slice(0, length);
}

const addr = (seed: string) => `0x${hexFrom(seed, 40)}` as `0x${string}`;
const tx = (seed: string) => `0x${hexFrom(seed, 64)}` as `0x${string}`;

const BUYERS = [
  "Mert Aydın", "Elif Şahin", "Jonas Weber", "Priya Raman", "Can Öztürk", "Lucía Romero",
  "Deniz Koç", "Tom Hargreaves", "Zeynep Arslan", "Kenji Mori", "Burak Yıldız", "Sofia Marques",
  "Ece Tunç", "Omar Haddad", "Nil Aksoy", "Hanna Lind", "Emre Çelik", "Grace Okafor",
  "Selin Uçar", "Mateo Ruiz", "İpek Doğan", "Lena Fischer", "Kaan Erdem", "Aiko Sato",
];

function pledgesFor(id: string, count: number, startIso: string, state: PledgeState, withdrawn = 0): Pledge[] {
  const start = new Date(startIso).getTime();
  const list: Pledge[] = [];
  for (let i = 0; i < count + withdrawn; i++) {
    const name = BUYERS[(i * 7 + id.length) % BUYERS.length];
    const isWithdrawn = i >= count;
    list.push({
      buyer: name,
      address: addr(`${id}:${i}`),
      signedAt: new Date(start + (i + 1) * 3_700_000 * 2.3).toISOString(),
      state: isWithdrawn ? "withdrawn" : state,
      balance: 20 + (parseInt(hexFrom(`${id}:${i}:b`, 4), 16) % 180) + 0.5,
    });
  }
  return list;
}

function campaign(c: Omit<Campaign, "seller" | "createTx" | "settleTx" | "pledges"> & { signed: number; withdrawn?: number }): Campaign {
  const state: PledgeState = c.status === "settled" ? "collected" : c.status === "lapsed" ? "expired" : "signed";
  const { signed, withdrawn, ...rest } = c;
  return {
    ...rest,
    seller: addr(`${c.id}:seller`),
    createTx: tx(`${c.id}:create`),
    settleTx: c.status === "settled" ? tx(`${c.id}:settle`) : undefined,
    pledges: pledgesFor(c.id, signed, c.createdAt, state, withdrawn ?? 0),
  };
}

export const campaigns: Campaign[] = [
  campaign({
    id: "kavruk-guji", poolId: 1, maker: "Kavruk Coffee Roasters", makerPerson: "Ayşe Demir", city: "Istanbul",
    product: "Ethiopia Guji natural, 250 g bag",
    blurb: "Ayşe only fires the drum for this lot when five bags are spoken for. Below that, the green beans cost more than they earn.",
    pricePerOrder: 2, minOrders: 5, maxOrders: 12, createdAt: "2026-12-01T08:00:00Z", deadline: "2026-12-02T08:00:00Z",
    status: "open", signed: 3, withdrawn: 1,
  }),
  campaign({
    id: "selin-linen-overshirt", poolId: 2, maker: "Selin Kaya Tailoring", makerPerson: "Selin Kaya", city: "Izmir",
    product: "Washed linen overshirt, cut from one 40 m bolt",
    blurb: "The mill sells this linen by the full bolt only. Twelve shirts pays for the bolt; fewer and Selin eats the remnant.",
    pricePerOrder: 48, minOrders: 12, maxOrders: 16, createdAt: "2026-11-25T10:00:00Z", deadline: "2026-12-06T18:00:00Z",
    status: "open", signed: 11,
  }),
  campaign({
    id: "kadikoy-riso-map", poolId: 3, maker: "Baskı Atölyesi", makerPerson: "Deniz Erkan", city: "Kadıköy",
    product: "Two-color risograph map of Kadıköy, A3",
    blurb: "A new master and two drums of ink. Twenty prints covers the setup, everything after that is paper.",
    pricePerOrder: 9, minOrders: 20, maxOrders: 80, createdAt: "2026-11-22T09:30:00Z", deadline: "2026-12-09T21:00:00Z",
    status: "open", signed: 14,
  }),
  campaign({
    id: "porto-letterpress-2027", poolId: 4, maker: "Tipografia Ribeira", makerPerson: "Rui Almeida", city: "Porto",
    product: "2027 letterpress wall calendar, 13 sheets",
    blurb: "Hand-set type, one sheet per month plus a cover. Fifty orders is the point where the paper order gets the trade price.",
    pricePerOrder: 26, minOrders: 50, maxOrders: 120, createdAt: "2026-11-18T12:00:00Z", deadline: "2026-12-10T23:00:00Z",
    status: "open", signed: 37,
  }),
  campaign({
    id: "roggenhaus-rye-month", poolId: 5, maker: "Roggenhaus Bakery", makerPerson: "Jana Vogel", city: "Berlin",
    product: "Four weeks of 1 kg sourdough rye, Saturday pickup",
    blurb: "A second Saturday bake needs 25 households to justify the extra night shift.",
    pricePerOrder: 16, minOrders: 25, maxOrders: 40, createdAt: "2026-11-28T07:00:00Z", deadline: "2026-12-08T07:00:00Z",
    status: "open", signed: 9,
  }),
  campaign({
    id: "ayvalik-early-harvest", poolId: 6, maker: "Ayvalık Family Press", makerPerson: "Hasan Uysal", city: "Ayvalık",
    product: "Early harvest olive oil, 1 L tin",
    blurb: "Green olives pressed the week they are picked. Forty tins books a slot at the cooperative mill.",
    pricePerOrder: 18, minOrders: 40, maxOrders: 60, createdAt: "2026-11-05T06:00:00Z", deadline: "2026-11-19T18:00:00Z",
    status: "settled", signed: 43,
  }),
  campaign({
    id: "ankara-bindery-notebook", poolId: 7, maker: "Kağıt Ev Bindery", makerPerson: "Ebru Taş", city: "Ankara",
    product: "Tea-dyed sewn notebook, 120 pages",
    blurb: "Fifteen notebooks fills one dye bath. Exactly fifteen people signed, and the batch went out in a single transaction.",
    pricePerOrder: 11, minOrders: 15, maxOrders: 30, createdAt: "2026-11-08T11:00:00Z", deadline: "2026-11-20T11:00:00Z",
    status: "settled", signed: 15,
  }),
  campaign({
    id: "brine-bloom-sauce", poolId: 8, maker: "Brine & Bloom", makerPerson: "Marisol Vega", city: "Austin",
    product: "Fermented habanero sauce, 150 ml",
    blurb: "One 60 L crock of mash. Sixty bottles or the crock waits until spring.",
    pricePerOrder: 7, minOrders: 60, maxOrders: 90, createdAt: "2026-11-02T15:00:00Z", deadline: "2026-11-16T15:00:00Z",
    status: "settled", signed: 64,
  }),
  campaign({
    id: "barro-azul-mugs", poolId: 9, maker: "Barro Azul Ceramics", makerPerson: "Inês Costa", city: "Lisbon",
    product: "Cobalt glaze stoneware mug, 330 ml",
    blurb: "A full kiln is thirty mugs. The campaign closed at nineteen, so nobody was charged and the kiln stayed cold.",
    pricePerOrder: 22, minOrders: 30, maxOrders: 45, createdAt: "2026-11-06T09:00:00Z", deadline: "2026-11-21T09:00:00Z",
    status: "lapsed", signed: 19,
  }),
  campaign({
    id: "kars-felt-socks", poolId: 10, maker: "Kars Felting Co-op", makerPerson: "Gülizar Ateş", city: "Kars",
    product: "Hand-felted wool house socks",
    blurb: "Thirty pairs to buy one fleece lot. It closed at twenty-one; every buyer's balance is exactly what it was.",
    pricePerOrder: 12, minOrders: 30, maxOrders: 50, createdAt: "2026-11-04T08:00:00Z", deadline: "2026-11-18T08:00:00Z",
    status: "lapsed", signed: 21,
  }),
];

/** The campaign the landing CTA preloads into the workspace. */
export const EXAMPLE_CAMPAIGN_ID = "kavruk-guji";

/** Mock wallets that can "sign" in mock mode, so the counter can be walked to the threshold. */
export const DEMO_SIGNERS = [
  { buyer: "You (demo wallet)", address: addr("demo:you") },
  { buyer: "Kerem Avcı", address: addr("demo:kerem") },
  { buyer: "Maya Brooks", address: addr("demo:maya") },
  { buyer: "Yusuf Polat", address: addr("demo:yusuf") },
];

export function activePledges(c: Campaign): Pledge[] {
  return c.pledges.filter((p) => p.state === "signed" || p.state === "collected" || p.state === "expired");
}

export function getSeedCampaign(id: string): Campaign | undefined {
  return campaigns.find((c) => c.id === id);
}

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
