import axios from 'axios';

// 1. Create the Axios instance
const api = axios.create({
  baseURL: 'https://aastha-final.onrender.com/api', // Your backend URL
  withCredentials: true, // This allows cookies to be sent/received if you use them
});

// 2. THE CRITICAL PART: Request Interceptor
// This runs before EVERY single request to the server
api.interceptors.request.use(
  (config) => {
    // A. Look in Local Storage for the data we saved in AuthContext
    const userInfoFromStorage = localStorage.getItem('userInfo');

    if (userInfoFromStorage) {
      try {
        // B. Parse the JSON string back into an object
        const userData = JSON.parse(userInfoFromStorage);

        // C. specific check: does the token exist?
        if (userData && userData.token) {
          // D. ATTACH THE TOKEN TO THE HEADER
          config.headers.Authorization = `Bearer ${userData.token}`;
          
          // Debugging log (Remove this after it works)
          // console.log("Attaching token to request:", userData.token.substring(0, 10) + "...");
        }
      } catch (error) {
        console.error("Error parsing user info for token", error);
        // If the data is corrupted, clear it so we don't keep failing
        localStorage.removeItem('userInfo');
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Response Interceptor (Optional but helpful)
// Catches 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If the server says "Unauthorized", dispatch the event to log the user out
      // This matches the event listener in your AuthContext
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
