import axios from 'axios';

// --- FIX: Dynamic API URL Helper ---
const getDynamicApiBaseUrl = () => {
    const host = window.location.hostname;
    // Use the current host to access the backend on port 5000
    return `http://${host}:5000/api`;
};
// ------------------------------------

const api = axios.create({
  baseURL: getDynamicApiBaseUrl(), // FIX APPLIED HERE
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Ensure credentials are included, solving cross-port/IP issues.
api.interceptors.request.use(
  (config) => {
    config.withCredentials = true; // Explicitly ensure cookies are sent
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle global errors like 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 occurs here, AuthContext.tsx or the consuming component must handle the redirect.
    return Promise.reject(error);
  }
);

export default api;