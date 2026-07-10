import { Settings } from 'lucide-react'
import type { Project, Tag } from '../../../shared/types'
import { TAG_DOT_CLASS } from '../lib/tag-colors'

interface TagSidebarProps {
  projects: Project[]
  tags: Tag[]
  selectedTagId: string | null
  onSelectTag: (tagId: string | null) => void
  onManageTags: () => void
}

export function TagSidebar({
  projects,
  tags,
  selectedTagId,
  onSelectTag,
  onManageTags
}: TagSidebarProps): React.JSX.Element {
  const countForTag = (tagId: string): number =>
    projects.filter((project) => project.tags.includes(tagId)).length

  // CMP-003：无项目关联的标签自动隐藏，除非当前正被选中
  const visibleTags = tags.filter((tag) => countForTag(tag.id) > 0 || tag.id === selectedTagId)

  return (
    <aside className="flex w-[200px] shrink-0 flex-col gap-xs bg-sidebar p-md">
      <button
        type="button"
        onClick={() => onSelectTag(null)}
        className={`flex items-center justify-between rounded-sm px-sm py-xs text-left text-sm ${
          selectedTagId === null
            ? 'bg-surface-hover font-medium text-text-primary'
            : 'text-text-secondary'
        }`}
      >
        <span>全部</span>
        <span className="text-text-secondary">{projects.length}</span>
      </button>

      {visibleTags.length === 0 ? (
        <p className="px-sm py-xs text-xs text-text-secondary">暂无标签，点击 + 创建</p>
      ) : (
        visibleTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => onSelectTag(tag.id)}
            className={`flex items-center justify-between rounded-sm px-sm py-xs text-left text-sm ${
              selectedTagId === tag.id
                ? 'bg-surface-hover font-medium text-text-primary'
                : 'text-text-secondary'
            }`}
          >
            <span className="flex items-center gap-xs">
              <span
                className={`h-2 w-2 rounded-full ${TAG_DOT_CLASS[tag.color] ?? 'bg-text-tertiary'}`}
              />
              {tag.name}
            </span>
            <span className="text-text-secondary">{countForTag(tag.id)}</span>
          </button>
        ))
      )}

      <button
        type="button"
        onClick={onManageTags}
        className="mt-xs flex items-center gap-xs rounded-sm px-sm py-xs text-left text-xs text-text-secondary hover:bg-surface-hover"
      >
        <Settings className="h-3.5 w-3.5" aria-hidden="true" />
        管理标签
      </button>
    </aside>
  )
}
