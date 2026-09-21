/**
 * The demo network, built in the browser on first run. This replaces supabase/seed.sql.
 *
 * Deterministic on purpose: every value is derived from a running index with coprime
 * multipliers instead of Math.random(), so the same network comes out every time and a
 * screenshot from yesterday still matches. Dates are relative to today, so the seed keeps
 * making sense next month.
 *
 * All names, companies and addresses are invented. Never seed real contact data.
 *
 * ~125 contacts: the first 90 are work contacts carrying a company and a role, the rest
 * are personal ones carrying how you know each other. They all live in the one network,
 * which is the point — the graph clusters by company *and* by relation. Enough for the
 * graph to look like a working network, small enough that every iteration is instant.
 * Do not seed 800.
 */
import { newId } from "@/lib/core/ids";
import { normalizeCompany } from "@/lib/core/import/normalize";
import {
  INTERACTION_KINDS,
  todayIso,
  type Contact,
  type Dataset,
  type Interaction,
} from "@/lib/core/types";

/** Index 1..90 are work contacts, 91..125 personal ones. */
const WORK_UNTIL = 90;
const TOTAL = 125;

const FIRST_NAMES = [
  "Elena", "Marcus", "Priya", "Tobias", "Annika", "Felix", "Rosalind", "Marek", "Clara", "Henrik",
  "Nadia", "Elias", "Delphine", "Bastian", "Ivana", "Ruben", "Theresa", "Malik", "Yara", "Corbin",
  "Frieda", "Aleks", "Juliet", "Vincent", "Maya", "Emil", "Johanna", "Linus", "Greta", "Samuel",
];

const LAST_NAMES = [
  "Hartmann", "Kessler", "Brandstetter", "Vogler", "Nowak", "Reinders", "Pfeiffer", "Salzmann",
  "Lindqvist", "Ostermann", "Ashworth", "Tschirner", "Kowalczyk", "Whitlock", "Hufnagel",
  "Dembinski", "Waldmann", "Steinbach", "Gruber", "Marek", "Ehrlich", "Vandenberg", "Zurek",
  "Fellinger", "Brandhorst", "Kienzle", "Sturm", "Oberhauser", "Liebig", "Rautenberg",
  "Schmidbauer", "Trautwein", "Novotny", "Eichwald", "Peltonen", "Hagedorn", "Kirschner",
];

/** Legal forms are left on: normalizeCompany strips them, which is what clusters them. */
const COMPANIES = [
  "Northlight Systems Ltd",
  "Kranzberg & Partners LLC",
  "Halfmoon Logistics Inc",
  "Veltwerk Holdings BV",
  "Meridian Data AG",
  "Saalfeld Pharma SE",
  "Brackwater Studios Ltd",
  "Tannhof Energy Corp",
  "Upperline Analytics GmbH",
  "Lindtmann Consulting",
  "Bedrock Construction Ltd",
  "Aurelia Media Group",
  "Piekenbrock Legal",
  "Westharbour Robotics Ltd",
];

const ROLES = [
  "Managing Director",
  "Head of Sales",
  "Product Manager",
  "Software Engineer",
  "Controller",
  "Head of Marketing",
  "Procurement Lead",
  "Recruiter",
  "Data Engineer",
  "VP Sales",
];

const WORK_CITIES = ["London", "Berlin", "Amsterdam", "New York", "Singapore"];

const ANY_CITIES = [
  "London", "Berlin", "Amsterdam", "New York", "Singapore", "Vienna", "Zurich",
  "Lisbon", "Rotterdam", "Copenhagen", "Austin",
];

/** How you know a work contact. Clustering material next to company and role. */
const WORK_RELATIONS = [
  "Client",
  "Ex-colleague",
  "Supplier",
  "Investor",
  "Conference",
  "Introduced",
];

const PERSONAL_RELATIONS = [
  "University",
  "Running club",
  "Festival",
  "Flatmate",
  "School",
  "Neighbour",
];

const PERSONAL_TAGS = ["Climbing", "Music", "Cooking", "Running", "Board games"];

const NOTES_POOL = [
  "Met through a mutual contact.",
  "Worth calling again in the autumn.",
  "Interested in working together.",
  "Two kids, moved house in 2024.",
  "Met at the conference in Lisbon.",
];

const INTERACTION_NOTES = [
  "Quick call.",
  "Went through the proposal.",
  "Met for a beer.",
  "Birthday message.",
  "Still waiting on their reply.",
];

