import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
<<<<<<< HEAD
  title: "Hope, Inc. — Business, in sync",
  description:
    "One connected workspace for product, people, sales, and customer management.",
=======
  title: "Hope, Inc. | Business Management",
  description: "Hope, Inc. business management system.",
>>>>>>> origin/develop
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
