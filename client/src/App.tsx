import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { DocumentList } from './components/DocumentList';
import { EditorContainer } from './components/EditorContainer';
import { ProtectedRoute } from './components/ProtectedRoute';

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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
