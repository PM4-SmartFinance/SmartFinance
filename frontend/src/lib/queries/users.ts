import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  active: boolean;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName?: string;
  role?: "USER" | "ADMIN";
}

export interface UpdateUserInput {
  name?: string;
  role?: "USER" | "ADMIN";
  active?: boolean;
}

interface UsersResponse {
  items: User[];
  total: number;
  limit: number;
  offset: number;
}

interface UserResponse {
  user: User;
}

const USERS_QUERY_KEY = ["users"] as const;

export function useUsers(
  limit = 50,
  offset = 0,
  sortBy?: "email" | "role" | "createdAt",
  sortOrder?: "asc" | "desc",
) {
  return useQuery<UsersResponse>({
    queryKey: [...USERS_QUERY_KEY, { limit, offset, sortBy, sortOrder }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());
      if (sortBy) {
        params.append("sortBy", sortBy);
      }
      if (sortOrder) {
        params.append("sortOrder", sortOrder);
      }
      const url = `/users?${params.toString()}`;
      const response = await api.get<UsersResponse>(url);
      return response;
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => api.post<UserResponse>("/users", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      api.patch<UserResponse>(`/users/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}
