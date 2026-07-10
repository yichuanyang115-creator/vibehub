import { useCallback, useEffect, useState } from 'react'

interface UseWindowCloseGuardResult {
  runningCountOnClose: number | null
  confirmClose: () => void
  cancelClose: () => void
}

// REQ-011：主进程拦截窗口关闭动作后通知 renderer 弹出确认对话框
export function useWindowCloseGuard(): UseWindowCloseGuardResult {
  const [runningCountOnClose, setRunningCountOnClose] = useState<number | null>(null)

  useEffect(() => {
    return window.api.onCloseRequested((runningCount) => {
      setRunningCountOnClose(runningCount)
    })
  }, [])

  const confirmClose = useCallback((): void => {
    window.api
      .confirmCloseWindow()
      .catch((error) => console.error('Failed to confirm close window', error))
  }, [])

  const cancelClose = useCallback((): void => setRunningCountOnClose(null), [])

  return { runningCountOnClose, confirmClose, cancelClose }
}
