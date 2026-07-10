import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Project, Tag } from '../shared/types'

// 测试隔离：CLAUDE.md 开发测试规则要求跑真实 app 的测试用独立数据目录，
// VIBEHUB_TEST_HOME 是本项目的测试隔离入口，仅供 e2e 测试注入临时目录，
// 生产环境不设置该变量时行为不变
function getVibeHubDir(): string {
  const dir = join(process.env.VIBEHUB_TEST_HOME ?? app.getPath('home'), '.vibehub')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getProjectsFilePath(): string {
  return join(getVibeHubDir(), 'projects.json')
}

function getTagsFilePath(): string {
  return join(getVibeHubDir(), 'tags.json')
}

function parseJsonFile<T>(filePath: string): T[] {
  if (!existsSync(filePath)) {
    return []
  }
  const raw = readFileSync(filePath, 'utf-8')
  if (raw.trim() === '') {
    return []
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    console.error(`Failed to parse ${filePath}, falling back to empty list`, error)
    return []
  }
}

export function loadProjects(): Project[] {
  return parseJsonFile<Project>(getProjectsFilePath())
}

export function saveProjects(projects: Project[]): void {
  writeFileSync(getProjectsFilePath(), JSON.stringify(projects, null, 2), 'utf-8')
}

// REQ-006：仅在应用启动时调用一次，把上次会话遗留的运行态清成已停止并落盘。
// 不能放进 loadProjects，否则同一 session 内真实的 running/launching 态
// 也会被每次读取时错误地抹掉。
export function resetStaleProjectStatuses(): void {
  const projects = loadProjects()
  const hasStaleStatus = projects.some(
    (project) => project.status === 'running' || project.status === 'launching'
  )
  if (!hasStaleStatus) {
    return
  }
  const resetProjects = projects.map((project) =>
    project.status === 'running' || project.status === 'launching'
      ? { ...project, status: 'stopped' as const, port: null }
      : project
  )
  saveProjects(resetProjects)
}

// FLOW-004：项目路径是否仍然存在。app 类型检查 .app 包本身，web 类型检查项目根目录
export function projectPathExists(project: Project): boolean {
  const targetPath = project.projectKind === 'app' ? project.appBundlePath : project.path
  return targetPath !== null && existsSync(targetPath)
}

// 应用启动时把路径已失效的项目标为 missing，路径恢复存在的项目从 missing 转回 stopped。
// 仅在启动时跑一次，与 resetStaleProjectStatuses 同一时机，运行中项目的路径检测发生在
// 点击启动前（见 ipc/launch.ts），不需要在这里重复处理
export function syncMissingPathStatuses(): void {
  const projects = loadProjects()
  let changed = false
  const synced = projects.map((project) => {
    const pathExists = projectPathExists(project)
    if (!pathExists && project.status !== 'missing') {
      changed = true
      return { ...project, status: 'missing' as const, port: null }
    }
    if (pathExists && project.status === 'missing') {
      changed = true
      return { ...project, status: 'stopped' as const }
    }
    return project
  })
  if (changed) {
    saveProjects(synced)
  }
}

export function updateProject(projectId: string, updates: Partial<Project>): Project | null {
  const projects = loadProjects()
  const index = projects.findIndex((project) => project.id === projectId)
  if (index === -1) {
    return null
  }
  const updated = { ...projects[index], ...updates }
  projects[index] = updated
  saveProjects(projects)
  return updated
}

export function deleteProject(projectId: string): Project | null {
  const projects = loadProjects()
  const index = projects.findIndex((project) => project.id === projectId)
  if (index === -1) {
    return null
  }
  const [removed] = projects.splice(index, 1)
  saveProjects(projects)
  return removed
}

export function loadTags(): Tag[] {
  return parseJsonFile<Tag>(getTagsFilePath())
}

export function saveTags(tags: Tag[]): void {
  writeFileSync(getTagsFilePath(), JSON.stringify(tags, null, 2), 'utf-8')
}
