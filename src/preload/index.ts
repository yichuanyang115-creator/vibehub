import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AddProjectResult,
  LogEntry,
  Project,
  Tag,
  UpdateProjectInput,
  UploadIconResult
} from '../shared/types'

// Custom APIs for renderer
const api = {
  getProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects:getAll'),
  getTags: (): Promise<Tag[]> => ipcRenderer.invoke('tags:getAll'),
  addProject: (folderPath: string): Promise<AddProjectResult> =>
    ipcRenderer.invoke('projects:add', folderPath),
  updateProject: (projectId: string, input: UpdateProjectInput): Promise<Project | null> =>
    ipcRenderer.invoke('projects:update', projectId, input),
  deleteProject: (projectId: string): Promise<void> =>
    ipcRenderer.invoke('projects:delete', projectId),
  updateProjectPath: (projectId: string, newPath: string): Promise<Project | null> =>
    ipcRenderer.invoke('projects:updatePath', projectId, newPath),
  revealProjectInFinder: (projectId: string): Promise<boolean> =>
    ipcRenderer.invoke('projects:revealInFinder', projectId),
  uploadIcon: (
    projectId: string,
    mimeType: string,
    base64Data: string
  ): Promise<UploadIconResult> =>
    ipcRenderer.invoke('projects:uploadIcon', projectId, mimeType, base64Data),
  createTag: (name: string): Promise<Tag> => ipcRenderer.invoke('tags:create', name),
  renameTag: (tagId: string, name: string): Promise<Tag | null> =>
    ipcRenderer.invoke('tags:rename', tagId, name),
  deleteTag: (tagId: string): Promise<void> => ipcRenderer.invoke('tags:delete', tagId),
  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:selectFolder'),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  startProject: (projectId: string, skipInstallCheck?: boolean): Promise<void> =>
    ipcRenderer.invoke('projects:start', projectId, skipInstallCheck),
  stopProject: (projectId: string): Promise<void> => ipcRenderer.invoke('projects:stop', projectId),
  onProjectStatusChanged: (callback: (project: Project) => void): (() => void) => {
    const listener = (_event: unknown, project: Project): void => callback(project)
    ipcRenderer.on('projects:statusChanged', listener)
    return () => ipcRenderer.removeListener('projects:statusChanged', listener)
  },
  getLogsForProject: (projectId: string): Promise<LogEntry[]> =>
    ipcRenderer.invoke('logs:getForProject', projectId),
  onLogAppended: (callback: (projectId: string, entry: LogEntry) => void): (() => void) => {
    const listener = (_event: unknown, projectId: string, entry: LogEntry): void =>
      callback(projectId, entry)
    ipcRenderer.on('logs:appended', listener)
    return () => ipcRenderer.removeListener('logs:appended', listener)
  },
  confirmCloseWindow: (): Promise<void> => ipcRenderer.invoke('window:confirmClose'),
  onCloseRequested: (callback: (runningCount: number) => void): (() => void) => {
    const listener = (_event: unknown, runningCount: number): void => callback(runningCount)
    ipcRenderer.on('window:closeRequested', listener)
    return () => ipcRenderer.removeListener('window:closeRequested', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
