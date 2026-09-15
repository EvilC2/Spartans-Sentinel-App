// Sentinel — minimal icon set, all stroke-based for a calm Apple feel.
// Ported from icons.jsx: same 24×24 viewBox, same path data. `currentColor`
// has no equivalent in RN, so colour is an explicit prop instead.

import React from 'react';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';
import { StyleProp, ViewStyle } from 'react-native';

export type IconName =
  | 'home' | 'calendar' | 'news' | 'grid' | 'me' | 'bell'
  | 'chev-r' | 'chev-l' | 'chev-d' | 'plus' | 'search' | 'pin' | 'close'
  | 'clock' | 'whistle' | 'book' | 'fork' | 'compass' | 'phone' | 'map'
  | 'sparkle' | 'tasks' | 'contacts' | 'play' | 'mail' | 'copy'
  | 'sun' | 'moon' | 'cloud' | 'cloud-sun' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'
  | 'camera' | 'scan' | 'qr' | 'image' | 'flash' | 'id' | 'badge' | 'share' | 'download' | 'more' | 'message'
  | 'helmet' | 'users' | 'shield' | 'chart' | 'grad' | 'week' | 'check-circle' | 'edit' | 'trash' | 'check';

type Props = {
  name: IconName | string;
  size?: number;
  stroke?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export const Icon = ({ name, size = 22, stroke = 1.6, color = '#000', style }: Props) => {
  const p = {
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const body = (() => {
    switch (name) {
      case 'home':
        return (<><Path {...p} d="M3.5 11.2 12 4l8.5 7.2" /><Path {...p} d="M5.5 10v9.5h13V10" /></>);
      case 'calendar':
        return (<><Rect {...p} x={3.5} y={5} width={17} height={15} rx={3} /><Path {...p} d="M3.5 9.5h17M8 3v4M16 3v4" /></>);
      case 'news':
        return (<><Rect {...p} x={3} y={5} width={18} height={14} rx={2.5} /><Path {...p} d="M7 9h10M7 12h10M7 15h6" /></>);
      case 'grid':
        return (<>
          <Rect {...p} x={4} y={4} width={7} height={7} rx={1.6} />
          <Rect {...p} x={13} y={4} width={7} height={7} rx={1.6} />
          <Rect {...p} x={4} y={13} width={7} height={7} rx={1.6} />
          <Rect {...p} x={13} y={13} width={7} height={7} rx={1.6} />
        </>);
      case 'me':
        return (<><Circle {...p} cx={12} cy={9} r={3.5} /><Path {...p} d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" /></>);
      case 'bell':
        return (<><Path {...p} d="M6 16V11a6 6 0 1 1 12 0v5l1.2 1.5H4.8z" /><Path {...p} d="M10.5 20a1.6 1.6 0 0 0 3 0" /></>);
      case 'chev-r': return <Path {...p} d="M9 5l7 7-7 7" />;
      case 'chev-l': return <Path {...p} d="M15 5l-7 7 7 7" />;
      case 'chev-d': return <Path {...p} d="M5 9l7 7 7-7" />;
      case 'plus':   return <Path {...p} d="M12 5v14M5 12h14" />;
      case 'search':
        return (<><Circle {...p} cx={11} cy={11} r={6} /><Path {...p} d="m20 20-4.3-4.3" /></>);
      case 'pin':
        return <Path {...p} d="M9 4h6l-1 5 3 3v2h-5v6l-1 1-1-1v-6H5v-2l3-3z" />;
      case 'close':  return <Path {...p} d="M6 6l12 12M18 6 6 18" />;
      case 'badge':
        return (<><Path {...p} d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" /><Path {...p} d="M12 8.2l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" /></>);
      case 'share':
        return (<><Path {...p} d="M12 3v12" /><Path {...p} d="M8 7l4-4 4 4" /><Path {...p} d="M5 12v7.5h14V12" /></>);
      case 'download':
        return (<><Path {...p} d="M12 3v12" /><Path {...p} d="M8 11l4 4 4-4" /><Path {...p} d="M5 14v5.5h14V14" /></>);
      case 'more':
        return (<><Circle {...p} cx={6} cy={12} r={1.2} /><Circle {...p} cx={12} cy={12} r={1.2} /><Circle {...p} cx={18} cy={12} r={1.2} /></>);
      case 'message':
        return <Path {...p} d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5z" />;
      case 'clock':
        return (<><Circle {...p} cx={12} cy={12} r={8} /><Path {...p} d="M12 7.5V12l3 2" /></>);
      case 'whistle':
        return (<>
          <Circle {...p} cx={9} cy={13} r={5} />
          <Path {...p} d="M13.2 10 22 7v3l-8 3.5" />
          <Path {...p} d="M9 8V5h5" />
        </>);
      case 'book':
        return (<>
          <Path {...p} d="M5 5h6a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H5z" />
          <Path {...p} d="M19 5h-6a3 3 0 0 0-3 3v12a3 3 0 0 1 3-3h6z" />
        </>);
      case 'fork':
        return (<>
          <Path {...p} d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11" />
          <Path {...p} d="M17 3c-1.5 0-3 1-3 4v4h3v10" />
        </>);
      case 'compass':
        return (<><Circle {...p} cx={12} cy={12} r={8.5} /><Path {...p} d="M15.5 8.5 13 13l-4.5 2.5L11 11z" /></>);
      case 'phone':
        return <Path {...p} d="M5 4h3l2 5-2.2 1.3a11 11 0 0 0 5.9 5.9L15 14l5 2v3a2 2 0 0 1-2 2A14 14 0 0 1 4 7a2 2 0 0 1 1-3z" />;
      case 'map':
        return (<><Path {...p} d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><Path {...p} d="M9 4v14M15 6v14" /></>);
      case 'sparkle':
        return <Path {...p} d="M12 4v6m0 4v6M4 12h6m4 0h6M7 7l3 3M14 14l3 3M17 7l-3 3M10 14l-3 3" />;
      case 'tasks':
        return (<>
          <Rect {...p} x={4} y={4} width={16} height={16} rx={3} />
          <Path {...p} d="M8 12.5l2.5 2.5L16 9.5" />
        </>);
      case 'contacts':
        return (<>
          <Rect {...p} x={5} y={3.5} width={15} height={17} rx={2.5} />
          <Path {...p} d="M3 8h2M3 12h2M3 16h2" />
          <Circle {...p} cx={12.5} cy={10} r={2.3} />
          <Path {...p} d="M9 16.5c.7-2 2-3 3.5-3s2.8 1 3.5 3" />
        </>);
      case 'play':   return <Path {...p} d="M8 5.5v13l10-6.5z" />;
      case 'mail':
        return (<><Rect {...p} x={3} y={5.5} width={18} height={13} rx={2.5} /><Path {...p} d="M3.5 7.5 12 13l8.5-5.5" /></>);
      case 'copy':
        return (<><Rect {...p} x={8} y={8} width={12} height={12} rx={2} /><Path {...p} d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>);
      case 'sun':
        return (<><Circle {...p} cx={12} cy={12} r={4} /><Path {...p} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>);
      case 'moon':   return <Path {...p} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />;
      case 'cloud':  return <Path {...p} d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5 4.25 4.25 0 0 1 17.5 18z" />;
      case 'cloud-sun':
        return (<>
          <Path {...p} d="M9 19a3.5 3.5 0 0 1-.4-6.98A4.8 4.8 0 0 1 17.8 11.5 3.75 3.75 0 0 1 18 19z" />
          <Path {...p} d="M6 10.5a4 4 0 0 1 6.5-3.2M4 5l1 1M9.5 2.5v1.5M3 9.5h1.5M14 4l-1 1" />
        </>);
      case 'fog':
        return (<><Path {...p} d="M7 13a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 6.5 3.75 3.75 0 0 1 17.5 13z" /><Path {...p} d="M5 17h14M7 20.5h10" /></>);
      case 'drizzle':
        return (<><Path {...p} d="M7 15a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 6.5 3.75 3.75 0 0 1 17.5 15z" /><Path {...p} d="M9 18v1.5M13 18v1.5M17 18v1.5" /></>);
      case 'rain':
        return (<><Path {...p} d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 5.5 3.75 3.75 0 0 1 17.5 14z" /><Path {...p} d="M9 17l-1 3M13 17l-1 3M17 17l-1 3" /></>);
      case 'snow':
        return (<><Path {...p} d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 5.5 3.75 3.75 0 0 1 17.5 14z" /><Path {...p} d="M9 18v2M12 17.5v3M15 18v2M7.7 19h2.6M10.7 19h2.6M13.7 19h2.6" /></>);
      case 'storm':
        return (<><Path {...p} d="M7 13a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 4.5 3.75 3.75 0 0 1 17.5 13z" /><Path {...p} d="M13 12l-2.5 4.5H14L11.5 21" /></>);
      case 'camera':
        return (<><Path {...p} d="M4 8.5A2 2 0 0 1 6 6.5h2.2l1.3-2h5l1.3 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><Circle {...p} cx={12} cy={12.5} r={3.2} /></>);
      case 'scan':
        return (<><Path {...p} d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><Path {...p} d="M7 12h10" /></>);
      case 'qr':
        return (<><Rect {...p} x={4} y={4} width={6} height={6} rx={1} /><Rect {...p} x={14} y={4} width={6} height={6} rx={1} /><Rect {...p} x={4} y={14} width={6} height={6} rx={1} /><Path {...p} d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" /></>);
      case 'image':
        return (<><Rect {...p} x={4} y={5} width={16} height={14} rx={2.5} /><Circle {...p} cx={9} cy={10} r={1.6} /><Path {...p} d="M4.5 17l5-4.5 3.5 3 2.5-2 4.5 3.5" /></>);
      case 'flash':
        return <Path {...p} d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />;
      case 'id':
        return (<><Rect {...p} x={3} y={5.5} width={18} height={13} rx={2.5} /><Circle {...p} cx={8.5} cy={11} r={2} /><Path {...p} d="M6 15.5c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8M14 10h4M14 13.5h4" /></>);
      // Spartan helmet — placeholder brand mark until the real Spartans logo lands.
      case 'helmet':
        return (<>
          <Path {...p} d="M6 13V9.5A6 6 0 0 1 18 9.5V13l-1.5 5.5H7.5z" />
          <Path {...p} d="M12 3.5c-2 0-3.5 1.2-3.5 3V9h7V6.5c0-1.8-1.5-3-3.5-3z" />
          <Path {...p} d="M9 13h6M10.5 13v4M13.5 13v4" />
        </>);
      case 'users':
        return (<>
          <Circle {...p} cx={9} cy={9} r={3.2} />
          <Path {...p} d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5" />
          <Path {...p} d="M15.5 6.5a3 3 0 0 1 0 5.6M17 14.6c2 .5 3.2 1.9 3.8 4.4" />
        </>);
      case 'shield':
        return (<><Path {...p} d="M12 3.5 5 6v5.5c0 4 2.8 7.3 7 9 4.2-1.7 7-5 7-9V6z" /><Path {...p} d="M9.2 12.2l2 2 3.8-4" /></>);
      case 'chart':
        return (<><Path {...p} d="M4 19.5h16" /><Path {...p} d="M7 16v-5M12 16V7M17 16v-3" /></>);
      case 'grad':
        return (<><Path {...p} d="M2.5 9.5 12 5l9.5 4.5L12 14z" /><Path {...p} d="M6.5 11.5V16c1.5 1.6 3.3 2.4 5.5 2.4s4-.8 5.5-2.4v-4.5M21.5 9.5V15" /></>);
      case 'week':
        return (<><Rect {...p} x={3.5} y={5} width={17} height={15} rx={3} /><Path {...p} d="M3.5 9.5h17M8.5 9.5v10.5M15.5 9.5v10.5" /></>);
      case 'check':   return <Path {...p} d="M5 12.5l4.5 4.5L19 7" />;
      case 'check-circle':
        return (<><Circle {...p} cx={12} cy={12} r={8.5} /><Path {...p} d="M8.5 12.2l2.4 2.4 4.6-5" /></>);
      case 'edit':
        return (<><Path {...p} d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z" /><Path {...p} d="M13.5 7.5l3 3" /></>);
      case 'trash':
        return (<><Path {...p} d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 12h8.4L17 7" /><Path {...p} d="M10.3 10.5v6M13.7 10.5v6" /></>);
      default:
        return null;
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <G>{body}</G>
    </Svg>
  );
};

// Apple Messages app glyph: green squircle with a white speech bubble. Used
// on the badge share row so the tile reads as "send in Messages".
export const MessagesGlyph = ({ size = 62 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Rect x={0} y={0} width={64} height={64} rx={15} fill="#34C759" />
    <Rect x={0} y={0} width={64} height={32} rx={15} fill="#5FE068" opacity={0.55} />
    <Path fill="#FFFFFF" d="M32 12c-12.7 0-23 8.6-23 19.2 0 5.6 2.9 10.6 7.5 14.1-.3 2.6-1.4 5.3-3.4 7.6 3.9-.3 7.4-1.8 10.1-3.9 2.7.9 5.7 1.4 8.8 1.4 12.7 0 23-8.6 23-19.2S44.7 12 32 12z" />
  </Svg>
);

// The small white check used by the admin badge and homework checkboxes.
export const Check = ({ size = 12, color = '#fff', width = 3.5 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 12l5 5L20 7"
    />
  </Svg>
);

// Filled weather glyph from home-bits.jsx (CloudIcon).
export const CloudIcon = ({ size = 14, color = 'rgba(255,255,255,0.7)' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" opacity={0.85}>
    <Path fill={color} d="M7 18a5 5 0 0 1-.6-9.95A6 6 0 0 1 18 9.5 4.5 4.5 0 0 1 17.5 18z" />
  </Svg>
);
