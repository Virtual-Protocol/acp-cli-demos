import type { ReactNode } from "react";
import { AppShell } from "@/components/product/AppShell";
import { ProductProvider } from "@/components/product/ProductProvider";
import { Web3Provider } from "@/components/product/Web3Provider";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <Web3Provider>
      <ProductProvider>
        <AppShell>{children}</AppShell>
      </ProductProvider>
    </Web3Provider>
  );
}
