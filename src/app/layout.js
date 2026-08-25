import "./globals.css";
import { ToastProvider } from "@/components/Toast.js";
import NextAuthProvider from "@/components/SessionProvider";
import { Cormorant_Garamond, Outfit } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
  variable: "--font-cormorant",
});

export const metadata = {
  title: "Hair Transplant Clinic",
  description: "Clinic Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <NextAuthProvider>
          <ToastProvider>{children} </ToastProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
