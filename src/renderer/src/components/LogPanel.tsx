import { useCallback, useEffect, useRef, useState } from 'react'
import { GripHorizontal, X } from 'lucide-react'
import { useProjectLogs } from '../hooks/useProjectLogs'
import type { LogStream } from '../../../shared/types'

interface LogPanelProps {
  projectId: string
  defaultTab: LogStream
  isProcessActive: boolean
  onClose: () => void
}

const DEFAULT_HEIGHT_PX = 240
const MIN_HEIGHT_PX = 140
const MAX_HEIGHT_PX = 480

export function LogPanel({
  projectId,
  defaultTab,
  isProcessActive,
  onClose
}: LogPanelProps): React.JSX.Element {
  const { logs } = useProjectLogs(projectId)
  const [activeTab, setActiveTab] = useState<LogStream>(defaultTab)
  const [height, setHeight] = useState(DEFAULT_HEIGHT_PX)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<{ startY: number; startHeight: number } | null>(null)

  // defaultTab 变化即代表项目切换或状态刚转入错误态（见 App.tsx），此时应
  // 强制切回该 tab（AC-003：启动失败自动高亮 stderr），而不只是初始值
  useEffect(() => {
    setActiveTab(defaultTab)
  }, [projectId, defaultTab])

  const visibleEntries = logs.filter((entry) => entry.stream === activeTab)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [visibleEntries.length, activeTab])

  const handleDragMove = useCallback((event: MouseEvent): void => {
    if (!dragStateRef.current) {
      return
    }
    // 面板从底部滑出，向上拖拽把手（鼠标 Y 减小）应该增大高度
    const delta = dragStateRef.current.startY - event.clientY
    const nextHeight = Math.min(
      MAX_HEIGHT_PX,
      Math.max(MIN_HEIGHT_PX, dragStateRef.current.startHeight + delta)
    )
    setHeight(nextHeight)
  }, [])

  const handleDragEnd = useCallback(
    function handleDragEnd(): void {
      dragStateRef.current = null
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
    },
    [handleDragMove]
  )

  const handleDragStart = useCallback(
    (event: React.MouseEvent): void => {
      dragStateRef.current = { startY: event.clientY, startHeight: height }
      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
    },
    [height, handleDragMove, handleDragEnd]
  )

  return (
    <div className="flex shrink-0 flex-col rounded-t-md bg-log-bg" style={{ height }}>
      <button
        type="button"
        onMouseDown={handleDragStart}
        aria-label="拖拽调整日志面板高度"
        className="flex h-3 w-full cursor-row-resize items-center justify-center"
      >
        <GripHorizontal className="h-3 w-3 text-white/30" aria-hidden="true" />
      </button>

      <div className="flex items-center justify-between px-md pb-sm">
        <div className="flex gap-xs">
          {(['stdout', 'stderr'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-sm px-sm py-xs text-xs font-medium ${
                activeTab === tab
                  ? tab === 'stderr'
                    ? 'bg-log-error/20 text-log-error'
                    : 'bg-white/10 text-log-text'
                  : 'text-white/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭日志面板"
          className="text-white/50 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-md pb-sm font-mono text-xs leading-[18px] whitespace-pre-wrap"
      >
        {visibleEntries.length === 0 ? (
          <p className="text-white/40">暂无日志输出</p>
        ) : (
          <>
            {visibleEntries.map((entry, index) => (
              <div
                key={`${entry.timestamp}-${index}`}
                className={activeTab === 'stderr' ? 'text-log-error' : 'text-log-text'}
              >
                {entry.text}
              </div>
            ))}
            {isProcessActive && (
              <span
                className="inline-block h-3 w-1.5 animate-pulse bg-log-text"
                aria-hidden="true"
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
