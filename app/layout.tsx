import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hope, Inc. — Business, in sync",
  description:
    "One connected workspace for product, people, sales, and customer management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
