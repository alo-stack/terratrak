import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from './Icon'
import ThemeToggle from './ThemeToggle'
import logo from '../assets/logo.png'

type NavKey = 'overview' | 'sensors' | 'settings' | 'about'
type Item = { key: NavKey; label: string; icon: 'dashboard'|'gauge'|'cog'|'info'; to: string }

const items: Item[] = [
  { key: 'overview', label: 'Dashboard', icon: 'dashboard', to: '/' },
  { key: 'sensors',  label: 'Sensors',   icon: 'gauge',     to: '/sensors' },
  { key: 'settings', label: 'Settings',  icon: 'cog',       to: '/settings' },
  { key: 'about',    label: 'About',     icon: 'info',      to: '/about' },
]

export default function SidebarNav(){
  const { pathname } = useLocation()
  const active: NavKey =
    pathname.startsWith('/sensors')  ? 'sensors'  :
    pathname.startsWith('/settings') ? 'settings' :
    pathname.startsWith('/about')    ? 'about'    :
    'overview'

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 px-4 py-6">
      {/* Logo aligned left */}
      <div className="mb-8 flex items-center">
        <img
          src={logo}
          alt="App Logo"
          className="w-10 h-10 object-contain drop-shadow-sm dark:drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]"
        />
      </div>

      {/* Nav list with better spacing */}
      <nav className="flex flex-col gap-3">
        {items.map((it) => {
          const selected = it.key === active
          return (
            <Link
              key={it.key}
              to={it.to}
              className={[
                'sidebar-item group',
                selected
                  ? 'bg-white text-gray-900 shadow-sm border border-[hsl(var(--border))] dark:bg-white/10 dark:text-white dark:border-white/10'
                  : 'text-gray-700 hover:bg-[hsl(var(--muted))] dark:text-gray-300 dark:hover:bg-white/[0.06]'
              ].join(' ')}
            >
              <Icon
                name={it.icon}
                className={[
                  'w-4 h-4 shrink-0 transition-transform duration-150',
                  selected ? 'scale-[1.05]' : 'group-hover:scale-105'
                ].join(' ')}
              />
              <span className={selected ? 'font-semibold' : 'font-medium'}>{it.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom: theme toggle */}
      <div className="mt-auto pt-6">
        <ThemeToggle />
      </div>
    </aside>
  )
}
