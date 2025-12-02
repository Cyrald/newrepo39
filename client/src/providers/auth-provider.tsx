import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { initializeAuth } from "@/lib/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    const initAuth = async () => {
      await initializeAuth();
      await checkAuth();
    };
    
    initAuth();
  }, [checkAuth]);

  return <>{children}</>;
}
