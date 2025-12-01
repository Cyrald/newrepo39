import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  }).then(async (response) => {
    if (!response.ok) {
      isRefreshing = false;
      refreshPromise = null;
      throw new Error('Failed to refresh token');
    }
    isRefreshing = false;
    refreshPromise = null;
  }).catch((error) => {
    isRefreshing = false;
    refreshPromise = null;
    throw error;
  });

  return refreshPromise;
}

export async function apiRequest<T = unknown>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const isFormData = data instanceof FormData;
  const isBlob = data instanceof Blob;
  const isFile = typeof File !== 'undefined' && data instanceof File;
  const isFileUpload = isFormData || isBlob || isFile;

  const headers: Record<string, string> = {};
  
  if (data && !isFileUpload) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: isFileUpload ? (data as any) : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/auth/refresh')) {
    try {
      await refreshAccessToken();
      
      const retryHeaders: Record<string, string> = {};
      
      if (data && !isFileUpload) {
        retryHeaders["Content-Type"] = "application/json";
      }
      
      const retryRes = await fetch(url, {
        method,
        headers: retryHeaders,
        body: isFileUpload ? (data as any) : (data ? JSON.stringify(data) : undefined),
        credentials: "include",
      });

      await throwIfResNotOk(retryRes);
      
      if (retryRes.status === 204 || retryRes.headers.get('content-length') === '0') {
        return undefined as T;
      }
      
      const contentType = retryRes.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await retryRes.json()) as T;
      }
      
      return (await retryRes.text()) as T;
    } catch (error) {
      throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
    }
  }

  await throwIfResNotOk(res);
  
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  
  return (await res.text()) as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
