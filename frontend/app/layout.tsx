import type { Metadata } from "next";
// The Transaction Kit panel's own stylesheet, scoped under `.gltk-root` so it
// cannot leak into the HUD. Imported before globals.css so this app's token
// overrides (see the `.gltk-root` block there) win on equal specificity.
import "@genlayer/transaction-kit-react/styles.css";
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
