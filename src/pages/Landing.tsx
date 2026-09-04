import React, { useState } from 'react'
import { useSession } from '../hooks/useSession'
import { useAuth } from '../hooks/useAuth'

export default function Landing() {
  const { session, startNewSession } = useSession()
  const { signInAsGuest, authState } = useAuth()
  const [guestError, setGuestError] = useState('')
  const [isLoadingGuest, setIsLoadingGuest] = useState(false)

  const handleContinueAsGuest = async () => {
    setGuestError('')
    setIsLoadingGuest(true)

    const { error } = await signInAsGuest()

    if (error) {
      setGuestError(error)
      setIsLoadingGuest(false)
    } else {
      // Navigate to frame gallery after successful guest authentication
      location.hash = '#/frames'
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <section className="grid items-center gap-8 rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-6 shadow-sm ring-1 ring-indigo-100 md:grid-cols-2 md:p-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Instant photobooth</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">Create a keepsake in the perfect frame.</h1>
          <p className="mt-4 max-w-lg text-base text-slate-600">Choose a layout, take your photos, refine the edit, and download your finished composition.</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleContinueAsGuest}
              disabled={isLoadingGuest}
              className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingGuest ? 'Signing In...' : 'Continue as Guest'}
            </button>
            <a href="#/signin" className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700">Sign In</a>
          </div>

          {guestError && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {guestError}
            </div>
          )}

          <p className="mt-4 text-sm text-slate-500">Your photos stay in this session until you finish or start again.</p>
        </div>

        <div className="space-y-3">
          <div className="h-40 rounded-2xl bg-gradient-to-r from-pink-200 via-rose-100 to-indigo-200 shadow-inner" />
          <div className="h-40 rounded-2xl bg-gradient-to-r from-amber-100 via-emerald-100 to-cyan-200 shadow-inner" />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900">How it works</h2>
        <ol className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-xl border border-slate-200 bg-white p-4"><span className="font-semibold text-slate-900">1.</span> Pick a frame</li>
          <li className="rounded-xl border border-slate-200 bg-white p-4"><span className="font-semibold text-slate-900">2.</span> Capture your photos</li>
          <li className="rounded-xl border border-slate-200 bg-white p-4"><span className="font-semibold text-slate-900">3.</span> Adjust the edit</li>
          <li className="rounded-xl border border-slate-200 bg-white p-4"><span className="font-semibold text-slate-900">4.</span> Download the result</li>
        </ol>
      </section>
    </main>
  )
}
