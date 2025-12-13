const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

let isRefreshing = false;

const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // Attempt Original Request
  let response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  // Check for 401 (Unauthorized)
  if (response.status === 401 && !isRefreshing) {
    isRefreshing = true;

    try {
      // Attempt Refresh
      const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshResponse.ok) {
        // Retry Original Request if refresh succeeded
        response = await fetch(url, {
          ...options,
          credentials: 'include',
        });
      }
    } catch (e) {
      console.error("Token refresh failed", e);
    } finally {
      isRefreshing = false;
    }
  }

  return response;
};

export const api = {
  foods: {
    list: async ({ pageParam = undefined, limit = 20 }: { pageParam?: string; limit?: number }) => {
      const params = new URLSearchParams({ limit: limit.toString() });
      
      if (pageParam) {
        params.append('cursor', pageParam);
      }

      const res = await fetchWithAuth(`${BASE_URL}/foods?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch foods');
      return res.json();
    },
    details: async (id: string) => {
      const res = await fetchWithAuth(`${BASE_URL}/foods/${id}/details`);
      if (!res.ok) throw new Error('Failed to fetch details');
      return res.json();
    },
    suggest: async (mood: string) => {
      const res = await fetchWithAuth(`${BASE_URL}/foods/suggest/${mood}`);
      if (!res.ok) throw new Error('Failed to suggest food');
      return res.json();
    }
  },
  auth: {
    me: async () => {
      const res = await fetchWithAuth(`${BASE_URL}/users/me`);
      if (!res.ok) throw new Error('Unauthorized');
      return res.json();
    },
    logout: async () => {
      await fetchWithAuth(`${BASE_URL}/auth/logout`, { method: 'POST' });
    }
  }
};