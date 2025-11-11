import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ShareDocument } from './ShareDocument';

describe('ShareDocument', () => {
  const mockToken = 'test-token';
  const mockDocumentId = 'doc-123';
  const mockOnClose = vi.fn();
  const mockOnShared = vi.fn();

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
    ],
  };

  it('renders share document form', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Share Document')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('User Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('fetches and displays current collaborators', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Current Collaborators')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `http://localhost:3000/api/documents/${mockDocumentId}`,
      {
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      }
    );
  });

  it('validates email format', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('User Email')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText('User Email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const shareButton = screen.getByText('Share');
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(
        screen.getByText('Please enter a valid email address')
      ).toBeInTheDocument();
    });
  });

  it('validates empty email', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('User Email')).toBeInTheDocument();
    });

    const shareButton = screen.getByText('Share');
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('shares document successfully', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Document shared successfully',
          documentId: 'doc-123',
          sharedWith: {
            userId: 'user-789',
            email: 'newuser@example.com',
            name: 'New User',
            role: 'editor',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      });

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('User Email')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText('User Email');
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });

    const roleSelect = screen.getByLabelText('Role');
    fireEvent.change(roleSelect, { target: { value: 'editor' } });

    const shareButton = screen.getByText('Share');
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/api/documents/${mockDocumentId}/share`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({
            email: 'newuser@example.com',
            role: 'editor',
          }),
        }
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText('Document shared with newuser@example.com')
      ).toBeInTheDocument();
    });

    expect(mockOnShared).toHaveBeenCalled();
  });

  it('allows selecting viewer role', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Document shared successfully',
          documentId: 'doc-123',
          sharedWith: {
            userId: 'user-789',
            email: 'viewer@example.com',
            name: 'Viewer',
            role: 'viewer',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      });

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('User Email')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText('User Email');
    fireEvent.change(emailInput, { target: { value: 'viewer@example.com' } });

    const roleSelect = screen.getByLabelText('Role');
    fireEvent.change(roleSelect, { target: { value: 'viewer' } });

    const shareButton = screen.getByText('Share');
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            email: 'viewer@example.com',
            role: 'viewer',
          }),
        })
      );
    });
  });

  it('handles user not found error', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: 'Not found',
          message: 'User with this email not found',
        }),
      });

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('User Email')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText('User Email');
    fireEvent.change(emailInput, { target: { value: 'notfound@example.com' } });

    const shareButton = screen.getByText('Share');
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(
        screen.getByText('User with this email not found')
      ).toBeInTheDocument();
    });

    expect(mockOnShared).not.toHaveBeenCalled();
  });

  it('handles network errors', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockRejectedValueOnce(new Error('Network error'));

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('User Email')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText('User Email');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const shareButton = screen.getByText('Share');
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('clears form after successful share', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Document shared successfully',
          documentId: 'doc-123',
          sharedWith: {
            userId: 'user-789',
            email: 'newuser@example.com',
            name: 'New User',
            role: 'editor',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      });

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('User Email')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText('User Email') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });

    const shareButton = screen.getByText('Share');
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(emailInput.value).toBe('');
    });
  });

  it('calls onClose when close button is clicked', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocument,
    });

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables form during submission', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      })
      .mockImplementation(() => new Promise(() => {})); // Never resolves

    render(
      <ShareDocument
        documentId={mockDocumentId}
        token={mockToken}
        onClose={mockOnClose}
        onShared={mockOnShared}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('User Email')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText('User Email');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const shareButton = screen.getByText('Share');
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(screen.getByText('Sharing...')).toBeInTheDocument();
    });

    expect(emailInput).toBeDisabled();
  });
});
