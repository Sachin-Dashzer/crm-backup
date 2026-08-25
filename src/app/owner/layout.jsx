import "./owner-theme.css";
import { ThemeProvider } from "@/components/owner/ThemeContext";

export default function OwnerLayout({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
