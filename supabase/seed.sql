-- Ori demo seed. Replayed by `supabase db reset` after the migrations.
--
-- Deterministic on purpose: rows are derived from a running index with coprime
-- multipliers instead of random(), so every reset produces the exact same network.
-- Dates are relative to current_date, so the seed still makes sense next month.
-- All names, companies and addresses are invented.

-- 1. The one demo user -------------------------------------------------------
-- demo@ori.local / demo12345. email_confirmed_at is set so the password grant
-- works without confirming a mail; auth.identities is required as well, GoTrue
-- refuses the password grant for a user without an email identity.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-4000-a000-000000000001',
  'authenticated', 'authenticated',
  'demo@ori.local',
  extensions.crypt('demo12345', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Demo Nutzer"}'::jsonb,
  '', '', '', '',
  now(), now()
);

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  'd0000000-0000-4000-a000-000000000001',
  'd0000000-0000-4000-a000-000000000001',
  '{"sub":"d0000000-0000-4000-a000-000000000001","email":"demo@ori.local","email_verified":true,"phone_verified":false}'::jsonb,
  'email', now(), now(), now()
);

-- 2. Contacts ----------------------------------------------------------------
-- Index 1..90 business, 91..125 friends, 126..140 family.
-- company_norm is what lib/core/import/normalize.ts#normalizeCompany produces for
-- company: the trailing legal form stripped, original casing kept.

with a as (
  select
    array['Lena','Jonas','Miriam','Tobias','Annika','Felix','Svenja','Marek','Clara','Henrik',
          'Paula','Elias','Nadine','Bastian','Ivana','Ruben','Theresa','Malte','Yara','Korbinian',
          'Frieda','Aleks','Rosalie','Vincent','Maja','Emil','Johanna','Linus','Greta','Samuel']::text[] as firsts,
    array['Hartmann','Kessler','Brandstetter','Vogler','Nowak','Reinders','Pfeiffer','Salzmann',
          'Lindqvist','Ostermann','Baumgartner','Tschirner','Kowalczyk','Reithofer','Hufnagel',
          'Dembinski','Waldmann','Steinbach','Gruber','Marek','Ehrlich','Vandenberg','Zurek',
          'Fellinger','Brandhorst','Kienzle','Sturm','Oberhauser','Liebig','Rautenberg',
          'Schmidbauer','Trautwein','Novotny','Eichwald','Peltonen','Hagedorn','Kirschner']::text[] as lasts,
    array['Nordlicht Systeme GmbH','Kranzberg & Partner AG','Halbmond Logistik GmbH & Co. KG',
          'Veltwerk UG (haftungsbeschränkt)','Meridian Datentechnik AG','Saalfeld Pharma SE',
          'Brackwasser Studios GmbH','Tannhof Energie AG','Oberrhein Analytik GmbH',
          'Lindtmann Consulting','Felsgrund Bau GmbH','Aurelia Medien GmbH',
          'Piekenbrock Kanzlei','Westhafen Robotics Ltd']::text[] as companies,
    array['Nordlicht Systeme','Kranzberg & Partner','Halbmond Logistik',
          'Veltwerk','Meridian Datentechnik','Saalfeld Pharma',
          'Brackwasser Studios','Tannhof Energie','Oberrhein Analytik',
          'Lindtmann Consulting','Felsgrund Bau','Aurelia Medien',
          'Piekenbrock Kanzlei','Westhafen Robotics']::text[] as company_norms,
    array['Geschäftsführerin','Head of Sales','Produktmanager','Softwareentwicklerin','Controller',
          'Marketingleiterin','Einkäufer','Recruiterin','Data Engineer','Vertriebsleiter']::text[] as roles,
    array['Berlin','Hamburg','München','Köln','Leipzig']::text[] as biz_cities,
    array['Berlin','Hamburg','München','Köln','Leipzig','Wien','Zürich','Freiburg','Rotterdam',
          'Lissabon','Aarhus']::text[] as any_cities,
    array['Studium','Sportverein','Festival','WG','Schule','Nachbarschaft']::text[] as friend_relations,
    array['Klettern','Musik','Kochen','Laufen','Brettspiele']::text[] as friend_tags,
    array['Mutter','Vater','Bruder','Schwester','Cousine','Cousin','Onkel','Tante','Oma','Opa',
          'Patenkind','Schwägerin','Schwager','Nichte','Neffe']::text[] as family_relations,
    -- aligned index by index with family_relations, so the relation and the name agree
    array['Ingrid','Bernd','Jannis','Mareike','Selina','Timo','Wolfgang','Heike','Elfriede',
          'Gerhard','Nele','Katrin','Dominik','Emilia','Fabian']::text[] as family_firsts,
    array['Über einen gemeinsamen Kontakt kennengelernt.','Will im Herbst wieder anrufen.',
          'Interessiert an einer Zusammenarbeit.','Hat zwei Kinder, wohnt seit 2024 neu.',
          'Kontakt über die Konferenz in Leipzig.']::text[] as notes_pool
),
raw as (
  select
    i,
    (case when i <= 90 then 'business' when i <= 125 then 'friends' else 'family' end)::public.network as network,
    case when i > 125 then a.family_firsts[i - 125]
         else a.firsts[1 + (i * 7) % array_length(a.firsts, 1)] end as first_name,
    a.lasts[1 + (i * 11) % array_length(a.lasts, 1)] as last_name,
    case when i <= 90 then a.companies[1 + (i * 11) % array_length(a.companies, 1)] end as company,
    case when i <= 90 then a.company_norms[1 + (i * 11) % array_length(a.company_norms, 1)] end as company_norm,
    case when i <= 90 then a.roles[1 + (i * 3) % array_length(a.roles, 1)] end as role,
    case
      when i % 7 = 0 then null                                                    -- ~15% without a city
      when i <= 90 then a.biz_cities[1 + (i * 3) % array_length(a.biz_cities, 1)]
      else a.any_cities[1 + (i * 3) % array_length(a.any_cities, 1)]
    end as city,
    case
      when i <= 90 then null
      when i <= 125 then a.friend_relations[1 + (i * 5) % array_length(a.friend_relations, 1)]
      else a.family_relations[i - 125]
    end as relation,
    case
      when i <= 90 then
        case when i % 9 = 0 then array['Kunde']
             when i % 11 = 0 then array['Messe 2026','Warm']
             else '{}'::text[] end
      when i <= 125 then
        case when i % 4 = 0
          then array[a.friend_tags[1 + (i * 3) % 5], a.friend_tags[1 + ((i * 3) % 5 + 1) % 5]]
          else array[a.friend_tags[1 + (i * 3) % 5]] end
      else '{}'::text[]
    end as tags,
    case when i % 17 = 0 then a.notes_pool[1 + (i * 3) % array_length(a.notes_pool, 1)] end as notes,
    case when i % 3 = 0 then null
         else '+49 1' || (50 + i % 10)::text || ' ' || lpad(((i * 7307) % 10000000)::text, 7, '0') end as phone
  from generate_series(1, 140) as i cross join a
)
insert into public.contacts (
  user_id, network, first_name, last_name, email, phone, company, company_norm,
  role, city, relation, tags, notes, source, created_at, updated_at
)
select
  'd0000000-0000-4000-a000-000000000001',
  raw.network,
  raw.first_name,
  raw.last_name,
  case when raw.i % 7 = 3 then null
       else regexp_replace(lower(translate(raw.first_name, 'äöüÄÖÜß', 'aouAOUs')), '[^a-z0-9]', '', 'g')
            || '.'
            || regexp_replace(lower(translate(raw.last_name, 'äöüÄÖÜß', 'aouAOUs')), '[^a-z0-9]', '', 'g')
            || '@'
            || coalesce(
                 nullif(regexp_replace(lower(translate(raw.company_norm, 'äöüÄÖÜß', 'aouAOUs')), '[^a-z0-9]', '', 'g'), '') || '.example',
                 'example.net')
  end,
  raw.phone,
  raw.company,
  raw.company_norm,
  raw.role,
  raw.city,
  raw.relation,
  raw.tags,
  raw.notes,
  'manual',
  -- monotonic in i, so `row_number() over (order by created_at)` below is the index again
  current_date - interval '180 days' + raw.i * interval '1 hour',
  current_date - interval '180 days' + raw.i * interval '1 hour'
