// Spartans — functioning app shell.
// Five tabs (Home, Buzz, Calendar, Social, More) plus sub-screens reached from
// More, the header or Quick links (Contacts, Homework, Me, Day view). Theme
// (light/dark) lives in ThemeContext and persists to AsyncStorage. The student
// profile (from the sign-up flow) lives in ProfileContext; until one exists the
// shell shows OnboardingScreen instead.
//
// The web build's `.app-frame` (max-width 430, centred, shadowed on desktop)
// is kept so tablets and the web target still show the phone-width column.

import React, { useState } from 'react';
import { View, StatusBar, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} from '@expo-google-fonts/newsreader';

import { ThemeProvider, useTheme } from './src/ThemeContext';
import { ProfileProvider, useProfile } from './src/ProfileContext';
import { PreviewTimeProvider } from './src/PreviewTime';
import { PinsProvider, GradesProvider, EventsProvider } from './src/stores';
import { ClassSheetProvider } from './src/components/ClassCard';
import { NavProvider, useNav } from './src/nav';
import { FRAME_MAX_WIDTH, shadow } from './src/theme';
import { TabBar, TabId } from './src/components/Chrome';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import HomeworkScreen from './src/screens/HomeworkScreen';
import BuzzScreen from './src/screens/NewsScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MoreScreen from './src/screens/MoreScreen';
import SocialScreen from './src/screens/SocialScreen';
import DayViewScreen from './src/screens/DayViewScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';

export type ScreenProps = {
  onNavigate: (t: TabId) => void;
  topInset: number;
  onEditProfile: () => void;
};

function Shell() {
  const { c, mode } = useTheme();
  const { profile, loaded, signedIn } = useProfile();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const nav = useNav();
  const tab = nav.tab;
  const [editing, setEditing] = useState(false);

  const wide = width > 500;
  const screenProps: ScreenProps = {
    onNavigate: nav.go, topInset: insets.top, onEditProfile: () => setEditing(true),
  };

  const showIntro = loaded && (!profile || !signedIn || editing);

  return (
    <View style={{
      flex: 1,
      backgroundColor: wide ? c.backdrop : c.paper,
      alignItems: 'center',
    }}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <View style={[{
        flex: 1,
        width: '100%',
        maxWidth: FRAME_MAX_WIDTH,
        backgroundColor: c.paper,
        overflow: 'hidden',
      }, wide ? shadow.lg : shadow.none]}>
        {!loaded && null}

        {showIntro && (
          <OnboardingScreen
            initial={editing ? profile : null}
            topInset={insets.top}
            onDone={() => { setEditing(false); nav.go('home'); }}
            onCancel={editing ? () => setEditing(false) : undefined}
          />
        )}

        {loaded && profile && signedIn && !editing && (
          <>
            {tab === 'home' && <HomeScreen {...screenProps} />}
            {(tab === 'buzz' || tab === 'news') && <BuzzScreen {...screenProps} />}
            {tab === 'calendar' && <CalendarScreen {...screenProps} />}
            {tab === 'social' && <SocialScreen {...screenProps} />}
            {tab === 'more' && <MoreScreen {...screenProps} />}
            {tab === 'homework' && <HomeworkScreen {...screenProps} />}
            {tab === 'contacts' && <ContactsScreen {...screenProps} />}
            {tab === 'dayview' && <DayViewScreen {...screenProps} />}
            {tab === 'me' && <ProfileScreen {...screenProps} />}
            <TabBar active={tab} onNavigate={nav.go} bottomInset={insets.bottom} />
          </>
        )}
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ProfileProvider>
          <PreviewTimeProvider>
            <PinsProvider>
              <GradesProvider>
                <EventsProvider>
                  <NavProvider>
                    <ClassSheetProvider>
                      <Shell />
                    </ClassSheetProvider>
                  </NavProvider>
                </EventsProvider>
              </GradesProvider>
            </PinsProvider>
          </PreviewTimeProvider>
        </ProfileProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
