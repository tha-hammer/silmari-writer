import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditMessageModal from '@/components/chat/EditMessageModal'

describe('EditMessageModal', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()
  const defaultProps = {
    isOpen: true,
    content: 'Original message content',
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  }

  it('renders modal when open', () => {
    render(<EditMessageModal {...defaultProps} />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/original message content/i)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<EditMessageModal {...defaultProps} isOpen={false} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows textarea with current content', () => {
    render(<EditMessageModal {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('Original message content')
  })

  it('calls onSave with edited content when Save clicked', async () => {
    const user = userEvent.setup()
    render(<EditMessageModal {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, 'Edited content')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith('Edited content')
  })

  it('calls onCancel when Cancel clicked', async () => {
    const user = userEvent.setup()
    render(<EditMessageModal {...defaultProps} />)

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('calls onCancel when Escape key pressed', async () => {
    const user = userEvent.setup()
    render(<EditMessageModal {...defaultProps} />)

    await user.keyboard('{Escape}')

    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('disables Save button when content is empty', async () => {
    const user = userEvent.setup()
    render(<EditMessageModal {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    await user.clear(textarea)

    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeDisabled()
  })

  it('shows character count', () => {
    render(<EditMessageModal {...defaultProps} content="Test" />)

    expect(screen.getByText(/4 characters/i)).toBeInTheDocument()
  })
})
