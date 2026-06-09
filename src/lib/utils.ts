import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'Rs.') {
  return `${currency} ${amount.toLocaleString('en-PK')}`
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
