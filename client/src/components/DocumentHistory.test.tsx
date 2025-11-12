import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentHistory from './DocumentHistory';
import apiClient from '../services/apiClient';
import * as Y from 'yjs';

vi.mock('../services/apiClient');

describe('DocumentHistory', () => {
  const mockDocumentId = 'doc123';
  const mockCurrentContent = 'Current document content';
  const mockOnVersionSelect = vi.fn();
  const mockOnRestore = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockYjsState = (content: string): string => {
    const yjsDoc = new Y.Doc();
    const yText = yjsDoc.getText('content');
    yText.insert(0, content);
    const state = Y.encodeStateAsUpdate(yjsDoc);
    return btoa(String.fromCharCode(...state));
  };

  const mockOperations = [
    {
      id: 'op1',
      documentId: mockDocumentId,
      userId: {
        _id: 'user1',
        name: 'John Doe',
        email: 'john@example.com',
      },
      timestamp: '2024-01-15T10:30:00.000Z',
      operationType: 'insert' as const,
      metadata: {
        clientId: 'client1',
        sessionId: 'session1',
      },
    },
    {
      id: 'op2',
      documentId: mockDocumentId,
      userId: {
        _id: 'user2',
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
      timestamp: '2024-01-15T11:00:00.000Z',
      operationType: 'delete' as const,
      metadata: {
        clientId: 'client2',
        sessionId: 'session2',
      },
    },
    {
      id: 'op3',
      documentId: mockDocumentId,
      userId: {
        _id: 'user3',
        name: 'Bob Johnson',
        email: 'bob@example.com',
      },
      timestamp: '2024-01-15T12:00:00.000Z',
      operationType: 'format' as const,
      metadata: {
        clientId: 'client3',
        sessionId: 'session3',
      },
    },
  ];

  const mockPagination = {
    page: 1,
    limit: 50,
    total: 3,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  describe('History Timeline Rendering', () => {
    it('renders document history header', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByText('Document History')).toBeInTheDocument();
      });
    });

    it('fetches and displays operation history on mount', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          `/api/documents/${mockDocumentId}/history`,
          expect.objectContaining({
            params: expect.objectContaining({
              page: 1,
              limit: 50,
            }),
          })
        );
      });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('displays operation types correctly', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByText('insert')).toBeInTheDocument();
      });

      expect(screen.getByText('delete')).toBeInTheDocument();
      expect(screen.getByText('format')).toBeInTheDocument();
    });

    it('displays formatted timestamps', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        const timestamps = screen.getAllByText(/Jan 15, 2024/);
        expect(timestamps.length).toBeGreaterThan(0);
      });
    });

    it('displays operation icons', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        const icons = screen.getAllByText(/[✏️🗑️🎨]/);
        expect(icons.length).toBeGreaterThan(0);
      });
    });

    it('shows loading state while fetching history', () => {
      vi.mocked(apiClient.get).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<DocumentHistory documentId={mockDocumentId} />);

      expect(screen.getByText('Loading history...')).toBeInTheDocument();
    });

    it('displays error message when fetch fails', async () => {
      const errorMessage = 'Failed to load document history';
      vi.mocked(apiClient.get).mockRejectedValueOnce({
        response: { data: { message: errorMessage } },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('shows "No operations found" when history is empty', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: [],
          pagination: {
            ...mockPagination,
            total: 0,
          },
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByText('No operations found')).toBeInTheDocument();
      });
    });

    it('renders close button when onClose is provided', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(
        <DocumentHistory documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        const closeButton = screen.getByLabelText('Close');
        expect(closeButton).toBeInTheDocument();
      });
    });

    it('calls onClose when close button is clicked', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      const user = userEvent.setup();

      render(
        <DocumentHistory documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Date Range Filtering', () => {
    it('renders date filter inputs', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Start Date:')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('End Date:')).toBeInTheDocument();
    });

    it('applies date filters when Apply Filters button is clicked', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      const user = userEvent.setup();

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Start Date:')).toBeInTheDocument();
      });

      const startDateInput = screen.getByLabelText('Start Date:');
      const endDateInput = screen.getByLabelText('End Date:');
      const applyButton = screen.getByText('Apply Filters');

      await user.type(startDateInput, '2024-01-15T10:00');
      await user.type(endDateInput, '2024-01-15T12:00');
      await user.click(applyButton);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          `/api/documents/${mockDocumentId}/history`,
          expect.objectContaining({
            params: expect.objectContaining({
              startDate: expect.any(String),
              endDate: expect.any(String),
            }),
          })
        );
      });
    });

    it('clears filters when Clear button is clicked', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      const user = userEvent.setup();

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Start Date:')).toBeInTheDocument();
      });

      const startDateInput = screen.getByLabelText(
        'Start Date:'
      ) as HTMLInputElement;
      const clearButton = screen.getByText('Clear');

      await user.type(startDateInput, '2024-01-15T10:00');
      expect(startDateInput.value).toBe('2024-01-15T10:00');

      await user.click(clearButton);

      await waitFor(() => {
        expect(startDateInput.value).toBe('');
      });
    });
  });

  describe('Pagination', () => {
    it('displays pagination controls when multiple pages exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: {
            page: 1,
            limit: 50,
            total: 150,
            totalPages: 3,
            hasNextPage: true,
            hasPrevPage: false,
          },
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
      });

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('disables Previous button on first page', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: {
            page: 1,
            limit: 50,
            total: 150,
            totalPages: 3,
            hasNextPage: true,
            hasPrevPage: false,
          },
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        const prevButton = screen.getByText('Previous');
        expect(prevButton).toBeDisabled();
      });
    });

    it('disables Next button on last page', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: {
            page: 3,
            limit: 50,
            total: 150,
            totalPages: 3,
            hasNextPage: false,
            hasPrevPage: true,
          },
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        const nextButton = screen.getByText('Next');
        expect(nextButton).toBeDisabled();
      });
    });

    it('fetches next page when Next button is clicked', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          operations: mockOperations,
          pagination: {
            page: 1,
            limit: 50,
            total: 150,
            totalPages: 3,
            hasNextPage: true,
            hasPrevPage: false,
          },
        },
      });

      const user = userEvent.setup();

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          `/api/documents/${mockDocumentId}/history`,
          expect.objectContaining({
            params: expect.objectContaining({
              page: 2,
            }),
          })
        );
      });
    });

    it('fetches previous page when Previous button is clicked', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          operations: mockOperations,
          pagination: {
            page: 2,
            limit: 50,
            total: 150,
            totalPages: 3,
            hasNextPage: true,
            hasPrevPage: true,
          },
        },
      });

      const user = userEvent.setup();

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByText('Previous')).toBeInTheDocument();
      });

      const prevButton = screen.getByText('Previous');
      await user.click(prevButton);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          `/api/documents/${mockDocumentId}/history`,
          expect.objectContaining({
            params: expect.objectContaining({
              page: 1,
            }),
          })
        );
      });
    });

    it('does not display pagination when only one page exists', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });
  });

  describe('Version Preview', () => {
    it('opens version preview when timeline item is clicked', async () => {
      const mockVersionContent = 'Historical version content';
      const mockState = createMockYjsState(mockVersionContent);

      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes('/history')) {
          return Promise.resolve({
            data: {
              operations: mockOperations,
              pagination: mockPagination,
            },
          });
        }
        if (url.includes('/version')) {
          return Promise.resolve({
            data: { state: mockState },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const user = userEvent.setup();

      render(
        <DocumentHistory
          documentId={mockDocumentId}
          currentContent={mockCurrentContent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const timelineItem = screen.getByText('John Doe').closest('.timeline-item');
      expect(timelineItem).toBeInTheDocument();
      await user.click(timelineItem!);

      await waitFor(() => {
        expect(screen.getByText('Version Preview')).toBeInTheDocument();
      });
    });

    it('calls onVersionSelect when timeline item is clicked', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      const user = userEvent.setup();

      render(
        <DocumentHistory
          documentId={mockDocumentId}
          onVersionSelect={mockOnVersionSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const timelineItem = screen.getByText('John Doe').closest('.timeline-item');
      await user.click(timelineItem!);

      expect(mockOnVersionSelect).toHaveBeenCalledWith(mockOperations[0].timestamp);
    });

    it('supports keyboard navigation for timeline items', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      const user = userEvent.setup();

      render(
        <DocumentHistory
          documentId={mockDocumentId}
          onVersionSelect={mockOnVersionSelect}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const timelineItem = screen.getByText('John Doe').closest('.timeline-item') as HTMLElement;
      expect(timelineItem).toHaveAttribute('tabIndex', '0');
      expect(timelineItem).toHaveAttribute('role', 'button');

      timelineItem.focus();
      await user.keyboard('{Enter}');

      expect(mockOnVersionSelect).toHaveBeenCalledWith(mockOperations[0].timestamp);
    });

    it('closes version preview when close button is clicked', async () => {
      const mockVersionContent = 'Historical version content';
      const mockState = createMockYjsState(mockVersionContent);

      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes('/history')) {
          return Promise.resolve({
            data: {
              operations: mockOperations,
              pagination: mockPagination,
            },
          });
        }
        if (url.includes('/version')) {
          return Promise.resolve({
            data: { state: mockState },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const user = userEvent.setup();

      render(
        <DocumentHistory
          documentId={mockDocumentId}
          currentContent={mockCurrentContent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Open preview
      const timelineItem = screen.getByText('John Doe').closest('.timeline-item');
      await user.click(timelineItem!);

      await waitFor(() => {
        expect(screen.getByText('Version Preview')).toBeInTheDocument();
      });

      // Close preview
      const closeButton = screen.getByLabelText('Close preview');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Version Preview')).not.toBeInTheDocument();
      });
    });
  });

  describe('Restore Functionality', () => {
    it('passes onRestore callback to version preview', async () => {
      const mockVersionContent = 'Historical version content';
      const mockState = createMockYjsState(mockVersionContent);

      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes('/history')) {
          return Promise.resolve({
            data: {
              operations: mockOperations,
              pagination: mockPagination,
            },
          });
        }
        if (url.includes('/version')) {
          return Promise.resolve({
            data: { state: mockState },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const user = userEvent.setup();

      render(
        <DocumentHistory
          documentId={mockDocumentId}
          currentContent={mockCurrentContent}
          onRestore={mockOnRestore}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const timelineItem = screen.getByText('John Doe').closest('.timeline-item');
      await user.click(timelineItem!);

      await waitFor(() => {
        expect(screen.getByText('Version Preview')).toBeInTheDocument();
      });

      // Verify restore button is present (only shown when onRestore is provided)
      await waitFor(() => {
        expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
      });
    });

    it('does not show restore button when onRestore is not provided', async () => {
      const mockVersionContent = 'Historical version content';
      const mockState = createMockYjsState(mockVersionContent);

      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes('/history')) {
          return Promise.resolve({
            data: {
              operations: mockOperations,
              pagination: mockPagination,
            },
          });
        }
        if (url.includes('/version')) {
          return Promise.resolve({
            data: { state: mockState },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const user = userEvent.setup();

      render(
        <DocumentHistory
          documentId={mockDocumentId}
          currentContent={mockCurrentContent}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const timelineItem = screen.getByText('John Doe').closest('.timeline-item');
      await user.click(timelineItem!);

      await waitFor(() => {
        expect(screen.getByText('Version Preview')).toBeInTheDocument();
      });

      // Verify restore button is NOT present
      expect(screen.queryByText('Restore to This Version')).not.toBeInTheDocument();
    });

    it('calls onRestore with correct timestamp when restore is confirmed', async () => {
      const mockVersionContent = 'Historical version content';
      const mockState = createMockYjsState(mockVersionContent);

      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes('/history')) {
          return Promise.resolve({
            data: {
              operations: mockOperations,
              pagination: mockPagination,
            },
          });
        }
        if (url.includes('/version')) {
          return Promise.resolve({
            data: { state: mockState },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          message: 'Document restored successfully',
        },
      });

      const user = userEvent.setup();

      render(
        <DocumentHistory
          documentId={mockDocumentId}
          currentContent={mockCurrentContent}
          onRestore={mockOnRestore}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click timeline item
      const timelineItem = screen.getByText('John Doe').closest('.timeline-item');
      await user.click(timelineItem!);

      await waitFor(() => {
        expect(screen.getByText('Version Preview')).toBeInTheDocument();
      });

      // Click restore button
      await waitFor(() => {
        expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
      });
      const restoreButton = screen.getByText('Restore to This Version');
      await user.click(restoreButton);

      // Confirm restore
      await waitFor(() => {
        expect(screen.getByText('Restore Document Version?')).toBeInTheDocument();
      });
      const confirmButton = screen.getByText('Restore Version');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockOnRestore).toHaveBeenCalledWith(mockOperations[0].timestamp);
      });
    });

    it('closes version preview after successful restore', async () => {
      const mockVersionContent = 'Historical version content';
      const mockState = createMockYjsState(mockVersionContent);

      vi.mocked(apiClient.get).mockImplementation((url: string) => {
        if (url.includes('/history')) {
          return Promise.resolve({
            data: {
              operations: mockOperations,
              pagination: mockPagination,
            },
          });
        }
        if (url.includes('/version')) {
          return Promise.resolve({
            data: { state: mockState },
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          message: 'Document restored successfully',
        },
      });

      const user = userEvent.setup();

      render(
        <DocumentHistory
          documentId={mockDocumentId}
          currentContent={mockCurrentContent}
          onRestore={mockOnRestore}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click timeline item
      const timelineItem = screen.getByText('John Doe').closest('.timeline-item');
      await user.click(timelineItem!);

      await waitFor(() => {
        expect(screen.getByText('Version Preview')).toBeInTheDocument();
      });

      // Click restore button
      await waitFor(() => {
        expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
      });
      const restoreButton = screen.getByText('Restore to This Version');
      await user.click(restoreButton);

      // Confirm restore
      await waitFor(() => {
        expect(screen.getByText('Restore Document Version?')).toBeInTheDocument();
      });
      const confirmButton = screen.getByText('Restore Version');
      await user.click(confirmButton);

      // Verify preview is closed
      await waitFor(() => {
        expect(screen.queryByText('Version Preview')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(
        <DocumentHistory documentId={mockDocumentId} onClose={mockOnClose} />
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Start Date:')).toBeInTheDocument();
      expect(screen.getByLabelText('End Date:')).toBeInTheDocument();
    });

    it('timeline items have proper role and tabIndex', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          operations: mockOperations,
          pagination: mockPagination,
        },
      });

      render(<DocumentHistory documentId={mockDocumentId} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const timelineItem = screen.getByText('John Doe').closest('.timeline-item');
      expect(timelineItem).toHaveAttribute('role', 'button');
      expect(timelineItem).toHaveAttribute('tabIndex', '0');
    });
  });
});
