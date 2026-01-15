import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AppLayout from '@/components/layout/AppLayout'

describe('AppLayout', () => {
  it('renders sidebar with Projects header', () => {
    render(
      <AppLayout>
        <div>Main content</div>
      </AppLayout>
    )

    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
  })

  it('renders main content area with children', () => {
    render(
      <AppLayout>
        <div data-testid="test-content">Main content</div>
      </AppLayout>
    )

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByTestId('test-content')).toBeInTheDocument()
  })

  it('has proper ARIA labels for accessibility', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    )

    expect(screen.getByRole('complementary', { name: /sidebar/i })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: /main content/i })).toBeInTheDocument()
  })

  it('shows toggle button for mobile viewport', () => {
    // Simulate mobile viewport by checking the toggle button is present
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    )

    const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })
    expect(toggleButton).toBeInTheDocument()
  })

  it('toggles sidebar visibility when toggle button is clicked', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    )

    const sidebar = screen.getByRole('complementary')
    const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })

    // Click to open
    fireEvent.click(toggleButton)
    expect(sidebar).toHaveAttribute('data-open', 'true')

    // Click to close
    fireEvent.click(toggleButton)
    expect(sidebar).toHaveAttribute('data-open', 'false')
  })

  it('closes sidebar when overlay is clicked', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>
    )

    const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i })

    // Open sidebar
    fireEvent.click(toggleButton)

    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveAttribute('data-open', 'true')

    // Click overlay to close
    const overlay = screen.getByTestId('sidebar-overlay')
    fireEvent.click(overlay)

    expect(sidebar).toHaveAttribute('data-open', 'false')
  })
})
