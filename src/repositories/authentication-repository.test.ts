import { apiClient } from '@/infrastructure/networking';
import { TokenStorageService } from '@/infrastructure/storage';

import { login, logout } from './authentication-repository';

jest.mock('@/infrastructure/networking', () => ({
  apiClient: { post: jest.fn() },
}));
jest.mock('@/infrastructure/storage', () => ({
  TokenStorageService: { saveToken: jest.fn(), getToken: jest.fn(), clearToken: jest.fn() },
}));

const CREDENTIALS = { username: 'field.executive', password: 'secret-value' };

describe('authentication-repository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('posts credentials to /auth/login and persists the returned token', async () => {
      jest.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            token: 'jwt-token-value',
            fieldExecutive: { id: 'fe-001', name: 'Amit Verma', email: 'amit.verma@fullscan.example', role: 'Field Agent' },
          },
        },
      });

      await login(CREDENTIALS);

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', CREDENTIALS);
      expect(TokenStorageService.saveToken).toHaveBeenCalledWith('jwt-token-value');
    });

    it('propagates the request failure without persisting a token', async () => {
      const requestError = new Error('Request failed with status code 401');
      jest.mocked(apiClient.post).mockRejectedValueOnce(requestError);

      await expect(login(CREDENTIALS)).rejects.toBe(requestError);
      expect(TokenStorageService.saveToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the persisted session token', async () => {
      await logout();

      expect(TokenStorageService.clearToken).toHaveBeenCalled();
    });
  });
});
