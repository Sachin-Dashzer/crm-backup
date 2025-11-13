import "./globals.css";
import { ToastProvider } from "@/components/Toast.js";
export const metadata = { title: "Clinic CRM" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ToastProvider>{children} </ToastProvider>
      </body>
    </html>
  );
}
