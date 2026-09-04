import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function SignIn() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await signInWithEmail(email, password);

    if (signInError) {
      setError(signInError);
      setLoading(false);
    } else {
      // Redirect to frame gallery on successful sign-in
      location.hash = '#/frames';
    }
  };

  const handleBackToLanding = () => {
    location.hash = '#/';
  };

  return (
    <main className="mx-auto max-w-md p-4 sm:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <button
          onClick={handleBackToLanding}
          className="mb-6 text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to home
        </button>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign In</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in with your email and password to access your frames and saved sessions.</p>

        <form onSubmit={handleSignIn} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <a href="#/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
              Create Account
            </a>
          </p>
          <p className="text-center text-sm text-slate-500">
            Or{' '}
            <a href="#/" className="font-medium text-indigo-600 hover:text-indigo-500">
              Continue as Guest
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
