// Sentinel — course + staff catalog used by the intro flow's autocomplete.
// COURSES: every course in the 2025–2026 Sentinel Course Book (westvancouverschools.ca),
//   titled as students say them. Grade suffix kept so "Chemistry 11" and "Chemistry 12" both match.
// TEACHERS: teaching staff, counselling and admin from the school's Staff page (Sep 2026).
//   Matching is by last name first, then first name.

export const COURSES: string[] = [
  // ── Grade 8 core ──
  'English 8', 'Mathematics 8', 'Mathematics 8 Enriched', 'Mathématiques 8', 'Science 8', 'Sciences 8',
  'Social Studies 8', 'Sciences humaines 8', 'Physical & Health Education 8', 'French 8', 'Français langue 8',
  'Career Education 8', 'Applied Design, Skills & Technology 8 (ADST 8)', 'Textiles 8', 'Woodwork 8',
  'Entrepreneurship & Marketing 8', 'Computers & Communication Devices 8', 'Arts Education 8',
  'Arts Education 8: Visual Arts', 'Arts Education 8: Ceramics & Sculpture', 'Arts Education 8: Media Arts',
  'Drama 8', 'Music 8', 'English Language Development 8/9',
  // ── Grade 9 ──
  'English 9', 'Mathematics 9', 'Mathematics 9 Enriched', 'Mathématiques 9', 'Science 9', 'Sciences 9',
  'Social Studies 9', 'Sciences humaines 9', 'Physical & Health Education 9', 'French 9', 'Français langue 9',
  'Career Education 9', 'Spanish 9', 'Arts Education 9', 'Arts Education 9: Ceramics & Sculpture',
  'Food Studies 9', 'Media Arts 9', 'Textiles 9', 'Dance 9', 'Drama 9', 'Theatre Company 9',
  'Concert Band 9', 'Jazz Band 9', 'Orchestra 9', 'Orchestral Strings 9', 'Concert Choir 9',
  // ── Grade 10 ──
  'EFP Literary Studies 10 & Writing 10', 'EFP Literary Studies 10 & Writing 10 (Language Adapted)',
  'Pre-AP EFP Literary Studies & Writing 10', 'Foundations of Mathematics & Pre-Calculus 10',
  'Foundations of Mathematics & Pre-Calculus 10 (Skill Development)', 'Pre-AP Foundations of Mathematics & Pre-Calculus 10',
  'Workplace Mathematics 10', 'Science 10', 'Sciences 10', 'Social Studies 10', 'Sciences humaines 10',
  'Physical & Health Education 10', 'Physical Education 10: Girls Fitness', 'Career Life Education 10',
  'Career Life Education 10 (Blended)', 'Éducation au choix de carrière et de vie 10', 'French 10', 'Spanish 10',
  'Computer Studies 10', 'Entrepreneurship & Marketing 10', 'Woodwork 10', 'Drama 10', 'Theatre Company 10',
  'Theatre Production 10', 'Dance Technique & Performance 10', 'Concert Band 10', 'Jazz Band 10', 'Orchestra 10',
  'Orchestral Strings 10', 'Concert Choir 10', 'Media Arts 10: Yearbook', 'Visual Arts 10',
  'Language & Cultural Literacy 10/11/12', 'Self-Efficacy 10/11/12',
  // ── Grade 11 ──
  'Literary Studies 11', 'Literary Studies 11 (Language Adapted)', 'Pre-AP Literary Studies 11', 'AP Literary Studies 11',
  'Academic Writing 11', 'Composition & Production 11', 'Pre-Calculus 11', 'Pre-AP Pre-Calculus 11', 'AP Pre-Calculus 11',
  'Foundations of Mathematics 11', 'Workplace Mathematics 11', 'Chemistry 11', 'AP Chemistry 11', 'Physics 11',
  'AP Physics 1 Honours 11', 'Life Sciences 11', 'AP Life Sciences 11', 'Earth Science 11',
  'Explorations en sciences humaines et sociales 11', 'Langue et culture de la francophonie 11', 'French 11',
  'Spanish 11', 'Introductory Spanish 11', 'Japanese 11', 'Introductory Japanese 11', 'Mandarin 11',
  'Introductory Mandarin 11', 'Introductory Farsi 11', 'Active Living 11', 'Fitness & Conditioning 11',
  'Fitness & Conditioning 11 (Girls)', 'Accounting 11', 'Marketing & Promotion 11', 'Computer Information Systems 11',
  'Drafting 11', 'Woodwork 11', 'Food Studies 11', 'Textiles 11', 'Photography 11', 'Studio Arts 2-D 11',
  'Studio Arts 3-D 11', 'Art Studio 11 (AP Art 11)', 'Drama 11', 'Theatre Company 11', 'Theatre Production 11',
  'Directing & Script Development 11', 'Dance Technique & Performance 11', 'Concert Band 11', 'Jazz Stage Band 11',
  'Orchestral Strings 11', 'Media Arts 11: Yearbook', 'Visual Arts 11', 'AP Capstone Seminar 11',
  // ── Grade 12 ──
  'English Studies 12', 'English First Peoples 12', 'Creative Writing 12', 'AP English Language & Composition 12',
  'AP English Literature & Composition 12', 'Pre-Calculus 12', 'Pre-Calculus 12 Honours', 'Calculus 12',
  'AP Calculus AB 12', 'AP Calculus BC 12', 'AP Statistics 12', 'Foundations of Mathematics 12',
  'Apprenticeship Mathematics 12', 'Chemistry 12', 'AP Chemistry 12', 'Physics 12', 'AP Physics 2 Honours 12',
  'Anatomy & Physiology 12', 'AP Biology 12', 'Geology 12', 'AP Psychology 12', 'AP Computer Science A 12',
  'AP Computer Science Principles 12', 'Computer Information Systems 12', 'Computer Programming 12',
  '20th Century World History 12', 'BC First Peoples 12', 'Comparative Cultures 12', 'Economics 12',
  'Economic Theory 12', 'Genocide Studies 12', 'Human Geography 12', 'Law Studies 12', 'Études du droit 12',
  'Philosophy 12', 'Social Justice 12', 'French 12', 'AP French Language & Culture 12', 'Spanish 12', 'Japanese 12',
  'AP Japanese Language & Culture 12', 'Mandarin 12', 'AP Chinese Language & Culture 12', 'Active Living 12',
  'Fitness & Conditioning 12', 'Accounting 12', 'E-Commerce 12', 'Drafting 12', 'Woodwork 12', 'Food Studies 12',
  'Textiles 12', 'Photography 12', 'Ceramics 12', 'Studio Arts 2-D 12', 'Studio Arts 3-D 12', 'AP Drawing 12',
  'AP 2-D Art & Design 12', 'AP 3-D Art & Design 12', 'Drama 12', 'Theatre Company 12', 'Theatre Production 12',
  'Directing & Script Development 12', 'Dance Technique & Performance 12', 'Concert Band 12', 'Jazz Stage Band 12',
  'Orchestral Strings 12', 'Visual Arts 12', 'AP Capstone Research 12', 'Career Life Connections 12A',
  'Career Life Connections 12B', 'Work Experience 12A', 'Work Experience 12B', 'Senior Mentorship 12',
  'Student Leadership', 'Study Block',
  // ── New in the 2026–2027 Course Handbook ──
  'Entrepreneurship & Marketing 9', 'Computer Studies 9', 'Woodwork 9', 'Français langue 10',
  'Physical Education 10: Strength & Power', 'Data Science, Python & AI 11', 'R&B Band 11', 'R&B Band 12',
  'Composition & Production 12', 'Media Arts 12: Yearbook', 'Français langue seconde-immersion 12', 'Youth Work in Trades',
];

