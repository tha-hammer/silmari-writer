import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProjectSidebar from '@/components/layout/ProjectSidebar'
import type { Project } from '@/lib/types'

const mockProjects: Project[] = [
  { id: '1', name: 'Project A', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Project B', createdAt: new Date(), updatedAt: new Date() },
]

describe('ProjectSidebar', () => {
  it('shows "No projects" message when projects array is empty', () => {
    render(
      <ProjectSidebar
        projects={[]}
        activeProjectId={null}
        onSelectProject={() => {}}
        onNewProject={() => {}}
      />
    )

    expect(screen.getByText(/no projects/i)).toBeInTheDocument()
  })

  it('renders project names', () => {
    render(
      <ProjectSidebar
        projects={mockProjects}
        activeProjectId={null}
        onSelectProject={() => {}}
        onNewProject={() => {}}
      />
    )

    expect(screen.getByText('Project A')).toBeInTheDocument()
    expect(screen.getByText('Project B')).toBeInTheDocument()
  })

  it('highlights active project', () => {
    render(
      <ProjectSidebar
        projects={mockProjects}
        activeProjectId="1"
        onSelectProject={() => {}}
        onNewProject={() => {}}
      />
    )

    const activeProject = screen.getByText('Project A').closest('button')
    expect(activeProject).toHaveAttribute('data-active', 'true')

    const inactiveProject = screen.getByText('Project B').closest('button')
    expect(inactiveProject).toHaveAttribute('data-active', 'false')
  })

  it('calls onSelectProject when project is clicked', () => {
    const onSelectProject = vi.fn()

    render(
      <ProjectSidebar
        projects={mockProjects}
        activeProjectId={null}
        onSelectProject={onSelectProject}
        onNewProject={() => {}}
      />
    )

    fireEvent.click(screen.getByText('Project A'))
    expect(onSelectProject).toHaveBeenCalledWith('1')

    fireEvent.click(screen.getByText('Project B'))
    expect(onSelectProject).toHaveBeenCalledWith('2')
  })

  it('shows New Project button', () => {
    render(
      <ProjectSidebar
        projects={mockProjects}
        activeProjectId={null}
        onSelectProject={() => {}}
        onNewProject={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
  })

  it('calls onNewProject when New Project button is clicked', () => {
    const onNewProject = vi.fn()

    render(
      <ProjectSidebar
        projects={mockProjects}
        activeProjectId={null}
        onSelectProject={() => {}}
        onNewProject={onNewProject}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /new project/i }))
    expect(onNewProject).toHaveBeenCalled()
  })

  it('shows New Project button even when empty', () => {
    render(
      <ProjectSidebar
        projects={[]}
        activeProjectId={null}
        onSelectProject={() => {}}
        onNewProject={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
  })
})
