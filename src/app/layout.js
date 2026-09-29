import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';
import { Toaster } from 'react-hot-toast';


const sans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const display = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata = {
  title: 'FitLab - Premium Fitness Education',
  description:
    'Learn from elite trainers who have lived what they teach. Structured fitness courses designed for people serious about results.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="bg-paper font-sans text-ink-900">
       
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('motion-ready')",
          }}
        />
        <AuthProvider>

          <SocketProvider>
            <Navbar />
            <main className="min-h-screen">
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer />
          </SocketProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#141312',
                color: '#fdfcfb',
                borderRadius: '8px',
                fontSize: '14px',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
