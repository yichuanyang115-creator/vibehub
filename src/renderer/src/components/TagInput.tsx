import { useState, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import type { Tag } from '../../../shared/types'
import { TAG_DOT_CLASS } from '../lib/tag-colors'

interface TagInputProps {
  allTags: Tag[]
  selectedTagIds: string[]
  onToggle: (tagId: string) => void
  onCreate: (name: string) => Promise<Tag>
}

export function TagInput({
  allTags,
  selectedTagIds,
  onToggle,
  onCreate
}: TagInputProps): React.JSX.Element {
  const [newTagName, setNewTagName] = useState('')

  const handleCreate = async (): Promise<void> => {
    const name = newTagName.trim()
    if (!name) {
      return
    }
    const tag = await onCreate(name)
    onToggle(tag.id)
    setNewTagName('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleCreate()
    }
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap gap-xs">
        {allTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggle(tag.id)}
              className={`flex items-center gap-xs rounded-sm px-sm py-xs text-xs ${
                isSelected ? 'bg-primary text-white' : 'bg-surface-hover text-text-secondary'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${TAG_DOT_CLASS[tag.color] ?? 'bg-text-tertiary'}`}
              />
              {tag.name}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-xs">
        <input
          type="text"
          value={newTagName}
          onChange={(event) => setNewTagName(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="新建标签"
          className="flex-1 rounded-sm border border-border bg-surface px-sm py-xs text-xs text-text-primary focus:border-border-focus focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCreate}
          aria-label="新建标签"
          className="flex h-6 w-6 items-center justify-center rounded-sm bg-surface-hover text-text-secondary"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
