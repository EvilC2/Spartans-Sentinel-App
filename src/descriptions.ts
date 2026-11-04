// Spartans — course descriptions for the class card and Programs.
// courseInfo() returns the Sentinel Course Book text (src/courseBook.ts,
// generated, don't hand-edit) when the course is in it, and otherwise falls
// back to a subject-level blurb keyed off the name so the card is never empty.

import { COURSE_BOOK } from './courseBook';

const EXACT: Record<string, string> = {
  'Study Block': 'A spare. No class this block: use it for homework, the library, or FIT-style catch-up.',
  'Student Leadership': 'Plan and run school events, spirit days and assemblies with the leadership team.',
  'Senior Mentorship 12': 'Mentor younger students and lead peer programs, with reflection and a final project.',
};

const SUBJECT: [RegExp, string][] = [
  [/academy/i, 'A district Premier Academy: focused sport or technical training in the last block, with fees, tryouts and travel to events.'],
  [/yell|entrepreneur/i, 'YELL: build and pitch a real venture with mentors from local business, ending in a pitch competition.'],
  [/theatre company|drama|directing/i, 'Acting, staging and rehearsal for public performances. Expect after-school rehearsals near show week.'],
  [/theatre production/i, 'The backstage side of the shows: sets, lighting, sound and stage management.'],
  [/band|orchestra|strings|choir|music/i, 'Ensemble music with concerts through the year, including Kay Meek performances and festival trips.'],
  [/dance/i, 'Technique and choreography across styles, building to performances.'],
  [/^(english|literary|composition|academic writing|creative writing|efp)/i, 'Reading, writing and discussion of literature and non-fiction, with essays, presentations and creative pieces.'],
  [/fran[cç]ais|français|langue|immersion|sciences humaines|explorations|éducation|études du droit/i, 'French Immersion course taught in French. Counts toward the bilingual Dogwood.'],
  [/french/i, 'Core French: speaking, listening, reading and writing, with a focus on real conversation.'],
  [/spanish|japanese|mandarin|farsi|chinese/i, 'A second-language course: conversation, grammar and culture, from introductory to AP.'],
  [/calculus|pre-calc|mathematics|math|statistics/i, 'Math: problem solving, algebra and functions, with unit tests and a final. Bring a scientific calculator.'],
  [/chemistry/i, 'Chemistry: atomic structure, reactions, stoichiometry and labs. Safety glasses required.'],
  [/physics/i, 'Physics: motion, forces, energy and waves, with labs and problem sets.'],
  [/life sciences|biology|anatomy/i, 'Biology: cells, genetics, evolution and body systems, with dissections and labs.'],
  [/earth science|geology/i, 'Earth science: rocks, plate tectonics, weather, oceans and space.'],
  [/^science/i, 'General science across biology, chemistry, physics and earth science, with regular labs.'],
  [/social studies|history|first peoples|comparative|genocide|geography|law|philosophy|social justice|economics/i, 'Social studies: history, geography, government and current issues, with inquiry projects and essays.'],
  [/psychology/i, 'Psychology: how the mind and behaviour work, from research methods to memory and disorders.'],
  [/physical|fitness|active living|conditioning/i, 'PE: team and individual activities, fitness and health. Change strip required.'],
  [/career|work experience|mentorship/i, 'Career education: planning, work habits, and graduation requirements.'],
  [/computer|programming|information systems|e-commerce/i, 'Computing: programming, systems and digital projects, from beginner to AP.'],
  [/accounting|marketing|business|entrepreneurship/i, 'Business: money, marketing and running a venture, with real projects.'],
  [/woodwork|drafting|textiles|food studies|applied design|adst|foods/i, 'Hands-on applied skills in the shop, kitchen or studio, with safety training first.'],
  [/photography|studio arts|visual arts|ceramics|art|drawing|media arts|yearbook/i, 'Studio work with a portfolio, critiques and an exhibition or publication at the end.'],
  [/capstone/i, 'AP Capstone: independent research, academic writing and presentation skills.'],
  [/leadership|council|committee/i, 'Student leadership: run events, represent students and build school spirit.'],
  [/club/i, 'A student club. Meets at lunch or after school; check the club for its schedule.'],
  [/basketball|soccer|rugby|volleyball|cross country|track|swim|tennis|golf|ultimate|hockey|badminton|ski/i, 'A Spartans team. Practices and games through the season; results post to Announcements.'],
];

export type CourseInfo = { desc: string; prereq?: string; fee?: string; official: boolean };

// Many 2026-27 entries open with "$75 Course Fee Applies." Shown as its own
// line so the description starts with the course.
const LEAD_FEE = /^\$(\d+) Course Fee Applies\.?\s*/;

export const courseInfo = (name: string): CourseInfo => {
  const hit = COURSE_BOOK[name.trim()];
  if (hit) {
    const m = LEAD_FEE.exec(hit.desc);
    return m ? { ...hit, desc: hit.desc.slice(m[0].length), fee: `$${m[1]}`, official: true } : { ...hit, official: true };
  }
  return { desc: describeCourse(name), official: false };
};

export const describeCourse = (name: string): string => {
  const n = name.trim();
  if (EXACT[n]) return EXACT[n];
  for (const [re, text] of SUBJECT) if (re.test(n)) return text;
  return 'No description yet. The course book text will be added here.';
};
