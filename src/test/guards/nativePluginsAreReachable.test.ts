import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every plugin JS registers must be reachable from JS on the platforms it
 * claims to support.
 *
 * This guard exists because of a shipped regression that nothing caught. On
 * iOS, `registerPlugin('Eduroam')` resolves against
 * `window.Capacitor.PluginHeaders`, which the CLI generates from
 * `packageClassList` in `ios/App/App/capacitor.config.json` — and the CLI
 * builds that list ONLY by walking installed plugin *packages* for
 * `@objc(...)`. An app-target Swift file is never scanned, and the generated
 * config is gitignored, so a hand-patched entry survives exactly until the next
 * sync. See native/capacitor-secure-store/README.md, which established all of
 * that by measurement.
 *
 * The consequence is a build that succeeds, tests that pass, native Swift
 * sitting in the repo — and a rejection the first time a student taps the
 * button: `"Eduroam" plugin is not implemented on ios`.
 *
 * Two failures are possible and this covers the one that lives in the repo: a
 * plugin registered in JS with no packaged iOS implementation behind it. (The
 * other is a `file:` dependency missing from a stale node_modules, which is
 * environment rather than repo state — `scripts/check-native-plugins.mjs`
 * blocks `cap:sync` on that, since CI always installs fresh and would never
 * see it.)
 */

const root = process.cwd();

/**
 * Plugins whose iOS half genuinely does not exist yet, with the reason. A name
 * may only sit here while the feature is Android-only IN FACT — the moment an
 * iOS implementation is written it has to be a `native/*` package, and taking
 * the name off this list is what proves it was packaged rather than dropped
 * into the app target.
 */
const ANDROID_ONLY: Record<string, string> = {
  // android/app/src/main/java/cz/reis/app/DownloadsPlugin.java. On iOS the
  // share sheet covers this, so no Swift half is planned; if one is written it
  // must be packaged, per the README's own warning about this exact plugin.
  Downloads: 'no iOS half — the share sheet covers it there',
};

/**
 * The mirror of ANDROID_ONLY: plugins whose Android half does not exist because
 * the feature is iPad-only IN FACT, with the reason. JS must gate every call on
 * `Capacitor.getPlatform() === 'ios'` (src/mobile/pdfInkNative.ts does), so on
 * Android the plugin is never even asked.
 */
