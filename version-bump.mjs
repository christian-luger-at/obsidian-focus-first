import { readFileSync, writeFileSync } from 'fs';

const targetVersion = process.env.npm_package_version;

// read minAppVersion from manifest.json and bump version to target version
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));

// update versions.json with target version and minAppVersion from manifest.json
// but only if the target version is not already in versions.json
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
if (!(targetVersion in versions)) {
	versions[targetVersion] = minAppVersion;
	writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
}

// Stamp the version into styles.css so each release's stylesheet has unique bytes,
// even when the CSS itself is unchanged between two versions. The marker line is
// rewritten in place on each bump. We no longer attest releases, but attestations
// are keyed by file digest and cannot be deleted: without this stamp, a release
// whose CSS happens to match an older, attested one would inherit that old
// attestation, and Obsidian's review rejects a digest carrying provenance from a
// different ref.
const styleMarker = /^\/\* Focus First v[^\n]* \*\/\n/;
const styleHeader = `/* Focus First v${targetVersion} */\n`;
let styles = readFileSync('styles.css', 'utf8');
styles = styleMarker.test(styles) ? styles.replace(styleMarker, styleHeader) : styleHeader + styles;
writeFileSync('styles.css', styles);
