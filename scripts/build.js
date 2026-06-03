import { cpSync, rmSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['chrome', 'firefox'];

for (const target of targets) {
  const dist = join(root, 'dist', target);
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true });
  cpSync(join(root, 'vendor'), join(dist, 'vendor'), { recursive: true });
  copyFileSync(join(root, 'loader.js'), join(dist, 'loader.js'));
  copyFileSync(join(root, `manifest.${target}.json`), join(dist, 'manifest.json'));

  const assets = join(root, 'assets');
  if (existsSync(assets)) {
    cpSync(assets, join(dist, 'assets'), { recursive: true });
  }

  console.log(`Built dist/${target}/`);
}
