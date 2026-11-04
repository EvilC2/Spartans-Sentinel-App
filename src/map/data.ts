// Spartans — the school map, traced from the posted 2014/2015 School Map
// (3 floors on one sheet). One shared coordinate frame for every floor so
// stairs and the elevator sit in the same spot on each layer.
//
//   • Units are drawing units, roughly 18 per metre (the sheet is not to
//     scale, so distances are "about").
//   • The sheet is drawn with south at the top, like the posted map. Kept
//     that way on purpose: students know the posted map.
//   • Floor 3 is the entry level (Foyer, Main Entrance, office, gym).
//     Floor 1 is the lowest (shops, art, change rooms).
//   • Floor 0 is "outside": portables, field, tennis courts, walkways.
//
// Rooms carry a door side (t/b/l/r/c): the door point is that edge's
// midpoint, and the router snaps it onto the nearest hall centreline of the
// same floor. Halls are centrelines. Links (stairs, elevator, doors out)
// join floors at one point per floor.

export type Floor = 0 | 1 | 2 | 3;

export type Kind =
  | 'room'      // numbered classroom or named place you can walk to
  | 'place'     // named space (Library, Gym, Foyer …)
  | 'hall'      // corridor fill, drawn under rooms
  | 'stairs'    // stair box
  | 'outdoor'   // dotted ground (courtyard, field, portables)
  | 'poi'       // small legend square (washroom, elevator, nurse …)
  | 'void';     // drawn, never routed to (boiler room, custodian)

export type Room = {
  id: string;            // what you type: '207', '149A', 'library', 'gym'
  label: string;         // drawn on the map; '\n' splits lines
  name?: string;         // spoken name in directions / search ("Room 207")
  aliases?: string[];    // extra search words
  floor: Floor;
  x: number; y: number; w: number; h: number;
  kind: Kind;
  door?: 't' | 'b' | 'l' | 'r' | 'c';
  font?: number;         // label size override
  vert?: boolean;        // vertical label
  color?: string;        // poi fill
};

export type Hall = { floor: Floor; a: [number, number]; b: [number, number] };

export type Link = {
  id: string;
  kind: 'stairs' | 'elevator' | 'door';
  label: string;                           // "the stairs by 300"
  at: Partial<Record<Floor, [number, number]>>;
};

export const FLOORS: { id: Floor; short: string; name: string; note: string }[] = [
  { id: 3, short: '3', name: '3rd floor', note: 'Main Entrance, office, gym, 300s' },
  { id: 2, short: '2', name: '2nd floor', note: 'Theatre, computer labs, 200s' },
  { id: 1, short: '1', name: '1st floor', note: 'Shops, art, change rooms' },
];

// Whole sheet. Building is roughly 0…1960 × 0…1440; outside adds margins.
export const VIEW = { x: -230, y: -260, w: 2380, h: 1740 };
export const BUILDING = { x: 0, y: 0, w: 1960, h: 1440 };
export const UNITS_PER_M = 18;

// Legend colours, same as the posted sheet so it reads instantly.
export const POI = {
  elevator: '#F4E04D',
  boys: '#9CC64A',
  girls: '#F2A93B',
  staff: '#8B6CB0',
  sports: '#2F6DB5',
  nurse: '#B8E6E4',
  meeting: '#E2197C',
  store: '#12A19A',
  careers: '#4CAF50',
};

const R = (
  id: string, label: string, floor: Floor, x: number, y: number, w: number, h: number,
  kind: Kind = 'room', door: Room['door'] = 'c', extra: Partial<Room> = {},
): Room => ({ id, label, floor, x, y, w, h, kind, door, ...extra });

const P = (id: string, floor: Floor, x: number, y: number, w: number, h: number, letter: string, color: string, name: string): Room =>
  ({ id, label: letter, name, floor, x, y, w, h, kind: 'poi', color, font: 26 });

