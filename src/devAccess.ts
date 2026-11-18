// Spartans — who gets the dev tools: the app's owner, and nobody else.
// "Owner" is the account holding the server-issued `owner` role, read from
// the real roles in useProfile(). Never use the "View as" roles for this (the
// owner viewing as a student must keep the way back), and never isOwner / isTop
// from ranks.ts (they also match President and Teacher Sponsor).
// Anything a developer runs from their own machine (__DEV__) counts too.

import { useProfile } from './ProfileContext';

export const useDevAccess = () => {
  const { roles } = useProfile();
  return __DEV__ || roles.includes('owner');
};
