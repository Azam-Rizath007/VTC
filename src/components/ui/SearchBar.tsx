'use client'
import { cn } from '@/lib/utils'
import { Search, X } from 'lucide-react'
import { InputHTMLAttributes, useState } from 'react'

interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch?: (value: string) => void
  onChange?: (value: string) => void
}

export function SearchBar({ className, placeholder = 'Search...', onSearch, onChange, ...props }: SearchBarProps) {
  const [value, setValue] = useState('')

  const handleChange = (v: string) => {
    setValue(v)
    onChange?.(v)
    onSearch?.(v)
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-700 focus:border-transparent"
        {...props}
      />
      {value && (
        <button
          onClick={() => handleChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