// ────────────────────────────────────────────────────────────────
// Outside (drawn on every floor)
// ────────────────────────────────────────────────────────────────
export const OUTSIDE: Room[] = [
  R('courtyard', 'Courtyard', 0, 118, 484, 769, 482, 'outdoor', 'c', { name: 'Courtyard', font: 44 }),
  R('garden', 'School Garden', 0, 431, 909, 456, 57, 'outdoor', 'c', { name: 'School Garden', font: 26 }),
  R('portable-1', 'Portable 1', 0, -50, 319, 128, 155, 'outdoor', 'r', { name: 'Portable 1', aliases: ['port 1', 'port1', 'portable1'], font: 26 }),
  R('portable-2', 'Portable 2', 0, -178, 319, 128, 155, 'outdoor', 'b', { name: 'Portable 2', aliases: ['port 2', 'port2', 'portable2'], font: 26 }),
  R('music-portable', 'Music\nPortable', 0, 1795, 715, 140, 180, 'outdoor', 'r', { name: 'Music Portable', aliases: ['band', 'music'], font: 26 }),
  R('field', 'Field', 0, 2022, 385, 100, 978, 'outdoor', 'l', { name: 'Field', aliases: ['track', 'turf'], font: 40, vert: true }),
  R('tennis', 'Tennis Courts', 0, 1322, -215, 611, 200, 'outdoor', 'b', { name: 'Tennis Courts', aliases: ['tennis'], font: 36 }),
  R('field-house', 'Field House', 0, 867, -215, 422, 200, 'outdoor', 'b', { name: 'Field House', font: 36 }),
  R('lacrosse', 'Lacrosse Box', 0, 300, -215, 533, 200, 'outdoor', 'b', { name: 'Lacrosse Box', aliases: ['lax'], font: 36 }),
  R('parking-front', 'Staff and Visitor Parking', 0, 350, 1470, 1300, 60, 'outdoor', 'c', { kind: 'void', font: 26 }),
];

