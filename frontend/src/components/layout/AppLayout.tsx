'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  return (
    <div className="flex h-screen">
      {/* Mobile toggle button */}
      <button
        onClick={toggleSidebar}
        className="fixed left-4 top-4 z-50 p-2 rounded-md bg-background border border-border lg:hidden"
        aria-label="Toggle sidebar"
      >
        {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div
          data-testid="sidebar-overlay"
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        role="complementary"
        aria-label="Sidebar"
        data-open={isSidebarOpen}
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-card border-r border-border
          transform transition-transform duration-200
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold">Projects</h2>
        </div>
      </aside>

      {/* Main content */}
      <main
        role="main"
        aria-label="Main content"
        className="flex-1 flex flex-col overflow-hidden"
      >
        {children}
      </main>
    </div>
  )
}
