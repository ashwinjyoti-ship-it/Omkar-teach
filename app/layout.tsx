import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omkar TODO",
  description: "Simple and efficient task manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-white">
        {children}
      </body>
    </html>
  );
}
