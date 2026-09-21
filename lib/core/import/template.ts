/**
 * The download the import page offers instead of a column-mapping UI: German headers the
 * parser is guaranteed to understand, and two rows that show the expected shape.
 * A check parses this constant, so the template cannot drift away from the parser.
 */
export const CONTACT_TEMPLATE_CSV = `Vorname;Nachname;E-Mail;Telefon;Firma;Rolle;Stadt;Beziehung;Tags;Notizen;Profil
Anna;Schmidt;anna.schmidt@example.com;+49 151 2345678;Acme GmbH;Head of Marketing;Berlin;Kundin;"kunde;messe";Auf der Messe 2025 kennengelernt;https://www.linkedin.com/in/anna-schmidt
Jonas;Weber;jonas.weber@example.com;0170 9876543;Nordlicht AG;CTO;Hamburg;Ex-Kollege;"tech;beirat";Kennt sich mit Postgres aus;
`;

export const CONTACT_TEMPLATE_FILENAME = "ori-kontakte-vorlage.csv";
