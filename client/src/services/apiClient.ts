import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (!error.response) {
      // Network error
      console.error('Network error:', error.message);
      showErrorMessage('Network error. Please check your connection.');
      return Promise.reject(error);
    }

    const status = error.response.status;
    const errorData = error.response.data as any;

    switch (status) {
      case 401:
        // Unauthorized - redirect to login
        console.error('Unauthorized access - redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        showErrorMessage('Your session has expired. Please log in again.');
        break;

      case 403:
        // Forbidden - show permission error
        console.error('Permission denied:', errorData?.message || 'Access forbidden');
        showErrorMessage(
          errorData?.message || 'You do not have permission to perform this action.'
        );
        break;

      case 404:
        // Not found
        console.error('Resource not found:', errorData?.message);
        showErrorMessage(errorData?.message || 'The requested resource was not found.');
        break;

      case 429:
        // Rate limit exceeded
        console.error('Rate limit exceeded');
        showErrorMessage('Too many requests. Please try again later.');
        break;

      case 500:
      case 502:
      case 503:
      case 504:
        // Server errors - show generic error message
        console.error('Server error:', status, errorData?.message);
        showErrorMessage(
          'An unexpected server error occurred. Please try again later.'
        );
        break;

      default:
        // Other errors
        console.error('API error:', status, errorData?.message);
        showErrorMessage(
          errorData?.message || 'An unexpected error occurred. Please try again.'
        );
    }

    return Promise.reject(error);
  }
);

// Helper function to show error messages
function showErrorMessage(message: string): void {
  // Check if a custom error handler is registered
  const customHandler = (window as any).__apiErrorHandler;
  if (customHandler && typeof customHandler === 'function') {
    customHandler(message);
    return;
  }

  // Fallback to alert (can be replaced with toast notification)
  if (typeof window !== 'undefined') {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'api-error-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-width: 400px;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Remove after 5 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 5000);
  }
}

// Export function to register custom error handler
export function setApiErrorHandler(handler: (message: string) => void): void {
  (window as any).__apiErrorHandler = handler;
}

export default apiClient;