const IOS_ONLY: Record<string, string> = {
  // native/capacitor-pdf-ink: PDFKit + PencilKit reader. Android keeps the
  // pdf.js viewer; there is no PencilKit to reuse there.
  PdfInk: 'iPad-only PencilKit reader — Android keeps the pdf.js viewer',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

/**
 * Memoised: this walks every source file, and five tests asking separately made
 * the suite slow enough to trip the default 5s timeout under a parallel run —
 * which failed as a bug in the guard rather than in what it guards.
 */
let namesCache: string[] | null = null;
let packagedCache: { pkg: string; dir: string; classes: string[] }[] | null = null;

/** Plugin names the app asks Capacitor for, e.g. registerPlugin<T>('Eduroam'). */
function registeredNames(): string[] {
  if (namesCache) return namesCache;
  const names = new Set<string>();
  for (const file of walk(join(root, 'src'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/registerPlugin\s*(?:<[^>]*>)?\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g))
      names.add(m[1] as string);
  }
  namesCache = [...names].sort();
  return namesCache;
}

/** `file:native/*` dependencies, and the `@objc(...)` classes each one ships. */
function packagedIosPlugins(): { pkg: string; dir: string; classes: string[] }[] {
  if (packagedCache) return packagedCache;
  const pkgJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const deps: Record<string, string> = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  packagedCache = Object.entries(deps)
    .filter(([, spec]) => String(spec).startsWith('file:native/'))
    .map(([pkg, spec]) => {
      const dir = join(root, String(spec).replace('file:', ''));
      const classes: string[] = [];
      const swift: string[] = [];
      if (existsSync(join(dir, 'ios'))) {
        const collect = (d: string) => {
          for (const e of readdirSync(d, { withFileTypes: true })) {
            const p = join(d, e.name);
            if (e.isDirectory()) collect(p);
            else if (e.name.endsWith('.swift')) swift.push(p);
          }
        };
        collect(join(dir, 'ios'));
      }
      for (const f of swift)
        for (const m of readFileSync(f, 'utf8').matchAll(/@objc\(([A-Za-z0-9_]+)\)/g))
          classes.push(m[1] as string);
      return { pkg, dir, classes };
    });
  return packagedCache;
}

// Filesystem I/O, not a unit test: the default 5s is not a meaningful budget
// for walking the source tree while the rest of the suite runs in parallel.
describe('native plugins are reachable from JS', { timeout: 30_000 }, () => {
  it('registers at least the plugins we know about', () => {
    // A canary: if this drops to nothing the parser broke and every assertion
    // below would pass vacuously.
    const names = registeredNames();
    expect(names).toContain('Eduroam');
    expect(names).toContain('SecureStore');
  });

  it('backs every registered plugin with a packaged iOS class, or declares it Android-only', () => {
    const packaged = packagedIosPlugins();
    const available = new Set(packaged.flatMap((p) => p.classes));

    const unreachable = registeredNames().filter(
      (name) => !available.has(`${name}Plugin`) && !(name in ANDROID_ONLY)
    );

    expect(
      unreachable,
      `These plugins are registered in JS but have no @objc(<Name>Plugin) in any ` +
        `file:native/* package, so cap sync will leave them out of packageClassList and ` +
        `every call will reject with "plugin is not implemented on ios". Package the Swift ` +
        `under native/<plugin>/ios and add it to package.json, or add the name to ` +
        `ANDROID_ONLY with a reason. Available: ${[...available].join(', ')}`
    ).toEqual([]);
  });

  it('keeps the Android-only list honest', () => {
    // Once an iOS class exists, the name must come OFF the list — otherwise the
    // list is what hides the next packaging mistake.
    const available = new Set(packagedIosPlugins().flatMap((p) => p.classes));
    const stale = Object.keys(ANDROID_ONLY).filter((name) => available.has(`${name}Plugin`));
    expect(stale, `These now have an iOS class and should leave ANDROID_ONLY`).toEqual([]);
  });

  it('keeps the iOS-only list honest', () => {
    const javaDir = join(root, 'android/app/src/main/java/cz/reis/app');
    const java = existsSync(javaDir) ? readdirSync(javaDir).join('\n') : '';
    const stale = Object.keys(IOS_ONLY).filter((name) => java.includes(`${name}Plugin.java`));
    expect(stale, `These now have an Android class and should leave IOS_ONLY`).toEqual([]);
  });

  it('has no native plugin directory that nothing depends on', () => {
    // An undeclared package is never synced, so it is not a plugin — it is a
    // directory that looks like one.
    const declared = new Set(
      packagedIosPlugins().map((p) => p.dir.replace(`${root}/`, '').replace(/\/$/, ''))
    );
    const nativeDir = join(root, 'native');
    const dirs = existsSync(nativeDir)
      ? readdirSync(nativeDir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && existsSync(join(nativeDir, e.name, 'package.json')))
          .map((e) => `native/${e.name}`)
      : [];
    expect(dirs.filter((d) => !declared.has(d))).toEqual([]);
  });

  it('ships an Android half for every registered plugin too', () => {
    // The mirror of the iOS check. Android registers app-local plugins fine
    // (MainActivity.registerPlugin runs before the bridge), so these live in the
    // app target — but a plugin with neither half is a dead call on both.
    const javaDir = join(root, 'android/app/src/main/java/cz/reis/app');
    const java = existsSync(javaDir) ? readdirSync(javaDir).join('\n') : '';
    const missing = registeredNames().filter(
      (name) => !java.includes(`${name}Plugin.java`) && !(name in IOS_ONLY)
    );
    expect(missing, `No <Name>Plugin.java under ${javaDir}`).toEqual([]);
  });
});
