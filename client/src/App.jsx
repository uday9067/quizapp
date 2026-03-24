import React, { useState } from 'react'
import Home from './pages/Home'
import Host from './pages/Host'
import Player from './pages/Player'

export default function App() {
  const [view, setView] = useState('home') // home | host | player

  return (
    <>
      {view === 'home' && (
        <Home
          onHost={() => setView('host')}
          onJoin={() => setView('player')}
        />
      )}
      {view === 'host' && (
        <Host onBack={() => setView('home')} />
      )}
      {view === 'player' && (
        <Player onBack={() => setView('home')} />
      )}
    </>
  )
}
