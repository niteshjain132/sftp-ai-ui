import { Search } from 'lucide-react'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder }: Props) {
  return (
    <label className="relative block min-w-[220px] flex-1">
      <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search name or regex'}
        className="h-9 w-full rounded-full border border-border bg-card pr-3 pl-9 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
      />
    </label>
  )
}
