import { useEffect, useRef } from 'react'

interface ProjectContextMenuProps {
  x: number
  y: number
  onEdit: () => void
  onRevealInFinder: () => void
  onOpenInTerminal: () => void
  onDelete: () => void
  onClose: () => void
}

export function ProjectContextMenu({
  x,
  y,
  onEdit,
  onRevealInFinder,
  onOpenInTerminal,
  onDelete,
  onClose
}: ProjectContextMenuProps): React.JSX.Element {
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

  return (
    <div
      ref={menuRef}
      style={{ top: y, left: x }}
      className="fixed z-50 flex min-w-[120px] flex-col rounded-md bg-surface p-xs shadow-modal"
    >
      <button
        type="button"
        onClick={() => {
          onOpenInTerminal()
          onClose()
        }}
        className="rounded-sm px-sm py-xs text-left text-sm text-text-primary hover:bg-surface-hover"
      >
        在终端中打开
      </button>
      <button
        type="button"
        onClick={() => {
          onRevealInFinder()
          onClose()
        }}
        className="rounded-sm px-sm py-xs text-left text-sm text-text-primary hover:bg-surface-hover"
      >
        在 Finder 中显示
      </button>
      <button
        type="button"
        onClick={() => {
          onEdit()
          onClose()
        }}
        className="rounded-sm px-sm py-xs text-left text-sm text-text-primary hover:bg-surface-hover"
      >
        编辑
      </button>
      <button
        type="button"
        onClick={() => {
          onDelete()
          onClose()
        }}
        className="rounded-sm px-sm py-xs text-left text-sm text-danger hover:bg-surface-hover"
      >
        删除
      </button>
    </div>
  )
}
