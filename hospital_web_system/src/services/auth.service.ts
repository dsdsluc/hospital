import { apiClient } from "@/lib/api-client";
import type { AuthResponse, User } from "@/types/api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  full_name: string;
  phone_number?: string;
}

export interface UpdateAccountPayload {
  email?: string;
  phone_number?: string | null;
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/auth/login", payload);
    return response.data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/auth/register", payload);
    return response.data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ user: User }>("/auth/me");
    return response.data.user;
  },

  async updateCurrentUser(payload: UpdateAccountPayload): Promise<User> {
    const response = await apiClient.patch<{ message: string; user: User }>("/auth/me", payload);
    return response.data.user;
  },
};
