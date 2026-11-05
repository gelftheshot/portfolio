"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { profile } from "@/lib/profile";
import WorkflowMark from "./WorkflowMark";

const sections = [
  { id: "assistant", label: "AI assistant" },
  { id: "work", label: "Work" },
  { id: "experience", label: "Experience" },
  { id: "client-work", label: "Reviews" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState({ path: "", id: "" });
  const active = activeSection.path === pathname ? activeSection.id : "";
  const menuButton = useRef(null);
  const adminPage = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (adminPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection({ path: pathname, id: entry.target.id === "home" ? "" : entry.target.id });
          }
        });
      },
      { rootMargin: "-15% 0px -55% 0px" },
    );
    ["home", ...sections.map((section) => section.id)].forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, [pathname, adminPage]);

  function handleKeyDown(event) {
    if (event.key === "Escape" && open) {
      setOpen(false);
      menuButton.current?.focus();
    }
  }

  if (adminPage) return null;
  return (
    <header className="site-header" onKeyDown={handleKeyDown}>
      <div className="header-inner section-shell">
        <Link className="wordmark" href="/#home" aria-label={profile.name + ", home"} onClick={() => setOpen(false)}>
          <WorkflowMark className="wordmark-workflow" />
          <span className="wordmark-text">{profile.name.toLowerCase()}<span className="wordmark-period">.</span></span>
        </Link>
        <button
          ref={menuButton}
          type="button"
          className="menu-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-controls="site-navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span>{open ? "Close" : "Menu"}</span>
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <nav id="site-navigation" className={`site-nav${open ? " is-open" : ""}`} aria-label="Main navigation">
          {sections.map((section) => (
            <Link href={`/#${section.id}`} key={section.id} aria-current={active === section.id ? "location" : undefined} onClick={() => setOpen(false)}>
              {section.label}<span className="nav-dot" aria-hidden="true" />
            </Link>
          ))}
        </nav>
        <Link className="header-contact" href="/#assistant">Ask AI <span aria-hidden="true">↗</span></Link>
      </div>
    </header>
  );
}
