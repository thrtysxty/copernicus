import * as fs from 'fs';
import * as path from 'path';

export interface AuditResult {
  skillName: string;
  file: string;
  issue: 'summary-style' | 'no-trigger' | 'too-short';
  line: number;
  current: string;
}

export function auditSkillDescriptions(rootPath: string): AuditResult[] {
  const auditResults: AuditResult[] = [];
  const claudeSkillsPath = path.join(rootPath, '.claude', 'skills');

  if (!fs.existsSync(claudeSkillsPath)) {
    return auditResults;
  }

  const skillDirs = fs.readdirSync(claudeSkillsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const skillName of skillDirs) {
    const skillMdPath = path.join(claudeSkillsPath, skillName, 'SKILL.md');

    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, 'utf8');
      const lines = content.split('\n');
      let primaryDescriptionLine = '';
      let primaryDescriptionLineNumber = -1;

      for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i]?.trim();
        if (trimmedLine && trimmedLine.length > 0 && !trimmedLine.startsWith('#')) {
          primaryDescriptionLine = trimmedLine;
          primaryDescriptionLineNumber = i + 1;
          break;
        }
      }

      if (primaryDescriptionLine) {
        const lowerCaseLine = primaryDescriptionLine.toLowerCase();

        // summary-style
        const summaryStyleTriggers = ['a skill that', 'this skill', 'helps with', 'used for', 'provides'];
        if (summaryStyleTriggers.some(trigger => lowerCaseLine.startsWith(trigger))) {
          auditResults.push({
            skillName,
            file: skillMdPath,
            issue: 'summary-style',
            line: primaryDescriptionLineNumber,
            current: primaryDescriptionLine,
          });
        }

        // no-trigger
        const noTriggerKeywords = ['when', 'after', 'before', 'if', 'on '];
        if (!noTriggerKeywords.some(keyword => lowerCaseLine.includes(keyword))) {
          auditResults.push({
            skillName,
            file: skillMdPath,
            issue: 'no-trigger',
            line: primaryDescriptionLineNumber,
            current: primaryDescriptionLine,
          });
        }

        // too-short
        const words = primaryDescriptionLine.split(/\s+/).filter(word => word.length > 0);
        if (words.length < 15) {
          auditResults.push({
            skillName,
            file: skillMdPath,
            issue: 'too-short',
            line: primaryDescriptionLineNumber,
            current: primaryDescriptionLine,
          });
        }
      }
    }
  }

  return auditResults;
}