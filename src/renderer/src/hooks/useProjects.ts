import { useCallback, useEffect, useState } from 'react'
import type { Project, UpdateProjectInput } from '../../../shared/types'

interface UseProjectsResult {
  projects: Project[]
  isLoading: boolean
  loadError: string | null
  addError: string | null
  addProjectByPath: (folderPath: string) => Promise<void>
  clearAddError: () => void
  startProject: (projectId: string, skipInstallCheck?: boolean) => void
  stopProject: (projectId: string) => void
  updateProject: (projectId: string, input: UpdateProjectInput) => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  updateProjectPath: (projectId: string, newPath: string) => Promise<boolean>
  refreshProjects: () => Promise<void>
}

export function useProjects(onProjectError?: (projectId: string) => void): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const result = await window.api.getProjects()
    setProjects(result)
  }, [])

  useEffect(() => {
    refresh()
      .then(() => setLoadError(null))
      .catch((error) => {
        console.error('Failed to load projects', error)
        setLoadError('加载项目列表失败')
      })
      .finally(() => setIsLoading(false))
  }, [refresh])

  useEffect(() => {
    return window.api.onProjectStatusChanged((updatedProject) => {
      setProjects((current) =>
        current.map((project) => (project.id === updatedProject.id ? updatedProject : project))
      )
      if (updatedProject.status === 'error' || updatedProject.status === 'installFailed') {
        onProjectError?.(updatedProject.id)
      }
    })
  }, [onProjectError])

  const addProjectByPath = useCallback(
    async (folderPath: string): Promise<void> => {
      const result = await window.api.addProject(folderPath)
      if (!result.success) {
        setAddError(result.error ?? '添加项目失败')
        return
      }
      setAddError(null)
      await refresh()
    },
    [refresh]
  )

  const clearAddError = useCallback((): void => setAddError(null), [])

  const startProject = useCallback((projectId: string, skipInstallCheck?: boolean): void => {
    window.api
      .startProject(projectId, skipInstallCheck)
      .catch((error) => console.error('Failed to start project', error))
  }, [])

  const stopProject = useCallback((projectId: string): void => {
    window.api
      .stopProject(projectId)
      .catch((error) => console.error('Failed to stop project', error))
  }, [])

  const updateProject = useCallback(
    async (projectId: string, input: UpdateProjectInput): Promise<void> => {
      const updated = await window.api.updateProject(projectId, input)
      if (updated) {
        setProjects((current) =>
          current.map((project) => (project.id === projectId ? updated : project))
        )
      }
    },
    []
  )

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    await window.api.deleteProject(projectId)
    setProjects((current) => current.filter((project) => project.id !== projectId))
  }, [])

  const updateProjectPath = useCallback(
    async (projectId: string, newPath: string): Promise<boolean> => {
      const updated = await window.api.updateProjectPath(projectId, newPath)
      if (!updated) {
        return false
      }
      setProjects((current) =>
        current.map((project) => (project.id === projectId ? updated : project))
      )
      return true
    },
    []
  )

  return {
    projects,
    isLoading,
    loadError,
    addError,
    addProjectByPath,
    clearAddError,
    startProject,
    stopProject,
    updateProject,
    deleteProject,
    updateProjectPath,
    refreshProjects: refresh
  }
}