// District Premier Academies (westvancouverschools.ca/programs/academies, Sep 2026).
// They run in the last block of the day, so 1-4 and 2-4 surface these first.
export const ACADEMIES: string[] = [
  'Badminton Academy', 'Baseball Academy', 'Basketball Academy', 'Fencing Academy', 'Field Hockey Academy',
  'Volleyball Academy', 'Mechatronics Robotics Academy', 'Soccer Academy', 'Tennis Academy',
];

// Outside the timetable: extracurricular classes, clubs, teams, programs.
export const EXTRAS: string[] = [
  'YELL (Young Entrepreneur Leadership Launchpad)', 'Theatre Company', 'Theatre Production', 'Concert Choir',
  'Jazz Band', 'Concert Band', 'Orchestra', 'Student Council', 'Grad Committee', 'Yearbook',
  'The Sentinel Sun (Newspaper)', 'Multicultural Club', 'Rotary Interact Club', 'Science Club', 'Robotics Club',
  'Debate Club', 'Model UN', 'Chess Club', 'Math Club', 'Peer Tutoring', 'Leadership', 'Link Crew',
  'Sr. Boys Basketball', 'Sr. Girls Basketball', 'Jr. Boys Basketball', 'Jr. Girls Basketball',
  'Sr. Boys Soccer', 'Sr. Girls Soccer', 'Sr. Boys Rugby', 'Sr. Girls Rugby', 'Volleyball', 'Cross Country',
  'Track & Field', 'Swimming', 'Tennis', 'Golf', 'Ultimate', 'Field Hockey', 'Badminton', 'Ski & Snowboard',
  'French Immersion', 'Exchange Program',
];

