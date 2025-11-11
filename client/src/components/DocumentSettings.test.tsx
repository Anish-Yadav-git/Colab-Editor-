import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DocumentSettings } from './DocumentSettings';

describe('DocumentSettings', () => {
  const mockToken = 'test-token';
  const mockDocumentId = 'doc-123';
  const mockUserId = 'user-123';
  const mockOnClose = vi.fn();
  const mockOnDocumentUpdated = vi.fn();
  const mockOnDocumentDeleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const mockDocument = {
    id: 'doc-123',
    title: 'Test Document',
    ownerId: 'user-123',
    permissions: [
      { userId: 'user-123', role: 'owner' as const },
      { userId: 'user-456', role: 'editor' as const },
      { userId: 'user-789', role: 'viewer' as const },
    ],
  };

  it('renders loading state initially', () => {
    (global.fetch as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('fetches and displays document settings', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Document Settings')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `http://localhost:3000/api/documents/${mockDocumentId}`,
      {
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      }
    );

    const titleInput = screen.getByLabelText('Document Title') as HTMLInputElement;
    expect(titleInput.value).toBe('Test Document');
  });

  it('displays permissions list', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Permissions')).toBeInTheDocument();
    });

    expect(screen.getByText('You (Owner)')).toBeInTheDocument();
    expect(screen.getByText('user-456')).toBeInTheDocument();
    expect(screen.getByText('user-789')).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('allows owner to edit document title', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockDocument, title: 'Updated Title' }),
      });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
        onDocumentUpdated={mockOnDocumentUpdated}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Document Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/documents/${mockDocumentId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ title: 'Updated Title' }),
        }
      );
    });

    expect(mockOnDocumentUpdated).toHaveBeenCalled();
  });

  it('validates empty title', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Document Title');
    fireEvent.change(titleInput, { target: { value: '' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1); // Only initial fetch
  });

  it('validates title length', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Document Title');
    const longTitle = 'a'.repeat(201);
    fireEvent.change(titleInput, { target: { value: longTitle } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText('Title must be 200 characters or less')
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1); // Only initial fetch
  });

  it('displays character count', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    expect(screen.getByText('13 / 200 characters')).toBeInTheDocument();

    const titleInput = screen.getByLabelText('Document Title');
    fireEvent.change(titleInput, { target: { value: 'New' } });

    expect(screen.getByText('3 / 200 characters')).toBeInTheDocument();
  });

  it('trims whitespace from title', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockDocument, title: 'Trimmed Title' }),
      });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Document Title');
    fireEvent.change(titleInput, { target: { value: '  Trimmed Title  ' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ title: 'Trimmed Title' }),
        })
      );
    });
  });

  it('disables save button when title unchanged', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Changes');
    expect(saveButton).toBeDisabled();
  });

  it('disables form during save', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Document Title');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    expect(titleInput).toBeDisabled();
  });

  it('handles server validation errors', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Validation error',
          message: 'Title already exists',
        }),
      });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Document Title');
    fireEvent.change(titleInput, { target: { value: 'Duplicate' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Title already exists')).toBeInTheDocument();
    });
  });

  it('handles network errors during save', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockRejectedValueOnce(new Error('Network error'));

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Document Title');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('clears validation errors when user types', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Document Title');
    fireEvent.change(titleInput, { target: { value: '' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    fireEvent.change(titleInput, { target: { value: 'N' } });

    expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
  });

  it('shows delete button for owner', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Danger Zone')).toBeInTheDocument();
    });

    expect(screen.getByText('Delete Document')).toBeInTheDocument();
  });

  it('hides delete button for non-owner', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId="user-456" // Not the owner
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Document Settings')).toBeInTheDocument();
    });

    expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete Document')).not.toBeInTheDocument();
  });

  it('disables title editing for non-owner', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId="user-456" // Not the owner
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Document Title')).toBeInTheDocument();
    });

    const titleInput = screen.getByLabelText('Document Title');
    expect(titleInput).toBeDisabled();
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
  });

  it('shows delete confirmation dialog', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Document')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Document');
    fireEvent.click(deleteButton);

    expect(
      screen.getByText(/Are you sure you want to delete this document/)
    ).toBeInTheDocument();
    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('cancels delete confirmation', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Document')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Document');
    fireEvent.click(deleteButton);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(
      screen.queryByText(/Are you sure you want to delete this document/)
    ).not.toBeInTheDocument();
    expect(screen.getByText('Delete Document')).toBeInTheDocument();
  });

  it('deletes document successfully', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Document deleted' }),
      });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
        onDocumentDeleted={mockOnDocumentDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Document')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Document');
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByText('Yes, Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/documents/${mockDocumentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
    });

    expect(mockOnDocumentDeleted).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables buttons during delete', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Document')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Document');
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByText('Yes, Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });

    expect(screen.getByText('Cancel')).toBeDisabled();
  });

  it('handles delete errors', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockRejectedValueOnce(new Error('Delete failed'));

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
        onDocumentDeleted={mockOnDocumentDeleted}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Document')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Document');
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByText('Yes, Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument();
    });

    expect(mockOnDocumentDeleted).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('hides delete confirmation after error', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockRejectedValueOnce(new Error('Delete failed'));

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Document')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Document');
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByText('Yes, Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/Are you sure you want to delete this document/)
    ).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays error state when document fetch fails', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <DocumentSettings
        documentId={mockDocumentId}
        token={mockToken}
        userId={mockUserId}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load document')).toBeInTheDocument();
    });

    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});
