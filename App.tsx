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

import React, { useEffect, useRef, useState } from 'react';
import { View, StatusBar, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import CatchUpScreen from './src/screens/CatchUpScreen';
import { useCatchUpPractice, endCatchUpPractice } from './src/catchUpPractice';
import { LoadingSplash } from './src/components/SplashHero';
import { WidgetSync } from './src/widgets/sync';
import { useDeepLinks } from './src/widgets/links';

export type ScreenProps = {
  onNavigate: (t: TabId) => void;
  topInset: number;
  onEdit: (what: EditWhat) => void;   // Settings → Edit profile / Edit classes
};

// The loading splash stays up at least this long, even if the profile loads sooner.
const SPLASH_MIN_MS = 2000;
// Catch Up opens by itself once, the first time. After "Not now" it waits on
// a card at the top of the Badges page until it's done. ("spartans-" so
// Delete account clears it.)
const CATCH_UP_ASKED_KEY = 'spartans-catchup-asked-v1';

function Shell() {
  const { c, mode } = useTheme();
  const { profile, loaded: profileLoaded, signedIn, catchUpOpen, openCatchUp, closeCatchUp } = useProfile();
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

  // Catch Up is optional: it asks once (at first launch or right after a new
  // account), then lives on the Badges page until it's finished.
  const catchUpDue = loaded && !!profile && signedIn && !profile.catchUp?.doneAt;
  useEffect(() => {
    if (!catchUpDue) return;
    let gone = false;
    AsyncStorage.getItem(CATCH_UP_ASKED_KEY).then(v => {
      if (gone || v) return;
      AsyncStorage.setItem(CATCH_UP_ASKED_KEY, '1').catch(() => {});
      openCatchUp();
    }).catch(() => {});
    return () => { gone = true; };
  }, [catchUpDue]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Practice runs (Developer screen) open over everything and save nothing.
  const practice = useCatchUpPractice();
  const showCatchUp = loaded && !!profile && signedIn && (catchUpOpen || !!practice);
  const inApp = loaded && !!profile && signedIn;

  // Widget and Live Activity taps (spartans://homework …) open that page.
  useDeepLinks(nav.go, inApp);

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
        {inApp && <WidgetSync />}

        {showIntro && (
          <OnboardingScreen
            topInset={insets.top}
            onDone={() => { setEditing(null); nav.go('home'); }}
          />
        )}

        {/* Settings editors cover the tabs; Save or Cancel returns to where you were. */}
        {showCatchUp && (
          <CatchUpScreen
            key={practice ? `practice-${practice.grade}` : 'real'}
            practice={practice}
            topInset={insets.top} bottomInset={insets.bottom}
            onClose={practice ? endCatchUpPractice : closeCatchUp}
          />
        )}

        {!showIntro && !showCatchUp && editing && (
          <ProfileEditor
            what={editing}
            topInset={insets.top}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}

        {loaded && profile && signedIn && !editing && !showCatchUp && (
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