// ────────────────────────────────────────────────────────────────
// 3rd floor — entry level
// ────────────────────────────────────────────────────────────────
const F3: Room[] = [
  // halls (fill only)
  R('h3-top', '', 3, 118, 205, 1252, 115, 'hall'),
  R('h3-bot', '', 3, 118, 1145, 1252, 110, 'hall'),
  R('h3-right', '', 3, 1315, 205, 55, 1050, 'hall'),
  R('h3-mezz-t', 'Student Mezzanine', 3, 885, 490, 370, 55, 'hall', 'c', { font: 22 }),
  R('h3-mezz-b', 'Teacher Mezzanine', 3, 885, 920, 370, 55, 'hall', 'c', { font: 22 }),
  R('h3-bleach', '', 3, 1370, 950, 400, 135, 'hall'),

  // top row
  R('ml-bookroom', 'Modern\nLang.', 3, 118, 90, 87, 115, 'void', 'c', { font: 18 }),
  R('361', '361', 3, 205, 35, 255, 170, 'room', 'b'),
  R('357', '357', 3, 460, 35, 285, 170, 'room', 'b'),
  R('355', '355', 3, 745, 35, 230, 170, 'room', 'b'),
  R('351', '351', 3, 975, 35, 280, 170, 'room', 'b'),
  R('s1-3', '', 3, 1255, 35, 115, 170, 'stairs'),
  P('wc-staff-361', 3, 460, 150, 55, 55, 'D', POI.staff, 'Staff washroom'),

  // middle row
  R('s2-3', '', 3, 118, 320, 87, 170, 'stairs'),
  R('366', '366', 3, 205, 320, 225, 170, 'room', 't'),
  R('s3-3', '', 3, 490, 320, 80, 170, 'stairs'),
  R('358', '358', 3, 570, 320, 290, 170, 'room', 't'),
  R('354', '354', 3, 940, 320, 255, 170, 'room', 't'),
  P('wc-staff-354', 3, 1195, 320, 60, 115, 'D', POI.staff, 'Staff washroom'),
  P('elev-3', 3, 1195, 435, 60, 55, 'A', POI.elevator, 'Elevator'),

  // library block
  R('library', 'Library', 3, 885, 545, 315, 375, 'place', 'l', { name: 'Library', aliases: ['lib', 'learning commons'], font: 44 }),
  R('s4-3', '', 3, 1200, 545, 115, 145, 'stairs'),
  R('s5-3', '', 3, 1200, 775, 115, 145, 'stairs'),
  R('cy-exit-a3', '', 3, 800, 575, 85, 85, 'stairs'),
  R('cy-exit-b3', '', 3, 800, 800, 85, 85, 'stairs'),

  // gym block
  R('gym', 'Gymnasium', 3, 1370, 320, 400, 630, 'place', 'b', { name: 'Gym', aliases: ['gymnasium', 'big gym', 'pe'], font: 44 }),
  R('custodian-supplies', 'Custodian\nSupplies', 3, 1370, 320, 110, 85, 'void', 'c', { font: 18 }),
  R('custodian-office', 'Custodian\nOffice', 3, 1370, 405, 110, 85, 'void', 'c', { font: 18 }),
  R('s9-3', '', 3, 1770, 520, 115, 140, 'stairs'),
  R('s10a-3', '', 3, 1415, 950, 65, 135, 'stairs'),
  R('bleachers', 'Bleachers', 3, 1480, 950, 180, 135, 'place', 'b', { name: 'Bleachers', font: 28 }),
  R('s10b-3', '', 3, 1660, 950, 60, 135, 'stairs'),
  R('foyer', 'Foyer', 3, 1370, 1085, 400, 225, 'place', 'c', { name: 'Foyer', aliases: ['front', 'lobby', 'main entrance'], font: 44 }),
  { ...P('store', 3, 1720, 1085, 50, 55, 'H', POI.store, 'School Store'), aliases: ['store', 'spirit wear'] },
  R('cafeteria', 'Cafeteria', 3, 1770, 1085, 165, 260, 'place', 'l', { name: 'Cafeteria', aliases: ['caf', 'cafe', 'lunch'], font: 34, vert: true }),

  // office row
  R('323', '323', 3, 118, 975, 202, 170, 'room', 'b'),
  R('s8-3', '', 3, 320, 975, 80, 170, 'stairs'),
  R('tech-support', 'Tech Support', 3, 400, 975, 30, 170, 'void', 'c', { font: 14, vert: true }),
  R('staff-room', 'Staff\nRoom', 3, 430, 975, 115, 170, 'place', 'b', { name: 'Staff Room', font: 22 }),
  P('wc-staff-office-a', 3, 545, 1085, 42, 60, 'D', POI.staff, 'Staff washroom'),
  P('wc-staff-office-b', 3, 587, 1085, 43, 60, 'D', POI.staff, 'Staff washroom'),
  R('principal', 'Principal', 3, 545, 975, 110, 80, 'place', 'b', { name: "Principal's office", aliases: ['principal'], font: 20 }),
  R('exec-assistant', 'Executive\nAssistant', 3, 655, 975, 115, 55, 'void', 'c', { font: 14 }),
  R('main-office', 'Main\nOffice', 3, 655, 1030, 230, 115, 'place', 'b', { name: 'Main Office', aliases: ['office', 'front office', 'attendance'], font: 30 }),
  R('vp-a', 'Vice-\nPrincipal', 3, 885, 975, 100, 80, 'place', 'b', { name: "Vice-Principals' office", aliases: ['vp', 'vice principal'], font: 16 }),
  R('vp-b', 'Vice-\nPrincipal', 3, 985, 975, 100, 80, 'void', 'c', { font: 16 }),
  R('photocopier', 'Photo-\ncopier', 3, 1085, 975, 115, 110, 'void', 'c', { font: 18 }),
  R('database-clerk', 'Database\nClerk', 3, 940, 1085, 115, 60, 'void', 'c', { font: 15 }),
  R('accounting', 'Account-\ning', 3, 1085, 1085, 85, 60, 'void', 'c', { font: 14 }),
  P('wc-boys-3', 3, 1200, 975, 55, 170, 'B', POI.boys, 'Boys washroom'),

  // bottom row
  R('s6-3', '', 3, 30, 1055, 88, 295, 'stairs'),
  R('310', '310', 3, 118, 1255, 112, 180, 'room', 't'),
  R('308', '308', 3, 230, 1255, 115, 180, 'room', 't'),
  R('306', '306', 3, 345, 1255, 170, 180, 'room', 't'),
  P('sports-academy-a', 3, 515, 1255, 60, 45, 'E', POI.sports, 'Sports Academy'),
  { ...P('nurse', 3, 515, 1300, 60, 40, 'F', POI.nurse, 'Nursing Station'), aliases: ['nurse', 'first aid', 'sick'] },
  P('wc-staff-306', 3, 515, 1340, 60, 40, 'D', POI.staff, 'Staff washroom'),
  P('sports-academy-b', 3, 515, 1380, 85, 55, 'E', POI.sports, 'Sports Academy'),
  R('304', '304', 3, 600, 1255, 170, 180, 'room', 't'),
  R('counselling', 'Counselling', 3, 770, 1255, 315, 180, 'place', 't', { name: 'Counselling', aliases: ['counsellor', 'counselor', 'counseling'], font: 28 }),
  { ...P('careers', 3, 1030, 1255, 55, 55, 'I', POI.careers, 'Careers'), aliases: ['crc', 'career centre', 'career resources'] },
  P('meeting-room', 3, 1000, 1345, 85, 90, 'G', POI.meeting, 'Meeting Room'),
  R('300', '300', 3, 1085, 1255, 170, 180, 'room', 't'),
  R('s7-3', '', 3, 1255, 1255, 115, 180, 'stairs'),
];

