import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // Remove /src
import { EncryptionProvider } from './context/EncryptionContext'; // Remove /src

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

let root;

// @ts-ignore
if (!rootElement._reactRootContainer) {
    root = ReactDOM.createRoot(rootElement);
    // @ts-ignore
    rootElement._reactRootContainer = root;
} else {
    // @ts-ignore
    root = rootElement._reactRootContainer;
}

root.render(
  <React.StrictMode>
    <AuthProvider>
      <EncryptionProvider>
        <App />
      </EncryptionProvider>
    </AuthProvider>
  </React.StrictMode>
);