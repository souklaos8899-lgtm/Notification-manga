import type {
  MangaItemDto,
  MangaSourceDto,
  NotificationChannelConfig,
  NotificationChannelDto,
  NotificationLogDto,
  SystemSettingsDto,
  UrlAnalyzeResultDto,
  UserProfileDto,
  CreateMangaInput,
  UpdateMangaInput,
} from '../types';

export class ApiError extends Error {
  public readonly status: number;
  public readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const TOKEN_KEY = 'manga_auth_token';

export function getStoredToken(): string | null {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setStoredToken(token: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : typeof data === 'object' && data !== null && 'message' in data && typeof (data as { message: unknown }).message === 'string'
          ? (data as { message: string }).message
          : `HTTP ${response.status}: ${response.statusText}`;
    throw new ApiError(response.status, errorMessage, data);
  }

  return data as T;
}

export const api = {
  async getMe(): Promise<UserProfileDto | null> {
    try {
      const res = await request<{ user: UserProfileDto | null }>('/api/auth/me');
      return res.user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        return null;
      }
      throw err;
    }
  },

  async quickPersonalLogin(): Promise<UserProfileDto> {
    const res = await request<{ user: UserProfileDto; token?: string }>('/api/auth/quick-personal-login', {
      method: 'POST',
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res.user;
  },

  async login(username: string, password: string): Promise<UserProfileDto> {
    const res = await request<{ user: UserProfileDto; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res.user;
  },

  async register(username: string, password: string, displayName: string): Promise<UserProfileDto> {
    const res = await request<{ user: UserProfileDto; token?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res.user;
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  async getSettings(): Promise<SystemSettingsDto> {
    return request<SystemSettingsDto>('/api/settings');
  },

  async updateSettings(settings: Partial<SystemSettingsDto>): Promise<SystemSettingsDto> {
    return request<SystemSettingsDto>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },

  async checkAllManga(): Promise<{ message: string; checkedCount: number }> {
    return request<{ message: string; checkedCount: number }>('/api/manga/check-all', {
      method: 'POST',
    });
  },

  async getMangaList(): Promise<readonly MangaItemDto[]> {
    const res = await request<{ readonly items?: readonly MangaItemDto[] }>('/api/manga');
    if (res && 'items' in res && Array.isArray(res.items)) return res.items;
    if (Array.isArray(res)) return res;
    return [];
  },

  async createManga(input: CreateMangaInput): Promise<MangaItemDto> {
    return request<MangaItemDto>('/api/manga', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async updateManga(id: string, input: UpdateMangaInput): Promise<MangaItemDto> {
    return request<MangaItemDto>(`/api/manga/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  async deleteManga(id: string): Promise<void> {
    await request(`/api/manga/${id}`, {
      method: 'DELETE',
    });
  },

  async markRead(id: string, chapterNumber: number, chapterTitle?: string, chapterUrl?: string): Promise<MangaItemDto> {
    return request<MangaItemDto>(`/api/manga/${id}/mark-read`, {
      method: 'POST',
      body: JSON.stringify({ chapterNumber, chapterTitle, chapterUrl }),
    });
  },

  async checkManga(id: string): Promise<MangaItemDto> {
    const res = await request<{ item?: MangaItemDto } & MangaItemDto>(`/api/manga/${id}/check`, {
      method: 'POST',
    });
    return res.item || res;
  },

  async simulateUpdate(id: string): Promise<MangaItemDto> {
    const res = await request<{ item?: MangaItemDto } & MangaItemDto>(`/api/manga/${id}/simulate-update`, {
      method: 'POST',
    });
    return res.item || res;
  },

  async addSource(mangaId: string, source: Omit<MangaSourceDto, 'id' | 'mangaId' | 'checkState'>): Promise<MangaSourceDto> {
    return request<MangaSourceDto>(`/api/manga/${mangaId}/sources`, {
      method: 'POST',
      body: JSON.stringify(source),
    });
  },

  async deleteSource(mangaId: string, sourceId: string): Promise<void> {
    await request(`/api/manga/${mangaId}/sources/${sourceId}`, {
      method: 'DELETE',
    });
  },

  async analyzeUrl(url: string): Promise<UrlAnalyzeResultDto> {
    return request<UrlAnalyzeResultDto>('/api/scraper/analyze', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },

  async getChannels(): Promise<readonly NotificationChannelDto[]> {
    const res = await request<{ readonly items?: readonly NotificationChannelDto[] }>('/api/channels');
    if (res && 'items' in res && Array.isArray(res.items)) return res.items;
    if (Array.isArray(res)) return res;
    return [];
  },

  async createChannel(payload: {
    readonly name: string;
    readonly enabled: boolean;
    readonly config: NotificationChannelConfig;
  }): Promise<NotificationChannelDto> {
    return request<NotificationChannelDto>('/api/channels', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateChannel(
    id: string,
    payload: {
      readonly name?: string;
      readonly enabled?: boolean;
      readonly config?: NotificationChannelConfig;
    }
  ): Promise<NotificationChannelDto> {
    return request<NotificationChannelDto>(`/api/channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteChannel(id: string): Promise<void> {
    await request(`/api/channels/${id}`, {
      method: 'DELETE',
    });
  },

  async testChannel(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/channels/${id}/test`, {
      method: 'POST',
    });
  },

  async getNotifications(): Promise<readonly NotificationLogDto[]> {
    const res = await request<{ readonly items?: readonly NotificationLogDto[] }>('/api/notifications');
    if (res && 'items' in res && Array.isArray(res.items)) return res.items;
    if (Array.isArray(res)) return res;
    return [];
  },

  async markNotificationRead(id: string): Promise<void> {
    await request(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  async markAllNotificationsRead(): Promise<void> {
    await request('/api/notifications/read-all', {
      method: 'POST',
    });
  },
};
