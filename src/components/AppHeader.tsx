// Spartans — the header every screen renders. Wires Chrome's <Header/> to the
// profile (avatar), the notification centre (bell, with the unread count) and
// the app's navigation (avatar → Me, App Club bubble → App Club, which shows
// the join page to anyone not on a team yet).
// Every screen passes its `title` (shown right of the brand) and, if it keeps
// a tally, `count` (shown right of the title). Sub-screens add `back`, which
// takes the brand's place; `onBack` overrides where it goes. `club` replaces
// the App Club bubble.

import React from 'react';
import { Header } from './Chrome';
import { useProfile, initials } from '../ProfileContext';
import { useNav } from '../nav';
import { useNotify } from '../notify/context';

export const AppHeader = ({ topInset, title, count, back, onBack, club }: {
  topInset: number; title?: string; count?: React.ReactNode; back?: boolean; onBack?: () => void; club?: React.ReactNode;
}) => {
  const { profile } = useProfile();
  const nav = useNav();
  const notify = useNotify();
  return (
    <Header
      topInset={topInset}
      initials={profile ? initials(profile) : '?'}
      photoUri={profile?.photoUri}
      unread={notify.unread}
      onBell={notify.openCenter}
      onClub={() => nav.go('admin')}
      onProfile={() => nav.go('me')}
      title={title}
      count={count}
      onBack={onBack || (back ? nav.back : undefined)}
      club={club}
    />
  );
};
