import axios from "axios";
import { AUTH_UNAUTHORIZED_EVENT } from "../constants";

// Helper to get the correct API URL
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  // Fallback for production if env var is missing
  return 'https://aastha-final.onrender.com/api';
};

const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 30000, // 30 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // FIX: Only fire the unauthorized event if we are NOT on the login page.
      // This prevents infinite loops if the user types a wrong password.
      if (window.location.pathname !== '/login') {
         window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
