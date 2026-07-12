import { useState, type MouseEvent } from 'react'
import { AppWindow, FileText, Folder, Globe, Pencil, Play, Square } from 'lucide-react'
import type { Project, Tag } from '../../../shared/types'
import { StatusBadge } from './StatusBadge'
import { ProjectContextMenu } from './ProjectContextMenu'
import { TAG_DOT_CLASS } from '../lib/tag-colors'

interface ProjectCardProps {
  project: Project
  allTags: Tag[]
  onStart: (projectId: string, skipInstallCheck?: boolean) => void
  onStop: (projectId: string) => void
  onOpenLogs: (projectId: string) => void
  onEdit: (projectId: string) => void
  onRequestDelete: (projectId: string) => void
  onRequestUpdatePath: (projectId: string) => void
}

const TYPE_ICON = {
  web: Globe,
  app: AppWindow
}

const MAX_VISIBLE_TAGS = 3

export function ProjectCard({
  project,
  allTags,
  onStart,
  onStop,
  onOpenLogs,
  onEdit,
  onRequestDelete,
  onRequestUpdatePath
}: ProjectCardProps): React.JSX.Element {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const TypeIcon = TYPE_ICON[project.projectKind]
  const isUnrecognized = project.status === 'error' && project.projectType === 'unknown'
  const isMissing = project.status === 'missing'
  const canControl = !isUnrecognized && !isMissing

  const projectTags = project.tags
    .map((tagId) => allTags.find((tag) => tag.id === tagId))
    .filter((tag): tag is Tag => tag !== undefined)
  const visibleTags = projectTags.slice(0, MAX_VISIBLE_TAGS)
  const hiddenTagCount = projectTags.length - visibleTags.length

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setContextMenuPos({ x: event.clientX, y: event.clientY })
  }

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        className={`flex flex-col gap-sm rounded-md bg-surface p-md shadow-card transition-shadow hover:shadow-card-hover ${
          isMissing ? 'border-2 border-danger' : ''
        }`}
      >
        <div className="flex items-start gap-sm">
          <div className="relative h-12 w-12 shrink-0">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-surface-hover">
              {project.iconPath ? (
                <img
                  src={`file://${project.iconPath}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Folder className="h-6 w-6 text-text-secondary" aria-hidden="true" />
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface">
              <TypeIcon className="h-3 w-3 text-text-secondary" aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-xs">
              <p className="line-clamp-2 flex-1 text-sm font-medium text-text-primary">
                {project.name}
              </p>
              <button
                type="button"
                onClick={() => onEdit(project.id)}
                aria-label="编辑"
                className="shrink-0 text-text-tertiary hover:text-text-secondary"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            {project.description && (
              <p className="truncate text-xs text-text-secondary">{project.description}</p>
            )}
            {visibleTags.length > 0 && (
              <div className="mt-xs flex flex-wrap gap-xs">
                {visibleTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-xs rounded-sm bg-surface-hover px-xs py-[1px] text-[11px] text-text-secondary"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${TAG_DOT_CLASS[tag.color] ?? 'bg-text-tertiary'}`}
                    />
                    {tag.name}
                  </span>
                ))}
                {hiddenTagCount > 0 && (
                  <span className="text-[11px] text-text-secondary">+{hiddenTagCount}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          {isUnrecognized ? (
            <StatusBadge
              status={project.status}
              port={project.port}
              projectKind={project.projectKind}
              errorMessage="无法识别项目类型"
            />
          ) : (
            <StatusBadge
              status={project.status}
              port={project.port}
              projectKind={project.projectKind}
            />
          )}

          {canControl && project.status === 'stopped' && (
            <button
              type="button"
              onClick={() => onStart(project.id)}
              aria-label="启动"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          {canControl && project.status === 'running' && (
            <button
              type="button"
              onClick={() => onStop(project.id)}
              aria-label="停止"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-danger text-white"
            >
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}

          {canControl && project.status === 'error' && (
            <div className="flex items-center gap-xs">
              <button
                type="button"
                onClick={() => onOpenLogs(project.id)}
                aria-label="日志"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-hover text-text-secondary"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onStart(project.id)}
                aria-label="重试"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* SCOPE-015：依赖安装失败提供重试（重新走一遍安装检测）和跳过（绕过检测直接尝试启动） */}
          {canControl && project.status === 'installFailed' && (
            <div className="flex items-center gap-xs">
              <button
                type="button"
                onClick={() => onOpenLogs(project.id)}
                aria-label="日志"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-hover text-text-secondary"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onStart(project.id, true)}
                className="rounded-md bg-surface-hover px-sm py-xs text-xs font-medium text-text-secondary"
              >
                跳过
              </button>
              <button
                type="button"
                onClick={() => onStart(project.id)}
                aria-label="重试"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {isMissing && (
            <div className="flex items-center gap-xs">
              <button
                type="button"
                onClick={() => onRequestUpdatePath(project.id)}
                className="rounded-md bg-surface-hover px-sm py-xs text-xs font-medium text-text-secondary"
              >
                更新路径
              </button>
              <button
                type="button"
                onClick={() => onRequestDelete(project.id)}
                className="rounded-md bg-danger px-sm py-xs text-xs font-medium text-white"
              >
                移除
              </button>
            </div>
          )}
        </div>
      </div>
      {contextMenuPos && (
        <ProjectContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onEdit={() => onEdit(project.id)}
          onDelete={() => onRequestDelete(project.id)}
          onClose={() => setContextMenuPos(null)}
        />
      )}
    </>
  )
}
