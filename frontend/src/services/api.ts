import axios, { type AxiosRequestConfig } from "axios";

export function resolveBaseUrl(): string {
  if (typeof window !== "undefined") {
    if (window.location.protocol === "https:") {
      return "";
    }

    const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (configuredBaseUrl) {
      if (configuredBaseUrl.startsWith("/")) {
        return configuredBaseUrl;
      }

      try {
        const parsed = new URL(configuredBaseUrl);
        const isLoopbackHost =
          parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
        const isBrowserOnLoopback =
          window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

        // When the frontend is opened on another device, a localhost API base URL points
        // to that device itself instead of the backend machine. In that case, reuse the
        // current hostname and keep the configured backend port.
        if (isLoopbackHost && !isBrowserOnLoopback) {
          const port = parsed.port || "8000";
          return `${window.location.protocol}//${window.location.hostname}:${port}`;
        }

        return configuredBaseUrl;
      } catch {
        // Fall through to the browser-derived default below.
      }
    }

    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:8000";
}

const client = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.response.use(
  (res) => res.data?.data ?? res.data,
  (err) => {
    const message = err.response?.data?.message || err.message;
    return Promise.reject(new Error(message));
  }
);

const api = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return client.get(url, config) as Promise<T>;
  },
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return client.post(url, data, config) as Promise<T>;
  },
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return client.patch(url, data, config) as Promise<T>;
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return client.delete(url, config) as Promise<T>;
  },
};

export default api;
