import type { IngredientSummary, RecipeRecommendation } from "@mealplanner/shared";

const normalizeApiBaseUrl = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error("VITE_API_BASE_URL is required for API requests.");
  }

  return trimmed.replace(/\/+$/, "");
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export const SESSION_STORAGE_KEY = "greeney-session-v1";

type ApiEnvelope<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string | { message?: string; code?: string } };

export interface AuthSession {
  accessToken: string;
  email?: string;
}

export interface CharacterStateDto {
  hp: number;
  stage: "egg" | "healthy" | "happy" | "weak" | "dead" | string;
  updated_at?: string;
  last_fed_at?: string;
  status_message?: string;
}

interface IngredientRow {
  id: string;
  user_id?: string;
  userId?: string;
  name?: string;
  item_code?: string;
  item_cd?: string;
  itemCode?: string;
  ctgry_nm?: string;
  expires_at?: string;
  expired_at?: string;
  expiresAt?: string;
  quantity?: number;
  total_quantity?: number;
  totalQuantity?: number;
  remaining_quantity?: number;
  remainingQuantity?: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

interface CreateIngredientInput {
  name: string;
  quantity: number;
  expiredAt: string;
}

const unwrap = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success) {
    const error = payload.success ? undefined : payload.error;
    throw new Error(typeof error === "string" ? error : error?.message ?? "API request failed.");
  }

  return payload.data;
};

const authHeaders = () => {
  const session = getStoredSession();
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
};

const request = async <T>(path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  for (const [key, value] of Object.entries(authHeaders())) {
    headers.set(key, value);
  }

  return unwrap<T>(
    await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    })
  );
};

export const getStoredSession = (): AuthSession | null => {
  if (typeof localStorage === "undefined") return null;

  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? "null") as Partial<AuthSession> | null;
    return parsed?.accessToken ? { accessToken: parsed.accessToken, email: parsed.email } : null;
  } catch {
    return null;
  }
};

export const storeSession = (session: AuthSession) => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

export const login = async (email: string, password: string) => {
  const data = await request<{ session?: { access_token?: string }; user?: { email?: string } }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Login succeeded, but no access token was returned.");

  const session = { accessToken, email: data.user?.email ?? email };
  storeSession(session);
  return session;
};

export const signup = async (email: string, password: string) => {
  const data = await request<{ session?: { access_token?: string }; user?: { email?: string } }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (data.session?.access_token) {
    const session = { accessToken: data.session.access_token, email: data.user?.email ?? email };
    storeSession(session);
    return session;
  }

  return { accessToken: "", email: data.user?.email ?? email };
};

export const logout = async () => {
  try {
    if (getStoredSession()) {
      await request("/auth/logout", { method: "POST" });
    }
  } finally {
    clearSession();
  }
};

export const loadCharacter = () => request<CharacterStateDto>("/api/character");

export const rebirthCharacter = () =>
  request<CharacterStateDto & { message?: string }>("/api/character/rebirth", { method: "POST" });

export const submitMealPhoto = (image: string, recommendedRecipeName?: string) =>
  request<CharacterStateDto & { hp_change?: number; food_name?: string; reason?: string; message?: string }>("/api/character/eat-photo", {
    method: "POST",
    body: JSON.stringify({ image, recommended_recipe_name: recommendedRecipeName }),
  });

export const loadIngredients = async () => {
  const rows = await request<IngredientRow[]>("/api/ingredients");
  return rows.map(toIngredientView);
};

export const createIngredient = async ({ name, quantity, expiredAt }: CreateIngredientInput) => {
  const rows = await request<IngredientRow[]>("/api/ingredients", {
    method: "POST",
    body: JSON.stringify({ name, quantity, expired_at: expiredAt }),
  });

  return rows.map(toIngredientView);
};

export const loadRecipeRecommendations = () =>
  request<RecipeRecommendation[]>("/api/recipes/recommend?limit=10&maxMissingIngredients=8&expiringWithinDays=3");

export const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image."));
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });

const toIngredientView = (row: IngredientRow): IngredientSummary & { storage: string; memo: string } => {
  const itemCode = row.itemCode ?? row.item_code ?? row.item_cd ?? row.name ?? row.id;
  const totalQuantity = Number(row.totalQuantity ?? row.total_quantity ?? row.quantity ?? 1);
  const remainingQuantity = Number(row.remainingQuantity ?? row.remaining_quantity ?? totalQuantity);
  const createdAt = row.createdAt ?? row.created_at ?? new Date().toISOString();

  return {
    id: row.id,
    userId: row.userId ?? row.user_id ?? "",
    itemCode,
    expiresAt: row.expiresAt ?? row.expires_at ?? row.expired_at ?? createdAt,
    totalQuantity,
    remainingQuantity,
    createdAt,
    updatedAt: row.updatedAt ?? row.updated_at ?? createdAt,
    storage: "냉장",
    memo: "등록된 식재료입니다.",
    item: {
      itemCode,
      name: row.name ?? itemCode,
      category: row.ctgry_nm,
      unit: "개",
    },
  };
};
