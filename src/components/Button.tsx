import React from 'react'

export default function Button({ children, className, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:-translate-y-0.5 enabled:hover:shadow-sm active:translate-y-0 ${className || ''}`}
    >
      {children}
    </button>
  )
}
