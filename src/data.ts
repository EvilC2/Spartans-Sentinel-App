// Sentinel app — shared mock data (news, announcements, quick links).
// The student, their courses, and "today" are NOT here any more:
//   src/ProfileContext.tsx  — student + courses, from the intro flow
//   src/calendar.ts         — the real 2025–2026 school calendar
//   src/bell.ts             — bell schedules
//   src/useToday.ts         — live "now" / current block

const SENTINEL = {
  announcements: [
    {
      id: 'a1',
      pinned: true,
      tag: 'Athletics',
      title: 'Sr. Boys Rugby — Provincials roster posted',
      body: 'Bus departs Friday 7:15 AM sharp from the front loop. Bring kit, lunch, and a packed water bottle. Coach Reilly will run a walkthrough at lunch on Thursday.',
      author: 'Coach Reilly',
      time: '7:48 AM',
    },
    {
      id: 'a2',
      tag: 'Counselling',
      title: 'Grad 2026 — final transcript requests due May 26',
      body: 'Submit through your MyEdBC portal. After May 26 a $25 late processing fee applies. Counselling is open all lunch this week.',
      author: 'Ms. Brar',
      time: '7:31 AM',
    },
    {
      id: 'a3',
      tag: 'Library',
      title: 'AP study rooms — extended hours',
      body: 'Library open until 5:00 PM through May 22. Group room bookings on the door sheet.',
      author: 'Mr. Doi',
      time: 'Yesterday',
    },
  ],

  events: [
    { id: 'e1', date: 'Thu May 21', title: 'West Van Orchestra Night',  loc: 'Kay Meek Centre', time: '7:00 PM' },
    { id: 'e2', date: 'Fri May 22', title: 'Sr. Boys Rugby Provincials', loc: 'Burnaby Lake',    time: 'All day' },
    { id: 'e3', date: 'Thu May 28', title: 'Collaboration Day',         loc: 'Early dismissal', time: '2:45 PM' },
    { id: 'e4', date: 'Fri May 29', title: 'Grad BBQ',                  loc: 'Front Lawn',      time: '12:00 PM' },
  ],

  // ── News / Announcements feed ───────────────────────────────────
  // Categories: Athletics, Academic, General, Events
  // Posts marked admin: true show a verified-staff badge.
  news: [
    {
      id: 'n1', pinned: true, admin: true,
      category: 'Athletics',
      title: 'Sr. Boys Rugby — Provincials roster posted',
      preview: 'Bus departs Friday 7:15 AM sharp from the front loop. Kit, lunch, packed water bottle. Walkthrough at lunch on Thursday.',
      body: 'The final roster for Provincials is up on the Athletics board outside the gym. Bus departs Friday 7:15 AM sharp from the front loop — do not be late.\n\nBring your full kit, a packed lunch, and at least one full water bottle. The cafeteria will be closed before we leave.\n\nA short walkthrough and Q&A will run at lunch on Thursday in the wrestling room. Parents who plan to attend the game can find directions and parking info on the team page.\n\nGo Lions.',
      author: 'Coach Reilly', role: 'Athletic Director',
      time: '7:48 AM', timeFull: 'Today · 7:48 AM',
      reactions: 34, comments: 8,
    },
    {
      id: 'n2', admin: true,
      category: 'Academic',
      title: 'Grad 2026 — final transcript requests due May 26',
      preview: 'Submit through your MyEdBC portal. After May 26 a $25 late processing fee applies. Counselling open all lunch this week.',
      author: 'Ms. Brar', role: 'Counsellor',
      time: '7:31 AM', timeFull: 'Today · 7:31 AM',
      reactions: 12, comments: 3,
    },
    {
      id: 'n3', admin: true,
      category: 'Academic',
      title: 'AP study rooms — extended hours through May 22',
      preview: 'Library open until 5:00 PM. Group room bookings on the door sheet. Quiet zone enforced after 3:30.',
      author: 'Mr. Doi', role: 'Librarian',
      time: 'Yesterday', timeFull: 'Mon May 18',
      reactions: 21, comments: 1,
    },
    {
      id: 'n4',
      category: 'Events',
      title: 'West Van Orchestra Night · Thursday 7 PM',
      preview: 'Kay Meek Centre. Sr. Strings, Wind Ensemble, and the Jazz Combo. Tickets $8 students / $12 adults at the door.',
      author: 'Mr. Lemay', role: 'Music Dept.', admin: true,
      time: 'Mon',  timeFull: 'Mon May 18',
      reactions: 18, comments: 4,
    },
    {
      id: 'n5',
      category: 'General',
      title: 'Lost & found cleanout — Friday after school',
      preview: 'Anything still in the bins by Friday 3:30 goes to donation. Check the cafeteria racks for jackets and water bottles.',
      author: 'Front Office', role: 'Admin', admin: true,
      time: 'Mon',  timeFull: 'Mon May 18',
      reactions: 5, comments: 0,
    },
    {
      id: 'n6',
      category: 'Athletics',
      title: 'Track & Field — districts results',
      preview: 'Three new school records on the weekend. Full results and photos on the Athletics page.',
      author: 'Coach Singh', role: 'Track & Field', admin: true,
      time: 'Sun',  timeFull: 'Sun May 17',
      reactions: 47, comments: 11,
    },
    {
      id: 'n7',
      category: 'Events',
      title: 'Grad BBQ — RSVP by May 26',
      preview: 'Front Lawn, 12:00 PM on May 29. Grads eat free, +1 guests $8. Vegan option available, mark on the form.',
      author: 'Grad Council', role: 'Student Council',
      time: 'Sun',  timeFull: 'Sun May 17',
      reactions: 62, comments: 14,
    },
    {
      id: 'n8',
      category: 'General',
      title: 'Bike racks — west lot temporarily closed',
      preview: 'Paving work runs through Wednesday. Use the racks by the gym entrance in the meantime.',
      author: 'Facilities', role: 'Admin', admin: true,
      time: 'Fri',  timeFull: 'Fri May 15',
      reactions: 3, comments: 0,
    },
  ],

  // "The Buzz" — slides for the big rotating window on the home screen.
  // Banner news is pulled from the pinned announcement; these are the fun ones.
  buzz: [
    {
      id: 'b1', kind: 'trivia',
      prompt: 'What year did Sentinel Secondary open?',
      options: ['1961', '1974', '1988', '1995'],
      answer: 0,
    },
    {
      id: 'b2', kind: 'fact',
      eyebrow: 'Did you know',
      title: 'The library has 3 bookable group rooms.',
      body: 'Sign-up sheet is on the door. Max 6 per room, 2 hours at a time.',
    },
    {
      id: 'b3', kind: 'trivia',
      prompt: 'How many blocks are in a full rotation?',
      options: ['4', '6', '8', '10'],
      answer: 2,
    },
    {
      id: 'b4', kind: 'poll',
      prompt: 'Best spot to eat lunch?',
      options: ['Cafeteria', 'Courtyard', 'Library steps', 'Anywhere but here'],
    },
    {
      id: 'b5', kind: 'trivia',
      prompt: 'Are you going to join the App Club?',
      options: ['Yes', 'Maybe', 'Tell me more', 'Already in'],
      answer: 0,
      explain: 'We meet Thursdays at lunch in Room 214. Bring ideas, bugs, or snacks.',
    },
  ],

  quickLinks: [
    { id: 'bell',       label: 'Bell Schedule', icon: 'clock' },
    { id: 'athletics',  label: 'Athletics',     icon: 'whistle' },
    { id: 'library',    label: 'Library',       icon: 'book' },
    { id: 'lunch',      label: 'Lunch Menu',    icon: 'fork' },
    { id: 'counselling',label: 'Counselling',   icon: 'compass' },
    { id: 'contacts',   label: 'Contacts',      icon: 'phone' },
  ],
};

export default SENTINEL;

