'use client'

import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import ProjectSidebar from '@/components/layout/ProjectSidebar'
import type { Project } from '@/lib/types'

const demoProjects: Project[] = [
  { id: '1', name: 'Project A', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Project B', createdAt: new Date(), updatedAt: new Date() },
]

export default function Home() {
  const [projects, setProjects] = useState<Project[]>(demoProjects)
  const [activeProjectId, setActiveProjectId] = useState<string | null>('1')

  const handleNewProject = () => {
    const newProject: Project = {
      id: String(Date.now()),
      name: `New Project ${projects.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setProjects([...projects, newProject])
    setActiveProjectId(newProject.id)
  }

  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Sidebar content */}
        <div className="w-64 border-r border-border bg-card hidden lg:block">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Projects</h2>
          </div>
          <ProjectSidebar
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
            onNewProject={handleNewProject}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 p-8">
          {activeProject ? (
            <div>
              <h1 className="text-2xl font-bold mb-4">{activeProject.name}</h1>
              <p className="text-muted-foreground">
                Start typing or upload a file to begin your writing session.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                Select a project or create a new one to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
