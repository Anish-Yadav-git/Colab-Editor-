import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestoreConfirmDialog from './RestoreConfirmDialog';

describe('RestoreConfirmDialog', () => {
  const mockTimestamp = '2024-01-15T10:30:00.000Z';
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnConfirm = vi.fn();
    mockOnCancel = vi.fn();
  });

  it('renders confirmation dialog with formatted timestamp', () => {
    render(
      <RestoreConfirmDialog
        timestamp={mockTimestamp}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Restore Document Version?')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to restore this document/)
    ).toBeInTheDocument();
    expect(screen.getByText(/January 15, 2024/)).toBeInTheDocument();
  });

  it('displays warning about history preservation', () => {
    render(
      <RestoreConfirmDialog
        timestamp={mockTimestamp}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Important:')).toBeInTheDocument();
    expect(
      screen.getByText(/The current version will be preserved in the history/)
    ).toBeInTheDocument();
  });

  it('calls onConfirm when Restore Version button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <RestoreConfirmDialog
        timestamp={mockTimestamp}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByText('Restore Version');
    await user.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <RestoreConfirmDialog
        timestamp={mockTimestamp}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('renders with proper accessibility attributes', () => {
    render(
      <RestoreConfirmDialog
        timestamp={mockTimestamp}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByText('Restore Version');
    const cancelButton = screen.getByText('Cancel');

    expect(confirmButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton.tagName).toBe('BUTTON');
    expect(cancelButton.tagName).toBe('BUTTON');
  });

  it('displays warning icon', () => {
    render(
      <RestoreConfirmDialog
        timestamp={mockTimestamp}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const warningIcon = screen.getByText('⚠️');
    expect(warningIcon).toBeInTheDocument();
  });
});
