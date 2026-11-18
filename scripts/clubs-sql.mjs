#!/usr/bin/env node
// Spartans — writes the club rows in src/clubList.ts out as SQL.
//   node scripts/clubs-sql.mjs            → supabase/seed/clubs.sql
// The same insert/update is pasted into migration 0023. Upsert by name
// (case-insensitive): new clubs are added, existing ones get the sheet's
// blurb, sponsor, meeting time, room, Google Classroom code and "new" flag.
// Safe to run again.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const src = fs.readFileSync(path.join(root, 'src/clubList.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const clubs = mod.exports.REAL_CLUBS;

const q = v => (v ? `'${String(v).replace(/'/g, "''")}'` : 'null');
const rows = clubs.map(c => `  (${[q(c.name), q(c.kind || 'club'), q(c.blurb), q(c.meets), q(c.room), q(c.sponsor), q(c.gc), c.isNew ? 'true' : 'false'].join(', ')})`);

export const upsertSql = `with v(name, kind, blurb, meets, room, sponsor, gc_code, is_new) as (values
${rows.join(',\n')}
), updated as (
  update clubs c set kind = v.kind, blurb = v.blurb, meets = v.meets, room = v.room,
    sponsor = v.sponsor, gc_code = v.gc_code, is_new = v.is_new, active = true
  from v where lower(trim(c.name)) = lower(trim(v.name))
  returning c.id
)
insert into clubs (name, kind, blurb, meets, room, sponsor, gc_code, is_new)
select v.name, v.kind, v.blurb, v.meets, v.room, v.sponsor, v.gc_code, v.is_new from v
where not exists (select 1 from clubs c where lower(trim(c.name)) = lower(trim(v.name)));
`;

if (process.argv[1] && process.argv[1].endsWith('clubs-sql.mjs')) {
  const header = `-- Spartans — Sentinel's real clubs (2026–27 club sheet). Generated from
-- src/clubList.ts by scripts/clubs-sql.mjs; edit that file, not this one.
-- Needs migration 0023 (gc_code, is_new). Safe to run again: matches by name,
-- adds new clubs and refreshes existing ones.
`;
  fs.writeFileSync(path.join(root, 'supabase/seed/clubs.sql'), header + upsertSql);
  console.log(`${clubs.length} clubs → supabase/seed/clubs.sql`);
}
