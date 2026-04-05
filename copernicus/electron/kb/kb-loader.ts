import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import yaml from 'js-yaml';
import { stateLedger } from '../db/state-ledger';
import log from 'electron-log';

function findMdFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findMdFiles(filePath, fileList);
    } else if (filePath.endsWith('.md')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export function loadKnowledgeBase(): void {
  try {
    const kbPath = path.join(app.getAppPath(), 'resources', 'kb');
    if (!fs.existsSync(kbPath)) {
      log.warn(`[KB] Directory not found: ${kbPath}`);
      return;
    }

    const mdFiles = findMdFiles(kbPath);
    let upsertedCount = 0;

    for (const filePath of mdFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse frontmatter
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (!match) {
        log.warn(`[KB] Invalid frontmatter in ${filePath}`);
        continue;
      }

      const frontmatterText = match[1] || '';
      const body = match[2] ? match[2].trim() : '';

      try {
        const fm = yaml.load(frontmatterText) as Record<string, any> | undefined;

        if (!fm || !fm.id || !fm.title || !fm.section || !fm.source || !fm.version) {
          log.warn(`[KB] Missing required frontmatter fields in ${filePath}`);
          continue;
        }

        stateLedger.upsertKbArticle({
          id: fm.id as string,
          title: fm.title as string,
          section: fm.section as string,
          tags: (fm.tags || []) as string[],
          source: fm.source as string,
          version: fm.version as number,
          content: body,
          excerpt: (fm.excerpt as string) || body.substring(0, 150) + (body.length > 150 ? '...' : '')
        });
        upsertedCount++;
      } catch (err) {
        log.error(`[KB] Error parsing frontmatter in ${filePath}:`, err);
      }
    }
    log.info(`[KB] Upserted ${upsertedCount} knowledge base articles.`);
  } catch (err) {
    log.error('[KB] Failed to load knowledge base:', err);
  }
}
