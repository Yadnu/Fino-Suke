import type { Metadata } from "next";
import { Sora, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "@/components/layout/SessionProvider";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finosuke — Personal Finance",
  description:
    "A modern, intelligent personal finance app built with precision and clarity.",
  themeColor: "#0f0f11",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${sora.variable} ${dmSans.variable} font-body`}>
        <SessionProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#1a1a1f",
                color: "#f4f4f5",
                border: "1px solid #2a2a32",
                borderRadius: "12px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "#4ade80", secondary: "#0f0f11" },
              },
              error: {
                iconTheme: { primary: "#f87171", secondary: "#0f0f11" },
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
