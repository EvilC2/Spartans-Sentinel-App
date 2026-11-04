// Spartans — map art. Fluent Emoji 3D (MIT, github.com/microsoft/fluentui-emoji),
// same look as the caf menu and the Programs icons. Files in assets/map.
// PLACES is the "Places" row on the Map screen: the spots people ask for most,
// each a target id from data.ts.

import type { ImageSourcePropType } from 'react-native';

export const MAP_ART = {
  map: require('../../assets/map/map.png'),
  pin: require('../../assets/map/pin.png'),
  flag: require('../../assets/map/flag.png'),
  school: require('../../assets/map/school.png'),
  door: require('../../assets/map/door.png'),
  walk: require('../../assets/map/walk.png'),
  elevator: require('../../assets/map/elevator.png'),
  stepfree: require('../../assets/map/stepfree.png'),
  office: require('../../assets/map/office.png'),
  books: require('../../assets/map/books.png'),
  plate: require('../../assets/map/plate.png'),
  gym: require('../../assets/map/gym.png'),
  speech: require('../../assets/map/speech.png'),
  theatre: require('../../assets/map/theatre.png'),
  nurse: require('../../assets/map/nurse.png'),
  stadium: require('../../assets/map/stadium.png'),
  toilet: require('../../assets/map/toilet.png'),
} satisfies Record<string, ImageSourcePropType>;

export const PLACES: { id: string; label: string; art: ImageSourcePropType }[] = [
  { id: 'main-office', label: 'Office', art: MAP_ART.office },
  { id: 'library', label: 'Library', art: MAP_ART.books },
  { id: 'cafeteria', label: 'Caf', art: MAP_ART.plate },
  { id: 'gym', label: 'Gym', art: MAP_ART.gym },
  { id: 'counselling', label: 'Counselling', art: MAP_ART.speech },
  { id: 'theatre', label: 'Theatre', art: MAP_ART.theatre },
  { id: 'nurse', label: 'Nurse', art: MAP_ART.nurse },
  { id: 'field', label: 'Field', art: MAP_ART.stadium },
];
