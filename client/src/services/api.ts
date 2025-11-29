import axios from 'axios';

// Helper to dynamically determine the API URL based on the current browser URL
// This works for localhost, 192.168.x.x, or any domain.
const getBaseUrl = () => {
  const { hostname } = window.location;
  return `http://${hostname}:5000/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true, // Important for Cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log but don't crash on 401, let components handle redirect
    if (error.response && error.response.status === 401) {
      console.warn("API Unauthorized");
    }
    return Promise.reject(error);
  }
);

export default api;