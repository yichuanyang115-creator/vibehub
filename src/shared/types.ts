export type ProjectKind = 'web' | 'app'

export type ProjectType = 'node' | 'python' | 'static' | 'unknown'

export type ProjectEditor = 'cursor' | 'vscode'

export type ProjectStatus =
  | 'stopped'
  | 'launching'
  | 'running'
  | 'error'
  | 'missing'
  | 'installing'
  | 'installFailed'

export interface Project {
  id: string
  name: string
  path: string
  projectKind: ProjectKind
  projectType: ProjectType | null
  appBundlePath: string | null
  startCommand: string | null
  description: string
  iconPath: string | null
  tags: string[]
  isFavorite: boolean
  status: ProjectStatus
  port: number | null
  createdAt: number
  lastOpenedAt: number | null
  openCount: number
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface AddProjectResult {
  success: boolean
  project?: Project
  error?: string
}

export type SortOption = 'recent' | 'frequent' | 'name-asc' | 'name-desc'

export interface UpdateProjectInput {
  name?: string
  description?: string
  tags?: string[]
  startCommand?: string | null
  isFavorite?: boolean
}

export interface UploadIconResult {
  success: boolean
  iconPath?: string
  error?: string
}

export type LogStream = 'stdout' | 'stderr'

export interface LogEntry {
  stream: LogStream
  text: string
  timestamp: number
}
