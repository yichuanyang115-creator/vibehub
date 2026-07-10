import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AddProjectResult,
  LogEntry,
  Project,
  Tag,
  UpdateProjectInput,
  UploadIconResult
} from '../shared/types'

interface Api {
  getProjects: () => Promise<Project[]>
  getTags: () => Promise<Tag[]>
  addProject: (folderPath: string) => Promise<AddProjectResult>
  updateProject: (projectId: string, input: UpdateProjectInput) => Promise<Project | null>
  deleteProject: (projectId: string) => Promise<void>
  updateProjectPath: (projectId: string, newPath: string) => Promise<Project | null>
  uploadIcon: (projectId: string, mimeType: string, base64Data: string) => Promise<UploadIconResult>
  createTag: (name: string) => Promise<Tag>
  renameTag: (tagId: string, name: string) => Promise<Tag | null>
  deleteTag: (tagId: string) => Promise<void>
  selectFolder: () => Promise<string | null>
  getPathForFile: (file: File) => string
  startProject: (projectId: string, skipInstallCheck?: boolean) => Promise<void>
  stopProject: (projectId: string) => Promise<void>
  onProjectStatusChanged: (callback: (project: Project) => void) => () => void
  getLogsForProject: (projectId: string) => Promise<LogEntry[]>
  onLogAppended: (callback: (projectId: string, entry: LogEntry) => void) => () => void
  confirmCloseWindow: () => Promise<void>
  onCloseRequested: (callback: (runningCount: number) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
