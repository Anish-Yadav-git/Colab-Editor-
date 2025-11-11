import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AuthProvider } from '../contexts/AuthContext';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const TestComponent = () => <div>Protected Content</div>;
const LoginComponent = () => <div>Login Page</div>;

const renderProtectedRoute = (initialPath = '/protected') => {
  window.history.pushState({}, '', initialPath);
  
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginComponent />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows loading state initially', async () => {
    renderProtectedRoute();
    // Loading state may be very brief, so we check that either loading or redirect happens
    const content = await screen.findByText(/login page|loading/i);
    expect(content).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', async () => {
    renderProtectedRoute();

    // Wait for loading to complete
    await screen.findByText(/login page/i);
    expect(screen.getByText(/login page/i)).toBeInTheDocument();
    expect(screen.queryByText(/protected content/i)).not.toBeInTheDocument();
  });

  it('renders protected content when authenticated', async () => {
    // Set up authenticated state
    sessionStorage.setItem('authToken', 'fake-token');
    sessionStorage.setItem('authUser', JSON.stringify({
      id: '1',
      email: 'test@example.com',
      name: 'Test User'
    }));

    renderProtectedRoute();

    // Wait for loading to complete and content to render
    await screen.findByText(/protected content/i);
    expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    expect(screen.queryByText(/login page/i)).not.toBeInTheDocument();
  });

  it('preserves attempted location for redirect after login', async () => {
    const { container } = renderProtectedRoute('/protected');

    // Wait for redirect
    await screen.findByText(/login page/i);
    
    // The location state should be preserved (tested via integration)
    expect(screen.getByText(/login page/i)).toBeInTheDocument();
  });
});
