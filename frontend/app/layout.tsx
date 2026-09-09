import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Westphalia | Diplomatic Board",
  description:
    "Interactive 3D voxel diplomatic board for the Westphalia Protocol on GenLayer StudioNet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="tactical-grid">{children}</body>
    </html>
  );
}
