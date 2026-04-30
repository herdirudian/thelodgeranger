import type { AppProps } from "next/app";
import "../app/globals.css";
import { AuthProvider } from "@/context/AuthContext";
import ClientLayout from "@/components/ClientLayout";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <ClientLayout>
        <Component {...pageProps} />
      </ClientLayout>
    </AuthProvider>
  );
}