// ────────────────────────────────────────────────────────────────
// 2nd floor
// ────────────────────────────────────────────────────────────────
const F2: Room[] = [
  R('h2-top', '', 2, 118, 197, 1257, 112, 'hall'),
  R('h2-bot', '', 2, 118, 1141, 1257, 112, 'hall'),
  R('h2-right', '', 2, 1319, 197, 56, 1056, 'hall'),
  R('h2-mezz', '', 2, 887, 484, 375, 50, 'hall'),
  R('h2-dance', '', 2, 1375, 403, 56, 81, 'hall'),
  R('h2-bleach', '', 2, 1375, 940, 406, 144, 'hall'),

  R('stub-2', '', 2, 118, 84, 88, 113, 'void'),
  R('261', '261', 2, 206, 28, 144, 169, 'room', 'b'),
  R('259', '259\nLAC', 2, 350, 28, 156, 169, 'room', 'b', { name: 'Room 259 (LAC)', aliases: ['lac', 'learning assistance'] }),
  P('wc-staff-259', 2, 406, 150, 50, 47, 'D', POI.staff, 'Staff washroom'),
  R('259A', '259A\nPhotocopier', 2, 506, 28, 75, 169, 'void', 'c', { font: 15, vert: true }),
  R('257', '257', 2, 581, 28, 169, 169, 'room', 'b'),
  R('255', '255\nFoods', 2, 750, 28, 225, 169, 'room', 'b', { name: 'Room 255 (Foods)', aliases: ['foods', 'cooking', 'kitchen'] }),
  R('253', '253', 2, 975, 28, 56, 169, 'room', 'b', { vert: true, font: 28 }),
  R('251', '251\nTextiles', 2, 1031, 28, 231, 169, 'room', 'b', { name: 'Room 251 (Textiles)', aliases: ['textiles', 'sewing'] }),
  R('s1-2', '', 2, 1262, 28, 113, 169, 'stairs'),

  R('s2-2', '', 2, 118, 309, 88, 175, 'stairs'),
  R('272', '272', 2, 206, 309, 56, 175, 'room', 't', { vert: true, font: 28 }),
  R('262', '262', 2, 262, 309, 113, 175, 'room', 't'),
  R('260', '260', 2, 375, 309, 112, 175, 'room', 't'),
  R('s3-2', '', 2, 487, 309, 88, 175, 'stairs'),
  P('wc-girls-2top', 2, 575, 309, 56, 175, 'C', POI.girls, 'Girls washroom'),
  R('258', '258\nComputer Lab', 2, 631, 309, 169, 175, 'room', 't', { name: 'Room 258 (Computer Lab)', aliases: ['computer lab', 'computers'], font: 26 }),
  R('256', '256', 2, 800, 309, 56, 175, 'room', 't', { vert: true, font: 28 }),
  R('254', '254\nComputer Lab', 2, 856, 309, 175, 175, 'room', 't', { name: 'Room 254 (Computer Lab)', aliases: ['computer lab', 'computers'], font: 26 }),
  R('252', '252', 2, 1031, 309, 175, 175, 'room', 't'),
  P('wc-boys-2', 2, 1206, 309, 56, 100, 'B', POI.boys, 'Boys washroom'),
  P('elev-2', 2, 1206, 409, 56, 75, 'A', POI.elevator, 'Elevator'),

  R('theatre', 'Theatre', 2, 1375, 197, 406, 206, 'place', 'l', { name: 'Theatre', aliases: ['theater', 'drama', 'auditorium', 'stage'], font: 40 }),
  P('elev-2b', 2, 1375, 403, 56, 81, 'A', POI.elevator, 'Elevator'),
  R('dance', 'Dance Studio', 2, 1431, 403, 263, 81, 'place', 'l', { name: 'Dance Studio', aliases: ['dance'], font: 26 }),
  R('gym-2', 'Gymnasium', 2, 1375, 484, 406, 456, 'place', 'l', { name: 'Gym (2nd floor)', aliases: ['gym floor'], font: 44 }),
  R('s9-2', '', 2, 1781, 509, 113, 144, 'stairs'),
  R('s10a-2', '', 2, 1431, 940, 56, 144, 'stairs'),
  R('bleachers-2', 'Bleachers', 2, 1487, 940, 182, 144, 'place', 'l', { name: 'Bleachers (2nd floor)', font: 28 }),
  R('s10b-2', '', 2, 1669, 940, 62, 144, 'stairs'),

  R('library-2', 'Library', 2, 887, 534, 319, 432, 'place', 'l', { name: 'Library (2nd floor)', aliases: ['lower library'], font: 44 }),
  R('s4-2', '', 2, 1206, 541, 113, 143, 'stairs'),
  R('s5-2', '', 2, 1206, 772, 113, 112, 'stairs'),
  R('cy-exit-a2', '', 2, 800, 566, 87, 87, 'stairs'),
  R('cy-exit-b2', '', 2, 800, 797, 87, 87, 'stairs'),

  R('209', '209', 2, 118, 966, 144, 175, 'room', 'b'),
  R('english-bookroom', 'English\nBookroom', 2, 262, 966, 57, 175, 'void', 'c', { font: 13, vert: true }),
  R('s8-2', '', 2, 319, 966, 87, 175, 'stairs'),
  R('207', '207', 2, 406, 966, 200, 175, 'room', 'b'),
  R('205', '205', 2, 606, 966, 194, 175, 'room', 'b'),
  R('203', '203', 2, 800, 966, 200, 175, 'room', 'b'),
  R('201', '201\nLibrary Lab', 2, 1000, 966, 206, 175, 'room', 'b', { name: 'Room 201 (Library Lab)', aliases: ['library lab'], font: 26 }),
  P('wc-girls-2bot', 2, 1206, 966, 56, 175, 'C', POI.girls, 'Girls washroom'),

  R('s6-2', '', 2, 31, 1053, 87, 288, 'stairs'),
  R('210', '210', 2, 118, 1253, 169, 175, 'room', 't'),
  R('grad-transitions', 'Grad Transitions\nWork Experience', 2, 287, 1253, 88, 175, 'void', 'c', { font: 12, vert: true }),
  R('208', '208', 2, 375, 1253, 175, 175, 'room', 't'),
  R('206', '206', 2, 550, 1253, 194, 175, 'room', 't'),
  R('204', '204', 2, 744, 1253, 175, 175, 'room', 't'),
  R('202', '202', 2, 919, 1253, 168, 175, 'room', 't'),
  R('200', '200', 2, 1087, 1253, 175, 175, 'room', 't'),
  R('s7-2', '', 2, 1262, 1253, 113, 175, 'stairs'),
];

