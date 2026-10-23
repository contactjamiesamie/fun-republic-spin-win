import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fun Republic - Spin & Win",
  description: "Fun Republic Mall Spin & Win Campaign",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0f1115] text-white antialiased">
        {children}
      </body>
    </html>
  );
}