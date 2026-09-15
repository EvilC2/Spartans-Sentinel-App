// Spartans — the header every screen renders. Wires Chrome's <Header/> to the
// profile (avatar) and the app's navigation (bell → Buzz, avatar → Me).
// Sub-screens pass `title` + `back` to get a back button instead of the brand.

import React from 'react';
import { Header } from './Chrome';
import { useProfile, initials } from '../ProfileContext';
import { useNav } from '../nav';

export const AppHeader = ({ topInset, title, back }: { topInset: number; title?: string; back?: boolean }) => {
  const { profile } = useProfile();
  const nav = useNav();
  return (
    <Header
      topInset={topInset}
      initials={profile ? initials(profile) : '?'}
      photoUri={profile?.photoUri}
      unread
      onBell={() => nav.go('buzz')}
      onProfile={() => nav.go('me')}
      title={title}
      onBack={back ? nav.back : undefined}
    />
  );
};
