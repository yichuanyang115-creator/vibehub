import { useCallback, useMemo, useState, type DragEvent } from 'react'
import { Plus } from 'lucide-react'
import { useProjects } from './hooks/useProjects'
import { useTags } from './hooks/useTags'
import { useWindowCloseGuard } from './hooks/useWindowCloseGuard'
import { TagSidebar } from './components/TagSidebar'
import { ProjectCard } from './components/ProjectCard'
import { EmptyState } from './components/EmptyState'
import { SkeletonGrid } from './components/SkeletonGrid'
import { LogPanel } from './components/LogPanel'
import { EditProjectModal } from './components/EditProjectModal'
import { TagManageModal } from './components/TagManageModal'
import { ConfirmModal } from './components/ConfirmModal'
import { SearchBar } from './components/SearchBar'
import { SortDropdown } from './components/SortDropdown'
import type { Project, SortOption } from '../../shared/types'

// REQ-010：排序方式对最近打开/最常打开值相同的项目做兜底，避免顺序不稳定
function sortProjects(projects: Project[], sortOption: SortOption): Project[] {
  const sorted = [...projects]
  const compareFavorite = (a: Project, b: Project): number =>
    Number(b.isFavorite) - Number(a.isFavorite)
  switch (sortOption) {
    case 'recent':
      return sorted.sort(
        (a, b) => compareFavorite(a, b) || (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)
      )
    case 'frequent':
      return sorted.sort((a, b) => compareFavorite(a, b) || b.openCount - a.openCount)
    case 'name-asc':
      return sorted.sort((a, b) => compareFavorite(a, b) || a.name.localeCompare(b.name))
    case 'name-desc':
      return sorted.sort((a, b) => compareFavorite(a, b) || b.name.localeCompare(a.name))
  }
}

