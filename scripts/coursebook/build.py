import json, re

L25 = open('cb2526.txt').read().split('\n')   # 2025-2026 Course Book (pymupdf text)
L27 = open('cb2627.txt').read().split('\n')   # 2026-2027 Course Handbook (pymupdf text)
CAT = json.load(open('catalog.json'))

def raw(L, a, b):
    """lines a..b inclusive (1-indexed), dropping page markers / page-number lines"""
    out = []
    skip = 0
    for i in range(a - 1, b):
        l = L[i].rstrip()
        if l.startswith('===== PAGE'):
            while out and out[-1] is None:
                out.pop()
            skip = 1  # skip blank lines + page number after marker
            continue
        if skip:
            if re.fullmatch(r'\s*', l):
                continue
            if re.fullmatch(r'\s*\d+\s*', l):
                skip = 0
                continue
            skip = 0
        out.append(None if L[i] == '' else l)
    return ['' if x is None else x for x in out]

HEADINGS = {'AP Capstone Seminar 11 Course Content', 'Course Scheduling Logistics', 'AP Capstone Research 12 Course Content',
            'Criteria:', 'Expectations:'}
CONT_END = re.compile(r'(\band|\bor|,|\bthe|\bof|\bto|\bin|\bfor|-)$')

def clean(lines):
    paras = []   # list of blocks; each block is list of "logical lines"
    cur = []     # logical lines in current block
    pending_marker = None
    for l in lines:
        s = l.strip()
        if not s:
            if cur:
                paras.append(cur); cur = []
            continue
        if s in HEADINGS:
            if cur: paras.append(cur)
            paras.append([[s, False]]); cur = []
            continue
        if s == '•' or re.fullmatch(r'[1-9]\.', s):
            pending_marker = '•' if s == '•' else s
            continue
        m = re.match(r'^(•|[1-9]\.)\s+(.*)$', s)
        if pending_marker:
            cur.append([pending_marker + ' ' + s, True]); pending_marker = None
            continue
        if m:
            cur.append([m.group(1) + ' ' + m.group(2), True])
            continue
        if cur:
            prev, is_item = cur[-1]
            if is_item:
                # continuation of a bullet only if next starts lowercase or prev clearly unfinished
                if s[0].islower() or CONT_END.search(prev):
                    cur[-1][0] = join(prev, s)
                else:
                    cur.append([s, False])
            else:
                cur[-1][0] = join(prev, s)
        else:
            cur.append([s, False])
    if cur:
        paras.append(cur)
    text = '\n\n'.join('\n'.join(x[0] for x in p) for p in paras)
    text = re.sub(r'\n\n(?=[a-z]\) )', '\n', text)
    text = re.sub(r'(\n[a-z]\) [^\n]*)\n\n(?=[1-9]\. )', r'\1\n', text)
    text = re.sub(r'[ \t]{2,}', '  ', text)
    text = re.sub(r'  ', ' ', text)
    return text.strip()

def join(a, b):
    if a.endswith('-'):
        return a + b
    return a + ' ' + b

def build(parts, L):
    lines = []
    for p in parts:
        if isinstance(p, str):
            lines += [p, '']
        else:
            lines += raw(L, *p) + ['']
    return clean(lines)

# ======================= 2025-26 spec (line numbers in cb2526.txt) =======================
S = {}  # name -> (desc_parts, prereq_parts or None, note or None); notes are documentation only, not output
def add(names, desc, prereq=None, note=None):
    if isinstance(names, str): names = [names]
    for n in names:
        S[n] = (desc, prereq, note)

# ---------- ELL ----------
add('English Language Development 8/9', [(794, 794), (795, 798)])
add('EFP Literary Studies 10 & Writing 10 (Language Adapted)', [(801, 801), (802, 807)])
add('Language & Cultural Literacy 10/11/12', [(810, 810), (811, 813)])
add('Academic Writing 11', [(816, 816), (817, 826)])
add('Literary Studies 11 (Language Adapted)', [(829, 829), (830, 835)])
# ---------- ADST 8 ----------
add('Applied Design, Skills & Technology 8 (ADST 8)', [(121, 123)])
add('Entrepreneurship & Marketing 8', [(945, 949)])
add('Entrepreneurship & Marketing 10', [(952, 960)])
add('Accounting 11', [(963, 983)])
add('Marketing & Promotion 11', [(986, 1003)])
add('Accounting 12', [(1015, 1034)], [(1014, 1014)])
add('E-Commerce 12', ['This course satisfies the Applied Skills requirement for graduation.', (1038, 1049)],
    ['Recommended Prerequisite: Marketing 11.'])
add('Economics 12', [(1052, 1078)])
add('Textiles 8', [(1089, 1092)])
add('Food Studies 9', [(1095, 1098)])
add('Textiles 9', [(1101, 1104)])
add('Food Studies 11', [(1107, 1112)])
add('Textiles 11', [(1115, 1124)])
add('Food Studies 12', [(1126, 1130)])
add('Textiles 12', [(1133, 1142)])
add('Computers & Communication Devices 8', [(1165, 1183)])
add('Computer Studies 10', [(1186, 1195)])
add('Computer Information Systems 11', ['This course satisfies the Applied Skills graduation requirement.', (1200, 1206)],
    ['Recommended Prerequisite: Grade 11 standing or permission from the instructor if a Grade 10 student who took CSTU10.'])
