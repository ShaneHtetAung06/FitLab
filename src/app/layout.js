import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/context/AuthContext';

/**
 * The variable names here are the ones tailwind.config.js reads in its
 * fontFamily entries (`--font-sans`, `--font-display`), so `font-sans` and
 * `font-display` in markup resolve to these without any extra wiring.
 */
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "FitLab",
  description: "Coaching, courses, and training plans.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
