import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api",
  withCredentials: true,
  timeout: 15000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = axios.isAxiosError(error)
      ? error.response?.data?.message
      : undefined;
    const text = Array.isArray(message) ? message[0] : message;
    return Promise.reject(
      new Error(
        typeof text === "string" && text
          ? text
          : "Không kết nối được máy chủ",
      ),
    );
  },
);

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
