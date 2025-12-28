import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css"; // Import the CSS file with Tailwind directives
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { EncryptionProvider } from "./context/EncryptionContext";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <EncryptionProvider>
        <App />
      </EncryptionProvider>
    </AuthProvider>
  </React.StrictMode>
);
