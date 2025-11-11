import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DocumentList } from './DocumentList';

describe('DocumentList', () => {
  const mockToken = 'test-token';
  const mockUserId = 'user-123';
  const mockOnDocumentSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const mockDocuments = {
    documents: [
      {
        id: 'doc-1',
        title: 'Test Document 1',
        ownerId: 'user-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: [{ userId: 'user-123', role: 'owner' as const }],
        metadata: {
          characterCount: 100,
          operationCount: 10,
          activeUsers: 1,
        },
      },
      {
        id: 'doc-2',
        title: 'Test Document 2',
        ownerId: 'user-456',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: [
          { userId: 'user-456', role: 'owner' as const },
          { userId: 'user-123', role: 'editor' as const },
        ],
        metadata: {
          characterCount: 200,
          operationCount: 20,
          activeUsers: 2,
        },
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };

  it('renders loading state initially', () => {
    (global.fetch as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    expect(screen.getByText('Loading documents...')).toBeInTheDocument();
  });

  it('fetches and displays documents', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    });

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Document 1')).toBeInTheDocument();
      expect(screen.getByText('Test Document 2')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/documents?page=1&limit=20',
      {
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      }
    );
  });

  it('displays owner role for owned documents', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    });

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      const ownerBadges = screen.getAllByText('Owner');
      expect(ownerBadges.length).toBeGreaterThan(0);
    });
  });

  it('displays editor role for shared documents', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    });

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Editor')).toBeInTheDocument();
    });
  });

  it('calls onDocumentSelect when document is clicked', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    });

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Document 1')).toBeInTheDocument();
    });

    const documentCard = screen.getByText('Test Document 1').closest('.document-card');
    fireEvent.click(documentCard!);

    expect(mockOnDocumentSelect).toHaveBeenCalledWith('doc-1');
  });

  it('handles keyboard navigation', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    });

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Document 1')).toBeInTheDocument();
    });

    const documentCard = screen.getByText('Test Document 1').closest('.document-card');
    fireEvent.keyDown(documentCard!, { key: 'Enter' });

    expect(mockOnDocumentSelect).toHaveBeenCalledWith('doc-1');
  });

  it('displays empty state when no documents', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        documents: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    });

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No documents found')).toBeInTheDocument();
    });
  });

  it('displays error state on fetch failure', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
    });
  });

  it('allows retrying after error', async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocuments,
      });

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Test Document 1')).toBeInTheDocument();
    });
  });

  it('toggles between grid and list view', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDocuments,
    });

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Test Document 1')).toBeInTheDocument();
    });

    const listButton = screen.getByLabelText('List view');
    fireEvent.click(listButton);

    const container = document.querySelector('.documents-list');
    expect(container).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    const mockPaginatedDocs = {
      ...mockDocuments,
      pagination: {
        page: 1,
        limit: 20,
        total: 40,
        totalPages: 2,
        hasNextPage: true,
        hasPrevPage: false,
      },
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPaginatedDocs,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockPaginatedDocs,
          pagination: { ...mockPaginatedDocs.pagination, page: 2, hasNextPage: false, hasPrevPage: true },
        }),
      });

    render(
      <DocumentList
        token={mockToken}
        userId={mockUserId}
        onDocumentSelect={mockOnDocumentSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    const nextButton = screen.getByLabelText('Next page');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/documents?page=2&limit=20',
        expect.any(Object)
      );
    });
  });
});
