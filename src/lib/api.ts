export type ApiError = {
  status: number;
  message: string;
};

export const getApiBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

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
