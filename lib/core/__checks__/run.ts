/**
 * The only checks in the project: the spreadsheet parser, the graph build, the filter
 * math and the dataset layer that replaced the database. Everything else is UI.
 *
 * Run with `npm run check`. No framework — node:assert and a process exit code.
 */
import assert from "node:assert/strict";

import { createContact, deleteContact, networkCounts } from "@/lib/core/contacts";
import { applyFilter, collectFacets } from "@/lib/core/graph/filter";
import { buildGraph } from "@/lib/core/graph/build";
import { buildClusterOverview, coldestClusters } from "@/lib/core/graph/clusters";
import { buildEasyMailDraft, worthContactingReason } from "@/lib/core/easymail";
import { ingestContacts } from "@/lib/core/import/ingest";
import { logInteraction } from "@/lib/core/interactions";
import { parseCsvText } from "@/lib/core/import/parse-spreadsheet";
import { CONTACT_TEMPLATE_CSV } from "@/lib/core/import/template";
import { normalizePhone, normalizeTags } from "@/lib/core/import/normalize";
import { getGraphData } from "@/lib/core/read";
import { EMPTY_DATASET } from "@/lib/core/types";
import type {
  AttrNode,
  Contact,
  ContactInput,
  GraphContact,
  Interaction,
  PersonNode,
} from "@/lib/core/types";

let failures = 0;

