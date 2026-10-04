import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_URL;

if (!configuredBaseUrl) {
  throw new Error('VITE_API_URL is missing. Set it in frontend/.env.');
}

const baseURL = configuredBaseUrl.replace(/\/+$/, '');
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveTokens(tokens) {
  if (!tokens?.access_token || !tokens?.refresh_token) {
    throw new Error('The API did not return both access and refresh tokens.');
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const isLogin = config.url?.includes('/api/auth/login');
  const isRefresh = config.url?.includes('/api/auth/refresh');
  const accessToken = getAccessToken();

  if (!isLogin && !isRefresh && accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

let refreshRequest;

function refreshTokens() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return Promise.reject(new Error('Your session has expired. Please log in again.'));
  }

  if (!refreshRequest) {
    refreshRequest = axios
      .post(
        `${baseURL}/api/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      )
      .then(({ data }) => {
        saveTokens(data);
        return data.access_token;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url ?? '';
    const isLogin = url.includes('/api/auth/login');
    const isRefresh = url.includes('/api/auth/refresh');

    if (error.response?.status !== 401 || !originalRequest || isLogin || isRefresh) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      clearTokens();
      window.dispatchEvent(new Event('auth:expired'));
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      await refreshTokens();

      if (url.includes('/api/auth/logout')) {
        originalRequest.data = JSON.stringify({ refresh_token: getRefreshToken() });
      }

      return api(originalRequest);
    } catch (refreshError) {
      clearTokens();
      window.dispatchEvent(new Event('auth:expired'));
      return Promise.reject(refreshError);
    }
  },
);

export function getApiError(error, fallback = 'Something went wrong. Please try again.') {
  return error.response?.data?.error
    || error.response?.data?.message
    || error.message
    || fallback;
}