export type Teacher = { last: string; first: string; dept: string };

export const TEACHERS: Teacher[] = [
  // Administration & counselling
  { last: 'Finch', first: 'Michael', dept: 'Principal' },
  { last: 'Ulinder', first: 'Lisa', dept: 'Vice-Principal' },
  { last: 'Anderson', first: 'Shawn', dept: 'Vice-Principal' },
  { last: 'Murray', first: 'Jennifer', dept: 'Counselling' },
  { last: 'Britten', first: 'Rebecca', dept: 'Counselling' },
  { last: 'Ahmelich', first: 'Jamal', dept: 'Counselling' },
  { last: 'Thureau', first: 'Alex', dept: 'Counselling' },
  { last: 'Heavyside', first: 'Carola', dept: 'Careers / Library' },
  // Teaching staff
  { last: 'Addis', first: 'Dale', dept: 'Science' },
  { last: 'Alm', first: 'Kristi', dept: 'Science' },
  { last: 'Armstrong', first: 'Dawn', dept: 'Career Life Education' },
  { last: 'Armstrong', first: 'Sherri', dept: 'English' },
  { last: 'Bauck', first: 'Christianne', dept: 'Physical Education' },
  { last: 'Beetlestone', first: 'Peter', dept: 'English' },
  { last: 'Bond', first: 'Janine', dept: 'Library' },
  { last: 'Caine', first: 'Nikki', dept: 'Textiles / Food Studies' },
  { last: 'Chappell', first: 'Jayne', dept: 'Inclusive Education' },
  { last: 'Chase', first: 'Kevin', dept: 'Social Studies' },
  { last: 'Chouinard', first: 'Jacqueline', dept: 'English' },
  { last: 'Curtin', first: 'Shelley-Ann', dept: 'Connect' },
  { last: 'Demers', first: 'Jamie', dept: 'Business Education' },
  { last: 'Deneau', first: 'Alyssa', dept: 'French / ELL' },
  { last: 'Dodsworth', first: 'Justin', dept: 'French' },
  { last: 'Elliot', first: 'Craig', dept: 'French Immersion' },
  { last: 'Evans', first: 'Cecily', dept: 'Fine Arts' },
  { last: 'Fromowitz', first: 'Daniel', dept: 'Social Studies' },
  { last: 'Fuller', first: 'Aaron', dept: 'English' },
  { last: 'Gage', first: 'Justin', dept: 'Mathematics' },
  { last: 'Gagliano', first: 'Alexia', dept: 'French Immersion' },
  { last: 'Griffiths', first: "D'Arcy", dept: 'Social Studies' },
  { last: 'Grikis', first: 'Laris', dept: 'Science' },
  { last: 'Hambly', first: 'Madelyn', dept: 'Fine Arts' },
  { last: 'Hammett', first: 'Bryn', dept: 'Science' },
  { last: 'Hardy', first: 'Isaiah', dept: 'Woodwork' },
  { last: 'Hart', first: 'Lauren', dept: 'Food Studies' },
  { last: 'Hsia', first: 'Carlos', dept: 'Science' },
  { last: 'Huh', first: 'Joseph', dept: 'Social Studies' },
  { last: 'Jamieson', first: 'Laura', dept: 'Mathematics' },
  { last: 'Jang', first: 'Emily', dept: 'Inclusive Education' },
  { last: 'Kennedy', first: 'Heather', dept: 'Physical Education' },
  { last: 'Klippenstein', first: 'Nathan', dept: 'Physical Education' },
  { last: 'Krug', first: 'Kayla', dept: 'Physical Education' },
  { last: 'Li', first: 'Ivy', dept: 'Mandarin' },
  { last: 'Ma', first: 'Gary', dept: 'Mathematics' },
  { last: 'Malone', first: 'Heather', dept: 'Applied Skills / Home Ec' },
  { last: 'McGuinness-Gill', first: 'Meghan', dept: 'Drama / Social Studies' },
  { last: 'McKeen', first: 'Trish', dept: 'Science' },
  { last: 'McLean', first: 'Tucker', dept: 'English / ELL' },
  { last: 'McNiven', first: 'Brooks', dept: 'Physical Education' },
  { last: 'Mirmiran', first: 'Siamak', dept: 'French Immersion' },
  { last: 'Miyamoto', first: 'Mari', dept: 'Japanese' },
  { last: 'Morvarid', first: 'Mahtab', dept: 'French Immersion' },
  { last: 'Naami', first: 'Ahmed', dept: 'French Immersion' },
  { last: 'Neufeld', first: 'Trevor', dept: 'Business Education' },
  { last: 'Obeck', first: 'Christian', dept: 'English' },
  { last: 'Ogawa', first: 'Allison', dept: 'Science' },
  { last: 'Page-Newman', first: 'Nicole', dept: 'Spanish' },
  { last: 'Popov', first: 'Julie', dept: 'Science' },
  { last: 'Seaton', first: 'James', dept: 'Mathematics' },
  { last: 'Shackleton-Turner', first: 'Alexandra', dept: 'English' },
  { last: 'Sinnott', first: 'Bree', dept: 'Science' },
  { last: 'Smith', first: 'Torrie', dept: 'Science' },
  { last: 'Sommers', first: 'Lindsay', dept: 'English / Inclusive Education' },
  { last: 'Tabone', first: 'Amanda', dept: 'English' },
  { last: 'Takahashi', first: 'Julie', dept: 'Mathematics' },
  { last: 'Virag', first: 'Zoltan', dept: 'Music' },
  { last: 'Winstone', first: 'Lara', dept: 'Applied Skills' },
  { last: 'Williamson', first: 'Victoria', dept: 'French Immersion' },
  { last: 'Willms', first: 'Lindsay', dept: 'English / Inclusive Education' },
  { last: 'Zhang', first: 'Caris', dept: 'Mathematics / Careers' },
];

