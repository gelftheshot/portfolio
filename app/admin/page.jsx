import { notFound } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { getAdminConfiguration } from "@/lib/server/admin-auth";
import "./admin.css";

export const dynamic = "force-dynamic";

const adminConfigured = () => getAdminConfiguration().configured;

const adminMetadata = {
  title: "Portfolio Admin",
  description: "Private portfolio management.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: "/admin", types: {} },
};

// Metadata resolves alongside the page, so it must not name the admin while the page answers 404.
export function generateMetadata() {
  return adminConfigured() ? adminMetadata : {};
}

export default function AdminPage() {
  // Until the admin credentials are configured, /admin is indistinguishable from a missing page.
  if (!adminConfigured()) notFound();
  return <main id="main-content" className="admin-app"><AdminDashboard /></main>;
}
