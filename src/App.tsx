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
      <div className="min-h-screen flex overflow-x-hidden">
        <SidebarNav />

        {/* Content column */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <Topbar />

          {/* Main content — full width, no right rail */}
          <main className="flex-1 px-2 sm:px-4 pt-24 sm:pt-3 md:pt-4 pb-20 md:pb-6 min-w-0 overflow-y-auto">
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
