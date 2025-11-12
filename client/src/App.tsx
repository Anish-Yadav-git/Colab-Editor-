import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Lazy load components for code splitting
const Login = lazy(() => import('./components/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./components/Register').then(module => ({ default: module.Register })));
const DocumentList = lazy(() => import('./components/DocumentList').then(module => ({ default: module.DocumentList })));
const EditorContainer = lazy(() => import('./components/EditorContainer').then(module => ({ default: module.EditorContainer })));

// Wrapper components to access auth context
const DocumentListPage = () => {
  const { token, user } = useAuth();
  return <DocumentList token={token || ''} userId={user?.id || ''} />;
};

const EditorPage = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const { token, user } = useAuth();
  
  return (
    <EditorContainer
      documentId={documentId || ''}
      userId={user?.id || ''}
      userName={user?.name}
      token={token || ''}
    />
  );
};

// Enhanced loading fallback with skeleton
const LoadingFallback = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p className="loading-text">Loading...</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <DocumentListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/editor/:documentId"
              element={
                <ProtectedRoute>
                  <EditorPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/documents" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
