import { useCallback, useEffect, useState } from 'react'
import type { Tag } from '../../../shared/types'

interface UseTagsResult {
  tags: Tag[]
  createTag: (name: string) => Promise<Tag>
  renameTag: (tagId: string, name: string) => Promise<void>
  deleteTag: (tagId: string) => Promise<void>
}

export function useTags(): UseTagsResult {
  const [tags, setTags] = useState<Tag[]>([])

  const refresh = useCallback(async (): Promise<void> => {
    const result = await window.api.getTags()
    setTags(result)
  }, [])

  useEffect(() => {
    refresh().catch((error) => console.error('Failed to load tags', error))
  }, [refresh])

  const createTag = useCallback(
    async (name: string): Promise<Tag> => {
      const tag = await window.api.createTag(name)
      await refresh()
      return tag
    },
    [refresh]
  )

  const renameTag = useCallback(
    async (tagId: string, name: string): Promise<void> => {
      await window.api.renameTag(tagId, name)
      await refresh()
    },
    [refresh]
  )

  const deleteTag = useCallback(
    async (tagId: string): Promise<void> => {
      await window.api.deleteTag(tagId)
      await refresh()
    },
    [refresh]
  )

  return { tags, createTag, renameTag, deleteTag }
}
