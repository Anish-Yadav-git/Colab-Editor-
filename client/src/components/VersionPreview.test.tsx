import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VersionPreview from './VersionPreview';
import apiClient from '../services/apiClient';
import * as Y from 'yjs';

vi.mock('../services/apiClient');

describe('VersionPreview', () => {
  const mockDocumentId = 'doc123';
  const mockTimestamp = '2024-01-15T10:30:00.000Z';
  const mockCurrentContent = 'Current document content';
  const mockOnClose = vi.fn();
  const mockOnRestore = vi.fn();

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

  it('renders version preview with restore button', async () => {
    const mockContent = 'Version content';
    const mockState = createMockYjsState(mockContent);

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { state: mockState },
    });

    render(
      <VersionPreview
        documentId={mockDocumentId}
        timestamp={mockTimestamp}
        currentContent={mockCurrentContent}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Version Preview')).toBeInTheDocument();
    });

    expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
  });

  it('loads and displays version content', async () => {
    const mockContent = 'Historical version content';
    const mockState = createMockYjsState(mockContent);

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { state: mockState },
    });

    render(
      <VersionPreview
        documentId={mockDocumentId}
        timestamp={mockTimestamp}
        currentContent={mockCurrentContent}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
      />
    );

    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(mockContent);
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/documents/${mockDocumentId}/version`,
      { params: { timestamp: mockTimestamp } }
    );
  });

  it('shows confirmation dialog when restore button is clicked', async () => {
    const mockContent = 'Version content';
    const mockState = createMockYjsState(mockContent);

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { state: mockState },
    });

    const user = userEvent.setup();

    render(
      <VersionPreview
        documentId={mockDocumentId}
        timestamp={mockTimestamp}
        currentContent={mockCurrentContent}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
    });

    const restoreButton = screen.getByText('Restore to This Version');
    await user.click(restoreButton);

    await waitFor(() => {
      expect(screen.getByText('Restore Document Version?')).toBeInTheDocument();
    });
  });

  it('calls restore API when confirmed', async () => {
    const mockContent = 'Version content';
    const mockState = createMockYjsState(mockContent);

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { state: mockState },
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { message: 'Document restored successfully' },
    });

    const user = userEvent.setup();

    render(
      <VersionPreview
        documentId={mockDocumentId}
        timestamp={mockTimestamp}
        currentContent={mockCurrentContent}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
    });

    // Click restore button
    const restoreButton = screen.getByText('Restore to This Version');
    await user.click(restoreButton);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Restore Document Version?')).toBeInTheDocument();
    });

    // Click confirm button
    const confirmButton = screen.getByText('Restore Version');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/documents/${mockDocumentId}/restore`,
        { timestamp: mockTimestamp }
      );
    });

    expect(mockOnRestore).toHaveBeenCalledWith(mockTimestamp);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('cancels restore when cancel button is clicked', async () => {
    const mockContent = 'Version content';
    const mockState = createMockYjsState(mockContent);

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { state: mockState },
    });

    const user = userEvent.setup();

    render(
      <VersionPreview
        documentId={mockDocumentId}
        timestamp={mockTimestamp}
        currentContent={mockCurrentContent}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
    });

    // Click restore button
    const restoreButton = screen.getByText('Restore to This Version');
    await user.click(restoreButton);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Restore Document Version?')).toBeInTheDocument();
    });

    // Click cancel button
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Restore Document Version?')).not.toBeInTheDocument();
    });

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(mockOnRestore).not.toHaveBeenCalled();
  });

  it('displays error when restore fails', async () => {
    const mockContent = 'Version content';
    const mockState = createMockYjsState(mockContent);

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { state: mockState },
    });

    const errorMessage = 'Failed to restore document';
    vi.mocked(apiClient.post).mockRejectedValueOnce({
      response: { data: { message: errorMessage } },
    });

    const user = userEvent.setup();

    render(
      <VersionPreview
        documentId={mockDocumentId}
        timestamp={mockTimestamp}
        currentContent={mockCurrentContent}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
    });

    // Click restore button
    const restoreButton = screen.getByText('Restore to This Version');
    await user.click(restoreButton);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Restore Document Version?')).toBeInTheDocument();
    });

    // Click confirm button
    const confirmButton = screen.getByText('Restore Version');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('disables restore button while restoring', async () => {
    const mockContent = 'Version content';
    const mockState = createMockYjsState(mockContent);

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { state: mockState },
    });

    // Make the restore call hang
    vi.mocked(apiClient.post).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const user = userEvent.setup();

    render(
      <VersionPreview
        documentId={mockDocumentId}
        timestamp={mockTimestamp}
        currentContent={mockCurrentContent}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
    });

    // Click restore button
    const restoreButton = screen.getByText('Restore to This Version');
    await user.click(restoreButton);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Restore Document Version?')).toBeInTheDocument();
    });

    // Click confirm button
    const confirmButton = screen.getByText('Restore Version');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Restoring...')).toBeInTheDocument();
    });

    const restoringButton = screen.getByText('Restoring...');
    expect(restoringButton).toBeDisabled();
  });

  it('does not show restore button when onRestore is not provided', async () => {
    const mockContent = 'Version content';
    const mockState = createMockYjsState(mockContent);

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { state: mockState },
    });

    render(
      <VersionPreview
        documentId={mockDocumentId}
        timestamp={mockTimestamp}
        currentContent={mockCurrentContent}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Version Preview')).toBeInTheDocument();
    });

    expect(screen.queryByText('Restore to This Version')).not.toBeInTheDocument();
  });

  it('preserves history by creating new operations', async () => {
    const mockContent = 'Version content';
    const mockState = createMockYjsState(mockContent);

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { state: mockState },
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        message: 'Document restored successfully',
        documentId: mockDocumentId,
        restoredTimestamp: mockTimestamp,
      },
    });

    const user = userEvent.setup();

    render(
      <VersionPreview
        documentId={mockDocumentId}
        timestamp={mockTimestamp}
        currentContent={mockCurrentContent}
        onClose={mockOnClose}
        onRestore={mockOnRestore}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Restore to This Version')).toBeInTheDocument();
    });

    // Click restore button
    const restoreButton = screen.getByText('Restore to This Version');
    await user.click(restoreButton);

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Restore Document Version?')).toBeInTheDocument();
    });

    // Verify warning message about history preservation
    expect(
      screen.getByText(/The current version will be preserved in the history/)
    ).toBeInTheDocument();

    // Click confirm button
    const confirmButton = screen.getByText('Restore Version');
    await user.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/documents/${mockDocumentId}/restore`,
        { timestamp: mockTimestamp }
      );
    });
  });
});
