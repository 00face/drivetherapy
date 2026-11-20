/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-115] Cross-OS & Linux Window Manager Native Decoration Resolver
 * Ensures proper native window decorations across Linux (Wayland & X11: GNOME/Mutter,
 * KDE/KWin, Cinnamon/Muffin, XFCE/Xfwm4, Hyprland, Sway, i3, Awesome, Openbox),
 * Windows (DWM + Snap Layouts), and macOS (Aqua).
 */

export interface WindowDecorationConfig {
  frame: boolean;
  titleBarStyle: 'default' | 'hidden' | 'hiddenInset';
  autoHideMenuBar: boolean;
  minWidth: number;
  minHeight: number;
  backgroundColor: string;
  isWayland: boolean;
  isTilingWm: boolean;
  desktopEnvironment: string;
  chromiumSwitches: Array<[string, string?]>;
}

const TILING_WM_TOKENS = [
  'hyprland',
  'sway',
  'i3',
  'bspwm',
  'awesome',
  'dwm',
  'qtile',
  'xmonad',
  'herbstluftwm',
  'river',
  'niri',
];

export function resolveWindowDecorationConfig(
  platform: NodeJS.Platform | string,
  env: Record<string, string | undefined> = {},
  shouldUseDarkColors = true
): WindowDecorationConfig {
  const xdgSession = (env.XDG_SESSION_TYPE || '').toLowerCase();
  const waylandDisplay = (env.WAYLAND_DISPLAY || '').trim();
  const rawDesktop = (env.XDG_CURRENT_DESKTOP || env.DESKTOP_SESSION || env.WINDOWMANAGER || '').toLowerCase();

  const isLinux = platform === 'linux';
  const isWayland = isLinux && (xdgSession === 'wayland' || Boolean(waylandDisplay));
  const isTilingWm = isLinux && TILING_WM_TOKENS.some((wm) => rawDesktop.includes(wm));

  const chromiumSwitches: Array<[string, string?]> = [];
  if (isLinux) {
    chromiumSwitches.push(['ozone-platform-hint', 'auto']);
    chromiumSwitches.push(['enable-features', 'WaylandWindowDecorations,UseOzonePlatform']);
  }

  return {
    // Always use native OS / WM decorations so every DE, X11 SSD, Wayland SSD/CSD,
    // tiling WM, Windows DWM, and macOS Aqua renders authentic controls cleanly.
    frame: true,
    titleBarStyle: 'default',
    autoHideMenuBar: isLinux || platform === 'win32',
    // Allow narrow splits on Linux tiling window managers (i3, Sway, Hyprland, etc.)
    minWidth: isTilingWm ? 360 : 760,
    minHeight: isTilingWm ? 540 : 600,
    backgroundColor: shouldUseDarkColors ? '#0f172a' : '#f8fafc',
    isWayland,
    isTilingWm,
    desktopEnvironment: rawDesktop || (platform === 'darwin' ? 'macos-aqua' : platform === 'win32' ? 'windows-dwm' : 'linux-generic'),
    chromiumSwitches,
  };
}
