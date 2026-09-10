import { access, cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const manifestSource = join(root, '.openai', 'hosting.json');
const manifestTarget = join(dist, '.openai', 'hosting.json');

await mkdir(dirname(manifestTarget), { recursive: true });
await cp(manifestSource, manifestTarget);
await cp(join(root, 'drizzle'), join(dist, 'drizzle'), { recursive: true });

let workerRoot = dist;
try {
  await access(join(workerRoot, 'wrangler.json'));
} catch {
  const entries = await readdir(dist, { withFileTypes: true });
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const candidate = join(dist, entry.name);
    try {
      await access(join(candidate, 'wrangler.json'));
      workerRoot = candidate;
      break;
    } catch {
      // Continue until the Cloudflare Worker output is found.
    }
  }
}
const wranglerOutput = JSON.parse(await readFile(join(workerRoot, 'wrangler.json'), 'utf8'));
const emittedMain = resolve(workerRoot, wranglerOutput.main);
const serverDir = join(dist, 'server');

if (emittedMain !== join(serverDir, 'index.js')) {
  await mkdir(serverDir, { recursive: true });
  await cp(dirname(emittedMain), serverDir, { recursive: true });
  const emittedName = emittedMain.split(/[\\/]/).pop();
  if (emittedName !== 'index.js') {
    await cp(emittedMain, join(serverDir, 'index.js'));
  }
}
