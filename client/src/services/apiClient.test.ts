import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import apiClient, { setApiErrorHandler } from './apiClient';

describe('API Client', () => {
  let mock: MockAdapter;
  let errorHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    errorHandler = vi.fn();
    setApiErrorHandler(errorHandler);
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    global.localStorage = localStorageMock as any;

    // Mock window.location
    delete (window as any).location;
    window.location = { href: '', pathname: '/' } as any;
  });

  afterEach(() => {
    mock.reset();
    vi.clearAllMocks();
  });

  it('adds authorization header when token exists', async () => {
    const token = 'test-token';
    (localStorage.getItem as any).mockReturnValue(token);

    mock.onGet('/test').reply((config) => {
      expect(config.headers?.Authorization).toBe(`Bearer ${token}`);
      return [200, { data: 'success' }];
    });

    await apiClient.get('/test');
  });

  it('handles 401 unauthorized by redirecting to login', async () => {
    mock.onGet('/test').reply(401, { message: 'Unauthorized' });

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    expect(window.location.href).toBe('/login');
    expect(errorHandler).toHaveBeenCalledWith(
      'Your session has expired. Please log in again.'
    );
  });

  it('does not redirect to login if already on login page', async () => {
    window.location.pathname = '/login';
    mock.onGet('/test').reply(401);

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(window.location.href).toBe('');
  });

  it('handles 403 forbidden with permission error', async () => {
    mock.onGet('/test').reply(403, { message: 'Access denied' });

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith('Access denied');
  });

  it('handles 403 with default message when no message provided', async () => {
    mock.onGet('/test').reply(403);

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith(
      'You do not have permission to perform this action.'
    );
  });

  it('handles 404 not found', async () => {
    mock.onGet('/test').reply(404, { message: 'Resource not found' });

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith('Resource not found');
  });

  it('handles 429 rate limit', async () => {
    mock.onGet('/test').reply(429);

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith(
      'Too many requests. Please try again later.'
    );
  });

  it('handles 500 server error with generic message', async () => {
    mock.onGet('/test').reply(500, { message: 'Internal server error' });

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith(
      'An unexpected server error occurred. Please try again later.'
    );
  });

  it('handles 502 bad gateway', async () => {
    mock.onGet('/test').reply(502);

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith(
      'An unexpected server error occurred. Please try again later.'
    );
  });

  it('handles 503 service unavailable', async () => {
    mock.onGet('/test').reply(503);

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith(
      'An unexpected server error occurred. Please try again later.'
    );
  });

  it('handles network errors', async () => {
    mock.onGet('/test').networkError();

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith(
      'Network error. Please check your connection.'
    );
  });

  it('handles other error codes with custom message', async () => {
    mock.onGet('/test').reply(400, { message: 'Bad request' });

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith('Bad request');
  });

  it('handles other error codes with default message', async () => {
    mock.onGet('/test').reply(418);

    try {
      await apiClient.get('/test');
    } catch (error) {
      // Expected to throw
    }

    expect(errorHandler).toHaveBeenCalledWith(
      'An unexpected error occurred. Please try again.'
    );
  });

  it('returns successful responses', async () => {
    const responseData = { data: 'success' };
    mock.onGet('/test').reply(200, responseData);

    const response = await apiClient.get('/test');

    expect(response.data).toEqual(responseData);
    expect(errorHandler).not.toHaveBeenCalled();
  });
});