add('Computer Information Systems 12', [(1219, 1226)], [(1217, 1218)])
add('AP Computer Science Principles 12', [(1231, 1247)], [(1229, 1230)])
add('AP Computer Science A 12', [(1253, 1265)], [(1250, 1251)])
add('Computer Programming 12', [(1268, 1285), (1292, 1292), (1293, 1295), (1296, 1296), (1297, 1298)], [(1287, 1290)],
    note='Book lists this as "Computer Programming 12 - Cyber Security and Artificial Intelligence" (district blended course).')
add('Woodwork 8', [(1303, 1317)])
add('Woodwork 10', [(1320, 1331)])
add('Woodwork 11', [(1334, 1360)])
add('Drafting 11', [(1363, 1382)])
add('Woodwork 12', [(1385, 1415)])
add('Drafting 12', [(1418, 1445)])
# ---------- Career ----------
add('Career Education 8', [(1449, 1451)])
add('Career Education 9', [(1454, 1456)])
add('Career Life Education 10', [(1459, 1474)])
add('Career Life Education 10 (Blended)', [(1477, 1478)])
add('Career Life Connections 12A', [(1481, 1484), (1487, 1490)])
add('Career Life Connections 12B', [(1481, 1484), (1497, 1502)])
add(['Work Experience 12A', 'Work Experience 12B'], [(1506, 1537), (1540, 1545)])
add('Senior Mentorship 12', [(1568, 1577)])
add('Self-Efficacy 10/11/12', [(1580, 1587)])
# ---------- English ----------
add(['English 8', 'English 9'], [(1595, 1598)],
    note='Book gives one combined "English Language Arts 8 & 9" description.')
add('EFP Literary Studies 10 & Writing 10', [(1611, 1625)])
add('Pre-AP EFP Literary Studies & Writing 10', [(1628, 1637)])
add('Literary Studies 11', [(1640, 1645)])
add('Pre-AP Literary Studies 11', [(1648, 1652)])
add('AP Capstone Seminar 11', [(1655, 1688)])
add('English First Peoples 12', [(1696, 1704)])
add('English Studies 12', [(1707, 1711)])
add(['AP English Language & Composition 12', 'AP English Literature & Composition 12'], [(1715, 1723)],
    note='Book describes AP English Language and AP English Literature together.')
add('AP Capstone Research 12', [(1769, 1807)])
add('Creative Writing 12', [(1811, 1825)])
# ---------- French Immersion ----------
add('Français langue 8', [(1833, 1843)])
add('Français langue 9', [(1882, 1889)])
add('Éducation au choix de carrière et de vie 10', [(1927, 1944)])
add('Langue et culture de la francophonie 11', [(1980, 1984)])
add('Explorations en sciences humaines et sociales 11', [(1975, 1977)])
add('Études du droit 12', [(1987, 2011)])
add('AP French Language & Culture 12', [(2025, 2030)])
# ---------- Math ----------
add(['Mathematics 8', 'Mathématiques 8'], [(2111, 2112)])
add('Mathematics 8 Enriched', [(2115, 2119)])
add(['Mathematics 9', 'Mathématiques 9'], [(2122, 2123)])
add('Mathematics 9 Enriched', [(2126, 2129)])
add('Workplace Mathematics 10', [(2132, 2134)])
add('Foundations of Mathematics & Pre-Calculus 10 (Skill Development)', [(2137, 2140)])
add('Foundations of Mathematics & Pre-Calculus 10', [(2143, 2145)])
add('Pre-AP Foundations of Mathematics & Pre-Calculus 10', [(2148, 2150)])
add('Workplace Mathematics 11', [(2159, 2161)])
add('Foundations of Mathematics 11', [(2164, 2167)])
add('Pre-Calculus 11', [(2170, 2172)])
add('Pre-AP Pre-Calculus 11', [(2175, 2178)])
add('AP Statistics 12', [(2183, 2191)], [(2181, 2182)])
add('Apprenticeship Mathematics 12', [(2194, 2196)])
add('Foundations of Mathematics 12', [(2199, 2202)])
add('Pre-Calculus 12', [(2206, 2211)], [(2205, 2205)])
add('Pre-Calculus 12 Honours', [(2223, 2225)], [(2222, 2222)])
add('Calculus 12', [(2230, 2231)], [(2228, 2229)])
add('AP Calculus AB 12', [(2235, 2251)], [(2234, 2234)])
add('AP Calculus BC 12', [(2254, 2257)])
# ---------- Languages ----------
add('Introductory Farsi 11', [(2356, 2363)])
add(['French 8', 'French 9'], [(2377, 2379)], note='Book gives one combined French 8 / French 9 description.')
add('French 10', [(2382, 2384)])
add('French 11', [(2387, 2388)])
add('French 12', [(2391, 2394)])
add('Introductory Japanese 11', [(2399, 2403)])
add('Japanese 11', [(2406, 2407)])
add('Japanese 12', [(2410, 2412)])
add('AP Japanese Language & Culture 12', [(2421, 2425)])
add('Introductory Mandarin 11', [(2430, 2434)])
add('Mandarin 11', [(2437, 2438)])
add('Mandarin 12', [(2441, 2442)])
add('AP Chinese Language & Culture 12', [(2445, 2450)])
add('Spanish 9', [(2467, 2469)])
add('Spanish 10', [(2472, 2481)])
add('Introductory Spanish 11', [(2484, 2491)])
add('Spanish 11', [(2494, 2498)])
add('Spanish 12', [(2501, 2506)])
# ---------- PE ----------
add(['Physical & Health Education 8', 'Physical & Health Education 9', 'Physical & Health Education 10'], [(2559, 2573)],
    note='Book gives one combined PHE 8/9/10 description.')
