"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuth() {
      try {
        const hash = window.location.hash;
        const search = window.location.search;

        let accessToken = new URLSearchParams(search).get("access_token");
        if (!accessToken && hash) {
          const cleanHash = hash.replace(/^#/, "?");
          accessToken = new URLSearchParams(cleanHash).get("access_token");
        }

        if (!accessToken) {
          setError("No access token found in redirect URL.");
          return;
        }

        // Retrieve any saved workspace name from sessionStorage
        const workspaceName = sessionStorage.getItem("nex_workspace_name") || undefined;
        sessionStorage.removeItem("nex_workspace_name");

        const res = await fetch("/api/v1/auth/supabase/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ accessToken, workspaceName })
        });

        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail?.detail || "Authentication verification failed.");
        }

        router.push("/dashboard");
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    }

    handleAuth();
  }, [router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-main)", color: "var(--fg-main)", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center", padding: "32px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", maxWidth: "400px", width: "100%" }}>
        {!error ? (
          <>
            <div className="spinner" style={{ border: "4px solid rgba(255,255,255,0.1)", borderTop: "4px solid var(--color-primary, #ffffff)", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite", margin: "0 auto 16px auto" }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Verifying session</h2>
            <p style={{ color: "var(--fg-muted)", fontSize: "14px" }}>Securing your environment and launching workspace...</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: "40px", color: "var(--color-danger, #ff4444)", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ fontSize: "20px", marginBottom: "8px", color: "var(--color-danger, #ff4444)" }}>Authentication Error</h2>
            <p style={{ color: "var(--fg-muted)", fontSize: "14px", marginBottom: "24px" }}>{error}</p>
            <button
              onClick={() => router.push("/")}
              style={{ padding: "10px 20px", borderRadius: "6px", background: "var(--color-primary, #ffffff)", color: "var(--bg-main)", border: "none", cursor: "pointer", fontWeight: "bold" }}
            >
              Return Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
