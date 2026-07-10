import { Folder } from 'lucide-react'

interface EmptyStateProps {
  onAddProject: () => void
  isDragOver: boolean
}

export function EmptyState({ onAddProject, isDragOver }: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={`flex h-full flex-1 flex-col items-center justify-center gap-md rounded-md border-2 border-dashed p-2xl text-center transition-colors ${
        isDragOver ? 'border-primary bg-surface-hover' : 'border-border'
      }`}
    >
      <Folder className="h-10 w-10 text-text-tertiary" aria-hidden="true" />
      <p className="text-sm text-text-secondary">
        还没有项目。拖拽文件夹到此处，或点击添加你的第一个项目
      </p>
      <button
        type="button"
        onClick={onAddProject}
        className="rounded-md bg-primary px-md py-sm text-sm font-medium text-white"
      >
        添加项目
      </button>
    </div>
  )
}
