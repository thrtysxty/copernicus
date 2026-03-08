import fs from 'node:fs'
import path from 'node:path'

export function parseMakefile(rootPath: string): string[] {
  const makefilePath = path.join(rootPath, 'Makefile')
  if (!fs.existsSync(makefilePath)) {
    return []
  }

  const content = fs.readFileSync(makefilePath, 'utf-8')
  const targets: string[] = []

  const regex = /^([a-zA-Z0-9_-]+):/gm

  let match
  while ((match = regex.exec(content)) !== null) {
    const target = match[1]
    if (target && target !== '.PHONY' && target !== 'help') {
       targets.push(target)
    }
  }

  return targets
}
