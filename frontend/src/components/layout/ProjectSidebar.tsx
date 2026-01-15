'use client'

import { Plus } from 'lucide-react'
import type { Project } from '@/lib/types'

interface ProjectSidebarProps {
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (id: string) => void
  onNewProject: () => void
}

export default function ProjectSidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
}: ProjectSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Project list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No projects yet
          </p>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              data-active={activeProjectId === project.id}
              onClick={() => onSelectProject(project.id)}
              className={`
                w-full text-left px-3 py-2 rounded-md text-sm
                transition-colors duration-150
                ${
                  activeProjectId === project.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }
              `}
            >
              {project.name}
            </button>
          ))
        )}
      </div>

      {/* New project button */}
      <div className="p-4 border-t border-border">
        <button
          onClick={onNewProject}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>
    </div>
  )
}
