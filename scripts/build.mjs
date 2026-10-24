import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist');
const entries = [
  'index.html',
  'projects.html',
  'certifications.html',
  'styles.css',
  'app.js',
  'favicon.svg',
  'social-preview.png',
  'social-preview.svg',
  'images',
  'assets',
];

try {
  // Validate sources before removing a previously successful build.
  for (const entry of entries) {
    await stat(path.join(root, entry));
  }

  if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== 'dist') {
    throw new Error('Refusing to clean a directory outside the project dist folder.');
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const entry of entries) {
    await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
  }

  const countFiles = async (directory) => {
    const contents = await readdir(directory, { withFileTypes: true });
    const counts = await Promise.all(contents.map((entry) => (
      entry.isDirectory() ? countFiles(path.join(directory, entry.name)) : 1
    )));
    return counts.reduce((sum, count) => sum + count, 0);
  };

  console.log(`Built ${await countFiles(output)} static files in dist/.`);
} catch (error) {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
}