add('Physical Education 10: Girls Fitness', [(2586, 2604), (2632, 2634)])
add('Fitness & Conditioning 11 (Girls)', [(2637, 2659)], note='Book heading: "Fitness and Conditioning 11/12: Girls".')
add(['Active Living 11', 'Active Living 12'], [(2662, 2679)], note='Book heading: "Senior PE - Active Living 11 & 12".')
add(['Fitness & Conditioning 11', 'Fitness & Conditioning 12'], [(2682, 2705)])
# ---------- Science ----------
add(['Science 8', 'Sciences 8'], [(2729, 2737)])
add(['Science 9', 'Sciences 9'], [(2741, 2750)])
add(['Science 10', 'Sciences 10'], [(2760, 2768)])
add('Chemistry 11', [(2771, 2789)], [(2770, 2770)])
add('AP Chemistry 11', [(2793, 2797)], [(2792, 2792)])
add('Earth Science 11', [(2801, 2807)], [(2800, 2800)])
add('Life Sciences 11', [(2810, 2819)])
add('AP Life Sciences 11', [(2824, 2841)], [(2822, 2823)])
add('Physics 11', [(2845, 2861)], [(2844, 2844)])
add('AP Physics 1 Honours 11', [(2865, 2869), (2875, 2876)], [(2864, 2864)],
    note='From the combined "Advanced Placement Physics 11 and 12" entry (AP Physics 11 paragraph).')
add('AP Physics 2 Honours 12', [(2865, 2865), (2871, 2876)], [(2864, 2864)],
    note='From the combined "Advanced Placement Physics 11 and 12" entry (AP Physics 12 paragraph).')
add('Anatomy & Physiology 12', [(2879, 2892)])
add('AP Biology 12', [(2895, 2919)], note='Book heading: "AP Biology 12 & Anatomy & Physiology 12 - Blended Learning".')
add('Chemistry 12', [(2923, 2937)], [(2922, 2922)])
add('AP Chemistry 12', [(2942, 2948)], [(2940, 2941)], note='Book heading: "AP Chemistry 12 & Chemistry 12 - Blended Learning".')
add('Geology 12', [(2952, 2958)], [(2951, 2951)])
add('Physics 12', [(2963, 2985)], [(2962, 2962)])
add('AP Psychology 12', [(2996, 3008)])
# ---------- Social Studies ----------
add(['Social Studies 8', 'Sciences humaines 8'], [(3091, 3105)])
add(['Social Studies 9', 'Sciences humaines 9'], [(3108, 3124)])
add(['Social Studies 10', 'Sciences humaines 10'], [(3127, 3134)])
add('20th Century World History 12', [(3166, 3171)], [(3163, 3165)])
add('BC First Peoples 12', [(3173, 3178)])
add('Comparative Cultures 12', [(3181, 3185)])
add('Economic Theory 12', [(3188, 3205)])
add('Genocide Studies 12', [(3208, 3215)])
add('Human Geography 12', [(3223, 3228)])
add('Law Studies 12', [(3231, 3255)])
add('Philosophy 12', [(3258, 3267)])
add('Social Justice 12', [(3270, 3283)])
# ---------- Dance / Drama ----------
add('Dance 9', [(3299, 3302)])
add('Dance Technique & Performance 10', [(3305, 3309)])
add(['Dance Technique & Performance 11', 'Dance Technique & Performance 12'], [(3312, 3317)])
add('Drama 8', [(3337, 3344)])
add('Drama 9', [(3373, 3383)])
add('Drama 10', [(3386, 3394)])
add('Drama 11', [(3397, 3404)])
add('Drama 12', [(3407, 3416)])
add(['Directing & Script Development 11', 'Directing & Script Development 12'], [(3421, 3425)], [(3419, 3420)])
add('Theatre Production 10', [(3436, 3443)])
add(['Theatre Production 11', 'Theatre Production 12'], [(3448, 3456)], [(3447, 3447)])
add('Theatre Company 9', [(3459, 3464)])
add(['Theatre Company 10', 'Theatre Company 11', 'Theatre Company 12'], [(3469, 3486)])
# ---------- Music ----------
add('Music 8', [(3497, 3508)])
BAND_NOTE = ('Book lists the Grade 9/10 course with only the line "Satisfies the Arts Education graduation requirement."; '
             'the ensemble description shown is the one printed directly below it for the Grade 11/12 course.')
