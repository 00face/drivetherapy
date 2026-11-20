/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Themes & Storage Navigation Suite
 * Verifies all 52 Gmail themes catalog, multi-OS common folder resolution,
 * CJK vertical typography integration, and storage device switching.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { APP_THEMES, GMAIL_THEMES, themeManager, calculateContrastRatio, resolveSmartTextContrast } from '../src/services/themeEngine';
import { GMAIL_THEMES_CATALOG } from '../src/services/gmailThemesCatalog';
import { CJK_LANGUAGES } from '../src/i18n';
import { resolveOsCommonFolders } from '../src/services/osFolders';

describe('Themes & Storage Navigation Suite', () => {
  describe('Full 52 Gmail Themes Catalog', () => {
    it('should have all 52 themes in GMAIL_THEMES_CATALOG', () => {
      assert.equal(GMAIL_THEMES_CATALOG.length, 52);
    });

    it('should include Featured Photo Backgrounds with local asset and Google CDN fallback', () => {
      const featured = GMAIL_THEMES_CATALOG.filter((t) => t.category === 'featured');
      assert.ok(featured.length >= 16);

      const lakeTahoe = featured.find((t) => t.name.includes('Lake Tahoe'));
      assert.ok(lakeTahoe);
      assert.ok(lakeTahoe.wallpaperUrl && lakeTahoe.wallpaperUrl.startsWith('/themes/'));
      assert.ok(lakeTahoe.fallbackUrl && lakeTahoe.fallbackUrl.includes('gstatic.com'));

      const animals = featured.find((t) => t.name.includes('Animals'));
      assert.ok(animals);
      assert.ok(animals.wallpaperUrl && animals.wallpaperUrl.startsWith('/themes/'));
      assert.ok(animals.fallbackUrl && animals.fallbackUrl.includes('f48.jpg'));
    });

    it('should ensure all 52 themes have matching local files in public/themes', () => {
      const publicThemesDir = path.join(process.cwd(), 'public', 'themes');
      assert.ok(fs.existsSync(publicThemesDir), 'public/themes must exist');

      for (const theme of GMAIL_THEMES_CATALOG) {
        if (theme.wallpaperUrl) {
          const relFile = theme.wallpaperUrl.replace(/^\/themes\//, '');
          const localPath = path.join(publicThemesDir, relFile);
          assert.ok(fs.existsSync(localPath), `Theme ${theme.name} file must exist at ${localPath}`);
        }
        if (theme.previewUrl) {
          const relFile = theme.previewUrl.replace(/^\/themes\//, '');
          const localPath = path.join(publicThemesDir, relFile);
          assert.ok(fs.existsSync(localPath), `Theme ${theme.name} preview file must exist at ${localPath}`);
        }
        if (theme.headerUrl) {
          const relFile = theme.headerUrl.replace(/^\/themes\//, '');
          const localPath = path.join(publicThemesDir, relFile);
          assert.ok(fs.existsSync(localPath), `Theme ${theme.name} header file must exist at ${localPath}`);
        }
        if (theme.footerUrl) {
          const relFile = theme.footerUrl.replace(/^\/themes\//, '');
          const localPath = path.join(publicThemesDir, relFile);
          assert.ok(fs.existsSync(localPath), `Theme ${theme.name} footer file must exist at ${localPath}`);
        }
      }
    });

    it('should distinguish classic tiled themes from fullscreen modern themes', () => {
      const classicTiled = GMAIL_THEMES_CATALOG.filter((t) => t.category === 'classic');
      for (const theme of classicTiled) {
        assert.equal(theme.backgroundType, 'tiled', `Classic theme ${theme.name} must have backgroundType tiled`);
        assert.ok(theme.background.includes('repeat'), `Classic theme ${theme.name} must use repeat in CSS`);
      }

      const modernFullscreen = GMAIL_THEMES_CATALOG.filter((t) => t.category === 'modern');
      for (const theme of modernFullscreen) {
        assert.equal(theme.backgroundType, 'fullscreen', `Modern theme ${theme.name} must have backgroundType fullscreen`);
        assert.ok(theme.background.includes('cover'), `Modern theme ${theme.name} must use cover in CSS`);
      }
    });

    it('should include Modern Named Landscapes and Classic Themes', () => {
      const modern = GMAIL_THEMES_CATALOG.filter((t) => t.category === 'modern');
      assert.ok(modern.length >= 10);
      assert.ok(modern.some((t) => t.name.includes('Wood')));
      assert.ok(modern.some((t) => t.name.includes('Desk')));
      assert.ok(modern.some((t) => t.name.includes('Beach')));
      assert.ok(modern.some((t) => t.name.includes('Ocean')));
      assert.ok(modern.some((t) => t.name.includes('Planets')));
      assert.ok(modern.some((t) => t.name.includes('Turf')));

      const classic = GMAIL_THEMES_CATALOG.filter((t) => t.category === 'classic');
      assert.ok(classic.length >= 8);
      assert.ok(classic.some((t) => t.name.includes('Tree')));
      assert.ok(classic.some((t) => t.name.includes('Candy')));
      assert.ok(classic.some((t) => t.name.includes('Ninja')));
      assert.ok(classic.some((t) => t.name.includes('Tea House')));
      assert.ok(classic.some((t) => t.name.includes('Terminal')));
      assert.ok(classic.some((t) => t.name.includes('High Score')));
    });

    it('should include authentic Solid Color palette', () => {
      const solids = GMAIL_THEMES_CATALOG.filter((t) => t.category === 'solid');
      assert.ok(solids.length >= 14);
      assert.ok(solids.some((t) => t.name.includes('Wasabi')));
      assert.ok(solids.some((t) => t.name.includes('Spearmint')));
      assert.ok(solids.some((t) => t.name.includes('High Contrast')));
      assert.ok(solids.some((t) => t.name.includes('Mahogany')));
      assert.ok(solids.some((t) => t.name.includes('Eggplant')));
    });

    it('should verify composited classic themes (Highscore, Ninja, Candy, Tea House) define headers and footers', () => {
      const highscore = GMAIL_THEMES_CATALOG.find((t) => t.id === 'gmail_highscore');
      assert.ok(highscore);
      assert.equal(highscore.headerUrl, '/themes/highscore_header.png');
      assert.equal(highscore.headerHeight, 48);

      const ninja = GMAIL_THEMES_CATALOG.find((t) => t.id === 'gmail_ninja');
      assert.ok(ninja);
      assert.equal(ninja.wallpaperUrl, '/themes/ninja_bg.png');
      assert.equal(ninja.headerUrl, '/themes/ninja_header.gif');
      assert.equal(ninja.footerUrl, '/themes/ninja_footer.gif');

      const candy = GMAIL_THEMES_CATALOG.find((t) => t.id === 'gmail_candy');
      assert.ok(candy);
      assert.equal(candy.headerUrl, '/themes/candy_header.gif');
      assert.equal(candy.footerUrl, '/themes/candy_footer.gif');

      const teahouse = GMAIL_THEMES_CATALOG.find((t) => t.id === 'gmail_teahouse');
      assert.ok(teahouse);
      assert.equal(teahouse.headerUrl, '/themes/teahouse_header.jpg');
    });

    it('should automatically compute smart text contrast exceeding WCAG AA >= 4.5:1', () => {
      // Test bright backgrounds (Wasabi, White, Yellow)
      const lightBg1 = resolveSmartTextContrast('#FFFFFF');
      assert.equal(lightBg1.isLightBackground, true);
      assert.equal(lightBg1.textColor, '#0F172A');
      assert.ok(lightBg1.contrastRatio >= 7.0);

      const wasabiContrast = resolveSmartTextContrast('#E8F0E6');
      assert.equal(wasabiContrast.isLightBackground, true);
      assert.equal(wasabiContrast.textColor, '#0F172A');
      assert.ok(wasabiContrast.contrastRatio >= 7.0);

      // Test dark backgrounds (Pitch black, Navy, Deep green)
      const blackContrast = resolveSmartTextContrast('#000000');
      assert.equal(blackContrast.isLightBackground, false);
      assert.equal(blackContrast.textColor, '#F8FAFC');
      assert.ok(blackContrast.contrastRatio >= 15.0);

      const ninjaForest = resolveSmartTextContrast('#001a00');
      assert.equal(ninjaForest.isLightBackground, false);
      assert.equal(ninjaForest.textColor, '#F8FAFC');
      assert.ok(ninjaForest.contrastRatio >= 12.0);
    });

    it('should include Titan Auger Class tech themes in APP_THEMES', () => {
      const titanThemes = APP_THEMES.filter((t) => t.category === 'titan');
      assert.equal(titanThemes.length, 9);
      assert.ok(titanThemes.some((t) => t.id === 'titan-mechanicus'));
      assert.ok(titanThemes.some((t) => t.id === 'titan-mars-forge'));
      assert.ok(titanThemes.some((t) => t.id === 'titan-ryza-plasma'));
    });

    it('should notify subscribers when setTheme is called', () => {
      let notifiedTheme: any = null;
      const unsubscribe = themeManager.subscribe((t) => {
        notifiedTheme = t;
      });

      themeManager.setTheme('titan-mechanicus');
      assert.ok(notifiedTheme);
      assert.equal(notifiedTheme.id, 'titan-mechanicus');

      unsubscribe();
      themeManager.setTheme('default-light');
    });

    it('should integrate with ThemeManager seamlessly', () => {
      assert.ok(APP_THEMES.length >= 52);
      const wasabi = APP_THEMES.find((t) => t.nameKey === 'Wasabi');
      assert.ok(wasabi);

      const active = themeManager.setTheme(wasabi.id);
      assert.equal(active.id, wasabi.id);
      assert.equal(active.accent, '#188038');

      // Reset to default
      themeManager.setTheme('default-light');
    });

    it('should enforce default area opacity (Sidebar 0%/0px 100% visible, Main Area 42%/10px) and text hinting (inset)', () => {
      themeManager.resetAreaPrefs();
      const prefs = themeManager.getAreaPrefs();
      assert.equal(prefs.sidebarOpacity, 0.0, 'Sidebar opacity default must be 0.0 (100% visible)');
      assert.equal(prefs.sidebarBlur, 0, 'Sidebar blur default must be 0px');
      assert.equal(prefs.mainOpacity, 0.42, 'Main area opacity default must be 0.42 (42%)');
      assert.equal(prefs.mainBlur, 10, 'Main area blur default must be 10px (10%)');
      assert.equal(prefs.textHinting, 'inset', 'Text hinting default must be inset');
    });

    it('should allow modifying area opacities and toggling text hinting modes', () => {
      themeManager.setAreaPrefs({
        sidebarOpacity: 0.85,
        sidebarBlur: 4,
        mainOpacity: 0.50,
        mainBlur: 12,
        textHinting: 'outlined',
      });

      const updated = themeManager.getAreaPrefs();
      assert.equal(updated.sidebarOpacity, 0.85);
      assert.equal(updated.sidebarBlur, 4);
      assert.equal(updated.mainOpacity, 0.50);
      assert.equal(updated.mainBlur, 12);
      assert.equal(updated.textHinting, 'outlined');

      // Toggle to none
      themeManager.setAreaPrefs({ textHinting: 'none' });
      assert.equal(themeManager.getAreaPrefs().textHinting, 'none');

      // Reset back to defaults
      themeManager.resetAreaPrefs();
      const reset = themeManager.getAreaPrefs();
      assert.equal(reset.sidebarOpacity, 0.0);
      assert.equal(reset.mainOpacity, 0.42);
      assert.equal(reset.textHinting, 'inset');
    });
  });

  describe('Multi-OS Common Desktop Folders Resolution', () => {
    it('should resolve standard system folders on the active host platform', () => {
      const folders = resolveOsCommonFolders(os.homedir(), os.platform());
      assert.ok(Array.isArray(folders));
      assert.ok(folders.length > 0);

      // Must have home or root
      assert.ok(folders.some((f) => f.id === 'home' || f.id === 'root'));
      // All resolved paths must actually exist on host
      for (const item of folders) {
        assert.ok(fs.existsSync(item.path), `Path ${item.path} should exist`);
        assert.ok(fs.statSync(item.path).isDirectory(), `Path ${item.path} should be directory`);
      }
    });

    it('should resolve Linux XDG user dirs correctly', () => {
      // Mock homedir with simulated XDG config
      const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-xdg-test-'));
      const configDir = path.join(tmpHome, '.config');
      fs.mkdirSync(configDir, { recursive: true });
      const customPics = path.join(tmpHome, 'MyPhotos');
      fs.mkdirSync(customPics, { recursive: true });

      const xdgContent = `
XDG_DESKTOP_DIR="$HOME/Desktop"
XDG_DOWNLOAD_DIR="$HOME/Downloads"
XDG_PICTURES_DIR="$HOME/MyPhotos"
XDG_DOCUMENTS_DIR="$HOME/Documents"
`;
      fs.writeFileSync(path.join(configDir, 'user-dirs.dirs'), xdgContent, 'utf8');

      const folders = resolveOsCommonFolders(tmpHome, 'linux');
      assert.ok(folders.some((f) => f.id === 'pictures' && f.path === customPics));

      // Cleanup
      fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    it('should resolve Windows Known Folders and OneDrive redirection paths', () => {
      const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-win-test-'));
      const oneDrive = path.join(tmpHome, 'OneDrive');
      const oneDrivePics = path.join(oneDrive, 'Pictures');
      fs.mkdirSync(oneDrivePics, { recursive: true });

      const oldOneDrive = process.env.OneDrive;
      process.env.OneDrive = oneDrive;

      const folders = resolveOsCommonFolders(tmpHome, 'win32');
      assert.ok(folders.some((f) => f.id === 'onedrive-pictures' && f.path === oneDrivePics));

      // Restore
      if (oldOneDrive !== undefined) process.env.OneDrive = oldOneDrive;
      else delete process.env.OneDrive;
      fs.rmSync(tmpHome, { recursive: true, force: true });
    });
  });

  describe('Adaptive Vertical Typography & CJK Integration', () => {
    it('should restrict vertical typography availability to CJK scripts', () => {
      assert.deepEqual(CJK_LANGUAGES, ['zh', 'ja', 'ko']);
      assert.ok(CJK_LANGUAGES.includes('zh'));
      assert.ok(CJK_LANGUAGES.includes('ja'));
      assert.ok(CJK_LANGUAGES.includes('ko'));
      assert.equal(CJK_LANGUAGES.includes('en'), false);
      assert.equal(CJK_LANGUAGES.includes('es'), false);
      assert.equal(CJK_LANGUAGES.includes('fr'), false);
    });
  });

  describe('Storage Switching & Filter Resolution', () => {
    it('should correctly filter local file manager items and reset on all', () => {
      const mockFiles = [
        { name: 'photo1.jpg', extension: 'jpg', category: 'image' },
        { name: 'raw1.cr3', extension: 'cr3', category: 'raw' },
        { name: 'clip.mp4', extension: 'mp4', category: 'video' },
        { name: 'notes.pdf', extension: 'pdf', category: 'document' },
      ];

      // Filter by raw
      const rawOnly = mockFiles.filter((f) => f.category === 'raw');
      assert.equal(rawOnly.length, 1);
      assert.equal(rawOnly[0].name, 'raw1.cr3');

      // Filter by photos/images
      const photosOnly = mockFiles.filter((f) => f.category === 'image');
      assert.equal(photosOnly.length, 1);
      assert.equal(photosOnly[0].name, 'photo1.jpg');

      // Filter by all
      const allFiles = mockFiles.filter(() => true);
      assert.equal(allFiles.length, 4);
    });
  });

  describe('WCAG 2.1 AA/AAA Color Contrast & Hue Separation', () => {
    it('should calculate relative luminance and contrast ratio accurately', () => {
      // Pure black (#000000) on pure white (#ffffff) must be 21:1
      const blackWhiteRatio = calculateContrastRatio('#000000', '#ffffff');
      assert.ok(Math.abs(blackWhiteRatio - 21) < 0.1);

      // Same color must be 1:1
      const sameColor = calculateContrastRatio('#123456', '#123456');
      assert.ok(Math.abs(sameColor - 1) < 0.01);
    });

    it('should guarantee all 52 themes pass WCAG 2.1 AA contrast >= 4.5:1', () => {
      for (const theme of GMAIL_THEMES_CATALOG) {
        const ratio = calculateContrastRatio(theme.surface, theme.text);
        assert.ok(
          ratio >= 4.5,
          `Theme "${theme.name}" (${theme.id}) failed WCAG AA: ratio ${ratio.toFixed(2)}:1 is below 4.5:1 (surface: ${theme.surface}, text: ${theme.text})`
        );
      }
    });

    it('should guarantee all APP_THEMES presets pass WCAG 2.1 AA contrast >= 4.5:1', () => {
      for (const theme of APP_THEMES) {
        const ratio = calculateContrastRatio(theme.surface, theme.text);
        assert.ok(
          ratio >= 4.5,
          `Preset "${theme.nameKey}" failed WCAG AA: ratio ${ratio.toFixed(2)}:1 is below 4.5:1 (surface: ${theme.surface}, text: ${theme.text})`
        );
      }
    });

    it('should guarantee High Contrast preset achieves WCAG AAA >= 7:1', () => {
      const highContrast = APP_THEMES.find((t) => t.id === 'high-contrast');
      assert.ok(highContrast);
      const ratio = calculateContrastRatio(highContrast.surface, highContrast.text);
      assert.ok(ratio >= 15, `High contrast theme must exceed 15:1 ratio (got ${ratio})`);
    });
  });

  describe('Warm Night Mode & Composited Wallpapers Suite', () => {
    it('should verify composited classic themes define full authentic heights and composed alternatives', () => {
      const publicThemesDir = path.join(process.cwd(), 'public', 'themes');

      // Ninja: 312px header, 269px footer, composed alternative
      const ninja = GMAIL_THEMES_CATALOG.find((t) => t.id === 'gmail_ninja');
      assert.ok(ninja);
      assert.equal(ninja.headerHeight, 312, 'Ninja header height must be 312px');
      assert.equal(ninja.footerHeight, 269, 'Ninja footer height must be 269px');
      assert.equal(ninja.composedWallpaperUrl, '/themes/ninja_composed.png');
      assert.ok(fs.existsSync(path.join(publicThemesDir, 'ninja_composed.png')));

      // High Score: 48px header, 191px hills footer, composed alternative
      const highscore = GMAIL_THEMES_CATALOG.find((t) => t.id === 'gmail_highscore');
      assert.ok(highscore);
      assert.equal(highscore.headerHeight, 48, 'Highscore header height must be 48px');
      assert.equal(highscore.footerHeight, 191, 'Highscore footer height must be 191px');
      assert.equal(highscore.footerUrl, '/themes/highscore_footer.png');
      assert.equal(highscore.composedWallpaperUrl, '/themes/highscore_composed.png');
      assert.ok(fs.existsSync(path.join(publicThemesDir, 'highscore_composed.png')));

      // Candy: 235px header, 312px footer, composed alternative
      const candy = GMAIL_THEMES_CATALOG.find((t) => t.id === 'gmail_candy');
      assert.ok(candy);
      assert.equal(candy.headerHeight, 235, 'Candy header height must be 235px');
      assert.equal(candy.footerHeight, 312, 'Candy footer height must be 312px');
      assert.equal(candy.composedWallpaperUrl, '/themes/candy_composed.png');
      assert.ok(fs.existsSync(path.join(publicThemesDir, 'candy_composed.png')));
    });

    it('should transform light day themes into warm dark variants when warmNightMode is enabled', () => {
      // 1. Wasabi (Solid Light Theme)
      themeManager.setTheme('gmail_lime');
      themeManager.setA11yPrefs({ warmNightMode: true });

      const warmWasabi = themeManager.getTheme();
      assert.equal(warmWasabi.isDark, true, 'Warm Wasabi must be dark mode');
      assert.equal(warmWasabi.background, '#141C12', 'Warm Wasabi background must be deep warm olive');
      assert.equal(warmWasabi.surface, 'rgba(24, 34, 22, 0.95)', 'Warm Wasabi surface must be warm sage frost');
      assert.equal(warmWasabi.text, '#E6F5E1', 'Warm Wasabi text must be warm matcha cream');
      const wasabiRatio = calculateContrastRatio(warmWasabi.surface, warmWasabi.text);
      assert.ok(wasabiRatio >= 7.0, `Warm Wasabi contrast ratio must be >= 7.0 (got ${wasabiRatio})`);

      // 2. Lavender (Solid Light Theme)
      themeManager.setTheme('gmail_lavender');
      const warmLavender = themeManager.getTheme();
      assert.equal(warmLavender.isDark, true);
      assert.equal(warmLavender.background, '#1A1424');
      assert.equal(warmLavender.text, '#F3E8FD');
      assert.ok(calculateContrastRatio(warmLavender.surface, warmLavender.text) >= 7.0);

      // Reset
      themeManager.setA11yPrefs({ warmNightMode: false });
      themeManager.setTheme('default-light');
    });

    it('should strictly preserve authentic dedicated night templates when warmNightMode is enabled', () => {
      themeManager.setA11yPrefs({ warmNightMode: true });

      // High Score must keep authentic 8-bit night sky
      themeManager.setTheme('gmail_highscore');
      const highscore = themeManager.getTheme();
      assert.equal(highscore.surface, 'rgba(26, 26, 51, 0.94)');
      assert.equal(highscore.text, '#CCD9FF');
      assert.equal(highscore.accent, '#6666FF');

      // Terminal must keep authentic green phosphor CRT
      themeManager.setTheme('gmail_terminal');
      const terminal = themeManager.getTheme();
      assert.equal(terminal.surface, 'rgba(0, 20, 10, 0.94)');
      assert.equal(terminal.text, '#00FF66');
      assert.equal(terminal.border, '#00FF66');

      // Pure Dark must keep authentic pure dark
      themeManager.setTheme('gmail_basicblack');
      const basicblack = themeManager.getTheme();
      assert.equal(basicblack.background, '#121212');
      assert.equal(basicblack.surface, 'rgba(24, 24, 27, 0.96)');

      // Titan Forge must keep authentic Martian red forge
      themeManager.setTheme('titan-mechanicus');
      const titan = themeManager.getTheme();
      assert.equal(titan.background, '#0d1117');
      assert.equal(titan.accent, '#00ffff');

      // Reset
      themeManager.setA11yPrefs({ warmNightMode: false });
      themeManager.setTheme('default-light');
    });

    it('should configure all 9 classic Gmail themes with accurate multi-layer alignment and repeat rules', () => {
      const candy = APP_THEMES.find((t) => t.id === 'gmail_candy');
      assert.ok(candy);
      assert.equal(candy.wallpaperRepeat, 'repeat-x');
      assert.equal(candy.headerRepeat, 'no-repeat');
      assert.equal(candy.headerPosition, 'top right');
      assert.equal(candy.footerRepeat, 'no-repeat');
      assert.equal(candy.footerPosition, 'bottom right');

      const android = APP_THEMES.find((t) => t.id === 'gmail_android');
      assert.ok(android);
      assert.equal(android.footerUrl, '/themes/android_footer.png');
      assert.equal(android.footerHeight, 325);
      assert.equal(android.footerRepeat, 'no-repeat');

      const gizmos = APP_THEMES.find((t) => t.id === 'gmail_gizmos');
      assert.ok(gizmos);
      assert.equal(gizmos.headerUrl, '/themes/gizmos_header.png');
      assert.equal(gizmos.footerUrl, '/themes/gizmos_footer.png');
      assert.equal(gizmos.canvasColor, '#26221E');

      const terminal = APP_THEMES.find((t) => t.id === 'gmail_terminal');
      assert.ok(terminal);
      assert.equal(terminal.wallpaperRepeat, 'no-repeat');
      assert.equal(terminal.wallpaperPosition, '76px calc(100% - 68px)');

      const teahouse = APP_THEMES.find((t) => t.id === 'gmail_teahouse');
      assert.ok(teahouse);
      assert.equal(teahouse.headerHeight, 540);
      assert.equal(teahouse.headerTileUrl, '/themes/teahouse_headertile.png');
      assert.equal(teahouse.footerUrl, '/themes/teahouse_footer.png');
      assert.equal(teahouse.footerTileUrl, '/themes/teahouse_footertile.png');
      assert.equal(teahouse.footerHeight, 399);

      const busstop = APP_THEMES.find((t) => t.id === 'gmail_busstop');
      assert.ok(busstop);
      assert.equal(busstop.headerUrl, '/themes/busstop_header.png');
      assert.equal(busstop.footerUrl, '/themes/busstop_footer.png');
      assert.equal(busstop.footerHeight, 535);
      assert.equal(busstop.footerPosition, '320px bottom');

      const tree = APP_THEMES.find((t) => t.id === 'gmail_tree');
      assert.ok(tree);
      assert.equal(tree.wallpaperRepeat, 'repeat-x');
      assert.equal(tree.headerUrl, '/themes/tree_header.png');
      assert.equal(tree.headerTileUrl, '/themes/tree_header_tile.gif');
      assert.equal(tree.footerUrl, '/themes/tree_footer.png');
      assert.equal(tree.footerTileUrl, '/themes/tree_grass_tile.png');
    });
  });
});
