import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Connection, ConnectionList, ConnectionPatch, Event, EventBody, ProfilePatch, User } from "@wjm/shared";
import { api, ApiRequestError } from "./client";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try { return await api<User>("/me"); }
      catch (e) { if (e instanceof ApiRequestError && e.status === 401) return null; throw e; }
    },
    staleTime: 60_000,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfilePatch) => api<User>("/me", { method: "PATCH", body }),
    onSuccess: (u) => qc.setQueryData(["me"], u),
  });
}

export function useConnections(q: string, eventId: string | null) {
  return useInfiniteQuery({
    queryKey: ["connections", q, eventId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (eventId) p.set("eventId", eventId);
      if (pageParam) p.set("cursor", pageParam);
      return api<ConnectionList>(`/connections?${p}`);
    },
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
  });
}

export function useConnection(id: string, waitForPhoto = false) {
  return useQuery({
    queryKey: ["connection", id], queryFn: () => api<Connection>(`/connections/${id}`),
    refetchInterval: waitForPhoto ? 3000 : false,
  });
}

export function useUpdateConnection(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ConnectionPatch) => api<Connection>(`/connections/${id}`, { method: "PATCH", body }),
    onSuccess: (c) => { qc.setQueryData(["connection", id], c); qc.invalidateQueries({ queryKey: ["connections"] }); },
  });
}

export function useEvents() {
  return useQuery({ queryKey: ["events"], queryFn: () => api<Event[]>("/events"), staleTime: 30_000 });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EventBody) => api<Event>("/events", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export async function uploadImage(kind: "avatar" | "connection" | "business_card" | "exchange", blob: Blob, connectionId?: string) {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  const qs = connectionId ? `?connectionId=${connectionId}` : "";
  return api<{ key: string; url: string }>(`/uploads${qs}`, { method: "POST", body: { kind, contentType: "image/jpeg", dataBase64 } });
}

export async function uploadExchangePhoto(blob: Blob, token: string) {
  const dataBase64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
  return api<{ key: string; url: string }>(`/uploads?token=${encodeURIComponent(token)}`, {
    method: "POST", body: { kind: "exchange", contentType: "image/jpeg", dataBase64 },
  });
}
