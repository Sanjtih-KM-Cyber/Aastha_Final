import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL; // <-- use env variable

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
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
      console.warn("API Unauthorized");
    }
    return Promise.reject(error);
  }
);

export default api;