// ────────────────────────────────────────────────────────────────
// 1st floor — lowest
// ────────────────────────────────────────────────────────────────
const F1: Room[] = [
  R('h1-top', '', 1, 375, 191, 1256, 112, 'hall'),
  R('h1-change', '', 1, 1262, 478, 113, 306, 'hall'),

  R('stub-1', '', 1, 118, 84, 88, 107, 'void'),
  R('155', '155\nWoodwork', 1, 206, 16, 169, 462, 'room', 'r', { name: 'Room 155 (Woodwork)', aliases: ['woodwork', 'wood shop', 'shop'], font: 30, vert: true }),
  R('153C', '153C\n3D Art', 1, 375, 16, 200, 175, 'room', 'b', { name: 'Room 153C (3D Art)', aliases: ['3d art', 'sculpture', 'ceramics'], font: 28 }),
  R('153B', '153B\nStudio', 1, 575, 16, 200, 175, 'room', 'b', { name: 'Room 153B (Studio)', aliases: ['studio'], font: 28 }),
  R('153A', '153A\nPhoto', 1, 775, 16, 200, 175, 'room', 'b', { name: 'Room 153A (Photo)', aliases: ['photo', 'photography', 'darkroom'], font: 28 }),
  R('stub-1b', '', 1, 975, 16, 56, 175, 'void'),
  R('151', '151\nArt', 1, 1031, 16, 231, 175, 'room', 'b', { name: 'Room 151 (Art)', aliases: ['art', 'art room'], font: 28 }),
  R('s1-1', '', 1, 1262, 16, 113, 175, 'stairs'),
  R('s12-1', '', 1, 1375, 16, 112, 175, 'stairs'),
  R('149A', '149A', 1, 1487, 16, 144, 175, 'room', 'b'),
  R('149B', '149B', 1, 1631, 16, 144, 175, 'room', 'b'),
  R('athletics-office', 'Athletics\nOffice', 1, 1631, 191, 144, 112, 'place', 'l', { name: 'Athletics Office', aliases: ['athletics'], font: 18 }),
  R('s11-1', '', 1, 375, 191, 87, 112, 'stairs'),

  R('156', '156', 1, 375, 303, 112, 175, 'room', 't'),
  R('s3-1', '', 1, 487, 303, 88, 175, 'stairs'),
  R('154', '154', 1, 575, 303, 225, 175, 'room', 't'),
  R('boiler', 'Boiler Room', 1, 800, 303, 462, 175, 'void', 'c', { font: 26 }),
  P('elev-1', 1, 1206, 422, 56, 56, 'A', POI.elevator, 'Elevator'),

  R('girls-change', 'Girls\nChange Rooms', 1, 1375, 303, 319, 144, 'place', 'l', { name: 'Girls Change Rooms', aliases: ['girls change', 'change room', 'changeroom', 'locker room'], font: 26, color: POI.girls }),
  P('wc-girls-1', 1, 1550, 447, 144, 100, 'C', POI.girls, 'Girls washroom'),
  R('weight-room', 'Weight\nRoom', 1, 1375, 447, 175, 200, 'place', 'l', { name: 'Weight Room', aliases: ['weights', 'fitness', 'workout'], font: 26 }),
  P('wc-boys-1', 1, 1550, 547, 144, 100, 'B', POI.boys, 'Boys washroom'),
  R('boys-change', 'Boys\nChange Rooms', 1, 1375, 647, 319, 137, 'place', 'l', { name: 'Boys Change Rooms', aliases: ['boys change', 'change room', 'changeroom', 'locker room'], font: 26, color: POI.boys }),
  R('pe-office', 'PE Office', 1, 1694, 447, 81, 200, 'place', 'l', { name: 'PE Office', aliases: ['pe', 'phys ed'], font: 18, vert: true }),

  R('library-1', 'Library', 1, 887, 534, 375, 369, 'outdoor', 'c', { kind: 'outdoor', font: 44 }),
  R('cy-exit-a1', '', 1, 800, 485, 87, 87, 'stairs'),
  R('cy-exit-b1', '', 1, 800, 665, 87, 87, 'stairs'),
];

