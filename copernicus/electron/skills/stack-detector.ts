import fs from 'fs';
import path from 'path';

export interface StackProfile {
  hasElectron: boolean;
  hasReact: boolean;
  hasTypeScript: boolean;
  hasFlask: boolean;
  hasPytest: boolean;
  hasPlaywright: boolean;
  hasCI: boolean;
  hasMakefile: boolean;
  hasCopernicus: boolean;
  frameworks: string[];
}

export function detectStack(rootPath: string): StackProfile {
  const profile: StackProfile = {
    hasElectron: false,
    hasReact: false,
    hasTypeScript: false,
    hasFlask: false,
    hasPytest: false,
    hasPlaywright: false,
    hasCI: false,
    hasMakefile: false,
    hasCopernicus: false,
    frameworks: []
  };

  if (!rootPath) {
    return profile;
  }

  const fileExists = (relativePath: string): boolean => {
    const filePath = path.join(rootPath, relativePath);
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  };

  const directoryExists = (relativePath: string): boolean => {
    const dirPath = path.join(rootPath, relativePath);
    try {
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  };

  const readTextFile = (relativePath: string): string | null => {
    if (!fileExists(relativePath)) return null;
    try {
      return fs.readFileSync(path.join(rootPath, relativePath), 'utf-8');
    } catch {
      return null;
    }
  };

  // 1. package.json analysis
  const pkgContent = readTextFile('package.json');
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      
      if ('electron' in deps) {
        profile.hasElectron = true;
      }
      
      if ('react' in deps) {
        profile.hasReact = true;
      }
      
      if ('typescript' in deps) {
        profile.hasTypeScript = true;
      }
    } catch {
      // Ignore JSON parse errors - fall back to naive string match
      if (pkgContent.includes('"electron"')) profile.hasElectron = true;
      if (pkgContent.includes('"react"')) profile.hasReact = true;
      if (pkgContent.includes('"typescript"')) profile.hasTypeScript = true;
    }
  }

  if (fileExists('tsconfig.json')) {
    profile.hasTypeScript = true;
  }

  // 2. Playwright analysis
  if (fileExists('playwright.config.ts') || fileExists('playwright.config.js')) {
    profile.hasPlaywright = true;
  }

  // 3. Python analysis
  const reqTxt = readTextFile('requirements.txt');
  if (reqTxt) {
    if (reqTxt.toLowerCase().includes('flask')) profile.hasFlask = true;
    if (reqTxt.toLowerCase().includes('pytest')) profile.hasPytest = true;
  }
  
  const pyProject = readTextFile('pyproject.toml');
  if (pyProject) {
    if (pyProject.toLowerCase().includes('flask')) profile.hasFlask = true;
    if (pyProject.toLowerCase().includes('pytest')) profile.hasPytest = true;
  }

  // 4. Project structure analysis
  if (directoryExists('.github/workflows')) {
    profile.hasCI = true;
  }

  const makefile = readTextFile('Makefile');
  if (makefile) {
    // Basic heuristics to check for a 'deploy' target which might be 'deploy:' or 'deploy :'
    const lines = makefile.split('\n');
    for (const line of lines) {
      if (/^deploy\s*:/.test(line)) {
        profile.hasMakefile = true;
        break;
      }
    }
  }

  if (fileExists('copernicus/electron/preload.ts')) {
    profile.hasCopernicus = true;
  }

  // Populate frameworks array
  if (profile.hasElectron) profile.frameworks.push('Electron');
  if (profile.hasReact) profile.frameworks.push('React');
  if (profile.hasTypeScript) profile.frameworks.push('TypeScript');
  if (profile.hasFlask) profile.frameworks.push('Flask');
  if (profile.hasPytest) profile.frameworks.push('pytest');
  if (profile.hasPlaywright) profile.frameworks.push('Playwright');
  if (profile.hasCI) profile.frameworks.push('CI');
  if (profile.hasMakefile) profile.frameworks.push('Makefile');
  if (profile.hasCopernicus) profile.frameworks.push('Copernicus');

  return profile;
}
