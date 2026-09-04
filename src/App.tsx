import React, { useEffect, useState } from 'react'
import Header from './components/Header'
import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import FrameGallery from './pages/FrameGallery'
import Studio from './pages/Studio'
import Review from './pages/Review'
import Editor from './pages/Editor'
import Result from './pages/Result'
import Upload from './pages/Upload'
import { useSession } from './hooks/useSession'
import { useAuth } from './hooks/useAuth'

function Router({ route }: { route: string }) {
  const path = route.split('?')[0]
  switch (path) {
    case '/signin':
      return <SignIn />
    case '/signup':
      return <SignUp />
    case '/frames':
    case '/gallery':
      return <FrameGallery />
    case '/upload':
      return <Upload />
    case '/studio':
      return <Studio />
    case '/review':
      return <Review />
    case '/editor':
      return <Editor />
    case '/result':
      return <Result />
    default:
      return <Landing />
  }
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash.replace('#', '') || '/')
  useSession()
  useAuth()

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#', '') || '/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="app-shell">
      <Header />
      <Router route={route} />
      <footer className="mt-auto py-6 text-center text-sm text-gray-500">© Photobooth • Photos expire after 24 hours</footer>
    </div>
  )
}
