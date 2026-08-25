import "./globals.css";
import { ToastProvider } from "@/components/Toast.js";
import NextAuthProvider from "@/components/SessionProvider";
// No next/font import here on purpose. This previously instantiated Cormorant_Garamond with four
// weights — so four font files were fetched and self-hosted on every page — but `cormorant.variable`
// was never applied to any element, and globals.css:13 defines --font-cormorant as a plain CSS
// value anyway. `Outfit` was imported and never called at all. To actually use next/font here,
// apply the returned `.variable` class to <html> and drop the hardcoded values in globals.css.

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