function App(): React.JSX.Element {
  const [openLogPanelProjectId, setOpenLogPanelProjectId] = useState<string | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [isTagManageOpen, setIsTagManageOpen] = useState(false)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('recent')
  const { runningCountOnClose, confirmClose, cancelClose } = useWindowCloseGuard()

  const handleProjectError = useCallback((projectId: string): void => {
    // Product-Spec.md REQ-003/004 AC-003：启动失败时日志面板自动展开并高亮 stderr
    setOpenLogPanelProjectId(projectId)
  }, [])

  const {
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
    refreshProjects
  } = useProjects(handleProjectError)
  const [updatePathError, setUpdatePathError] = useState<string | null>(null)
  const [projectActionError, setProjectActionError] = useState<string | null>(null)
  const { tags, createTag, renameTag, deleteTag } = useTags()
  const [isDragOver, setIsDragOver] = useState(false)

  const openLogPanelProject =
    projects.find((project) => project.id === openLogPanelProjectId) ?? null
  const editingProject = projects.find((project) => project.id === editingProjectId) ?? null
  const deletingProject = projects.find((project) => project.id === deletingProjectId) ?? null

  const visibleProjects = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase()
    const filtered = projects.filter((project) => {
      const matchesTag = !selectedTagId || project.tags.includes(selectedTagId)
      const matchesSearch = !trimmedQuery || project.name.toLowerCase().includes(trimmedQuery)
      return matchesTag && matchesSearch
    })
    return sortProjects(filtered, sortOption)
  }, [projects, selectedTagId, searchQuery, sortOption])

  // REQ-008：删除弹窗从编辑弹窗内触发时，先关闭编辑弹窗再弹出确认，避免弹窗叠加
  const handleRequestDelete = useCallback((projectId: string): void => {
    setEditingProjectId(null)
    setDeletingProjectId(projectId)
  }, [])

  const handleConfirmDelete = useCallback(async (): Promise<void> => {
    if (!deletingProjectId) {
      return
    }
    await deleteProject(deletingProjectId)
    setDeletingProjectId(null)
  }, [deletingProjectId, deleteProject])

  // FLOW-004：路径失效项目点击「更新路径」，复用系统文件选择器，与 REQ-001 添加项目的入口方式一致
  const handleRequestUpdatePath = useCallback(
    (projectId: string): void => {
      window.api
        .selectFolder()
        .then(async (folderPath) => {
          if (!folderPath) {
            return
          }
          const success = await updateProjectPath(projectId, folderPath)
          setUpdatePathError(success ? null : '所选文件夹路径不存在或不可读')
        })
        .catch((error) => console.error('Failed to update project path', error))
    },
    [updateProjectPath]
  )

  const handleUploadIcon = useCallback(
    async (mimeType: string, base64Data: string): Promise<void> => {
      if (!editingProjectId) {
        return
      }
      await window.api.uploadIcon(editingProjectId, mimeType, base64Data)
      await refreshProjects()
    },
    [editingProjectId, refreshProjects]
  )

  const handleRevealInFinder = useCallback((projectId: string): void => {
    window.api
      .revealProjectInFinder(projectId)
      .then((success) => {
        setProjectActionError(success ? null : '无法在 Finder 中显示项目，项目路径可能已失效')
      })
      .catch((error) => {
        console.error('Failed to reveal project in Finder', error)
        setProjectActionError('无法在 Finder 中显示项目')
      })
  }, [])

  const handleOpenInTerminal = useCallback((projectId: string): void => {
    window.api
      .openProjectInTerminal(projectId)
      .then((success) => {
        setProjectActionError(success ? null : '无法在终端中打开项目，项目路径可能已失效')
      })
      .catch((error) => {
        console.error('Failed to open project in Terminal', error)
        setProjectActionError('无法在终端中打开项目')
      })
  }, [])

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((): void => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault()
      setIsDragOver(false)
      const file = event.dataTransfer.files[0]
      if (!file) {
        return
      }
      const folderPath = window.api.getPathForFile(file)
      addProjectByPath(folderPath).catch((error) => console.error('Failed to add project', error))
    },
    [addProjectByPath]
  )

  const handleAddProject = useCallback((): void => {
    window.api
      .selectFolder()
      .then((folderPath) => {
        if (folderPath) {
          return addProjectByPath(folderPath)
        }
        return undefined
      })
      .catch((error) => console.error('Failed to add project', error))
  }, [addProjectByPath])

  return (
    <div
      className="flex h-screen w-screen bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TagSidebar
        projects={projects}
        tags={tags}
        selectedTagId={selectedTagId}
        onSelectTag={setSelectedTagId}
        onManageTags={() => setIsTagManageOpen(true)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex flex-1 flex-col gap-lg overflow-y-auto p-xl">
          <div className="flex items-center justify-between gap-md">
            <h1 className="text-sm font-medium text-text-primary">VibeHub</h1>
            <div className="flex items-center gap-sm">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              <SortDropdown value={sortOption} onChange={setSortOption} />
              <button
                type="button"
                onClick={handleAddProject}
                aria-label="添加项目"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-white"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {loadError && (
            <p className="rounded-md bg-danger/10 px-md py-sm text-xs text-danger">{loadError}</p>
          )}

          {addError && (
            <div className="flex items-center justify-between rounded-md bg-danger/10 px-md py-sm text-xs text-danger">
              <span>{addError}</span>
              <button type="button" onClick={clearAddError} aria-label="关闭提示">
                ×
              </button>
            </div>
          )}

          {updatePathError && (
            <div className="flex items-center justify-between rounded-md bg-danger/10 px-md py-sm text-xs text-danger">
              <span>{updatePathError}</span>
              <button type="button" onClick={() => setUpdatePathError(null)} aria-label="关闭提示">
                ×
              </button>
            </div>
          )}

          {projectActionError && (
            <div className="flex items-center justify-between rounded-md bg-danger/10 px-md py-sm text-xs text-danger">
              <span>{projectActionError}</span>
              <button
                type="button"
                onClick={() => setProjectActionError(null)}
                aria-label="关闭提示"
              >
                ×
              </button>
            </div>
          )}

          {isLoading ? (
            <SkeletonGrid />
          ) : projects.length === 0 ? (
            <EmptyState onAddProject={handleAddProject} isDragOver={isDragOver} />
          ) : visibleProjects.length === 0 ? (
            <p className="py-2xl text-center text-sm text-text-secondary">没有匹配的项目</p>
          ) : (
            <div className="grid grid-cols-3 gap-lg">
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  allTags={tags}
                  onStart={startProject}
                  onStop={stopProject}
                  onOpenLogs={setOpenLogPanelProjectId}
                  onEdit={setEditingProjectId}
                  onToggleFavorite={(projectId, isFavorite) =>
                    updateProject(projectId, { isFavorite })
                  }
                  onRevealInFinder={handleRevealInFinder}
                  onOpenInTerminal={handleOpenInTerminal}
                  onRequestDelete={handleRequestDelete}
                  onRequestUpdatePath={handleRequestUpdatePath}
                />
              ))}
            </div>
          )}
        </main>

        {openLogPanelProject && (
          <LogPanel
            projectId={openLogPanelProject.id}
            defaultTab={
              openLogPanelProject.status === 'error' ||
              openLogPanelProject.status === 'installFailed'
                ? 'stderr'
                : 'stdout'
            }
            isProcessActive={openLogPanelProject.status === 'running'}
            onClose={() => setOpenLogPanelProjectId(null)}
          />
        )}
      </div>

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          allTags={tags}
          onClose={() => setEditingProjectId(null)}
          onSave={updateProject}
          onCreateTag={createTag}
          onUploadIcon={handleUploadIcon}
          onRequestDelete={handleRequestDelete}
        />
      )}

      {deletingProject && (
        <ConfirmModal
          title="删除项目"
          message="确定要移除吗？不会删除项目文件，仅从 Hub 中移除。"
          confirmLabel="删除"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingProjectId(null)}
        />
      )}

      {isTagManageOpen && (
        <TagManageModal
          tags={tags}
          onClose={() => setIsTagManageOpen(false)}
          onCreate={createTag}
          onRename={renameTag}
          onDelete={deleteTag}
        />
      )}

      {runningCountOnClose !== null && (
        <ConfirmModal
          title="关闭 VibeHub"
          message={`有 ${runningCountOnClose} 个项目正在运行，关闭 VibeHub 将停止所有项目。确定要关闭吗？`}
          confirmLabel="停止并关闭"
          onConfirm={confirmClose}
          onCancel={cancelClose}
        />
      )}
    </div>
  )
}

export default App