const pick = <T>(values: T[], index: number): T => values[index % values.length];

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function isoDaysFromToday(days: number, today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Annual account value in EUR, for work contacts only.
 *
 * Personal contacts get null, not 0: an unvalued friend must never show up in a
 * "money at risk" total. Key accounts (the i % 9 tag above) are an order of magnitude
 * bigger, so the cold-accounts ranking has a clear top rather than a flat list.
 */
function accountValueFor(i: number, work: boolean): number | null {
  if (!work) return null;
  if (i % 9 === 0) return 150_000 + ((i * 7919) % 11) * 25_000; // 150k .. 400k
  return 15_000 + ((i * 7919) % 22) * 5_000; // 15k .. 120k
}

function tagsFor(i: number, work: boolean): string[] {
  if (work) {
    if (i % 9 === 0) return ["Key account"];
    if (i % 11 === 0) return ["Trade fair 2026", "Warm"];
    return [];
  }
  const first = pick(PERSONAL_TAGS, (i * 3) % 5);
  if (i % 4 !== 0) return [first];
  return [first, pick(PERSONAL_TAGS, ((i * 3) % 5 + 1) % 5)];
}

function contactFor(i: number, today: string): Contact {
  const work = i <= WORK_UNTIL;

  const first_name = pick(FIRST_NAMES, i * 7);
  const last_name = pick(LAST_NAMES, i * 11);

  const company = work ? pick(COMPANIES, i * 11) : null;
  const company_norm = normalizeCompany(company);

  // Every contact says how you know them; only the vocabulary differs.
  const relation = work ? pick(WORK_RELATIONS, i * 5) : pick(PERSONAL_RELATIONS, i * 5);

  // ~15% have no city at all — the graph has to survive missing attributes.
  const city = i % 7 === 0 ? null : work ? pick(WORK_CITIES, i * 3) : pick(ANY_CITIES, i * 3);

  const domain = company_norm ? `${slug(company_norm)}.example` : "example.net";
  const email = i % 7 === 3 ? null : `${slug(first_name)}.${slug(last_name)}@${domain}`;

  const phone =
    i % 3 === 0
      ? null
      : `+1 (${200 + (i % 700)}) 555-${String((i * 7307) % 10000).padStart(4, "0")}`;

  // Monotonic in i, so the interaction pattern below lines up with the same index.
  const created = new Date(`${isoDaysFromToday(-180, today)}T00:00:00Z`);
  created.setUTCHours(created.getUTCHours() + i);
  const timestamp = created.toISOString();

  return {
    id: newId(),
    network: "connections",
    first_name,
    last_name,
    email,
    phone,
    company,
    company_norm,
    role: work ? pick(ROLES, i * 3) : null,
    city,
    relation,
    tags: tagsFor(i, work),
    notes: i % 17 === 0 ? pick(NOTES_POOL, i * 3) : null,
    profile_url: null,
    // Roughly one in eight, so the provenance caution is visible in the demo without
    // being the first thing you see on every card.
    crowdsourced: i % 8 === 5,
    account_value: accountValueFor(i, work),
    source: "manual",
    created_at: timestamp,
    updated_at: timestamp,
  };
}

/**
 * The interaction log.
 *   i % 9 === 0 -> no interaction at all               (quiet because nothing was logged)
 *   i % 9 === 1 -> last interaction 100..699 days ago  (quiet by QUIET_AFTER_DAYS = 90)
 *   otherwise   -> everything inside the last 85 days  (active)
 * Both quiet cases have to exist or the "quiet contacts only" filter has nothing to show.
 *
 * The 9 matters: city cycles every 5, role every 10 and company every 14, so keying the
 * quiet pattern on 5 or 7 would make "London" mean "never contacted" and every role sit
 * in one recency band. 9 is coprime with all three, so recency spreads across the graph.
 */
function interactionsFor(contact: Contact, i: number, today: string): Interaction[] {
  if (i % 9 === 0) return [];

  const entries: Interaction[] = [];

  for (let j = 1; j <= 1 + (i % 4); j++) {
    const ago = i % 9 === 1 ? 100 + ((i * 17 + j * 29) % 600) : (i * 11 + j * 23) % 85;

    entries.push({
      id: newId(),
      contact_id: contact.id,
      kind: pick([...INTERACTION_KINDS], i * 3 + j * 7),
      occurred_on: isoDaysFromToday(-ago, today),
      note: (i + j) % 4 === 0 ? pick(INTERACTION_NOTES, i + j) : null,
      created_at: contact.created_at,
    });
  }

  return entries;
}

export function buildSeedDataset(today = todayIso()): Dataset {
  const contacts: Contact[] = [];
  const interactions: Interaction[] = [];

  for (let i = 1; i <= TOTAL; i++) {
    const contact = contactFor(i, today);
    contacts.push(contact);
    interactions.push(...interactionsFor(contact, i, today));
  }

  return { contacts, interactions };
}
