import AdminDashboard from "@/components/admin/AdminDashboard";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Portfolio Admin",
  description: "Private portfolio management.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  alternates: { canonical: "/admin", types: {} },
};

export default function AdminPage() {
  return <main id="main-content" className="admin-app"><AdminDashboard /></main>;
}