add(['Concert Band 9', 'Concert Band 10'], [(3512, 3512), (3517, 3522)], note=BAND_NOTE)
add(['Concert Band 11', 'Concert Band 12'], [(3515, 3515), (3517, 3522)], [(3516, 3516)])
add(['Jazz Band 9', 'Jazz Band 10'], [(3526, 3526), (3532, 3538)], note=BAND_NOTE)
add(['Jazz Stage Band 11', 'Jazz Stage Band 12'], [(3529, 3529), (3532, 3538)], [(3530, 3531)])
add(['Orchestra 9', 'Orchestra 10', 'Orchestral Strings 9', 'Orchestral Strings 10'], [(3558, 3558), (3564, 3570)], note=BAND_NOTE)
add(['Orchestral Strings 11', 'Orchestral Strings 12'], [(3561, 3561), (3564, 3570)], [(3562, 3563)])
add('Composition & Production 11', [(3573, 3588)])
# ---------- Visual Arts ----------
add('Arts Education 8: Visual Arts', [(3621, 3625)])
add('Arts Education 8: Ceramics & Sculpture', [(3628, 3633)])
add('Arts Education 8: Media Arts', [(3636, 3650)])
add('Arts Education 9', [(3653, 3659)])
add('Media Arts 9', [(3662, 3670)], note='Book heading: "ADST: Media Arts 9" (text describes it as Photography 9).')
add('Arts Education 9: Ceramics & Sculpture', [(3673, 3679)])
add('Studio Arts 2-D 11', [(3684, 3690)])
add('Photography 11', [(3693, 3703)])
add('Studio Arts 3-D 11', [(3711, 3718)])
add('Art Studio 11 (AP Art 11)', [(3722, 3730)], ['Recommended Prerequisite: Art 9'])
add('Studio Arts 2-D 12', [(3736, 3741)], [(3735, 3735)])
add('Photography 12', [(3745, 3752)], [(3744, 3744)])
add('Studio Arts 3-D 12', [(3756, 3763)], [(3755, 3755)])
add('AP Drawing 12', [(3794, 3799)], [(3793, 3793)],
    note='Book heading: "AP Studio Art Drawing 12 and Independent Directed Studies Art Foundations 12".')
add('AP 2-D Art & Design 12', [(3803, 3803), (3805, 3810)], [(3804, 3804)],
    note='Book heading: "AP 2-D Design Portfolio 12 and Independent Directed Studies Art Foundations 12". '
         'A second variant (with Independent Directed Studies Photography 12, prerequisite Photography 12) is also listed.')
add(['AP 3-D Art & Design 12', 'Ceramics 12'], [(3827, 3839)], [(3826, 3826)],
    note='Book heading: "AP 3-D Design Portfolio 12 and Independent Directed Studies Ceramics 12".')
add(['Media Arts 10: Yearbook', 'Media Arts 11: Yearbook'], [(3844, 3848)])
add('Study Block', [(3852, 3874)])