from raw;

-- 3. Interactions ------------------------------------------------------------
-- rn is the contact index from above.
--   rn % 5 = 0  -> no interaction at all      (quiet because nothing was ever logged)
--   rn % 5 = 1  -> last interaction 100..699 days ago  (quiet by QUIET_AFTER_DAYS = 90)
--   otherwise   -> everything inside the last 85 days  (active)
-- Both quiet cases have to exist or the "nur stille Kontakte" filter has nothing to show.

insert into public.interactions (user_id, contact_id, kind, occurred_on, note)
select
  'd0000000-0000-4000-a000-000000000001',
  c.id,
  (array['call','message','meeting','email','note'])[1 + (c.rn * 3 + j * 7) % 5]::public.interaction_kind,
  case when c.rn % 5 = 1
    then current_date - (100 + (c.rn * 17 + j * 29) % 600)::int
    else current_date - ((c.rn * 11 + j * 23) % 85)::int
  end,
  case when (c.rn + j) % 4 = 0
    then (array['Kurz telefoniert.','Angebot besprochen.','Auf ein Bier getroffen.',
                'Geburtstagsnachricht.','Rückmeldung offen.'])[1 + (c.rn + j) % 5]
  end
from (
  select id, row_number() over (order by created_at) as rn
  from public.contacts
) as c
cross join generate_series(1, 1 + (c.rn % 4)) as j
where c.rn % 5 <> 0;
