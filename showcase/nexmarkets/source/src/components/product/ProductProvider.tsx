"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { ApiProblem, BootstrapData } from "./types";

type Toast = { title: string; text: string } | null;

type ProductContextValue = {
  data: BootstrapData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
  connectWallet: () => Promise<void>;
  signOut: () => Promise<void>;
  toast: Toast;
  notify: (title: string, text: string) => void;
  dismissToast: () => void;
  walletConnected: boolean;
  connectClientWallet: () => Promise<void>;
  signInOpen: boolean;
  setSignInOpen: (open: boolean) => void;
  connectWalletOpen: boolean;
  setConnectWalletOpen: (open: boolean) => void;
};

const ProductContext = createContext<ProductContextValue | null>(null);

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const method = (init?.method || "GET").toUpperCase();
  if (!new Set(["GET", "HEAD", "OPTIONS"]).has(method) && !headers.has("idempotency-key")) {
    headers.set("idempotency-key", crypto.randomUUID());
  }
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  const payload = await response.json().catch(() => null) as { data?: T; detail?: string; title?: string; code?: string; requestId?: string } | null;
  if (!response.ok) {
    const error = new Error(payload?.detail || payload?.title || `Request failed with status ${response.status}.`) as ApiProblem;
    error.status = response.status;
    error.code = payload?.code;
    error.requestId = payload?.requestId;
    throw error;
  }
  return payload?.data as T;
}

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window { ethereum?: EthereumProvider }
}

export function ProductProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { address: wagmiAddress, isConnected: wagmiIsConnected, chainId: wagmiChainId } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();

  const [signInOpen, setSignInOpen] = useState(false);
  const [connectWalletOpen, setConnectWalletOpen] = useState(false);

  const walletConnected = process.env.NODE_ENV === "development" || Boolean(
    wagmiIsConnected &&
    wagmiAddress &&
    data?.wallet.address &&
    wagmiAddress.toLowerCase() === data.wallet.address.toLowerCase()
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await requestJson<BootstrapData>("/api/v1/bootstrap");
      setData(next);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "NexMarkets data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const notify = useCallback((title: string, text: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ title, text });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const connectWallet = useCallback(async () => {
    if (process.env.NODE_ENV === "development") {
      notify("Development wallet ready", "Local development simulation linked the seeded dev wallet.");
      await refresh();
      setSignInOpen(false);
      return;
    }
    if (!wagmiIsConnected || !wagmiAddress) {
      if (openConnectModal) {
        openConnectModal();
      } else {
        throw new Error("Install or open an EVM wallet to continue.");
      }
      return;
    }
    const address = wagmiAddress;
    const chainId = wagmiChainId === 4663 || wagmiChainId === 46630
      ? wagmiChainId
      : data?.wallet.chainId === 4663 || data?.wallet.chainId === 46630
        ? data.wallet.chainId
        : 46630;
    const challenge = await requestJson<{ challengeId: string; message: string }>("/api/v1/auth/wallet/challenge", {
      method: "POST",
      body: JSON.stringify({ address, chainId }),
    });
    const signature = await signMessageAsync({ message: challenge.message });
    await requestJson("/api/v1/auth/wallet/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId: challenge.challengeId, address, signature }),
    });
    await refresh();
    setSignInOpen(false);
    notify("Wallet verified", "Your real wallet is now connected to this account.");
  }, [wagmiIsConnected, wagmiAddress, wagmiChainId, data, openConnectModal, signMessageAsync, notify, refresh]);

  const connectClientWallet = useCallback(async () => {
    if (process.env.NODE_ENV === "development") {
      setConnectWalletOpen(false);
      notify("Development wallet ready", "Local development simulation bypassed the browser wallet connection.");
      return;
    }
    if (!wagmiIsConnected || !wagmiAddress) {
      if (openConnectModal) {
        openConnectModal();
      } else {
        throw new Error("Install or open an EVM wallet to continue.");
      }
      return;
    }
    if (data?.wallet.address && wagmiAddress.toLowerCase() !== data.wallet.address.toLowerCase()) {
      throw new Error(`Connect the registered wallet address: ${data.wallet.address.slice(0, 6)}…${data.wallet.address.slice(-4)}`);
    }
    setConnectWalletOpen(false);
    notify("Wallet connected", "Your wallet is now connected to this session.");
  }, [wagmiIsConnected, wagmiAddress, openConnectModal, data, notify]);

  const signOut = useCallback(async () => {
    await requestJson("/api/v1/auth/logout", { method: "POST", body: "{}" });
    try {
      await disconnectAsync();
    } catch {
      // ignore
    }
    await refresh();
    notify("Signed out", "Private workspace data has been cleared from this view.");
  }, [disconnectAsync, notify, refresh]);

  const value = useMemo<ProductContextValue>(() => ({
    data, loading, error, refresh, api: requestJson, connectWallet, signOut, toast, notify,
    dismissToast: () => setToast(null),
    walletConnected, connectClientWallet,
    signInOpen, setSignInOpen,
    connectWalletOpen, setConnectWalletOpen
  }), [connectWallet, data, error, loading, notify, refresh, signOut, toast, walletConnected, connectClientWallet, signInOpen, connectWalletOpen]);

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProduct() {
  const value = useContext(ProductContext);
  if (!value) throw new Error("useProduct must be used within ProductProvider.");
  return value;
}
