import { Loader2 } from 'lucide-react'
import type { ProjectStatus } from '../../../shared/types'

interface StatusBadgeProps {
  status: ProjectStatus
  port: number | null
  projectKind: 'web' | 'app'
  errorMessage?: string
}

const DOT_COLOR: Record<ProjectStatus, string> = {
  stopped: 'bg-text-tertiary',
  launching: 'bg-warning',
  running: 'bg-success',
  error: 'bg-danger',
  missing: 'bg-danger',
  installing: 'bg-warning',
  installFailed: 'bg-danger'
}

function truncateError(message: string): string {
  return message.length > 30 ? `${message.slice(0, 30)}...` : message
}

export function StatusBadge({
  status,
  port,
  projectKind,
  errorMessage
}: StatusBadgeProps): React.JSX.Element {
  const label = (): string => {
    switch (status) {
      case 'stopped':
        return '已停止'
      case 'launching':
        return '启动中'
      case 'running':
        return projectKind === 'web' && port !== null ? `运行中 · ${port}` : '运行中'
      case 'error':
        return errorMessage ? truncateError(errorMessage) : '错误'
      case 'missing':
        return '项目路径不存在'
      case 'installing':
        return '正在安装依赖...'
      case 'installFailed':
        return '依赖安装失败'
    }
  }

  return (
    <span className="inline-flex items-center gap-xs text-xs text-text-secondary">
      {status === 'launching' || status === 'installing' ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin text-warning" aria-hidden="true" />
      ) : (
        <span
          className={`h-2 w-2 rounded-full ${DOT_COLOR[status]} ${status === 'running' ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
      )}
      {label()}
    </span>
  )
}
