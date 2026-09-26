import PwaRegister from "../components/PwaRegister";
import "./globals.css";
export const metadata = {
  title: { default: "Lead2 CRM", template: "%s · Lead2 CRM" },
  description: "Your team, your pipeline, your next opportunity.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
