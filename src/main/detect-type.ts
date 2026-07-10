import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import type { ProjectKind, ProjectType } from '../shared/types'

export interface DetectionResult {
  projectKind: ProjectKind
  projectType: ProjectType | null
  appBundlePath: string | null
}

export class MultipleAppBundlesError extends Error {
  constructor() {
    super('检测到多个 .app，请确认文件夹内只有一个 .app')
  }
}

function findAppBundles(dirPath: string): string[] {
  const found: string[] = []
  const entries = readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const entryPath = join(dirPath, entry.name)
    if (entry.name.endsWith('.app')) {
      found.push(entryPath)
    } else {
      found.push(...findAppBundles(entryPath))
    }
  }

  return found
}

function detectWebType(dirPath: string): ProjectType {
  if (existsSync(join(dirPath, 'package.json'))) {
    return 'node'
  }
  if (
    existsSync(join(dirPath, 'requirements.txt')) ||
    existsSync(join(dirPath, 'pyproject.toml')) ||
    existsSync(join(dirPath, 'setup.py'))
  ) {
    return 'python'
  }
  if (existsSync(join(dirPath, 'index.html'))) {
    return 'static'
  }
  return 'unknown'
}

export function detectProjectType(dirPath: string): DetectionResult {
  const appBundles = findAppBundles(dirPath)

  if (appBundles.length > 1) {
    throw new MultipleAppBundlesError()
  }

  if (appBundles.length === 1) {
    return { projectKind: 'app', projectType: null, appBundlePath: appBundles[0] }
  }

  return { projectKind: 'web', projectType: detectWebType(dirPath), appBundlePath: null }
}
