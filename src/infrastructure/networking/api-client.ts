import axios from 'axios';
import type { AxiosError, AxiosInstance } from 'axios';
import { Platform } from 'react-native';

import { LoggerService } from '@/infrastructure/logger';
import { TokenStorageService } from '@/infrastructure/storage';

const FILE_NAME = 'infrastructure/networking/api-client.ts';
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Android emulators can't resolve the host machine as `localhost` — 10.0.2.2
 * is the documented alias back to it. iOS simulators share the host network
 * directly. Physical devices will need a real LAN/tunnel URL, not handled
 * here yet — this points only at the local FullScanServer mock during
 * development.
 */
const DEV_API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3000/api/v1',
  default: 'http://localhost:3000/api/v1',
});

/**
 * Single configured axios instance for the app — repositories are the only
 * layer allowed to import this; screens/widgets never call it directly.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: DEV_API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

apiClient.interceptors.request.use(async (request) => {
  // Method, URL path and status code only — never headers, request bodies or
  // response payloads: they carry bearer tokens, passwords and PII.
  LoggerService.info(`${FILE_NAME}: apiClient: preparing request`, {
    method: request.method,
    url: request.url,
  });

  const token = await TokenStorageService.getToken();
  if (token) {
    LoggerService.info(`${FILE_NAME}: apiClient: attaching authorization header`, {
      url: request.url,
    });
    request.headers.set('Authorization', `Bearer ${token}`);
  } else {
    LoggerService.warn(`${FILE_NAME}: apiClient: no auth token, sending unauthenticated request`, {
      url: request.url,
    });
  }

  LoggerService.info(`${FILE_NAME}: apiClient: request`, {
    method: request.method,
    url: request.url,
    isAuthenticated: Boolean(token),
  });
  return request;
});

apiClient.interceptors.response.use(
  (response) => {
    LoggerService.info(`${FILE_NAME}: apiClient: response`, {
      status: response.status,
      url: response.config.url,
    });
    return response;
  },
  (error: AxiosError) => {
    LoggerService.error(`${FILE_NAME}: apiClient: request failed`, {
      url: error.config?.url,
      status: error.response?.status,
    });
    return Promise.reject(error);
  },
);