export const ROOMS: Room[] = [...OUTSIDE, ...F3, ...F2, ...F1];

// Places that are not rects: the front doors.
export const ENTRANCE = { id: 'main-entrance', name: 'Main Entrance', floor: 3 as Floor, x: 1570, y: 1330 };

// ────────────────────────────────────────────────────────────────
// Hall centrelines
// ────────────────────────────────────────────────────────────────
const H = (floor: Floor, ax: number, ay: number, bx: number, by: number): Hall => ({ floor, a: [ax, ay], b: [bx, by] });

export const HALLS: Hall[] = [
  // 3rd
  H(3, 118, 262, 1370, 262),      // top hall
  H(3, 118, 1200, 1370, 1200),    // bottom hall
  H(3, 1342, 262, 1342, 1200),    // right hall
  H(3, 885, 517, 1342, 517),      // student mezzanine
  H(3, 885, 947, 1342, 947),      // teacher mezzanine
  H(3, 912, 517, 912, 947),       // library aisle
  H(3, 1370, 1200, 1770, 1200),   // foyer, to the cafeteria door
  H(3, 1570, 400, 1570, 1330),    // gym → bleachers → foyer → front doors
  H(3, 1570, 590, 1770, 590),     // gym to the field stairs
  // 2nd
  H(2, 118, 253, 1375, 253),
  H(2, 118, 1197, 1375, 1197),
  H(2, 1347, 253, 1347, 1197),
  H(2, 887, 509, 1347, 509),      // walkway above the library
  H(2, 912, 509, 912, 940),       // library aisle
  H(2, 1347, 443, 1431, 443),     // to the dance studio
  H(2, 1347, 712, 1578, 712),     // into the gym
  H(2, 1578, 581, 1578, 1012),    // gym length
  H(2, 1578, 581, 1781, 581),     // gym to the field stairs
  H(2, 1459, 1012, 1700, 1012),   // bleachers
  // 1st
  H(1, 375, 247, 1703, 247),      // the one long hall
  H(1, 1318, 247, 1318, 784),     // change-room hall
  H(1, 1318, 547, 1694, 547),     // through the weight room to the PE office
  // outside walkways
  H(0, 30, 1400, 1960, 1400),     // front, along the parking
  H(0, 1960, -60, 1960, 1400),    // east side, by the field
  H(0, 30, -60, 1960, -60),       // top, by the courts
  H(0, 30, -60, 30, 1400),        // west side, by the portables
  H(0, 1827, 590, 1960, 590),     // field stairs landing
  H(0, 30, 405, 118, 405),        // west door
  H(0, -114, 500, 30, 500),       // to portable 2
  H(0, 1570, 1330, 1570, 1400),   // front steps
  H(0, 531, 484, 531, 725),       // into the courtyard from its door
];

