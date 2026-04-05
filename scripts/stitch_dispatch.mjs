#!/usr/bin/env node
/**
 * scripts/stitch_dispatch.mjs
 *
 * Dispatch a UI story to Google Stitch for component generation.
 * Reads STITCH_API_KEY from env or ~/.secrets.
 *
 * Usage:
 *   node scripts/stitch_dispatch.mjs docs/stories/story_NNN_*.md
 *   node scripts/stitch_dispatch.mjs docs/stories/story_NNN_*.md --model GEMINI_3_FLASH
 *
 * Output:
 *   docs/stitch/story-NNN/<ComponentName>.html  — generated screen HTML per component
 *   Prints Stitch project URL and screen URLs to stdout.
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// --- Auth ---
function getStitchApiKey() {
  let key = process.env.STITCH_API_KEY;
  if (!key) {
    try {
      const out = execSync('bash -c "source ~/.secrets 2>/dev/null && echo $STITCH_API_KEY"', { encoding: 'utf-8' });
      key = out.trim();
    } catch (e) {}
  }
  if (!key) throw new Error('STITCH_API_KEY not set — add it to ~/.secrets');
  return key;
}

// --- Story parser ---
function parseStory(filePath) {
  const raw = readFileSync(filePath, 'utf-8');

  // Story number
  const numMatch = raw.match(/^## Story Number\s+(\d+)/m) || raw.match(/^# Story (\d+)/m);
  const storyNumber = numMatch ? numMatch[1] : 'unknown';

  // Title
  const titleMatch = raw.match(/^# Story \d+[:\s—–-]+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

  // Extract Files in Scope section
  const scopeMatch = raw.match(/^## Files in Scope\s+([\s\S]*?)(?=^## |\Z)/m);
  const scopeText = scopeMatch ? scopeMatch[1] : '';

  // Find .tsx files listed in scope
  const tsxFiles = [];
  const tsxPattern = /`([^`]+\.tsx)`[^-\n]*(?:[-–—]\s*(.+))?/g;
  let m;
  while ((m = tsxPattern.exec(scopeText)) !== null) {
    const filePath = m[1];
    const baseName = filePath.split('/').pop().replace('.tsx', '');
    // Look for the description block that follows this file mention
    const fileIdx = scopeText.indexOf(m[0]);
    const blockEnd = scopeText.indexOf('\n`', fileIdx + 1);
    const desc = blockEnd > -1
      ? scopeText.slice(fileIdx + m[0].length, blockEnd).trim()
      : (m[2] || '').trim();
    tsxFiles.push({ path: filePath, name: baseName, description: desc });
  }

  // Extract Acceptance Criteria
  const acMatch = raw.match(/^## Acceptance Criteria\s+([\s\S]*?)(?=^## |\Z)/m);
  const acs = acMatch ? acMatch[1].trim() : '';

  // Extract Frozen Surfaces
  const frozenMatch = raw.match(/^## Frozen Surfaces?\s+([\s\S]*?)(?=^## |\Z)/m);
  const frozen = frozenMatch ? frozenMatch[1].trim() : '';

  // Full scope section for context
  const scopeFull = scopeMatch ? scopeMatch[1].trim() : '';

  return { storyNumber, title, tsxFiles, acs, frozen, scopeFull, raw };
}

// --- Prompt builder ---
function buildScreenPrompt(story, component) {
  const { title, acs, frozen, storyNumber } = story;
  return `
You are generating a React/TSX component for the Copernicus IDE — a professional multi-agent orchestration desktop application built with Electron + React 18 + TypeScript.

Design system:
- Dark theme with slate/zinc palette (bg-zinc-900, bg-zinc-800, text-zinc-100, text-zinc-400)
- Accent: indigo-500 / indigo-400
- Font: system-ui / monospace for code
- Spacing: 8pt grid (Tailwind: p-2, p-4, p-6, gap-2, gap-4)
- Borders: border-zinc-700, rounded-md
- Scrollable panels: overflow-y-auto with thin scrollbar-zinc styling
- Icons: lucide-react

Component: ${component.name}
Story: ${storyNumber} — ${title}

Component description and requirements:
${component.description || '(see ACs below)'}

Acceptance Criteria relevant to this component:
${acs}

${frozen ? `Frozen surfaces (do not modify):\n${frozen}` : ''}

Generate a complete, production-quality React component. Use Tailwind CSS classes. Export as default. Include all sub-elements visible in a real desktop IDE panel. No placeholder grey boxes — render real UI with realistic labels, icons, and structure.
`.trim();
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const storyFile = args.find(a => a.endsWith('.md'));
  const modelArg = args.find(a => a.startsWith('--model='))?.split('=')[1]
    || (args.includes('--flash') ? 'GEMINI_3_FLASH' : 'GEMINI_3_PRO');

  if (!storyFile) {
    console.error('Usage: node scripts/stitch_dispatch.mjs docs/stories/story_NNN_*.md [--flash]');
    process.exit(1);
  }

  const story = parseStory(join(REPO_ROOT, storyFile));
  console.log(`\nStitch dispatch — Story ${story.storyNumber}: ${story.title}`);
  console.log(`Model: ${modelArg}`);

  if (story.tsxFiles.length === 0) {
    console.error('No .tsx files found in story scope. Is this a UI story?');
    process.exit(1);
  }

  console.log(`Components to generate (${story.tsxFiles.length}):`);
  story.tsxFiles.forEach(f => console.log(`  - ${f.name} (${f.path})`));

  // Load Stitch SDK from copernicus node_modules
  const stitchSdkPath = join(REPO_ROOT, 'copernicus/node_modules/@google/stitch-sdk/dist/src/singleton.js');
  if (!existsSync(stitchSdkPath)) {
    console.error('Stitch SDK not found at copernicus/node_modules/@google/stitch-sdk');
    process.exit(1);
  }

  process.env.STITCH_API_KEY = getStitchApiKey();
  const { stitch } = await import(stitchSdkPath);

  // Get or create Copernicus project
  console.log('\nConnecting to Stitch...');
  let project;
  try {
    const projects = await stitch.projects();
    project = projects.find(p => p.data?.title === 'Copernicus IDE');
    if (!project) {
      console.log('Creating Stitch project "Copernicus IDE"...');
      project = await stitch.createProject({ title: 'Copernicus IDE' });
    }
    console.log(`Project: ${project.id}`);
  } catch (e) {
    console.error(`Failed to connect to Stitch: ${e.message}`);
    process.exit(1);
  }

  // Output dir
  const outDir = join(REPO_ROOT, 'docs/stitch', `story-${story.storyNumber}`);
  mkdirSync(outDir, { recursive: true });

  // Generate each component
  const results = [];
  for (const component of story.tsxFiles) {
    console.log(`\nGenerating ${component.name}...`);
    const prompt = buildScreenPrompt(story, component);

    try {
      const screen = await project.generate(prompt, 'DESKTOP', modelArg);
      console.log(`  Screen ID: ${screen.id}`);

      const html = await screen.getHtml();
      const outPath = join(outDir, `${component.name}.html`);
      writeFileSync(outPath, html);
      console.log(`  Saved: docs/stitch/story-${story.storyNumber}/${component.name}.html`);

      results.push({ component: component.name, screenId: screen.id, outPath, ok: true });
    } catch (e) {
      console.error(`  ❌ Failed to generate ${component.name}: ${e.message}`);
      results.push({ component: component.name, ok: false, error: e.message });
    }
  }

  // Summary
  console.log('\n--- Stitch Dispatch Complete ---');
  console.log(`Project: https://stitch.withgoogle.com (ID: ${project.id})`);
  console.log(`Output: docs/stitch/story-${story.storyNumber}/`);
  results.forEach(r => {
    if (r.ok) {
      console.log(`  ✓ ${r.component} → ${r.outPath.replace(REPO_ROOT + '/', '')}`);
    } else {
      console.log(`  ✗ ${r.component} → ${r.error}`);
    }
  });

  const allOk = results.every(r => r.ok);
  process.exit(allOk ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