function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (cause) {
    failures++;
    console.log(`  FAIL ${name}`);
    console.log(`       ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

// ---------------------------------------------------------------- (a) parser, happy path

// Hand-exported files really do look like this: a title, a blank line, a legend, CRLF,
// a BOM, a row with no e-mail, semicolon tags, and one row that is only a note.
const MESSY_CSV =
  "﻿Meine Kontakte\r\n" +
  "\r\n" +
  "Stand: Maerz 2026\r\n" +
  "Vorname;Nachname;E-Mail;Telefon;Firma;Rolle;Stadt;Beziehung;Tags;Notizen\r\n" +
  'Anna;Schmidt;Anna.Schmidt@Example.com;+49 151 / 234 56-78;Acme GmbH;Head of Marketing;Berlin;Kundin;"kunde; messe ;kunde";Auf der Messe\r\n' +
  "Jonas;Weber;;0170 9876543;Nordlicht AG;CTO;Hamburg;Ex-Kollege;tech|beirat;\r\n" +
  ";;niemand@example.com;;Solo UG;;;;;Zeile ohne Namen\r\n" +
  "\r\n";

check("(a) messy CSV: prelude skipped, German headers mapped", () => {
  const result = parseCsvText(MESSY_CSV);

  assert.equal(result.error, null);
  assert.deepEqual(result.headers, [
    "Vorname",
    "Nachname",
    "E-Mail",
    "Telefon",
    "Firma",
    "Rolle",
    "Stadt",
    "Beziehung",
    "Tags",
    "Notizen",
  ]);
  assert.equal(result.rows.length, 2, "two named rows");
  assert.equal(result.skipped, 1, "the nameless row is skipped, trailing blanks are not");

  const [anna, jonas] = result.rows;

  assert.equal(anna.contact.first_name, "Anna");
  assert.equal(anna.contact.last_name, "Schmidt");
  assert.equal(anna.contact.company, "Acme GmbH");
  assert.equal(anna.contact.role, "Head of Marketing");
  assert.equal(anna.contact.relation, "Kundin");
  assert.equal(anna.contact.profile_url, null);
  // Tags: semicolon-separated, trimmed, deduplicated case-insensitively.
  assert.deepEqual(anna.contact.tags, ["kunde", "messe"]);
  assert.deepEqual(anna.problems, [], "a clean row has no problems");
  assert.equal(anna.rowNumber, 5, "1-based row number in the original file");

  // A row without e-mail is a normal row, not a problem and not skipped.
  assert.equal(jonas.contact.email, null);
  assert.equal(jonas.contact.notes, null);
  assert.deepEqual(jonas.contact.tags, ["tech", "beirat"]);
});

check("(a) combined name column splits at the last space", () => {
  const result = parseCsvText(
    "Name;E-Mail;Stadt\n" +
      "Anna Maria Schmidt;anna@example.com;Berlin\n" +
      "Cher;cher@example.com;Los Angeles\n" +
      "Weber, Jonas;not-even-an-address;Hamburg\n",
  );

  assert.equal(result.error, null);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].contact.first_name, "Anna Maria");
  assert.equal(result.rows[0].contact.last_name, "Schmidt");
  assert.equal(result.rows[1].contact.first_name, "Cher");
  assert.equal(result.rows[1].contact.last_name, "", "a single token is the first name");
  // An implausible e-mail is reported, never blocking.
  assert.equal(result.rows[2].problems.length, 1);
  assert.match(result.rows[2].problems[0], /E-mail/);
});

check("(a) a 'Name' column beside 'Vorname' is the surname, not a combined name", () => {
  const result = parseCsvText("Vorname;Name;Stadt\nAnna;Schmidt;Berlin\n");
  assert.equal(result.error, null);
  assert.equal(result.rows[0].contact.first_name, "Anna");
  assert.equal(result.rows[0].contact.last_name, "Schmidt");
});

check("(a) delimiter is detected on short files and after a title line", () => {
  // Regression: Papaparse's own guess needs >2 mean fields per previewed line, so a title
  // row or a trailing newline used to make the whole line one column.
  for (const csv of [
    "Vorname;Nachname\nAnna;Schmidt\n",
    "Meine Kontakte\nVorname;Nachname\nAnna;Schmidt",
    "First Name,Last Name\nAnna,Schmidt\n",
    "Vorname\tNachname\nAnna\tSchmidt\n",
  ]) {
    const result = parseCsvText(csv);
    assert.equal(result.error, null, `should parse: ${JSON.stringify(csv)} -> ${result.error}`);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].contact.first_name, "Anna");
    assert.equal(result.rows[0].contact.last_name, "Schmidt");
  }

  // A comma-heavy notes column must not outvote the real delimiter.
  const tricky = parseCsvText(
    "Vorname;Nachname;Notizen\n" +
      "Anna;Schmidt;Kennt Jonas, Mara, und Emil\n" +
      "Jonas;Weber;Kennt Anna, Mara, und Emil\n",
  );
  assert.equal(tricky.error, null);
  assert.equal(tricky.rows.length, 2);
  assert.equal(tricky.rows[0].contact.notes, "Kennt Jonas, Mara, und Emil");
});

check("(a) unknown columns are ignored, not an error", () => {
  const result = parseCsvText("Vorname;Nachname;Lieblingsfarbe\nAnna;Schmidt;blau\n");
  assert.equal(result.error, null);
  assert.equal(result.rows.length, 1);
});

// ------------------------------------------------------------- (b) parser, no name column

check("(b) no name column: loud error naming the headers that were found", () => {
  const result = parseCsvText("E-Mail;Firma;Stadt\nanna@example.com;Acme GmbH;Berlin\n");

  assert.notEqual(result.error, null, "a silent empty import is the worst outcome");
  assert.equal(result.rows.length, 0);
  for (const header of ["E-Mail", "Firma", "Stadt"]) {
    assert.ok(result.error!.includes(header), `error names "${header}": ${result.error}`);
  }
});

check("(b) empty file is an error, not an empty success", () => {
  assert.notEqual(parseCsvText("").error, null);
  assert.notEqual(parseCsvText("   \n\n").error, null);
});

// ------------------------------------------------------------------- (c) graph build

const CITIES = ["Berlin", "Hamburg", "München", "Köln", null];
const ROLES = ["CTO", "Head of Marketing", "Founder", null];
const RELATIONS = ["Kundin", "Ex-Kollege", null];
const TAGS = [["kunde"], ["tech", "beirat"], [], ["messe"], ["kunde", "tech"]];

/** 150 synthetic contacts across 12 companies, plus one with no attribute at all. */
function synthetic(): GraphContact[] {
  const contacts: GraphContact[] = [];

  for (let i = 0; i < 149; i++) {
    contacts.push({
      id: `c${i}`,
      first_name: `Person${i}`,
      last_name: `Nachname${i}`,
      // 12 companies, weighted so the cap has a clear top and a clear tail.
      company_norm: `Firma ${i % 12}`,
      role: ROLES[i % ROLES.length],
      city: CITIES[i % CITIES.length],
      relation: RELATIONS[i % RELATIONS.length],
      tags: TAGS[i % TAGS.length],
      last_contact_on: i % 3 === 0 ? "2026-09-01" : "2025-01-01",
      interaction_count: i % 3,
      crowdsourced: false,
      account_value: null,
    });
  }

  contacts.push({
    id: "lonely",
    first_name: "Ohne",
    last_name: "Attribut",
    company_norm: null,
    role: null,
    city: null,
    relation: null,
    tags: [],
    last_contact_on: null,
    interaction_count: 0,
    crowdsourced: false,
    account_value: null,
  });

  return contacts;
}

check("(c) bipartite: every edge runs person -> attr, never person -> person", () => {
  const contacts = synthetic();
  const graph = buildGraph(contacts, { companyCap: 5 });
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  assert.ok(graph.edges.length > 0);
  for (const edge of graph.edges) {
    assert.equal(byId.get(edge.source)?.kind, "person", `source ${edge.source} is a person`);
    assert.equal(byId.get(edge.target)?.kind, "attr", `target ${edge.target} is an attribute`);
  }

  // Every person is a node, attribute or not.
  const persons = graph.nodes.filter((n): n is PersonNode => n.kind === "person");
  assert.equal(persons.length, contacts.length);
});

check("(c) no attribute node with a single member", () => {
  const graph = buildGraph(synthetic(), { companyCap: 5 });
  const attrs = graph.nodes.filter((n): n is AttrNode => n.kind === "attr");

  assert.ok(attrs.length > 0);
  for (const attr of attrs) assert.ok(attr.size >= 2, `${attr.id} has size ${attr.size}`);

  // A hub of one really is dropped, not just absent from this fixture.
  const tiny = buildGraph([
    { ...synthetic()[0], id: "only", city: "Flensburg", company_norm: null, role: null, relation: null, tags: [] },
  ]);
  assert.equal(tiny.nodes.filter((n) => n.kind === "attr").length, 0);
  assert.equal(tiny.edges.length, 0);
});

check("(c) company cap bites and the tail lands in Other", () => {
  const graph = buildGraph(synthetic(), { companyCap: 5 });
  const companies = graph.nodes.filter(
    (n): n is AttrNode => n.kind === "attr" && n.attr === "company",
  );

  assert.ok(companies.length <= 6, `5 kept + Other, got ${companies.length}`);
  const other = companies.find((c) => c.label === "Other");
  assert.ok(other, "an Other bucket exists");
  assert.ok(other!.size >= 2);

  // Uncapped, all twelve companies keep their own hub.
  const wide = buildGraph(synthetic(), { companyCap: 40 });
  const wideCompanies = wide.nodes.filter((n) => n.kind === "attr" && n.attr === "company");
  assert.equal(wideCompanies.length, 12);
});

check("(c) a contact with no attribute stays as an isolated node", () => {
  const graph = buildGraph(synthetic(), { companyCap: 5 });

  const lonely = graph.nodes.find((n) => n.id === "person:lonely");
  assert.ok(lonely, "the attribute-less contact is still a node");
  assert.equal(graph.edges.filter((e) => e.source === "person:lonely").length, 0);
});

check("(c) tags produce one node per tag, a person links to each of theirs", () => {
  const graph = buildGraph(synthetic(), { companyCap: 5 });
  const tagNodes = graph.nodes.filter((n): n is AttrNode => n.kind === "attr" && n.attr === "tag");

  assert.deepEqual(
    tagNodes.map((n) => n.label).sort(),
    ["beirat", "kunde", "messe", "tech"],
  );

  // Contact 1 carries ["tech", "beirat"] -> two tag edges.
  const own = graph.edges.filter((e) => e.source === "person:c1" && e.target.startsWith("tag:"));
  assert.equal(own.length, 2);
});

// ---------------------------------------------------------------------- (d) filter

const TODAY = "2026-09-21";

const FILTER_CONTACTS: GraphContact[] = [
  {
    id: "a",
    first_name: "Anna",
    last_name: "Schmidt",
    company_norm: "Acme",
    role: "CTO",
    city: "Berlin",
    relation: "Kundin",
    tags: ["kunde", "messe"],
    last_contact_on: "2026-09-10", // 11 days -> loud
    interaction_count: 3,
    crowdsourced: false,
    account_value: null,
  },
  {
    id: "b",
    first_name: "Jonas",
    last_name: "Weber",
    company_norm: "Acme",
    role: "Founder",
    city: "Berlin",
    relation: "Ex-Kollege",
    tags: ["tech"],
    last_contact_on: "2025-01-01", // > 90 days -> quiet
    interaction_count: 1,
    crowdsourced: false,
    account_value: null,
  },
  {
    id: "c",
    first_name: "Mara",
    last_name: "Ohlsen",
    company_norm: "Nordlicht",
    role: "CTO",
    city: "Hamburg",
    relation: "Kundin",
    tags: ["tech", "messe"],
    last_contact_on: "2026-09-15",
    interaction_count: 7,
    crowdsourced: false,
    account_value: null,
  },
  {
    id: "d",
    first_name: "Nie",
    last_name: "Gemeldet",
    company_norm: "Nordlicht",
    role: "Founder",
    city: "Hamburg",
    relation: "Ex-Kollege",
    tags: [],
    last_contact_on: null, // no interaction at all -> quiet
    interaction_count: 0,
    crowdsourced: false,
    account_value: null,
  },
];

const FILTER_GRAPH = buildGraph(FILTER_CONTACTS);

const visiblePersons = (filter: Parameters<typeof applyFilter>[1]) =>
  [...applyFilter(FILTER_GRAPH, filter, TODAY).visibleNodeIds]
    .filter((id) => id.startsWith("person:"))
    .sort();

check("(d) OR inside a dimension, AND across dimensions", () => {
  assert.deepEqual(visiblePersons({}), ["person:a", "person:b", "person:c", "person:d"]);

  // OR: two cities.
  assert.deepEqual(visiblePersons({ cities: ["Berlin", "Hamburg"] }).length, 4);
  assert.deepEqual(visiblePersons({ cities: ["Berlin"] }), ["person:a", "person:b"]);

  // AND: Berlin *and* CTO is Anna alone.
  assert.deepEqual(visiblePersons({ cities: ["Berlin"], roles: ["CTO"] }), ["person:a"]);
  // A combination nobody satisfies.
  assert.deepEqual(visiblePersons({ cities: ["Berlin"], companies: ["Nordlicht"] }), []);
  // Matching is case- and whitespace-insensitive.
  assert.deepEqual(visiblePersons({ cities: ["  berlin "] }), ["person:a", "person:b"]);
});

check("(d) tag filter matches on a single hit", () => {
  assert.deepEqual(visiblePersons({ tags: ["messe"] }), ["person:a", "person:c"]);
  assert.deepEqual(visiblePersons({ tags: ["tech", "kunde"] }), [
    "person:a",
    "person:b",
    "person:c",
  ]);
  // The untagged contact never matches a tag filter.
  assert.equal(visiblePersons({ tags: ["tech"] }).includes("person:d"), false);
});

check("(d) quietOnly keeps the silent ones, including those never contacted", () => {
  assert.deepEqual(visiblePersons({ quietOnly: true }), ["person:b", "person:d"]);
  assert.deepEqual(visiblePersons({ quietOnly: true, cities: ["Hamburg"] }), ["person:d"]);
  assert.deepEqual(visiblePersons({ quietOnly: false }).length, 4);
});

check("(d) free text searches name, company, role, city, relation and tags", () => {
  assert.deepEqual(visiblePersons({ query: "ohlsen" }), ["person:c"]);
  assert.deepEqual(visiblePersons({ query: "acme" }), ["person:a", "person:b"]);
  assert.deepEqual(visiblePersons({ query: "messe" }), ["person:a", "person:c"]);
  assert.deepEqual(visiblePersons({ query: "  " }), ["person:a", "person:b", "person:c", "person:d"]);
});

check("(d) an attribute node without a visible person disappears", () => {
  const all = applyFilter(FILTER_GRAPH, {}, TODAY);
  assert.ok(all.visibleNodeIds.has("city:hamburg"));
  assert.ok(all.visibleNodeIds.has("company:acme"));

  const berlin = applyFilter(FILTER_GRAPH, { cities: ["Berlin"] }, TODAY);
  assert.equal(berlin.visibleNodeIds.has("city:hamburg"), false, "Hamburg has no visible member");
  assert.ok(berlin.visibleNodeIds.has("city:berlin"));
  assert.equal(berlin.visibleNodeIds.has("company:nordlicht"), false);
  assert.ok(berlin.visibleNodeIds.has("company:acme"));

  // Every visible edge starts at a visible person.
  for (const edge of berlin.visibleEdges) assert.ok(berlin.visibleNodeIds.has(edge.source));
});

check("(d) highlightIds hides nothing", () => {
  assert.deepEqual(visiblePersons({ highlightIds: ["person:a"] }).length, 4);
});

check("(d) collectFacets lists every value, sorted, Other excluded", () => {
  const facets = collectFacets(FILTER_GRAPH);

  assert.deepEqual(facets.companies, ["Acme", "Nordlicht"]);
  assert.deepEqual(facets.roles, ["CTO", "Founder"]);
  assert.deepEqual(facets.cities, ["Berlin", "Hamburg"]);
  assert.deepEqual(facets.relations, ["Ex-Kollege", "Kundin"]);
  assert.deepEqual(facets.tags, ["kunde", "messe", "tech"]);

  // A company with one member has no hub but must stay selectable.
  const single = collectFacets(buildGraph([{ ...FILTER_CONTACTS[0], company_norm: "Einzelfall" }]));
  assert.deepEqual(single.companies, ["Einzelfall"]);
});

// ---------------------------------------------------------------------- (e) template

check("(e) CONTACT_TEMPLATE_CSV parses cleanly through parseCsvText", () => {
  const result = parseCsvText(CONTACT_TEMPLATE_CSV);

  assert.equal(result.error, null, `template must parse: ${result.error}`);
  assert.equal(result.skipped, 0);
  assert.equal(result.rows.length, 2);

  for (const row of result.rows) {
    assert.deepEqual(row.problems, [], `row ${row.rowNumber}: ${row.problems.join(", ")}`);
    assert.ok(row.contact.first_name, "first name filled");
    assert.ok(row.contact.last_name, "last name filled");
    assert.ok(row.contact.email, "e-mail filled");
    assert.equal(row.contact.tags.length, 2, "two tags from one quoted cell");
  }

  assert.equal(result.rows[0].contact.city, "London");
  assert.equal(result.rows[1].contact.profile_url, null, "an empty trailing cell is null");
});

// -------------------------------------------------------------------- normalizers

check("normalizePhone / normalizeTags", () => {
  assert.equal(normalizePhone("+49 151 / 234 56-78"), "+491512345678");
  assert.equal(normalizePhone("0170 9876543"), "01709876543");
  assert.equal(normalizePhone("  "), null);
  assert.equal(normalizePhone("keine"), null);

  assert.deepEqual(normalizeTags("kunde; messe |kunde"), ["kunde", "messe"]);
  assert.deepEqual(normalizeTags(["  a ", "A", ""]), ["a"]);
  assert.deepEqual(normalizeTags(null), []);
});

// ------------------------------------------------------------------- (f) dataset layer
// These used to be database guarantees: a partial unique index on lower(email) and an
// ON DELETE CASCADE. With no backend they are plain code, so they get checked.

const CONTACT_FIELDS = {
  email: null,
  phone: null,
  company: null,
  role: null,
  city: null,
  relation: null,
  tags: [],
  notes: null,
  profile_url: null,
  crowdsourced: false,
  account_value: null,
};

const input = (first: string, email: string | null): ContactInput => ({
  ...CONTACT_FIELDS,
  first_name: first,
  last_name: "Test",
  email,
});

check("(f) import skips an e-mail already in the network, case-insensitively", () => {
  const seeded = ingestContacts(EMPTY_DATASET, "connections", [input("Anna", "Anna@X.com")]);
  assert.equal(seeded.counts.inserted, 1);

  const again = ingestContacts(seeded.dataset, "connections", [input("Anna", "anna@x.com")]);
  assert.deepEqual(again.counts, { inserted: 0, updated: 0, skipped: 1 });
  assert.equal(again.dataset.contacts.length, 1, "the dataset is unchanged");
});

check("(f) import dedupes within one batch, and a row with no e-mail always goes in", () => {
  const result = ingestContacts(EMPTY_DATASET, "connections", [
    input("Anna", "anna@x.com"),
    input("Anna", "ANNA@x.com"),
    input("Nameless", null),
    input("Also nameless", null),
  ]);

  assert.deepEqual(result.counts, { inserted: 3, updated: 0, skipped: 1 });
});

check("(f) deleting a contact takes its interactions with it", () => {
  const created = createContact(EMPTY_DATASET, "connections", input("Anna", null));
  const other = createContact(created.dataset, "connections", input("Jonas", null));

  let dataset = logInteraction(other.dataset, {
    contact_id: created.contact.id,
    kind: "call",
    occurred_on: "2026-09-01",
    note: null,
  }).dataset;
  dataset = logInteraction(dataset, {
    contact_id: other.contact.id,
    kind: "call",
    occurred_on: "2026-09-02",
    note: null,
  }).dataset;

  const after = deleteContact(dataset, created.contact.id);
  assert.equal(after.contacts.length, 1);
  assert.equal(after.interactions.length, 1, "only the other contact's log survives");
  assert.equal(after.interactions[0].contact_id, other.contact.id);
});

check("(f) logging against a contact that does not exist is an error", () => {
  assert.throws(() =>
    logInteraction(EMPTY_DATASET, {
      contact_id: "nope",
      kind: "call",
      occurred_on: "2026-09-01",
      note: null,
    }),
  );
});

check("(f) getGraphData folds the log into a count and the latest date", () => {
  const created = createContact(EMPTY_DATASET, "connections", input("Anna", null));
  const silent = createContact(created.dataset, "connections", input("Jonas", null));

  let dataset = silent.dataset;
  for (const occurred_on of ["2026-01-05", "2026-03-20", "2026-02-11"]) {
    dataset = logInteraction(dataset, {
      contact_id: created.contact.id,
      kind: "call",
      occurred_on,
      note: null,
    }).dataset;
  }

  const rows = getGraphData(dataset, "connections");
  assert.equal(rows.length, 2);

  const anna = rows.find((row) => row.id === created.contact.id)!;
  assert.equal(anna.interaction_count, 3);
  assert.equal(anna.last_contact_on, "2026-03-20", "max, not most recently entered");

  const jonas = rows.find((row) => row.id === silent.contact.id)!;
  assert.equal(jonas.interaction_count, 0);
  assert.equal(jonas.last_contact_on, null, "never contacted is null, not a date");

  assert.deepEqual(networkCounts(dataset), { connections: 2 });
});

// ------------------------------------------------------------- (g) cluster overview
// The first screen and the demo's headline number, so both get pinned.

/** Three companies with known quiet counts: Acme 3/4 quiet, Beta 1/3, Gamma 0/2. */
function clusterFixture(): { graph: ReturnType<typeof buildGraph>; quiet: Set<string> } {
  const rows: GraphContact[] = [];
  const add = (id: string, company: string, city: string | null) =>
    rows.push({
      id,
      first_name: "P",
      last_name: id,
      company_norm: company,
      role: null,
      city,
      relation: null,
      tags: [],
      last_contact_on: null,
      interaction_count: 0,
      crowdsourced: false,
      account_value: null,
    });

  for (const id of ["a1", "a2", "a3", "a4"]) add(id, "Acme", "Berlin");
  for (const id of ["b1", "b2", "b3"]) add(id, "Beta", "Berlin");
  for (const id of ["g1", "g2"]) add(id, "Gamma", null);

  return {
    graph: buildGraph(rows),
    quiet: new Set(["person:a1", "person:a2", "person:a3", "person:b1"]),
  };
}

check("(g) cluster overview counts members and quiet members per cluster", () => {
  const { graph, quiet } = clusterFixture();
  const overview = buildClusterOverview(graph, ["company"], quiet);

  assert.deepEqual(
    overview.nodes.map((node) => node.label).sort(),
    ["Acme", "Beta", "Gamma"],
    "only the company dimension",
  );

  const acme = overview.stats.get("company:acme")!;
  assert.equal(acme.size, 4);
  assert.equal(acme.quiet, 3);
  assert.equal(overview.stats.get("company:gamma")!.quiet, 0);
});

check("(g) a dimension that is switched off produces no clusters", () => {
  const { graph, quiet } = clusterFixture();
  const overview = buildClusterOverview(graph, ["relation"], quiet);
  assert.deepEqual(overview.nodes, [], "no relations in the fixture");
  assert.deepEqual(overview.edges, []);
});

check("(g) two companies are never linked — nobody has two employers", () => {
  const { graph, quiet } = clusterFixture();
  const overview = buildClusterOverview(graph, ["company"], quiet);
  assert.deepEqual(overview.edges, []);

  // Add the city back and Berlin links to the companies that share enough people with it.
  const withCity = buildClusterOverview(graph, ["company", "city"], quiet);
  for (const edge of withCity.edges) {
    assert.ok(
      edge.source.startsWith("city:") || edge.target.startsWith("city:"),
      `every edge touches the city hub: ${edge.source} -> ${edge.target}`,
    );
  }
});

check("(g) value at risk counts only the quiet members", () => {
  const { graph, quiet } = clusterFixture();
  // Everyone at Acme is worth 10k; only b1 at Beta is valued, at 500k.
  const values = new Map<string, number>([
    ["person:a1", 10_000],
    ["person:a2", 10_000],
    ["person:a3", 10_000],
    ["person:a4", 10_000],
    ["person:b1", 500_000],
  ]);

  const overview = buildClusterOverview(graph, ["company"], quiet, values);

  const acme = overview.stats.get("company:acme")!;
  assert.equal(acme.value, 40_000, "all four members");
  assert.equal(acme.valueAtRisk, 30_000, "only the three quiet ones");

  const beta = overview.stats.get("company:beta")!;
  assert.equal(beta.value, 500_000);
  assert.equal(beta.valueAtRisk, 500_000, "b1 is the quiet one");

  const gamma = overview.stats.get("company:gamma")!;
  assert.equal(gamma.value, 0, "unvalued contacts contribute nothing");
  assert.equal(gamma.valueAtRisk, 0);
});

check("(g) money outranks headcount: one big quiet account beats three small ones", () => {
  const { graph, quiet } = clusterFixture();
  const values = new Map<string, number>([
    ["person:a1", 10_000],
    ["person:a2", 10_000],
    ["person:a3", 10_000],
    ["person:b1", 500_000],
  ]);

  const byMoney = coldestClusters(buildClusterOverview(graph, ["company"], quiet, values));
  assert.deepEqual(
    byMoney.map((c) => c.label),
    ["Beta", "Acme"],
    "Beta has 1 quiet contact but 500k at risk; Acme has 3 quiet worth 30k",
  );

  // With no values at all, the ranking falls back to quiet headcount.
  const byCount = coldestClusters(buildClusterOverview(graph, ["company"], quiet));
  assert.deepEqual(byCount.map((c) => c.label), ["Acme", "Beta"]);
});

check("(g) coldest accounts rank by quiet headcount, then by share", () => {
  const { graph, quiet } = clusterFixture();
  const overview = buildClusterOverview(graph, ["company", "city"], quiet);

  const cold = coldestClusters(overview);
  assert.deepEqual(
    cold.map((c) => c.label),
    ["Acme", "Beta"],
    "companies only, quiet ones only, most quiet first",
  );
  assert.equal(cold[0].quiet, 3);
  assert.equal(cold[0].quietShare, 0.75);
  assert.ok(!cold.some((c) => c.label === "Gamma"), "a cluster with nobody quiet is not cold");
  assert.ok(!cold.some((c) => c.attr === "city"), "cities are not accounts");
});

// ----------------------------------------------------------------------- (h) EasyMail
// The draft is shown to the user and then sent by them, so it must never invent a fact.

const MAIL_TODAY = "2026-09-21";

function mailContact(over: Partial<Contact> = {}): Contact {
  return {
    ...CONTACT_FIELDS,
    id: "m1",
    network: "connections",
    first_name: "Grace",
    last_name: "Okonkwo",
    company: "Zenith Capital Ltd",
    company_norm: "Zenith Capital",
    role: "Partner",
    source: "manual",
    created_at: `${MAIL_TODAY}T00:00:00.000Z`,
    updated_at: `${MAIL_TODAY}T00:00:00.000Z`,
    ...over,
  } as Contact;
}

function mailInteraction(over: Partial<Interaction> = {}): Interaction {
  return {
    id: "i1",
    contact_id: "m1",
    kind: "meeting",
    occurred_on: "2025-01-05",
    note: null,
    created_at: `${MAIL_TODAY}T00:00:00.000Z`,
    ...over,
  };
}

check("(h) the draft greets by first name and carries the address and company", () => {
  const draft = buildEasyMailDraft({
    contact: mailContact(),
    lastInteraction: mailInteraction(),
    today: MAIL_TODAY,
  });

  assert.equal(draft.to, null, "the fixture has no e-mail, so `to` is null");
  assert.match(draft.body, /^Hi Grace,/);
  assert.match(draft.subject, /Zenith Capital/);
  assert.match(draft.body, /Best regards,$/);
});

check("(h) the draft quotes the last interaction's note instead of inventing context", () => {
  const draft = buildEasyMailDraft({
    contact: mailContact({ email: "grace@zenith.example" }),
    lastInteraction: mailInteraction({ kind: "call", note: "the Series B timeline." }),
    today: MAIL_TODAY,
  });

  assert.equal(draft.to, "grace@zenith.example");
  assert.match(draft.body, /Last time we spoke you mentioned the Series B timeline\./);
  assert.ok(!draft.body.includes("the Series B timeline..".slice(0, 30) + "."), "no doubled full stop");
});

check("(h) a contact never contacted is described as such, not as a long gap", () => {
  const draft = buildEasyMailDraft({
    contact: mailContact(),
    lastInteraction: null,
    today: MAIL_TODAY,
  });

  assert.match(draft.body, /have not managed to speak since we connected/);
  assert.match(draft.subject, /Following up since we connected/);

  // Every opening sentence starts with a capital, whichever phrase it used.
  for (const last of [null, mailInteraction(), mailInteraction({ occurred_on: "2026-09-19" })]) {
    const body = buildEasyMailDraft({
      contact: mailContact(),
      lastInteraction: last,
      today: MAIL_TODAY,
    }).body;
    const opening = body.split("\n")[2];
    assert.match(opening, /^[A-Z]/, `opening must be capitalised: ${opening}`);
  }
});

check("(h) a commercial relationship gets the business ask, a friend does not", () => {
  const client = buildEasyMailDraft({
    contact: mailContact({ relation: "Client" }),
    lastInteraction: mailInteraction(),
    today: MAIL_TODAY,
  });
  assert.match(client.body, /15 minutes/);

  const friend = buildEasyMailDraft({
    contact: mailContact({ relation: "Running club", company: null, company_norm: null, role: null }),
    lastInteraction: mailInteraction(),
    today: MAIL_TODAY,
  });
  assert.match(friend.body, /coffee or a quick call/);
  assert.ok(!friend.body.includes("15 minutes"));
});

check("(h) worthContactingReason stays silent for an active contact", () => {
  const recent = mailInteraction({ occurred_on: "2026-09-10" });
  assert.equal(worthContactingReason(mailContact(), recent, MAIL_TODAY), null);

  const stale = worthContactingReason(mailContact({ relation: "Client" }), mailInteraction(), MAIL_TODAY);
  assert.ok(stale && stale.includes("commercial"), `commercial reason: ${stale}`);

  const never = worthContactingReason(mailContact(), null, MAIL_TODAY);
  assert.ok(never && never.includes("ever been logged"), `never-contacted reason: ${never}`);
});

console.log(failures === 0 ? "\nall checks green" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
