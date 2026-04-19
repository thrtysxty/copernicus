#!/usr/bin/env node

import * as fs from 'fs'
import * as path from 'path'

const args = process.argv.slice(2)
if (args[0] !== 'create' || !args[1]) {
  console.error('Usage: create-copernicus-extension create <directory>')
  process.exit(1)
}

const targetDir = path.resolve(process.cwd(), args[1])
const extensionName = path.basename(targetDir)

if (fs.existsSync(targetDir)) {
  console.error(`Error: Directory ${targetDir} already exists.`)
  process.exit(1)
}

fs.mkdirSync(targetDir, { recursive: true })
fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true })

const scaffoldDir = path.join(__dirname, '..', 'scaffold')

function copyTemplate(templateName: string, destPath: string, replaceName: boolean = false) {
  const content = fs.readFileSync(path.join(scaffoldDir, templateName), 'utf-8')
  const finalContent = replaceName ? content.replace(/\{\{name\}\}/g, extensionName) : content
  fs.writeFileSync(path.join(targetDir, destPath), finalContent)
}

copyTemplate('template-package.json', 'package.json', true)
copyTemplate('template-tsconfig.json', 'tsconfig.json')
copyTemplate('template-index.txt', 'src/index.ts')
copyTemplate('template-README.md', 'README.md', true)

console.log(`Successfully created Copernicus extension in ${targetDir}`)
console.log('To get started:')
console.log(`  cd ${args[1]}`)
console.log(`  npm install`)
console.log(`  npm run build`)