// ────────────────────────────────────────────────────────────────
// Links between floors (and doors to outside)
// ────────────────────────────────────────────────────────────────
export const LINKS: Link[] = [
  { id: 's1', kind: 'stairs', label: 'the stairs by 351', at: { 3: [1312, 120], 2: [1318, 112], 1: [1318, 105], 0: [1318, -60] } },
  { id: 's2', kind: 'stairs', label: 'the stairs by 366', at: { 3: [160, 405], 2: [162, 396], 0: [30, 405] } },
  { id: 's3', kind: 'stairs', label: 'the stairs by 358', at: { 3: [530, 405], 2: [531, 396], 1: [531, 390] } },
  { id: 's4', kind: 'stairs', label: 'the library stairs', at: { 3: [1257, 617], 2: [1262, 612] } },
  { id: 's5', kind: 'stairs', label: 'the library stairs', at: { 3: [1257, 847], 2: [1262, 828] } },
  { id: 's6', kind: 'stairs', label: 'the stairs by 310', at: { 3: [74, 1200], 2: [74, 1197] } },
  { id: 's7', kind: 'stairs', label: 'the stairs by 300', at: { 3: [1312, 1345], 2: [1318, 1340] } },
  { id: 's8', kind: 'stairs', label: 'the stairs by 323', at: { 3: [360, 1060], 2: [362, 1053] } },
  { id: 's9', kind: 'stairs', label: 'the gym stairs', at: { 3: [1827, 590], 2: [1837, 581], 0: [1827, 590] } },
  { id: 's10', kind: 'stairs', label: 'the bleacher stairs', at: { 3: [1447, 1017], 2: [1459, 1012] } },
  { id: 's11', kind: 'stairs', label: 'the stairs by 156', at: { 2: [418, 253], 1: [418, 247] } },
  { id: 's12', kind: 'stairs', label: 'the stairs by 149A', at: { 1: [1431, 105], 0: [1431, -60] } },
  { id: 'elev', kind: 'elevator', label: 'the elevator', at: { 3: [1225, 462], 2: [1234, 446], 1: [1234, 450] } },
  { id: 'front', kind: 'door', label: 'the front doors', at: { 3: [1570, 1330], 0: [1570, 1330] } },
  { id: 'cy', kind: 'door', label: 'the courtyard door', at: { 1: [531, 478], 0: [531, 484] } },
];

