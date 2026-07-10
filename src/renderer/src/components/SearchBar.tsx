import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps): React.JSX.Element {
  return (
    <div className="relative flex w-full max-w-[240px] items-center">
      <Search
        className="pointer-events-none absolute left-sm h-3.5 w-3.5 text-text-tertiary"
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="搜索项目..."
        aria-label="搜索项目"
        className="w-full rounded-md border border-border bg-surface py-sm pl-[28px] pr-md text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清空搜索"
          className="absolute right-sm text-text-tertiary hover:text-text-secondary"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
