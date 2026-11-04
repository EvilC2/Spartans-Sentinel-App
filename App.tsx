// Spartans — functioning app shell.
// Six tabs (Home, Programs, Calendar, Announcements, Social, More) plus
// sub-screens reached from More, the header, Quick links or a program row
// (Contacts, Homework, Me, Day view, Program). The Buzz lives on Home only. Theme
// (light/dark) lives in ThemeContext and persists to AsyncStorage. The student
// profile (from the sign-up flow) lives in ProfileContext; until one exists the
// shell shows OnboardingScreen instead.
//
// The web build's `.app-frame` (max-width 430, centred, shadowed on desktop)
// is kept so tablets and the web target still show the phone-width column.

import React, { useEffect, useState } from 'react';
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
import { PinsProvider, GradesProvider, EventsProvider, HomeworkProvider } from './src/stores';
import { ClassSheetProvider } from './src/components/ClassCard';
import { NavProvider, useNav } from './src/nav';
import { FriendsProvider } from './src/social';
import { NotifyProvider } from './src/notify/NotifyProvider';
import { ContentProvider } from './src/content';
import { FRAME_MAX_WIDTH, shadow } from './src/theme';
import { TabBar, TabId } from './src/components/Chrome';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import HomeworkScreen from './src/screens/HomeworkScreen';
import AnnouncementsScreen from './src/screens/NewsScreen';
import ProgramsScreen from './src/screens/ProgramsScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import MoreScreen from './src/screens/MoreScreen';
import SocialScreen from './src/screens/SocialScreen';
import MapScreen from './src/screens/MapScreen';
import LunchScreen from './src/screens/LunchScreen';
import AdminScreen from './src/screens/AdminScreen';
import OnboardingScreen, { ProfileEditor, EditWhat } from './src/screens/OnboardingScreen';
import { LoadingSplash } from './src/components/SplashHero';

export type ScreenProps = {
  onNavigate: (t: TabId) => void;
  topInset: number;
  onEdit: (what: EditWhat) => void;   // Settings → Edit profile / Edit classes
};

// The loading splash stays up at least this long, even if the profile loads sooner.
const SPLASH_MIN_MS = 2000;

function Shell() {
  const { c, mode } = useTheme();
  const { profile, loaded: profileLoaded, signedIn } = useProfile();
  const [splashHeld, setSplashHeld] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setSplashHeld(false), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);
  const loaded = profileLoaded && !splashHeld;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const nav = useNav();
  const tab = nav.tab;
  const [editing, setEditing] = useState<EditWhat | null>(null);

  const wide = width > 500;
  const screenProps: ScreenProps = {
    onNavigate: nav.go, topInset: insets.top, onEdit: setEditing,
  };

  const showIntro = loaded && (!profile || !signedIn);

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
        {!loaded && <LoadingSplash />}

        {showIntro && (
          <OnboardingScreen
            topInset={insets.top}
            onDone={() => { setEditing(null); nav.go('home'); }}
          />
        )}

        {/* Settings editors cover the tabs; Save or Cancel returns to where you were. */}
        {!showIntro && editing && (
          <ProfileEditor
            what={editing}
            topInset={insets.top}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}

        {loaded && profile && signedIn && !editing && (
          <>
            {tab === 'home' && <HomeScreen {...screenProps} />}
            {tab === 'programs' && <ProgramsScreen {...screenProps} />}
            {tab === 'announcements' && <AnnouncementsScreen {...screenProps} />}
            {tab === 'calendar' && <CalendarScreen {...screenProps} />}
            {tab === 'social' && <SocialScreen {...screenProps} />}
            {tab === 'more' && <MoreScreen {...screenProps} />}
            {tab === 'homework' && <HomeworkScreen {...screenProps} />}
            {tab === 'contacts' && <ContactsScreen {...screenProps} />}
            {tab === 'lunch' && <LunchScreen {...screenProps} />}
            {tab === 'me' && <ProfileScreen {...screenProps} />}
            {tab === 'map' && <MapScreen {...screenProps} />}
            {tab === 'admin' && <AdminScreen {...screenProps} />}
            <TabBar active={tab} onNavigate={nav.go} bottomInset={insets.bottom} />
          </>
        )}
      </View>
    </View>
  );
}

export default function App() {
  // Bumped after an account is deleted: remounts every store below the
  // profile so nothing from the old account stays in memory.
  const [epoch, setEpoch] = useState(0);
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ProfileProvider onReset={() => setEpoch(e => e + 1)}>
          <PreviewTimeProvider key={epoch}>
            <ContentProvider>
            <PinsProvider>
              <GradesProvider>
                <HomeworkProvider>
                  <EventsProvider>
                    <NavProvider>
                      <ClassSheetProvider>
                        <FriendsProvider>
                          <NotifyProvider>
                            <Shell />
                          </NotifyProvider>
                        </FriendsProvider>
                      </ClassSheetProvider>
                    </NavProvider>
                  </EventsProvider>
                </HomeworkProvider>
              </GradesProvider>
            </PinsProvider>
            </ContentProvider>
          </PreviewTimeProvider>
        </ProfileProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
