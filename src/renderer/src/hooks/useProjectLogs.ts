import { useCallback, useEffect, useState } from 'react'
import type { LogEntry } from '../../../shared/types'

interface UseProjectLogsResult {
  logs: LogEntry[]
  loadLogs: () => void
}

export function useProjectLogs(projectId: string | null): UseProjectLogsResult {
  const [logs, setLogs] = useState<LogEntry[]>([])

  const loadLogs = useCallback((): void => {
    if (!projectId) {
      setLogs([])
      return
    }
    window.api
      .getLogsForProject(projectId)
      .then(setLogs)
      .catch((error) => console.error('Failed to load logs', error))
  }, [projectId])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useEffect(() => {
    if (!projectId) {
      return undefined
    }
    return window.api.onLogAppended((appendedProjectId, entry) => {
      if (appendedProjectId === projectId) {
        setLogs((current) => [...current, entry])
      }
    })
  }, [projectId])

  return { logs, loadLogs }
}
