import { useState, type KeyboardEvent } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Modal } from './Modal'
import type { Tag } from '../../../shared/types'
import { TAG_DOT_CLASS } from '../lib/tag-colors'

interface TagManageModalProps {
  tags: Tag[]
  onClose: () => void
  onCreate: (name: string) => Promise<Tag>
  onRename: (tagId: string, name: string) => Promise<void>
  onDelete: (tagId: string) => Promise<void>
}

export function TagManageModal({
  tags,
  onClose,
  onCreate,
  onRename,
  onDelete
}: TagManageModalProps): React.JSX.Element {
  const [newTagName, setNewTagName] = useState('')
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleCreate = async (): Promise<void> => {
    const name = newTagName.trim()
    if (!name) {
      return
    }
    await onCreate(name)
    setNewTagName('')
  }

  const startEditing = (tag: Tag): void => {
    setEditingTagId(tag.id)
    setEditingName(tag.name)
  }

  const commitEditing = async (): Promise<void> => {
    const name = editingName.trim()
    if (editingTagId && name) {
      await onRename(editingTagId, name)
    }
    setEditingTagId(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, onEnter: () => void): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onEnter()
    }
  }

  return (
    <Modal title="管理标签" onClose={onClose}>
      <div className="flex flex-col gap-md">
        <div className="flex items-center gap-xs">
          <input
            type="text"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, handleCreate)}
            placeholder="新建标签"
            className="flex-1 rounded-md border border-border bg-surface px-sm py-sm text-sm text-text-primary focus:border-border-focus focus:outline-none"
          />
          <button
            type="button"
            onClick={handleCreate}
            aria-label="新建标签"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {tags.length === 0 ? (
          <p className="text-sm text-text-secondary">暂无标签，点击 + 创建</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {tags.map((tag) => (
              <li
                key={tag.id}
                className="group flex items-center justify-between rounded-md px-sm py-xs hover:bg-surface-hover"
              >
                {editingTagId === tag.id ? (
                  <input
                    type="text"
                    value={editingName}
                    autoFocus
                    onChange={(event) => setEditingName(event.target.value)}
                    onKeyDown={(event) => handleKeyDown(event, commitEditing)}
                    className="flex-1 rounded-sm border border-border-focus bg-surface px-xs py-xs text-sm text-text-primary focus:outline-none"
                  />
                ) : (
                  <span className="flex items-center gap-xs text-sm text-text-primary">
                    <span
                      className={`h-2 w-2 rounded-full ${TAG_DOT_CLASS[tag.color] ?? 'bg-text-tertiary'}`}
                    />
                    {tag.name}
                  </span>
                )}

                <div className="flex items-center gap-xs opacity-0 group-hover:opacity-100">
                  {editingTagId === tag.id ? (
                    <>
                      <button
                        type="button"
                        onClick={commitEditing}
                        aria-label="确认"
                        className="text-text-secondary"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTagId(null)}
                        aria-label="取消"
                        className="text-text-secondary"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEditing(tag)}
                        aria-label="重命名"
                        className="text-text-secondary"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(tag.id)}
                        aria-label="删除"
                        className="text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
