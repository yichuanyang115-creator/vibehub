import { ChevronDown } from 'lucide-react'
import type { SortOption } from '../../../shared/types'

interface SortDropdownProps {
  value: SortOption
  onChange: (value: SortOption) => void
}

const SORT_LABELS: Record<SortOption, string> = {
  recent: '最近打开',
  frequent: '最常打开',
  'name-asc': '名称 A-Z',
  'name-desc': '名称 Z-A'
}

export function SortDropdown({ value, onChange }: SortDropdownProps): React.JSX.Element {
  return (
    <div className="relative flex items-center">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortOption)}
        aria-label="排序方式"
        className="appearance-none rounded-md border border-border bg-surface py-sm pl-sm pr-2xl text-sm text-text-primary focus:border-border-focus focus:outline-none"
      >
        {Object.entries(SORT_LABELS).map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-sm h-3.5 w-3.5 text-text-secondary"
        aria-hidden="true"
      />
    </div>
  )
}
