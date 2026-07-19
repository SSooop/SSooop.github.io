import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const blogRoot = path.join(root, 'src/content/blog');
const keepFileText = 'Tracked placeholder for manually managed image assets.\n';

const sharedImageDirs = [
  'src/assets/site',
  'src/assets/og',
  'public/images/site',
  'public/images/og',
];

function ensureTrackedDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });

  const keepFile = path.join(dirPath, '.gitkeep');
  if (!fs.existsSync(keepFile)) {
    fs.writeFileSync(keepFile, keepFileText);
  }
}

function findArticleDirs() {
  const dirs = [];

  for (const yearEntry of fs.readdirSync(blogRoot, { withFileTypes: true })) {
    if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue;

    const yearDir = path.join(blogRoot, yearEntry.name);

    for (const postEntry of fs.readdirSync(yearDir, { withFileTypes: true })) {
      if (!postEntry.isDirectory()) continue;

      const postDir = path.join(yearDir, postEntry.name);
      const hasContentFile = fs
        .readdirSync(postDir)
        .some((fileName) => /^(cn|en)\.mdx?$/.test(fileName));

      if (hasContentFile) {
        dirs.push(postDir);
      }
    }
  }

  return dirs.sort();
}

const articleDirs = findArticleDirs();

for (const dir of articleDirs) {
  ensureTrackedDir(path.join(dir, 'images'));
}

for (const dir of sharedImageDirs) {
  ensureTrackedDir(path.join(root, dir));
}

console.log(`Prepared image folders for ${articleDirs.length} article directories.`);
console.log('Shared image folders:');
for (const dir of sharedImageDirs) {
  console.log(`  - ${dir}/`);
}
