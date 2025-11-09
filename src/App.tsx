import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SidebarNav from './components/SidebarNav'
import Topbar from './components/Topbar'
import Overview from './pages/Overview'
import Sensors from './pages/Sensors'
import Settings from './pages/Settings'
import About from './pages/About'

export default function App(){
  return (
    <BrowserRouter>
      <div className="min-h-screen flex">
        <SidebarNav />

        {/* Content column */}
        <div className="flex-1 flex flex-col">
          <Topbar />

          {/* Main content — full width, no right rail */}
          <main className="px-4 pb-6">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/sensors" element={<Sensors />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
