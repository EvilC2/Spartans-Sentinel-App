// Spartans — the notification system's context, on its own so screens can
// read it without importing the provider (and its overlays).

import { createContext, useContext } from 'react';
import type { Notice } from './feed';
import type { EventDay } from './eventDays';
import type { PermissionState } from './push';

export type Ctx = {
  notices: Notice[];
  unread: number;
  isRead: (n: Notice) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (ids: string[]) => void;     // take these off the list
  restore: (ids: string[]) => void;     // undo that
  open: (n: Notice) => void;            // tap on a row
  centerOpen: boolean;
  openCenter: () => void;
  closeCenter: () => void;
  permission: PermissionState;
  requestPermission: () => Promise<void>;
  today: EventDay[];                     // today's banners, most important first
  showBanner: (day: EventDay) => void;
  now: number;
};

export const NotifyCtx = createContext<Ctx | null>(null);

export const useNotify = () => {
  const v = useContext(NotifyCtx);
  if (!v) throw new Error('useNotify needs NotifyProvider');
  return v;
};
