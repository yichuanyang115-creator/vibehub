import { useCallback, useEffect, useState } from 'react'
import type { LogEntry } from '../../../shared/types'

interface UseProjectLogsResult {
  logs: LogEntry[]
  loadLogs: () => void
}

export function useProjectLogs(projectId: string): UseProjectLogsResult {
  const [logs, setLogs] = useState<LogEntry[]>([])

  const loadLogs = useCallback((): void => {
    window.api
      .getLogsForProject(projectId)
      .then(setLogs)
      .catch((error) => console.error('Failed to load logs', error))
  }, [projectId])

  useEffect(() => {
    let isActive = true
    window.api
      .getLogsForProject(projectId)
      .then((entries) => {
        if (isActive) {
          setLogs(entries)
        }
      })
      .catch((error) => console.error('Failed to load logs', error))
    return () => {
      isActive = false
    }
  }, [projectId])

  useEffect(() => {
    return window.api.onLogAppended((appendedProjectId, entry) => {
      if (appendedProjectId === projectId) {
        setLogs((current) => [...current, entry])
      }
    })
  }, [projectId])

  return { logs, loadLogs }
}
