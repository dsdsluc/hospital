const accessTokenKey = "hospital_access_token";

export const authStorage = {
  getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(accessTokenKey) ?? window.sessionStorage.getItem(accessTokenKey);
  },

  setAccessToken(token: string, persistent = true): void {
    this.removeAccessToken();
    const storage = persistent ? window.localStorage : window.sessionStorage;
    storage.setItem(accessTokenKey, token);
    window.dispatchEvent(new Event("hospital-auth-change"));
  },

  removeAccessToken(): void {
    window.localStorage.removeItem(accessTokenKey);
    window.sessionStorage.removeItem(accessTokenKey);
    window.dispatchEvent(new Event("hospital-auth-change"));
  },
};