ACAD_SRC = 'https://westvancouverschools.ca/academies/'
ACAD = {
 'Badminton Academy': ("West Vancouver Schools Premier Badminton Academy offers cohorts for students at both the recreational and competitive level who are passionate about the sport and are interested in developing their game.\n\n"
                       "The Premier Badminton Academy is a multi-year specialty program that takes place from September to June and offers badminton specific physical and technical training by excellent instructional staff.", 'badminton'),
 'Baseball Academy': ("West Vancouver Schools offers one of the most comprehensive baseball programs in the lower mainland. Student-athletes maximize their health and sport performance under the guidance of outstanding former professional baseball players, National Team athletes, and elite performance coaches while mapping the best pathway for post secondary/scholarship opportunities.\n\n"
                      "The Premier Baseball Academy is a multi-year specialty program in which students develop their individual skills and tactical game play while having fun with like-minded peers.", 'baseball'),
 'Basketball Academy': ("This is a multi year specialty program aimed at developing students’ knowledge, skills, and abilities in the sport of basketball.\n\n"
                        "The Premier Basketball Academy consists of two cohorts – Development and Regional Training Center (RTC). The Development cohort is designed for younger players (typically in Grades 8 and 9) who are keen to improve on the basic fundamentals of the game, while gaining a better understanding of team strategies and tactics. The RTC pathway provides a high performance training opportunity for older students who wish to acquire the knowledge, skills, rules and strategies necessary to play at an elite level of basketball.", 'basketball'),
 'Fencing Academy': ("West Vancouver Schools Premier Fencing Academy is the only one of its kind in British Columbia. Launched in 2015, our Head Coach and High Performance Director for the Canadian Fencing Federation, Igor Gantsevich, welcomes students in Grades 8 to 12 who are registered full time at Rockridge, Ecole Sentinel, or West Vancouver Secondary.\n\n"
                     "The Premier Fencing Academy is a multi-year specialty program that provides formal fencing training within the academic setting to allow for achievement and excellence in sport and education.", 'fencing'),
 'Field Hockey Academy': ("West Vancouver Schools is committed to offering students excellent training in the sport of field hockey, the second largest team sport in the world. It is played in 100 countries and offers a lifetime of enjoyment while participating and making social connections.\n\n"
                          "The Academy is a multi-year specialty program that is open to student-athletes of all skill levels with the intention of providing the best possible field hockey experience. All development training sessions take place during the school day.", 'field-hockey'),
 'Mechatronics Robotics Academy': ("The Premier Mechatronics Robotics Academy is an example of West Vancouver Schools commitment to facilitating increased student opportunities in STEM (Science, Technology, Engineering, Math) education in a creative, exciting and competitive environment.\n\n"
                                   "This program offers students the opportunity to explore their potential in Competitive Robotics utilizing STEM (Science, Technology, Engineering, Math) skills in a practical and hands-on environment.\n\n"
                                   "Students work in a variety of roles to research, design, build, program and test robots, ultimately competing in robotics competitions, locally, provincially, and internationally.", 'mechatronics-robotics'),
 'Soccer Academy': ("The West Vancouver Schools Premier Soccer Academy is a quality program that offer students the opportunity to complete their academic coursework and participate in soccer skill-development all during school hours, 1:40 to 3:00pm. By partaking in the Academy, students receive credit for Physical and Health Education: Soccer Academy.\n\n"
                    "The WVS Premier Soccer Academy is a multi-year specialty program designed for the student-athlete who wants to develop their individual skills and tactical game play in a fun and supportive environment, during school hours.", 'soccer'),
 'Tennis Academy': ("The Premier Tennis Academy offers an outstanding training environment for students who want to advance their skill level and tactical game play, while having fun with their peers.\n\n"
                    "The Premier Tennis Academy is a multi year specialty program which provides tennis training in the morning, prior to school start – a schedule that enables students to develop their tennis skills while maintaining academic excellence. This program is supplementary to the existing programs run by various tennis clubs.", 'tennis'),
 'Volleyball Academy': ("The Volleyball Academy is multi-year specialty program designed for students who are interested in developing their skill level and advancing their game play in a fun and inclusive environment.", 'volleyball-academy'),
}


# ======================= 2026-27 spec (line numbers in cb2627.txt) =======================
# Catalog names -> 2026-27 handbook sections. Renamed-but-same courses are mapped here too:
#   Pre-AP Foundations of Mathematics & Pre-Calculus 10 -> "Foundations of Mathematics & Pre-Calculus 10 Enriched"
#   Fitness & Conditioning 11/12                        -> "Strength and Power 11 & 12 (Co-Ed)"
#   Career Life Education 10 (Blended)                  -> combined "Career Life Education 10/Career Life Education 10 (Blended)"
# Grade changes (Woodwork 10 -> 9, Entrepreneurship & Marketing 10 -> 9, Computer Studies 10 -> ICT 9) are treated as
# dropped + new, since the grade (and course code) differs.
S27 = {}
def add27(names, desc, prereq=None):
    if isinstance(names, str): names = [names]
    for n in names:
        S27[n] = (desc, prereq)

# ELL
add27('English Language Development 8/9', [(522, 522), (523, 526)])
add27('EFP Literary Studies 10 & Writing 10 (Language Adapted)', [(529, 529), (530, 535)])
add27('Language & Cultural Literacy 10/11/12', [(538, 538), (539, 541)])
add27('Academic Writing 11', [(544, 544), (545, 550)])
add27('Literary Studies 11 (Language Adapted)', [(553, 553), (554, 559)])
# ADST / Business / Home Ec / IT / Tech Ed
add27('Applied Design, Skills & Technology 8 (ADST 8)', [(121, 122)])
add27('Accounting 11', [(665, 685)])
add27('Marketing & Promotion 11', [(695, 712)])
add27('Accounting 12', ['This course satisfies the Applied Skills requirement for graduation.', (716, 735)],
      ['Recommended Prerequisite: Accounting 11.'])
add27('E-Commerce 12', ['This course satisfies the Applied Skills requirement for graduation.', (739, 750)],
      ['Recommended Prerequisite: Marketing 11.'])
