import { useEffect, useRef } from 'react'
import type { ProjectEditor } from '../../../shared/types'

interface ProjectEditorMenuProps {
  onSelect: (editor: ProjectEditor) => void
  onClose: () => void
}

export function ProjectEditorMenu({
  onSelect,
  onClose
}: ProjectEditorMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const selectEditor = (editor: ProjectEditor): void => {
    onSelect(editor)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-6 z-40 flex min-w-[150px] flex-col rounded-md bg-surface p-xs shadow-modal"
    >
      <button
        type="button"
        onClick={() => selectEditor('cursor')}
        className="rounded-sm px-sm py-xs text-left text-sm text-text-primary hover:bg-surface-hover"
      >
        用 Cursor 打开
      </button>
      <button
        type="button"
        onClick={() => selectEditor('vscode')}
        className="rounded-sm px-sm py-xs text-left text-sm text-text-primary hover:bg-surface-hover"
      >
        用 VS Code 打开
      </button>
    </div>
  )
}