// ────────────────────────────────────────────────────────────────
// Lookup helpers
// ────────────────────────────────────────────────────────────────
export const NAVIGABLE = new Set<Kind>(['room', 'place', 'outdoor']);

export const roomById = (id: string) => ROOMS.find(r => r.id === id);

export const roomName = (r: Room) => r.name || (/^\d/.test(r.id) ? `Room ${r.id}` : r.label.replace('\n', ' '));

// All the things you can search for.
export type Target = { id: string; name: string; floor: Floor; sub: string; kind: 'room' | 'place' | 'outdoor' | 'entrance' | 'poi' };

export const TARGETS: Target[] = [
  { id: ENTRANCE.id, name: ENTRANCE.name, floor: 3, sub: '3rd floor · Foyer', kind: 'entrance' },
  ...ROOMS.filter(r => NAVIGABLE.has(r.kind) || r.kind === 'poi').filter(r => r.id !== 'parking-front' && r.id !== 'library-1' && r.id !== 'garden').map(r => ({
    id: r.id,
    name: r.kind === 'poi' ? `${r.name} (${floorShort(r.floor)})` : roomName(r),
    floor: r.floor,
    sub: r.kind === 'poi' ? 'Legend' : r.floor === 0 ? 'Outside' : FLOORS.find(f => f.id === r.floor)!.name,
    kind: r.kind as Target['kind'],
  })),
];

function floorShort(f: Floor) { return f === 0 ? 'outside' : f === 1 ? '1st' : f === 2 ? '2nd' : '3rd'; }

// "rm 207" / "Room 149a" / "gym" → a target id, or null.
export const normalizeQuery = (q: string) => q.trim().toLowerCase().replace(/^(room|rm|r)\s*/, '').replace(/\s+/g, ' ');

export const findTarget = (q: string): Target | null => {
  const s = normalizeQuery(q);
  if (!s) return null;
  const exact = TARGETS.find(t => t.id.toLowerCase() === s || t.name.toLowerCase() === s);
  if (exact) return exact;
  const list = searchTargets(s);
  return list[0] || null;
};

export const searchTargets = (q: string, limit = 6): Target[] => {
  const s = normalizeQuery(q);
  if (!s) return [];
  const score = (t: Target) => {
    const id = t.id.toLowerCase(), name = t.name.toLowerCase();
    const room = roomById(t.id);
    const al = room?.aliases || [];
    if (id === s || name === s) return 0;
    if (id.startsWith(s)) return 1;
    if (name.startsWith(s)) return 2;
    if (al.some(a => a === s)) return 2;
    if (al.some(a => a.startsWith(s))) return 3;
    if (name.includes(s)) return 4;
    if (al.some(a => a.includes(s))) return 5;
    return 99;
  };
  return TARGETS.map(t => ({ t, k: score(t) })).filter(x => x.k < 99).sort((a, b) => a.k - b.k || a.t.name.localeCompare(b.t.name)).slice(0, limit).map(x => x.t);
};