add27('Economics 12', [(753, 771)])
add27('Textiles 8', [(777, 780)])
add27('Food Studies 9', [(783, 787)])
add27('Textiles 9', [(790, 794)])
add27('Food Studies 11', [(797, 802)])
add27('Textiles 11', [(805, 814)])
add27('Food Studies 12', [(816, 821)])
add27('Textiles 12', [(835, 844)])
add27('Computers & Communication Devices 8', [(859, 877)])
add27('Computer Information Systems 11', [(895, 901)])
add27('Computer Information Systems 12', [(915, 921)], [(912, 913)])
add27('AP Computer Science Principles 12', [(924, 924), (928, 943)], [(925, 926)])
add27('AP Computer Science A 12', [(946, 946), (950, 963)], [(947, 948)])
add27('Woodwork 8', [(968, 982)])
add27('Woodwork 11', [(1000, 1023)])
add27('Drafting 11', [(1032, 1052)])
add27('Woodwork 12', [(1055, 1086)])
add27('Drafting 12', [(1089, 1112)])
# Career / Leadership
add27('Career Education 8', [(1119, 1121)])
add27('Career Education 9', [(1124, 1126)])
add27(['Career Life Education 10', 'Career Life Education 10 (Blended)'], [(1129, 1137)])
add27('Career Life Connections 12A', [(1140, 1142), (1145, 1147)])
add27('Career Life Connections 12B', [(1140, 1142), (1150, 1152)])
add27(['Work Experience 12A', 'Work Experience 12B'], [(1154, 1160)])
add27('Senior Mentorship 12', [(1177, 1186)])
add27('Self-Efficacy 10/11/12', [(1189, 1196)])
# English
add27(['English 8', 'English 9'], [(1200, 1203)])
add27('EFP Literary Studies 10 & Writing 10', [(1207, 1221)])
add27('Pre-AP EFP Literary Studies & Writing 10', [(1229, 1238)])
add27('Literary Studies 11', [(1241, 1246)])
add27('Pre-AP Literary Studies 11', [(1249, 1253)])
add27('AP Capstone Seminar 11', [(1256, 1286)])
add27('English First Peoples 12', [(1298, 1306)])
add27('English Studies 12', [(1309, 1313)])
add27(['AP English Language & Composition 12', 'AP English Literature & Composition 12'], [(1317, 1325)])
add27('AP Capstone Research 12', [(1368, 1401)])
add27('Creative Writing 12', [(1404, 1418)])
# French Immersion
add27('Français langue 8', [(1432, 1442)])
add27('Français langue 9', [(1477, 1484)])
add27('Éducation au choix de carrière et de vie 10', [(1528, 1541)])
add27('Explorations en sciences humaines et sociales 11', [(1577, 1583)])   # FI-section version (updated text)
add27('Langue et culture de la francophonie 11', [(1586, 1591)])
add27('Études du droit 12', [(1594, 1618)])
add27('AP French Language & Culture 12', [(1642, 1646)])
# Math
add27(['Mathematics 8', 'Mathématiques 8'], [(1673, 1674)])
add27('Mathematics 8 Enriched', [(1677, 1680)])
add27(['Mathematics 9', 'Mathématiques 9'], [(1683, 1684)])
add27('Mathematics 9 Enriched', [(1687, 1690)])
add27('Workplace Mathematics 10', [(1693, 1696)])
add27('Foundations of Mathematics & Pre-Calculus 10', [(1699, 1701)])
add27('Pre-AP Foundations of Mathematics & Pre-Calculus 10', [(1704, 1706)])   # renamed "...10 Enriched"
add27('Workplace Mathematics 11', [(1709, 1712)])
add27('Foundations of Mathematics 11', [(1715, 1717)])
add27('Pre-Calculus 11', [(1720, 1722)])
add27('Pre-AP Pre-Calculus 11', [(1725, 1734)])
add27('AP Statistics 12', [(1737, 1737), (1740, 1747)], [(1738, 1739)])
add27('Apprenticeship Mathematics 12', [(1749, 1751)])
add27('Foundations of Mathematics 12', [(1754, 1756)])
add27('Pre-Calculus 12', [(1760, 1765)], [(1759, 1759)])
add27('Calculus 12', [(1770, 1771)], [(1768, 1769)])
add27('AP Calculus AB 12', [(1775, 1775), (1777, 1792)], [(1774, 1774)])
# Languages
add27(['French 8', 'French 9'], [(1900, 1902)])
add27('French 10', [(1905, 1908)])
add27('French 11', [(1911, 1912)])
add27('French 12', [(1915, 1918)])
add27('Introductory Japanese 11', [(1923, 1927)])
add27('Japanese 11', [(1930, 1931)])
add27('Japanese 12', [(1934, 1936)])
add27('AP Japanese Language & Culture 12', [(1939, 1943)])
add27('Introductory Mandarin 11', [(1954, 1958)])
add27('Mandarin 11', [(1961, 1962)])
add27('Mandarin 12', [(1965, 1966)])
add27('AP Chinese Language & Culture 12', [(1969, 1974)])
add27('Spanish 9', [(1991, 1993)])
add27('Spanish 10', [(1996, 2000)])
add27('Introductory Spanish 11', [(2003, 2016)])
add27('Spanish 11', [(2019, 2023)])
add27('Spanish 12', [(2026, 2031)])
# PE
add27(['Physical & Health Education 8', 'Physical & Health Education 9', 'Physical & Health Education 10'], [(2038, 2052)])
add27('Physical Education 10: Girls Fitness', [(2074, 2098)])
add27('Fitness & Conditioning 11 (Girls)', [(2101, 2117)])
add27(['Active Living 11', 'Active Living 12'], [(2120, 2138)])
add27(['Fitness & Conditioning 11', 'Fitness & Conditioning 12'], [(2141, 2157)])   # renamed "Strength and Power 11 & 12"
# Science
add27(['Science 8', 'Sciences 8'], [(2183, 2191)])
add27(['Science 9', 'Sciences 9'], [(2195, 2204)])
add27(['Science 10', 'Sciences 10'], [(2214, 2222)])
add27('Chemistry 11', [(2224, 2242)])
add27('AP Chemistry 11', [(2245, 2245), (2247, 2251)], [(2246, 2246)])
add27('Earth Science 11', [(2254, 2269)])
add27('Life Sciences 11', [(2272, 2285)])
add27('AP Life Sciences 11', [(2295, 2309)])
add27('Physics 11', [(2313, 2329)], [(2312, 2312)])
add27('AP Physics 1 Honours 11', [(2333, 2337), (2344, 2344)], [(2332, 2332)])
add27('AP Physics 2 Honours 12', [(2333, 2333), (2339, 2342), (2344, 2344)], [(2332, 2332)])
add27('Anatomy & Physiology 12', ['This course requires a strong foundation and understanding of scientific vocabulary.', (2350, 2358)],
      ['Recommended pre-requisite: Life Sciences 11 and/or Chemistry 11.'])
