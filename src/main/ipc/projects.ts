import { ipcMain, app } from 'electron'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { basename, join } from 'path'
import {
  loadProjects,
  saveProjects,
  updateProject,
  deleteProject as deleteProjectFromStore
} from '../store'
import { detectProjectType, MultipleAppBundlesError } from '../detect-type'
import { stopProjectAndWait, isProjectRunning } from '../process-manager'
import type {
  Project,
  AddProjectResult,
  UpdateProjectInput,
  UploadIconResult
} from '../../shared/types'

// 测试隔离：与 store.ts 的 getVibeHubDir 同源，见该函数注释
function getIconsDir(): string {
  const dir = join(process.env.VIBEHUB_TEST_HOME ?? app.getPath('home'), '.vibehub', 'icons')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

const SUPPORTED_ICON_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif'
}

function updateProjectHandler(projectId: string, input: UpdateProjectInput): Project | null {
  const projects = loadProjects()
  const project = projects.find((p) => p.id === projectId)
  if (!project) {
    return null
  }
  const updates: Partial<Project> = { ...input }
  // REQ-007 AC-002：unknown 类型项目填入启动命令后转为可启动状态，
  // 之前因识别失败落入的 error 态需要一并清除，否则填了命令也仍显示错误
  const isUnrecognized = project.projectKind === 'web' && project.projectType === 'unknown'
  if (input.startCommand && isUnrecognized && project.status === 'error') {
    updates.status = 'stopped'
  }
  return updateProject(projectId, updates)
}

function uploadIcon(projectId: string, mimeType: string, base64Data: string): UploadIconResult {
  const extension = SUPPORTED_ICON_MIME[mimeType]
  if (!extension) {
    return { success: false, error: '仅支持 JPG、PNG、GIF 格式' }
  }
  const iconPath = join(getIconsDir(), `${projectId}.${extension}`)
  writeFileSync(iconPath, Buffer.from(base64Data, 'base64'))
  const updated = updateProject(projectId, { iconPath })
  if (!updated) {
    return { success: false, error: '项目不存在' }
  }
  return { success: true, iconPath }
}

function addProject(folderPath: string): AddProjectResult {
  if (!existsSync(folderPath)) {
    return { success: false, error: '文件夹路径不存在或不可读' }
  }

  let entries: string[]
  try {
    entries = readdirSync(folderPath)
  } catch {
    return { success: false, error: '文件夹路径不存在或不可读' }
  }

  if (entries.length === 0) {
    return { success: false, error: '文件夹为空' }
  }

  const projects = loadProjects()
  if (projects.some((project) => project.path === folderPath)) {
    return { success: false, error: '该项目已存在' }
  }

  let detection
  try {
    detection = detectProjectType(folderPath)
  } catch (error) {
    if (error instanceof MultipleAppBundlesError) {
      return { success: false, error: error.message }
    }
    throw error
  }

  const now = Date.now()
  const isUnrecognized = detection.projectKind === 'web' && detection.projectType === 'unknown'
  const project: Project = {
    id: randomUUID(),
    name: basename(folderPath),
    path: folderPath,
    projectKind: detection.projectKind,
    projectType: detection.projectType,
    appBundlePath: detection.appBundlePath,
    startCommand: null,
    description: '',
    iconPath: null,
    tags: [],
    isFavorite: false,
    status: isUnrecognized ? 'error' : 'stopped',
    port: null,
    createdAt: now,
    lastOpenedAt: null,
    openCount: 0
  }

  saveProjects([...projects, project])
  return { success: true, project }
}

// REQ-008 AC-002：运行中的项目删除前先强制停止并等其真正退出，再执行删除——
// 停止是异步 SIGKILL，不等退出就删 store 记录会让 process-manager 里的
// child.on('exit') 回调对着已删除的 projectId 做无效更新（见 process-manager.ts 注释）
async function deleteProjectHandler(projectId: string): Promise<void> {
  if (isProjectRunning(projectId)) {
    await stopProjectAndWait(projectId)
  }
  const removed = deleteProjectFromStore(projectId)
  // REQ-008 MUST：删除时同步清理该项目关联的自定义图标文件，避免磁盘上遗留孤儿文件
  if (removed?.iconPath && existsSync(removed.iconPath)) {
    unlinkSync(removed.iconPath)
  }
}

// FLOW-004 分支路径：用户为路径失效的项目重新指定路径，按新路径重新走一遍类型检测
// （新路径下的项目可能已换了技术栈），恢复为可正常启动的状态
function updatePathHandler(projectId: string, newPath: string): Project | null {
  if (!existsSync(newPath)) {
    return null
  }
  let detection
  try {
    detection = detectProjectType(newPath)
  } catch {
    return null
  }
  const isUnrecognized = detection.projectKind === 'web' && detection.projectType === 'unknown'
  return updateProject(projectId, {
    path: newPath,
    projectKind: detection.projectKind,
    projectType: detection.projectType,
    appBundlePath: detection.appBundlePath,
    status: isUnrecognized ? 'error' : 'stopped'
  })
}

export function registerProjectsIpc(): void {
  ipcMain.handle('projects:getAll', () => {
    return loadProjects()
  })

  ipcMain.handle('projects:add', (_event, folderPath: string) => {
    return addProject(folderPath)
  })

  ipcMain.handle('projects:update', (_event, projectId: string, input: UpdateProjectInput) => {
    return updateProjectHandler(projectId, input)
  })

  ipcMain.handle(
    'projects:uploadIcon',
    (_event, projectId: string, mimeType: string, base64Data: string) => {
      return uploadIcon(projectId, mimeType, base64Data)
    }
  )

  ipcMain.handle('projects:delete', (_event, projectId: string) => {
    return deleteProjectHandler(projectId)
  })

  ipcMain.handle('projects:updatePath', (_event, projectId: string, newPath: string) => {
    return updatePathHandler(projectId, newPath)
  })
}
