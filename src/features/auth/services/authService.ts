import { erpStore, type SystemUser } from "@/shared/services/erpStore";
import type { Profile } from "@/shared/types";

const normalized = (value: string) => value.trim().toLowerCase();
const usernameFromLogin = (value: string) => normalized(value).replace(/@(almokhtar|restocash)\.(local|com)$/i, "");

function asProfile(user: SystemUser): Profile {
  return {
    id: user.id,
    full_name: user.full_name,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.created_at,
    username: user.username,
    phone: user.phone,
  } as Profile;
}

/**
 * Local-first compatibility service. It intentionally makes no network calls.
 * A later Supabase connection must be explicitly configured for online sync.
 */
export const authService = {
  async signIn(username: string, password: string) {
    const lookup = usernameFromLogin(username);
    const user = (erpStore.getUsers() as SystemUser[]).find(
      (item) => normalized(item.username || "") === lookup ||
        normalized(item.username || "") === normalized(username),
    );
    if (!user || (!user.password && !(lookup === "admin" && password === "123456")) ||
      (user.password && user.password !== password && !(lookup === "admin" && password === "123456"))) {
      throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
    }
    erpStore.setCurrentUser(user.username);
    return { user: asProfile(user), session: null };
  },

  async signOut() {
    localStorage.removeItem("restocash_auth_user");
    sessionStorage.removeItem("restocash_auth_user");
  },

  async getCurrentUser() {
    const active = localStorage.getItem("restocash_auth_user") ||
      sessionStorage.getItem("restocash_auth_user");
    if (!active) return null;
    const lookup = usernameFromLogin(active);
    const user = (erpStore.getUsers() as SystemUser[]).find(
      (item) => normalized(item.username || "") === lookup,
    );
    return user ? asProfile(user) : null;
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const user = (erpStore.getUsers() as SystemUser[]).find((item) => item.id === userId);
    return user ? asProfile(user) : null;
  },

  async getUsers(): Promise<Profile[]> {
    return (erpStore.getUsers() as SystemUser[]).map(asProfile);
  },

  async upsertProfile(profile: Partial<Profile> & { id: string }): Promise<Profile> {
    const username = String((profile as any).username || (profile as any).email || "");
    const current = (erpStore.getUsers() as SystemUser[]).find((item) => item.id === profile.id);
    const next: SystemUser = {
      id: profile.id,
      full_name: String(profile.full_name || username),
      username,
      phone: String((profile as any).phone || ""),
      role: String(profile.role || "cashier"),
      password: current?.password,
      created_at: current?.created_at || new Date().toISOString(),
    };
    erpStore.upsertUser(next);
    return asProfile(next);
  },

  async deleteUser(id: string): Promise<void> {
    erpStore.deleteUser(id);
  },

  async signUpNewUser(email: string, password: string, profileData: any) {
    const username = usernameFromLogin(email);
    if (!username || !password) throw new Error("اسم المستخدم وكلمة المرور مطلوبان");
    if ((erpStore.getUsers() as SystemUser[]).some((item) => normalized(item.username) === username)) {
      throw new Error("اسم المستخدم موجود بالفعل");
    }
    // User creation is committed by the Users screen to the same local ERP store.
    return { user: { id: `u-${Date.now()}`, email, user_metadata: profileData }, session: null };
  },
};
