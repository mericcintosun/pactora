// Prints the seed campaign count and a sha256 digest of the seed records.
// Writes no file; two runs print the same output.
// Run with: npm run seed (Node 22.6 or newer, uses --experimental-strip-types).
import { createHash } from "node:crypto";

const { campaigns } = await import("../lib/data/seed.ts");

const digest = createHash("sha256").update(JSON.stringify(campaigns)).digest("hex");

console.log(`seed campaigns: ${campaigns.length}`);
console.log(`seed sha256: ${digest}`);