add27('AP Biology 12', [(2369, 2369),
                        'Priority will be given to those students who have successfully completed AP Life Sciences 11. '
                        'This course requires a strong foundation and understanding of scientific vocabulary.',
                        (2373, 2388)],
      ['Recommended pre-requisite: AP Life Sciences 11 and/or AP Chemistry 11.'])
add27('Chemistry 12', [(2392, 2405)], [(2391, 2391)])
add27('AP Chemistry 12', [(2408, 2408), (2411, 2416)], [(2409, 2410)])
add27('Geology 12', [(2419, 2436)], [(2418, 2418)])
add27('Physics 12', [(2444, 2466)])
add27('AP Psychology 12', [(2469, 2480)])
# Social Studies
add27(['Social Studies 8', 'Sciences humaines 8'], [(2562, 2576)])
add27(['Social Studies 9', 'Sciences humaines 9'], [(2579, 2595)])
add27(['Social Studies 10', 'Sciences humaines 10'], [(2598, 2605)])
add27('20th Century World History 12', [(2629, 2634)], [(2626, 2628)])
add27('BC First Peoples 12', [(2636, 2641)])
add27('Comparative Cultures 12', [(2644, 2648)])
add27('Economic Theory 12', [(2651, 2668)])
add27('Genocide Studies 12', [(2671, 2678)])
add27('Human Geography 12', [(2686, 2691)])
add27('Law Studies 12', [(2694, 2718)])
add27('Philosophy 12', [(2721, 2729)])
add27('Social Justice 12', [(2733, 2745)])
# Dance / Drama
add27('Dance 9', [(2766, 2769)])
add27('Dance Technique & Performance 10', [(2772, 2775)])
add27(['Dance Technique & Performance 11', 'Dance Technique & Performance 12'], [(2778, 2782)])
add27('Drama 8', [(2802, 2809)])
add27('Drama 9', [(2841, 2852)])
add27('Drama 10', [(2855, 2863)])
add27('Drama 11', [(2866, 2873)])
add27('Drama 12', [(2876, 2885)])
add27(['Directing & Script Development 11', 'Directing & Script Development 12'], [(2888, 2888), (2891, 2895)], [(2889, 2890)])
add27('Theatre Production 10', [(2904, 2911)])
add27(['Theatre Production 11', 'Theatre Production 12'], [(2916, 2924)], [(2915, 2915)])
add27('Theatre Company 9', [(2927, 2932)])
add27(['Theatre Company 10', 'Theatre Company 11', 'Theatre Company 12'], [(2937, 2955)])
# Music (Grade 9/10 entries carry only the "Satisfies..." line; ensemble text is the 11/12 entry printed below it)
add27('Music 8', [(2966, 2977)])
add27(['Concert Band 9', 'Concert Band 10'], [(2981, 2981), (2986, 2991)])
add27(['Concert Band 11', 'Concert Band 12'], [(2984, 2984), (2986, 2991)], [(2985, 2985)])
add27(['Jazz Band 9', 'Jazz Band 10'], [(2995, 2995), (3001, 3007)])
add27(['Jazz Stage Band 11', 'Jazz Stage Band 12'], [(2998, 2998), (3001, 3007)], [(2999, 3000)])
add27(['Orchestra 9', 'Orchestra 10', 'Orchestral Strings 9', 'Orchestral Strings 10'], [(3028, 3028), (3034, 3040)])
add27(['Orchestral Strings 11', 'Orchestral Strings 12'], [(3031, 3031), (3034, 3040)], [(3032, 3033)])
add27('Composition & Production 11', [(3043, 3059)])
# Visual Arts
add27('Arts Education 8: Visual Arts', [(3092, 3096)])
add27('Arts Education 8: Ceramics & Sculpture', [(3099, 3104)])
add27('Arts Education 8: Media Arts', [(3107, 3115)])
add27('Arts Education 9', [(3124, 3131)])
add27('Media Arts 9', [(3134, 3142)])
add27('Arts Education 9: Ceramics & Sculpture', [(3145, 3152)])
add27('Studio Arts 2-D 11', [(3157, 3164)])
add27('Photography 11', [(3167, 3184)])
add27('Studio Arts 3-D 11', [(3187, 3195)])
add27('Art Studio 11 (AP Art 11)', [(3199, 3208)], ['Recommended Prerequisite: Art 9'])
add27('Studio Arts 2-D 12', [(3213, 3213), (3215, 3220)], [(3214, 3214)])
add27('Photography 12', [(3223, 3223), (3225, 3232)], [(3224, 3224)])
add27('Studio Arts 3-D 12', [(3235, 3235), (3237, 3254)], [(3236, 3236)])
add27('AP Drawing 12', [(3276, 3276), (3278, 3282)], [(3277, 3277)])
add27('AP 2-D Art & Design 12', [(3285, 3286), (3288, 3292)], [(3287, 3287)])
add27('AP 3-D Art & Design 12', [(3313, 3313), (3316, 3321)], [(3314, 3314)])
add27(['Media Arts 10: Yearbook', 'Media Arts 11: Yearbook'], [(3324, 3328)])
add27('Study Block', [(3332, 3354)])

