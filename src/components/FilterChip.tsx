import React from 'react'

export default function FilterChip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded-full text-sm ${active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
      {children}
    </button>
  )
}
