import axios from "axios";

export const SERVER_WAKING =
  "Máy chủ đang thức dậy sau lúc nghỉ. Cứ đợi một chút, đăng nhập sẽ tiếp tục khi máy chủ mở lại.";

export class ApiError extends Error {
  readonly asleep: boolean;

  constructor(message: string, asleep: boolean) {
    super(message);
    this.name = "ApiError";
    this.asleep = asleep;
  }
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api",
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);

function toApiError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return new ApiError("Máy chủ chưa phản hồi. Thử lại sau một lát.", false);
  }
  const status = error.response?.status;
  const asleep = !error.response || status === 502 || status === 503 || status === 504 || error.code === "ECONNABORTED";
  if (asleep) return new ApiError(SERVER_WAKING, true);

  const message = error.response?.data?.message;
  const text = Array.isArray(message) ? message[0] : message;
  if (text === "Internal server error") {
    return new ApiError("Máy chủ gặp lỗi khi xử lý yêu cầu. Thử lại sau một lát.", false);
  }
  return new ApiError(
    typeof text === "string" && text ? text : "Máy chủ chưa phản hồi. Thử lại sau một lát.",
    false,
  );
}

export type Role = "ADMIN" | "LEADER" | "MEMBER";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
};

export type LoginResponse = {
  user: AuthUser;
};