# ---------- In the 2026-27 handbook but not in catalog.json ----------
N27 = {}
def addnew(names, desc, prereq=None):
    if isinstance(names, str): names = [names]
    for n in names:
        N27[n] = (desc, prereq)

addnew('Entrepreneurship & Marketing 9', [(656, 662)])                     # ADST: ENTREPRENEURSHIP AND MARKETING 9
addnew('Computer Studies 9', [(880, 888)])                                 # ADST: INFORMATION AND COMMUNICATIONS TECHNOLOGY 9 (listed as "Computer Studies 9")
addnew('Data Science, Python & AI 11', [(904, 909)])                       # COMPUTER PROGRAMMING 11 – Data Science, Python & AI
addnew('Woodwork 9', [(985, 997)])                                         # ADST: WOODWORK 9
addnew('Youth Work in Trades', [(1162, 1173)])
addnew('Français langue 10', [(1544, 1549)])
addnew('Français langue seconde-immersion 12', [(1621, 1629)])
addnew('Physical Education 10: Strength & Power', [(2055, 2071)])         # PE 10: STRENGTH & POWER (Co-Ed)
addnew(['R&B Band 11', 'R&B Band 12'], [(3010, 3017)])                     # INSTR. MUSIC 11,12: JAZZ SENTINEL R&B BAND
addnew('Composition & Production 12', [(3043, 3059)])                      # COMPOSITION AND PRODUCTION 11/12
addnew('Media Arts 12: Yearbook', [(3324, 3328)])                           # VISUAL ARTS: MEDIA ARTS 10-12 YEARBOOK

# ======================= output =======================
URL25 = 'https://westvancouverschools.ca/ecole-sentinel-secondary/wp-content/uploads/sites/8/2025/01/2025-2026-Course-Book-Final.pdf'
URL27 = 'https://westvancouverschools.ca/ecole-sentinel-secondary/wp-content/uploads/sites/8/2026/05/2026-2027-Course-Handbook_Updated-Fees-May-21_2026.pdf'

def entry(desc, prereq, L, year):
    e = {'desc': build(desc, L)}
    if prereq:
        e['prereq'] = build(prereq, L)
    e['year'] = year
    return e

allnames = CAT['COURSES'] + CAT['ACADEMIES']
for n in list(S27) + list(S):
    assert n in allnames, n
for n in N27:
    assert n not in allnames, n

courses, unmatched, dropped = {}, [], []
n27 = n25 = nacad = 0
for n in allnames:
    if n in S27:
        courses[n] = entry(*S27[n], L27, '2026-27'); n27 += 1
    elif n in S:
        d, p, _note = S[n]
        courses[n] = entry(d, p, L25, '2025-26'); n25 += 1
        dropped.append(n)
    elif n in ACAD:
        txt, slug = ACAD[n]
        courses[n] = {'desc': txt, 'year': '2026-27', 'source': f'https://westvancouverschools.ca/academies/{slug}/'}
        nacad += 1
    else:
        unmatched.append(n)

new = {n: {k: v for k, v in entry(d, p, L27, '2026-27').items() if k != 'year'} for n, (d, p) in N27.items()}

json.dump({
    'source': [URL27, URL25, ACAD_SRC],
    'courses': courses,
    'unmatched': unmatched,
}, open('descriptions.json', 'w'), ensure_ascii=False, indent=2)
json.dump(new, open('new-2627.json', 'w'), ensure_ascii=False, indent=2)
json.dump({'source': URL27, 'dropped': dropped}, open('dropped-2627.json', 'w'), ensure_ascii=False, indent=2)

print(f'2026-27: {n27} courses + {nacad} academies (district site); 2025-26: {n25}; new: {len(new)}; unmatched: {len(unmatched)}')
print('dropped:', dropped)
print('unmatched:', unmatched)
