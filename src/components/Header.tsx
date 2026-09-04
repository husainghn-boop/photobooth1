import React from 'react'
import { useSession } from '../hooks/useSession'
import { useAuth } from '../hooks/useAuth'

export default function Header({ children }: { children?: React.ReactNode }) {
  const { session, startNewSession } = useSession()
  const { user, userType, signOut, isAuthenticated } = useAuth()

  const start = () => {
    startNewSession(session?.selectedFrame)
    location.hash = '#/studio'
  }

  const handleLogout = async () => {
    await signOut()
    location.hash = '#/'
  }

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="#/" className="text-2xl font-semibold text-indigo-700">Photobooth</a>
          <nav className="hidden md:flex gap-4 text-sm text-gray-600 items-center">
            <a href="#/frames" className="hover:underline">Frames</a>
            <a href="#/frames?tab=community" className="hover:underline">Community</a>
            <a href="#/frames?tab=official" className="hover:underline">Official</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated && user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-600">
                {userType === 'registered' ? user.email : 'Guest'}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded bg-gray-100 text-sm hover:bg-gray-200"
              >
                Logout
              </button>
            </div>
          )}
          {!isAuthenticated && (
            <a href="#/signin" className="px-3 py-2 rounded bg-gray-100 text-sm">
              Sign In
            </a>
          )}
          {userType === 'registered' && <a href="#/upload" className="px-3 py-2 rounded bg-gray-100 text-sm">Upload Frame</a>}
          <button onClick={start} className="px-3 py-2 rounded bg-indigo-600 text-white text-sm">Start Photobooth</button>
        </div>
      </div>
    </header>
  )
}
