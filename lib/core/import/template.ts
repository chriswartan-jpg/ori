/**
 * The download the import page offers instead of a column-mapping UI: headers the parser
 * is guaranteed to understand, and two rows that show the expected shape.
 * A check parses this constant, so the template cannot drift away from the parser.
 */
export const CONTACT_TEMPLATE_CSV = `First Name;Last Name;Email;Phone;Company;Role;City;Relation;Tags;Notes;Profile
Anna;Schmidt;anna.schmidt@example.com;+1 212 555 0134;Acme Ltd;Head of Marketing;London;Client;"client;trade fair";Met at the 2025 trade fair;https://www.linkedin.com/in/anna-schmidt
Jonas;Weber;jonas.weber@example.com;+1 415 555 0182;Northlight AG;CTO;Hamburg;Ex-colleague;"tech;advisory";Knows Postgres inside out;
`;

export const CONTACT_TEMPLATE_FILENAME = "ori-contacts-template.csv";
