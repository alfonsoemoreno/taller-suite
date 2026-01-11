export type ApiError = {
  status: number;
  message: string;
};

export const getApiBaseUrl = () =>
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function parseApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Error inesperado';
  try {
    const data = await response.json();
    if (data?.message) {
      message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
  } catch {
    try {
      const text = await response.text();
      if (text) {
        message = text;
      }
    } catch {
      // ignore parse errors
    }
  }
  return { status: response.status, message };
}