export const teacherLabel = (t: Teacher) => `${t.last}, ${t.first}`;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Course matches for the autocomplete: word-prefix matches rank above substring
// matches, and within each tier the student's own grade comes first (others follow).
const courseGrade = (c: string) => { const m = c.match(/(\d+)/); return m ? Number(m[1]) : 0; };
export const matchCourses = (q: string, grade?: number, opts: { lastBlock?: boolean } = {}): string[] => {
  const s = norm(q.trim());
  if (!s) return opts.lastBlock ? ACADEMIES : [];
  const starts: string[] = [], contains: string[] = [];
  // Academies lead on last-block fields and trail everywhere else.
  const pool = opts.lastBlock ? [...ACADEMIES, ...COURSES] : [...COURSES, ...ACADEMIES];
  for (const c of pool) {
    const nc = norm(c);
    if (nc.startsWith(s) || nc.split(/[\s(]+/).some(w => w.startsWith(s))) starts.push(c);
    else if (nc.includes(s)) contains.push(c);
  }
  const byGrade = (arr: string[]) => grade
    ? [...arr.filter(c => courseGrade(c) === grade), ...arr.filter(c => courseGrade(c) !== grade)]
    : arr;
  return [...byGrade(starts), ...byGrade(contains)];
};

// Extras: clubs, teams and extracurricular classes first, then the course list.
export const matchExtras = (q: string, grade?: number): string[] => {
  const s = norm(q.trim());
  if (!s) return EXTRAS.slice(0, 8);
  const own = EXTRAS.filter(e => norm(e).startsWith(s) || norm(e).split(/[\s(]+/).some(w => w.startsWith(s)));
  const rest = EXTRAS.filter(e => !own.includes(e) && norm(e).includes(s));
  return [...own, ...rest, ...matchCourses(q, grade).filter(c => !own.includes(c) && !rest.includes(c))];
};

// Teacher matches, last name first, then first name / anywhere in "Last, First".
export const matchTeachers = (q: string): Teacher[] => {
  const s = norm(q.trim().replace(/^(mr|ms|mrs|mme|m|dr|mlle)\.?\s+/i, ''));
  if (!s) return [];
  const byLast = TEACHERS.filter(t => norm(t.last).startsWith(s));
  const byFirst = TEACHERS.filter(t => !byLast.includes(t) && (norm(t.first).startsWith(s) || norm(teacherLabel(t)).includes(s)));
  return [...byLast, ...byFirst];
};
