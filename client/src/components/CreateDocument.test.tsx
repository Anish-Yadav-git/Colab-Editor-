import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CreateDocument } from './CreateDocument';

describe('CreateDocument', () => {
  const mockToken = 'test-token';
  const mockOnDocumentCreated = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders create document form', () => {
    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Create New Document')).toBeInTheDocument();
    expect(screen.getByLabelText(/Document Title/)).toBeInTheDocument();
    expect(screen.getByText('Create Document')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('validates empty title', async () => {
    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText('Create Document');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('validates title length', async () => {
    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText(/Document Title/);
    const longTitle = 'a'.repeat(201);
    fireEvent.change(input, { target: { value: longTitle } });

    const submitButton = screen.getByText('Create Document');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText('Title must be 200 characters or less')
      ).toBeInTheDocument();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('displays character count', () => {
    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText(/Document Title/);
    fireEvent.change(input, { target: { value: 'Test' } });

    expect(screen.getByText('4 / 200 characters')).toBeInTheDocument();
  });

  it('creates document successfully', async () => {
    const mockResponse = {
      id: 'doc-123',
      title: 'Test Document',
      ownerId: 'user-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: [],
      metadata: {},
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText(/Document Title/);
    fireEvent.change(input, { target: { value: 'Test Document' } });

    const submitButton = screen.getByText('Create Document');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/documents',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockToken}`,
          },
          body: JSON.stringify({ title: 'Test Document' }),
        }
      );
    });

    expect(mockOnDocumentCreated).toHaveBeenCalledWith('doc-123');
  });

  it('trims whitespace from title', async () => {
    const mockResponse = {
      id: 'doc-123',
      title: 'Test Document',
      ownerId: 'user-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      permissions: [],
      metadata: {},
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText(/Document Title/);
    fireEvent.change(input, { target: { value: '  Test Document  ' } });

    const submitButton = screen.getByText('Create Document');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/documents',
        expect.objectContaining({
          body: JSON.stringify({ title: 'Test Document' }),
        })
      );
    });
  });

  it('handles server validation errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Validation error',
        message: 'Title cannot be empty',
      }),
    });

    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText(/Document Title/);
    fireEvent.change(input, { target: { value: 'Test' } });

    const submitButton = screen.getByText('Create Document');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title cannot be empty')).toBeInTheDocument();
    });

    expect(mockOnDocumentCreated).not.toHaveBeenCalled();
  });

  it('handles network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText(/Document Title/);
    fireEvent.change(input, { target: { value: 'Test Document' } });

    const submitButton = screen.getByText('Create Document');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    expect(mockOnDocumentCreated).not.toHaveBeenCalled();
  });

  it('disables form during submission', async () => {
    (global.fetch as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByLabelText(/Document Title/);
    fireEvent.change(input, { target: { value: 'Test Document' } });

    const submitButton = screen.getByText('Create Document');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    expect(input).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('clears validation errors when user types', async () => {
    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText('Create Document');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/Document Title/);
    fireEvent.change(input, { target: { value: 'T' } });

    expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
  });

  it('disables submit button when title is empty', () => {
    render(
      <CreateDocument
        token={mockToken}
        onDocumentCreated={mockOnDocumentCreated}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText('Create Document');
    expect(submitButton).toBeDisabled();
  });
});
