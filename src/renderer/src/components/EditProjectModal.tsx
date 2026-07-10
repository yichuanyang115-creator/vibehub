import { useState } from 'react'
import { Modal } from './Modal'
import { IconUploader } from './IconUploader'
import { TagInput } from './TagInput'
import { StartCommandInput } from './StartCommandInput'
import type { Project, Tag, UpdateProjectInput } from '../../../shared/types'

interface EditProjectModalProps {
  project: Project
  allTags: Tag[]
  onClose: () => void
  onSave: (projectId: string, input: UpdateProjectInput) => Promise<void>
  onCreateTag: (name: string) => Promise<Tag>
  onUploadIcon: (mimeType: string, base64Data: string) => Promise<void>
  onRequestDelete: (projectId: string) => void
}

export function EditProjectModal({
  project,
  allTags,
  onClose,
  onSave,
  onCreateTag,
  onUploadIcon,
  onRequestDelete
}: EditProjectModalProps): React.JSX.Element {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [tagIds, setTagIds] = useState<string[]>(project.tags)
  const [startCommand, setStartCommand] = useState(project.startCommand ?? '')
  const [isSaving, setIsSaving] = useState(false)

  // REQ-007：仅 unknown 类型（既非可识别的 web 子类型，也非 app）展示启动命令字段
  const isUnrecognized = project.projectKind === 'web' && project.projectType === 'unknown'
  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0 && !isSaving

  const toggleTag = (tagId: string): void => {
    setTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    )
  }

  const handleSave = async (): Promise<void> => {
    if (!canSave) {
      return
    }
    setIsSaving(true)
    try {
      const input: UpdateProjectInput = {
        name: trimmedName,
        description,
        tags: tagIds
      }
      if (isUnrecognized) {
        input.startCommand = startCommand.trim() || null
      }
      await onSave(project.id, input)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const footer = (
    <div className="flex w-full items-center justify-between">
      <button
        type="button"
        onClick={() => onRequestDelete(project.id)}
        className="rounded-md px-md py-sm text-sm font-medium text-danger"
      >
        删除项目
      </button>
      <div className="flex items-center gap-sm">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-md py-sm text-sm font-medium text-text-secondary"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-md bg-primary px-md py-sm text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-text-tertiary"
        >
          保存
        </button>
      </div>
    </div>
  )

  return (
    <Modal title="编辑项目" onClose={onClose} footer={footer}>
      <div className="flex flex-col gap-md">
        <IconUploader iconPath={project.iconPath} onUpload={onUploadIcon} />

        <div className="flex flex-col gap-xs">
          <label htmlFor="project-name" className="text-xs font-medium text-text-primary">
            名称
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：Todo App"
            className="rounded-md border border-border bg-surface px-sm py-sm text-sm text-text-primary focus:border-border-focus focus:outline-none"
          />
          {trimmedName.length === 0 && <p className="text-xs text-danger">项目名称不能为空</p>}
        </div>

        <div className="flex flex-col gap-xs">
          <label htmlFor="project-description" className="text-xs font-medium text-text-primary">
            描述
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="resize-none rounded-md border border-border bg-surface px-sm py-sm text-sm text-text-primary focus:border-border-focus focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-xs">
          <span className="text-xs font-medium text-text-primary">标签</span>
          <TagInput
            allTags={allTags}
            selectedTagIds={tagIds}
            onToggle={toggleTag}
            onCreate={onCreateTag}
          />
        </div>

        {isUnrecognized && <StartCommandInput value={startCommand} onChange={setStartCommand} />}
      </div>
    </Modal>
  )
}
