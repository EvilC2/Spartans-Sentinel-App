// Sentinel — staff directory with real contact emails.
// Source: westvancouverschools.ca/ecole-sentinel-secondary/about/staff/ (Sep 2026).
// Regenerate from the staff page if people move; do not invent addresses.

export type StaffGroup = 'admin' | 'counselling' | 'office' | 'library' | 'teaching' | 'support';

export type StaffMember = {
  last: string;
  first: string;
  email: string;
  role: string;
  group: StaffGroup;
  range?: string; // counsellors: student last-name range
};

export const SCHOOL = {
  name: 'Sentinel Secondary',
  address: '1250 Chartwell Drive, West Vancouver, BC V7S 2R2',
  phone: '(604) 981-1130',
  phoneRaw: '+16049811130',
  email: 'sentinel@wvschools.ca',
  attendanceEmail: 'sentinelattendance@wvschools.ca',
  emailDomain: 'wvschools.ca',
};

export const STAFF: StaffMember[] = [
  // ── Administration ──
  { last: 'Finch', first: 'Michael', email: 'mfinch@wvschools.ca', role: 'Principal · Gr. 12', group: 'admin' },
  { last: 'Ulinder', first: 'Lisa', email: 'lulinder@wvschools.ca', role: 'Vice-Principal · Gr. 9 & 11 · Pursuit', group: 'admin' },
  { last: 'Anderson', first: 'Shawn', email: 'sanderson@wvschools.ca', role: 'Vice-Principal · Gr. 8 & 10 · AP Coordinator', group: 'admin' },
  // ── Counselling ──
  { last: 'Murray', first: 'Jennifer', email: 'jmurray@wvschools.ca', role: 'Counsellor', group: 'counselling', range: 'A–GL' },
  { last: 'Britten', first: 'Rebecca', email: 'rbritten@wvschools.ca', role: 'Counsellor · Student Services', group: 'counselling', range: 'GM–LIM' },
  { last: 'Ahmelich', first: 'Jamal', email: 'jahmelich@wvschools.ca', role: 'Counsellor', group: 'counselling', range: 'LIN–SAM' },
  { last: 'Thureau', first: 'Alex', email: 'athureau@wvschools.ca', role: 'Counsellor', group: 'counselling', range: 'SAN–Z' },
  { last: 'Bayou', first: 'Erin', email: 'ebayou@wvschools.ca', role: 'Youth Worker', group: 'counselling' },
  { last: 'Heavyside', first: 'Carola', email: 'cheavyside@wvschools.ca', role: 'Careers & Library', group: 'library' },
  { last: 'Bond', first: 'Janine', email: 'jbond@wvschools.ca', role: 'Librarian', group: 'library' },
  // ── Office ──
  { last: 'Brazeau', first: 'Martina', email: 'mbrazeau@wvschools.ca', role: 'Admin Assistant & Registrar', group: 'office' },
  { last: 'Zhang', first: 'Rana', email: 'rzhang@wvschools.ca', role: 'Student Records & Transcripts', group: 'office' },
  { last: 'Jafari', first: 'Niloofar', email: 'njafari@wvschools.ca', role: 'MyEd Help · SIS Data', group: 'office' },
  { last: 'Carruthers', first: 'Allison', email: 'acarruthers@wvschools.ca', role: 'Accountant · School Cash Online', group: 'office' },
  { last: 'Moy', first: 'Monica', email: 'mmoy@wvschools.ca', role: 'Office Support', group: 'office' },
  // ── Teaching staff ──
  { last: 'Addis', first: 'Dale', email: 'daddis@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'Alm', first: 'Kristi', email: 'kalm@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'Armstrong', first: 'Dawn', email: 'darmstrong@wvschools.ca', role: 'Career Life Education', group: 'teaching' },
  { last: 'Armstrong', first: 'Sherri', email: 'sarmstrong@wvschools.ca', role: 'English', group: 'teaching' },
  { last: 'Bauck', first: 'Christianne', email: 'cbauck@wvschools.ca', role: 'Physical Education', group: 'teaching' },
  { last: 'Beetlestone', first: 'Peter', email: 'pbeetlestone@wvschools.ca', role: 'English', group: 'teaching' },
  { last: 'Caine', first: 'Nikki', email: 'ncaine@wvschools.ca', role: 'Textiles / Food Studies', group: 'teaching' },
  { last: 'Chappell', first: 'Jayne', email: 'jchappell@wvschools.ca', role: 'Inclusive Education', group: 'teaching' },
  { last: 'Chase', first: 'Kevin', email: 'kchase@wvschools.ca', role: 'Social Studies', group: 'teaching' },
  { last: 'Chouinard', first: 'Jacqueline', email: 'jchouinard@wvschools.ca', role: 'English', group: 'teaching' },
  { last: 'Curtin', first: 'Shelley-Ann', email: 'scurtin@wvschools.ca', role: 'Connect', group: 'teaching' },
  { last: 'Demers', first: 'Jamie', email: 'jdemers@wvschools.ca', role: 'Business Education', group: 'teaching' },
  { last: 'Deneau', first: 'Alyssa', email: 'adeneau@wvschools.ca', role: 'French / ELL', group: 'teaching' },
  { last: 'Dodsworth', first: 'Justin', email: 'jdodsworth@wvschools.ca', role: 'French', group: 'teaching' },
  { last: 'Elliot', first: 'Craig', email: 'celliot@wvschools.ca', role: 'French Immersion', group: 'teaching' },
  { last: 'Evans', first: 'Cecily', email: 'cevans@wvschools.ca', role: 'Fine Arts', group: 'teaching' },
  { last: 'Fromowitz', first: 'Daniel', email: 'dfromowitz@wvschools.ca', role: 'Social Studies', group: 'teaching' },
  { last: 'Fuller', first: 'Aaron', email: 'afuller@wvschools.ca', role: 'English', group: 'teaching' },
  { last: 'Gage', first: 'Justin', email: 'jgage@wvschools.ca', role: 'Mathematics', group: 'teaching' },
  { last: 'Gagliano', first: 'Alexia', email: 'agagliano@wvschools.ca', role: 'French Immersion', group: 'teaching' },
  { last: 'Griffiths', first: "D'Arcy", email: 'dgriffiths@wvschools.ca', role: 'Social Studies', group: 'teaching' },
  { last: 'Grikis', first: 'Laris', email: 'lgrikis@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'Hambly', first: 'Madelyn', email: 'mhambly@wvschools.ca', role: 'Fine Arts', group: 'teaching' },
  { last: 'Hammett', first: 'Bryn', email: 'bhammett@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'Hardy', first: 'Isaiah', email: 'ihardy@wvschools.ca', role: 'Woodwork', group: 'teaching' },
  { last: 'Hart', first: 'Lauren', email: 'lhart@wvschools.ca', role: 'Food Studies', group: 'teaching' },
  { last: 'Hsia', first: 'Carlos', email: 'chsia@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'Huh', first: 'Joseph', email: 'jhuh@wvschools.ca', role: 'Social Studies', group: 'teaching' },
  { last: 'Jamieson', first: 'Laura', email: 'ljamieson@wvschools.ca', role: 'Mathematics', group: 'teaching' },
  { last: 'Jang', first: 'Emily', email: 'ejang@wvschools.ca', role: 'Inclusive Education', group: 'teaching' },
  { last: 'Kennedy', first: 'Heather', email: 'hkennedy@wvschools.ca', role: 'P.E. · Athletic Director', group: 'teaching' },
  { last: 'Klippenstein', first: 'Nathan', email: 'nklippenstein@wvschools.ca', role: 'Physical Education', group: 'teaching' },
  { last: 'Krug', first: 'Kayla', email: 'kkrug@wvschools.ca', role: 'Physical & Health Education', group: 'teaching' },
  { last: 'Li', first: 'Ivy', email: 'ivy.li@wvschools.ca', role: 'Mandarin', group: 'teaching' },
  { last: 'Ma', first: 'Gary', email: 'gma@wvschools.ca', role: 'Mathematics', group: 'teaching' },
  { last: 'Malone', first: 'Heather', email: 'hmalone@wvschools.ca', role: 'Applied Skills / Home Ec.', group: 'teaching' },
  { last: 'McGuinness-Gill', first: 'Meghan', email: 'mmcguinnessgill@wvschools.ca', role: 'Drama / Social Studies', group: 'teaching' },
  { last: 'McKeen', first: 'Trish', email: 'tmckeen@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'McLean', first: 'Tucker', email: 'tmclean@wvschools.ca', role: 'English / ELL', group: 'teaching' },
  { last: 'McNiven', first: 'Brooks', email: 'bmcniven@wvschools.ca', role: 'P.E. · Athletic Director', group: 'teaching' },
  { last: 'Mirmiran', first: 'Siamak', email: 'smirmiran@wvschools.ca', role: 'French Immersion', group: 'teaching' },
  { last: 'Miyamoto', first: 'Mari', email: 'mmiyamoto@wvschools.ca', role: 'Japanese', group: 'teaching' },
  { last: 'Morvarid', first: 'Mahtab', email: 'mmorvarid@wvschools.ca', role: 'French Immersion', group: 'teaching' },
  { last: 'Naami', first: 'Ahmed', email: 'anaami@wvschools.ca', role: 'French Immersion', group: 'teaching' },
  { last: 'Neufeld', first: 'Trevor', email: 'tneufeld@wvschools.ca', role: 'Business Education / Applied Skills', group: 'teaching' },
  { last: 'Obeck', first: 'Christian', email: 'cobeck@wvschools.ca', role: 'English', group: 'teaching' },
  { last: 'Ogawa', first: 'Allison', email: 'aogawa@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'Page-Newman', first: 'Nicole', email: 'npage-newman@wvschools.ca', role: 'Spanish / Modern Languages', group: 'teaching' },
  { last: 'Popov', first: 'Julie', email: 'jpopov@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'Seaton', first: 'James', email: 'jseaton@wvschools.ca', role: 'Mathematics', group: 'teaching' },
  { last: 'Shackleton-Turner', first: 'Alexandra', email: 'ashackletonturner@wvschools.ca', role: 'English', group: 'teaching' },
  { last: 'Sinnott', first: 'Bree', email: 'bsinnott@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'Smith', first: 'Torrie', email: 'torrie.smith@wvschools.ca', role: 'Science', group: 'teaching' },
  { last: 'Sommers', first: 'Lindsay', email: 'lsommers@wvschools.ca', role: 'English / Inclusive Education', group: 'teaching' },
  { last: 'Tabone', first: 'Amanda', email: 'atabone@wvschools.ca', role: 'English', group: 'teaching' },
  { last: 'Takahashi', first: 'Julie', email: 'jtakahashi@wvschools.ca', role: 'Mathematics', group: 'teaching' },
  { last: 'Virag', first: 'Zoltan', email: 'zvirag@wvschools.ca', role: 'Music', group: 'teaching' },
  { last: 'Winstone', first: 'Lara', email: 'lwinstone@wvschools.ca', role: 'Applied Skills', group: 'teaching' },
  { last: 'Williamson', first: 'Victoria', email: 'vwilliamson@wvschools.ca', role: 'French Immersion', group: 'teaching' },
  { last: 'Willms', first: 'Lindsay', email: 'lwillms@wvschools.ca', role: 'English / Inclusive Education', group: 'teaching' },
  { last: 'Zhang', first: 'Caris', email: 'caris.zhang@wvschools.ca', role: 'Mathematics / Careers', group: 'teaching' },
  // ── Education assistants & support ──
  { last: 'Mishima', first: 'Tyler', email: 'tmishima@wvschools.ca', role: 'District EA Lead', group: 'support' },
  { last: 'Belarbia', first: 'Chafia', email: 'cbelarbia@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Carrera', first: 'Deborah', email: 'dcarrera@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Dadisso', first: 'Tesfaye', email: 'tdadisso@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Farkas', first: 'Virag', email: 'vfarkas@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Han', first: 'Ning', email: 'nhan@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Janbazi', first: 'Afsaneh', email: 'ajanbazi@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Laher', first: 'Teresita', email: 'tlaher@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Lee', first: 'Connie', email: 'klee@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Mykolaitis', first: 'Marius', email: 'mmykolaitis@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Poulin', first: 'Donald', email: 'dpoulin@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Protopappas', first: 'Jana', email: 'jprotopappas@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Rinon', first: 'Monaliza', email: 'mrinon@wvschools.ca', role: 'Education Assistant', group: 'support' },
  { last: 'Toledo', first: 'Maria', email: 'mtoledo@wvschools.ca', role: 'Education Assistant', group: 'support' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

// Resolve a timetable teacher string ("Last, First", "Mr. Last", or free text)
// to a staff record. Matches by last name, then disambiguates by first initial.
export const findStaff = (teacher: string): StaffMember | undefined => {
  const t = teacher.trim().replace(/^(mr|ms|mrs|mme|mlle|m|dr)\.?\s+/i, '');
  if (!t) return undefined;
  let last = t, first = '';
  if (t.includes(',')) [last, first] = t.split(',').map(s => s.trim());
  else if (t.includes(' ')) { const w = t.split(/\s+/); first = w[0]; last = w[w.length - 1]; }
  const nl = norm(last);
  const byLast = STAFF.filter(s => norm(s.last) === nl);
  if (byLast.length === 1) return byLast[0];
  if (byLast.length > 1 && first) {
    const nf = norm(first);
    return byLast.find(s => norm(s.first) === nf) || byLast.find(s => norm(s.first).startsWith(nf[0] || ''));
  }
  return byLast[0];
};

// Best-effort address when a teacher isn't on the staff page:
// first initial + last name @wvschools.ca (the district's usual pattern).
export const guessEmail = (teacher: string): string | null => {
  const t = teacher.trim().replace(/^(mr|ms|mrs|mme|mlle|m|dr)\.?\s+/i, '');
  let last = t, first = '';
  if (t.includes(',')) [last, first] = t.split(',').map(s => s.trim());
  else if (t.includes(' ')) { const w = t.split(/\s+/); first = w[0]; last = w[w.length - 1]; }
  if (!last) return null;
  const l = norm(last), f = norm(first);
  if (!l) return null;
  return `${f[0] || ''}${l}@${SCHOOL.emailDomain}`;
};

// Which counsellor covers a student, by last name.
export const counsellorFor = (lastName: string): StaffMember | undefined => {
  const key = norm(lastName).toUpperCase();
  if (!key) return undefined;
  const ranges: [string, string, string][] = [
    ['A', 'GL', 'Murray'], ['GM', 'LIM', 'Britten'], ['LIN', 'SAM', 'Ahmelich'], ['SAN', 'ZZZ', 'Thureau'],
  ];
  const hit = ranges.find(([lo, hi]) => key >= lo && key.slice(0, hi.length) <= hi);
  return hit ? STAFF.find(s => s.last === hit[2]) : undefined;
};

export const staffName = (s: StaffMember) => `${s.first} ${s.last}`;
export const staffInitials = (s: StaffMember) => `${s.first[0] || ''}${s.last[0] || ''}`.toUpperCase();
