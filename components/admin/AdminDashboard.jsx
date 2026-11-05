"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import WorkflowMark from "../WorkflowMark";
import { validateContentBundle } from "@/lib/admin/content-schema";

const DRAFT_KEY = "portfolio-admin-content-v1";
const sections = [
  ["overview", "Overview"], ["profile", "Profile"], ["projects", "Projects"],
  ["experience", "Experience"], ["reviews", "Reviews"], ["assistant", "AI assistant"], ["inbox", "Contact inbox"],
];
const newItems = {
  projects: () => ({ slug: "new-project-" + Date.now().toString(36), title: "Untitled project", category: "Software engineering", description: "", detail: "", role: "", tags: [], images: [], visualType: "screenshot", visualAlt: "", technicalSections: [], sources: [] }),
  experience: () => ({ id: "new-role-" + Date.now().toString(36), company: "New company", role: "", period: "", startYear: "", endYear: "", description: "", focusAreas: [], responsibilities: [] }),
  reviews: () => ({ id: "new-review-" + Date.now().toString(36), title: "New client project", clientName: "", clientNameSource: "Client", period: "", startDate: "", endDate: "", rating: 5, ratingScale: 5, feedback: "", sourceUrl: "" }),
};
const clone = (value) => structuredClone(value);
const signature = (value) => JSON.stringify(value);
const list = (value) => Array.isArray(value) ? value : [];
const imageSource = (path) => typeof path === "string" && /^\/(?!\/)[a-zA-Z0-9/_. -]+\.(png|jpe?g|webp|svg)$/i.test(path) ? path : null;

function Icon({ name }) {
  const paths = {
    overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    profile: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    projects: "M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
    experience: "M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3",
    reviews: "m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L2.2 9.4l6.1-.9L12 3Z",
    assistant: "M5 5h14v12H9l-4 4V5ZM9 9h6M9 13h4",
    inbox: "M3 5h18v14H3zM3 6l9 7 9-7",
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.overview} /></svg>;
}

function Field({ label, value, onChange, multiline = false, hint, type = "text", rows = 4, ...props }) {
  const id = useId();
  const Input = multiline ? "textarea" : "input";
  return <div className="admin-field"><label htmlFor={id}>{label}</label><Input id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)} {...(multiline ? { rows } : { type })} {...props} />{hint && <p>{hint}</p>}</div>;
}

function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose, busy }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    // Removing this component dismisses the dialog. Calling close() during
    // Strict Mode's effect replay would queue onClose and clear the new dialog.
  }, []);
  return <dialog ref={ref} className="admin-confirm" aria-labelledby={id} onClose={onClose}><h2 id={id}>{title}</h2><div>{children}</div><div className="admin-confirm-actions"><button type="button" className="admin-button" onClick={onClose} disabled={busy} autoFocus>Cancel</button><button type="button" className="admin-button admin-primary" onClick={onConfirm} disabled={busy}>{busy ? "Publishing…" : confirmLabel}</button></div></dialog>;
}

export default function AdminDashboard() {
  const [phase, setPhase] = useState("checking");
  const [configured, setConfigured] = useState(false);
  const [password, setPassword] = useState("");
  const [screen, setScreen] = useState("overview");
  const [content, setContent] = useState(null);
  const [original, setOriginal] = useState(null);
  const [revision, setRevision] = useState(null);
  const [publishingConfigured, setPublishingConfigured] = useState(false);
  const [repository, setRepository] = useState("");
  const [selected, setSelected] = useState(0);
  const [uploads, setUploads] = useState([]);
  const [imagePreviews, setImagePreviews] = useState({});
  const [recovery, setRecovery] = useState(null);
  const [rawValues, setRawValues] = useState({});
  const [rawErrors, setRawErrors] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [published, setPublished] = useState(null);
  const [operations, setOperations] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);
  const [messageId, setMessageId] = useState(null);
  const [messageFilter, setMessageFilter] = useState("active");
  const [storageWarning, setStorageWarning] = useState(false);
  const fileRef = useRef(null);
  const dirty = content && original && signature(content) !== signature(original);
  const invalid = Object.keys(rawErrors).length > 0;
  const settingsDirty = operations && savedSettings && signature(operations.settings) !== signature(savedSettings);
  const hasUnsaved = dirty || invalid || settingsDirty;

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setPhase("login");
      setContent(null);
      setOperations(null);
      setSavedSettings(null);
      setPassword("");
      setConfirm(null);
    }
    if (!response.ok) {
      const failure = new Error(data.error?.message || data.message || "The request could not be completed.");
      failure.status = response.status;
      throw failure;
    }
    return data;
  }, []);

  const loadContent = useCallback(async () => {
    const data = await api("/api/admin/content");
    setContent(data.content);
    setOriginal(clone(data.content));
    setRevision(data.revision);
    setPublishingConfigured(data.publishingConfigured);
    setRepository(data.repository);
    setUploads([]);
    setRawValues({});
    setRawErrors({});
    setSelected(0);
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      setRecovery(saved?.content?.profile && Array.isArray(saved.content.projects) && saved.content?.upwork?.completedWork ? saved : null);
    } catch { setRecovery(null); }
    setPhase("dashboard");
  }, [api]);

  const checkSession = useCallback(async () => {
    try {
      const session = await api("/api/admin/session");
      setError("");
      setConfigured(session.configured);
      if (session.authenticated) await loadContent();
      else setPhase("login");
    } catch (failure) { setError(failure.message); setPhase("login"); }
  }, [api, loadContent]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("The admin session could not be checked."); return response.json(); })
      .then((session) => {
        if (!active) return;
        setConfigured(session.configured);
        if (session.authenticated) void loadContent().catch((failure) => { if (active) { setError(failure.message); setPhase("login"); } });
        else setPhase("login");
      })
      .catch((failure) => { if (active) { setError(failure.message); setPhase("login"); } });
    return () => { active = false; controller.abort(); };
  }, [loadContent]);

  useEffect(() => {
    if (!content || recovery || phase !== "dashboard") return;
    const timer = setTimeout(() => {
      try {
        if (dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify({ content, revision, uploads, savedAt: new Date().toISOString() }));
        else localStorage.removeItem(DRAFT_KEY);
        setStorageWarning(false);
      } catch { setStorageWarning(true); }
    }, 450);
    return () => clearTimeout(timer);
  }, [content, revision, uploads, dirty, recovery, phase]);

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  useEffect(() => {
    if (phase !== "dashboard") return;
    let active = true;
    let controller;
    const verify = () => {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
        .then((response) => { if (!response.ok) throw new Error("Session unavailable"); return response.json(); })
        .then((session) => {
          if (active && !session.authenticated) {
            setOperations(null); setSavedSettings(null); setContent(null); setPassword(""); setConfirm(null); setPhase("login");
            setNotice(""); setError("Your session expired. Sign in again to continue.");
          }
        })
        .catch((failure) => {
          if (active && failure.name !== "AbortError") {
            setOperations(null); setSavedSettings(null);
            setError("The private session could not be checked. Reconnect before managing messages or settings.");
          }
        });
    };
    const timer = setInterval(verify, 60_000);
    document.addEventListener("visibilitychange", verify);
    window.addEventListener("focus", verify);
    return () => { active = false; clearInterval(timer); controller?.abort(); document.removeEventListener("visibilitychange", verify); window.removeEventListener("focus", verify); };
  }, [phase]);

  async function login(event) {
    event.preventDefault(); setBusy("login"); setError("");
    try { await api("/api/admin/session", { method: "POST", body: JSON.stringify({ password }) }); setPassword(""); await loadContent(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  }

  async function logout() {
    setBusy("logout");
    try {
      await api("/api/admin/session", { method: "DELETE" });
      setPhase("login"); setContent(null); setOperations(null); setSavedSettings(null); setPassword(""); setConfirm(null); setNotice(""); setError("");
    } catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  }
  async function reloadLatest() {
    setBusy("reload"); setError("");
    try { await loadContent(); setRecovery(null); localStorage.removeItem(DRAFT_KEY); setNotice("Latest content loaded."); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  }

  async function loadOperations() {
    setBusy("operations"); setError("");
    try { const data = await api("/api/admin/operations"); setOperations(data); setSavedSettings(clone(data.settings)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  }

  function navigate(next, index = 0) {
    if (invalid) { setError("Fix the highlighted structured fields before switching sections."); return; }
    setScreen(next); setSelected(index); setRawValues({}); setRawErrors({}); setError(""); setNotice("");
    if (["assistant", "inbox"].includes(next) && !operations) void loadOperations();
  }

  function records() {
    if (screen === "projects") return content.projects;
    if (screen === "experience") return content.profile.experience;
    return content.upwork.completedWork;
  }
  function updateRecords(next) {
    setContent((previous) => screen === "projects" ? { ...previous, projects: next } : screen === "experience" ? { ...previous, profile: { ...previous.profile, experience: next } } : { ...previous, upwork: { ...previous.upwork, completedWork: next } });
  }
  function updateRecord(field, value) {
    updateRecords(records().map((item, index) => {
      if (index !== selected) return item;
      const next = { ...item, [field]: value };
      if ((["website", "github"].includes(field) && !value?.trim()) || (field === "caseStudy" && value === null)) delete next[field];
      return next;
    }));
    setPublished(null);
  }
  function updateProfile(field, value) {
    setContent((previous) => ({ ...previous, profile: { ...previous.profile, [field]: value } })); setPublished(null);
  }
  function rawField(field, value, update, label) {
    const key = screen + ":" + selected + ":" + field;
    return <div className="admin-json-field" key={key}><Field label={label || field} value={rawValues[key] ?? JSON.stringify(value ?? [], null, 2)} multiline rows={7} spellCheck={false} hint="Structured JSON. Existing fields are preserved; valid edits apply to this draft." onChange={(text) => {
      setRawValues((previous) => ({ ...previous, [key]: text }));
      try {
        const parsed = JSON.parse(text); update(parsed);
        setRawErrors((previous) => { const next = { ...previous }; delete next[key]; return next; });
      } catch { setRawErrors((previous) => ({ ...previous, [key]: "Enter valid JSON before publishing." })); }
    }} aria-invalid={Boolean(rawErrors[key])} />{rawErrors[key] && <p className="admin-field-error" role="alert">{rawErrors[key]}</p>}</div>;
  }
  function listField(field, value, update, label, delimiter = ", ") {
    const key = screen + ":" + selected + ":" + field;
    return <Field label={label} multiline={delimiter === "\n"} rows={3} value={rawValues[key] ?? list(value).join(delimiter)} hint={delimiter === "\n" ? "One local image path per line. The first image is the cover." : "Separate entries with commas."} onChange={(text) => {
      setRawValues((previous) => ({ ...previous, [key]: text }));
      update(text.split(delimiter === "\n" ? "\n" : ",").map((entry) => entry.trim()).filter(Boolean));
    }} />;
  }
  function addRecord() {
    if (invalid) { setError("Fix the structured fields before adding another item."); return; }
    const items = records(); updateRecords([...items, newItems[screen]()]); setSelected(items.length); setRawValues({});
  }
  function moveRecord(direction) {
    if (invalid) return;
    const next = [...records()]; const destination = selected + direction;
    if (destination < 0 || destination >= next.length) return;
    [next[selected], next[destination]] = [next[destination], next[selected]];
    updateRecords(next); setSelected(destination); setRawValues({});
  }
  function duplicateRecord() {
    if (invalid) return;
    const item = clone(records()[selected]);
    if (screen === "projects") { item.slug += "-copy-" + Date.now().toString(36); item.title += " (copy)"; }
    else { item.id += "-copy-" + Date.now().toString(36); }
    const next = [...records()]; next.splice(selected + 1, 0, item); updateRecords(next); setSelected(selected + 1); setRawValues({});
  }
  function removeRecord() {
    const next = records().filter((_, index) => index !== selected);
    if (screen === "projects") {
      const slug = records()[selected].slug;
      setContent((previous) => ({ ...previous, projects: next, profile: { ...previous.profile, automationFocus: { ...previous.profile.automationFocus, projectEvidence: previous.profile.automationFocus.projectEvidence.filter((project) => project.slug !== slug) } } }));
    } else updateRecords(next);
    setSelected(Math.max(0, selected - 1)); setRawValues({}); setRawErrors({}); setConfirm(null);
  }

  async function uploadImage(file) {
    if (!file) return;
    const total = uploads.reduce((sum, item) => sum + Math.floor(item.dataBase64.length * 3 / 4), 0);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size + total > 2 * 1024 * 1024 || uploads.length >= 3) {
      setError("Choose PNG, JPEG, or WebP images. A publish can include up to 3 new images, 2 MB total."); return;
    }
    setBusy("upload"); setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      const dataBase64 = btoa(binary);
      const path = "/projects/uploads/" + digest.slice(0, 24) + ".webp";
      setImagePreviews((previous) => ({ ...previous, [path]: "data:" + file.type + ";base64," + dataBase64 }));
      if (!uploads.some((item) => item.path === path)) setUploads((previous) => [...previous, { path, dataBase64, preview: "data:" + file.type + ";base64," + dataBase64 }]);
      updateRecord("images", [...new Set([...list(records()[selected].images), path])]);
      setNotice("Image added to this draft. It will be processed and published with the project.");
    } catch { setError("The image could not be read. Try another file."); }
    finally { setBusy(""); if (fileRef.current) fileRef.current.value = ""; }
  }
  function previewImage(path) { return imagePreviews[path] || uploads.find((item) => item.path === path)?.preview || imageSource(path); }
  function restoreDraft() {
    try {
      const restored = validateContentBundle(recovery.content);
      setContent(restored); setRevision(recovery.revision); setUploads(list(recovery.uploads)); setRecovery(null); setError("");
    } catch (failure) { setError("This saved draft needs correction: " + failure.message); }
  }
  function reviewPublish() {
    try { validateContentBundle(content); setError(""); setConfirm("publish"); }
    catch (failure) { setError(failure.message); }
  }

  function downloadDraft() {
    const blob = new Blob([JSON.stringify({ content, revision, uploads: uploads.map(({ dataBase64, path }) => ({ dataBase64, path })), savedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "portfolio-content-draft.json"; anchor.click(); URL.revokeObjectURL(url);
  }
  async function publish() {
    setBusy("publish"); setError("");
    try {
      const data = await api("/api/admin/content", { method: "PUT", body: JSON.stringify({ content, revision, uploads: uploads.map(({ dataBase64 }) => ({ dataBase64 })) }) });
      setRevision(data.revision); setOriginal(clone(content)); setUploads([]); setPublished(data); setNotice("Changes committed. Vercel is rebuilding the public site."); setConfirm(null);
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    } catch (failure) { setError(failure.message); setConfirm(null); }
    finally { setBusy(""); }
  }
  async function saveSettings() {
    setBusy("settings"); setError("");
    try {
      const data = await api("/api/admin/operations", { method: "PUT", body: JSON.stringify({ settings: operations.settings }) });
      setOperations((previous) => ({ ...previous, settings: data.settings })); setSavedSettings(clone(data.settings)); setNotice("Assistant settings saved.");
    } catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  }
  async function messageStatus(id, status) {
    setBusy("message"); setError("");
    try {
      await api("/api/admin/messages/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ status }) });
      setOperations((previous) => ({ ...previous, messages: previous.messages.map((item) => item.id === id ? { ...item, status } : item) }));
    } catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  }

  if (phase !== "dashboard" || !content) {
    return <div className="admin-login-shell"><Link className="admin-brand" href="/"><WorkflowMark /><span>lihon gebre<span className="admin-brand-period">.</span></span><span className="admin-private-label">ADMIN</span></Link><div className="admin-login-layout"><div className="admin-login-copy"><p className="admin-overline">YOUR PRIVATE WORKSPACE</p><h1>Behind<br />the work.</h1><p>A quiet place to update your portfolio, look after conversations, and keep everything current.</p><span className="admin-login-caption">PROFILE / PROJECTS / CONVERSATIONS</span></div><div className="admin-login-card"><span className="admin-lock" aria-hidden="true">↗</span><h2>{phase === "checking" ? "Opening your workspace" : configured ? "Welcome back." : "Set up your workspace."}</h2><p>{configured ? "Sign in to manage your portfolio." : "The admin stays locked until its server credentials and login protection are configured."}</p>{phase === "checking" ? <p className="admin-muted" role="status">Checking your session…</p> : configured ? <form onSubmit={login}><Field label="Admin password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={setPassword} /><button className="admin-button admin-primary" type="submit" disabled={Boolean(busy)}>{busy === "login" ? "Signing in…" : "Sign in"} <span aria-hidden="true">↗</span></button></form> : <div className="admin-setup-note"><p>Run <code>npm run admin:setup</code> to create your password hash and session secret. Add the settings to Vercel along with the shared Redis credentials.</p><button className="admin-button" type="button" onClick={checkSession}>Check configuration again</button></div>}{error && <p className="admin-error" role="alert">{error}</p>}<Link className="admin-back-link" href="/">Back to the portfolio <span aria-hidden="true">↗</span></Link></div></div></div>;
  }

  const counts = { projects: content.projects.length, experience: content.profile.experience.length, reviews: content.upwork.completedWork.length, inbox: operations ? list(operations.messages).filter((item) => item.status === "new").length : undefined };
  const item = ["projects", "experience", "reviews"].includes(screen) ? records()[selected] : null;
  const label = sections.find(([id]) => id === screen)?.[1] || "Overview";
  const messages = list(operations?.messages).filter((message) => messageFilter === "all" || (messageFilter === "active" ? message.status !== "archived" : message.status === messageFilter));
  const selectedMessage = list(operations?.messages).find((message) => message.id === messageId);
  const preview = item?.images?.[0] && previewImage(item.images[0]);

  return <div className="admin-workspace">
    <aside className="admin-sidebar"><Link className="admin-brand" href="/"><WorkflowMark /><span>lihon gebre<span>.</span></span></Link><p className="admin-sidebar-label">PORTFOLIO WORKSPACE</p><nav aria-label="Admin navigation">{sections.map(([id, title]) => <button key={id} type="button" aria-current={screen === id ? "page" : undefined} onClick={() => navigate(id)}><Icon name={id} /><span>{title}</span>{counts[id] !== undefined && <span className="admin-nav-count">{counts[id]}</span>}</button>)}</nav><div className="admin-sidebar-bottom"><span className="admin-avatar">LG</span><div><strong>Lihon Gebre</strong><span>Portfolio owner</span></div><button type="button" aria-label="Sign out" onClick={() => { if (hasUnsaved) setConfirm("logout"); else void logout(); }} disabled={Boolean(busy)}>↗</button></div></aside>
    <div className="admin-main"><header className="admin-topbar"><p>Workspace <span>/</span> {label}</p><div><span className="admin-draft-indicator">{!publishingConfigured ? "Build snapshot" : dirty ? "Unpublished changes" : "Content loaded"}</span><button className="admin-link-button" type="button" onClick={() => { if (hasUnsaved) setConfirm("reload"); else void reloadLatest(); }} disabled={Boolean(busy)}>Reload content</button><a href="/" target="_blank" rel="noreferrer">View website <span aria-hidden="true">↗</span></a></div></header>
      <div className="admin-content">
        <div className="admin-page-heading"><div><p className="admin-overline">PORTFOLIO / {label.toUpperCase()}</p><h1>{screen === "overview" ? "Make your next update." : label}</h1><p>{({ overview: "Your work, your words, and the conversations that follow.", profile: "Keep your introduction and professional details current.", projects: "Show the work you want to do more of.", experience: "The roles and experience behind your work.", reviews: "Client feedback, with clear sources and attribution.", assistant: "Choose how your portfolio assistant responds.", inbox: "Messages from people interested in your work." })[screen]}</p></div>{newItems[screen] && <button className="admin-button admin-primary" type="button" onClick={addRecord}>+ Add {screen === "experience" ? "role" : screen === "reviews" ? "review" : "project"}</button>}</div>
        {error && <div className="admin-error" role="alert">{error}</div>}
        {notice && <div className="admin-notice" role="status">{notice}{published?.commitUrl && <a href={published.commitUrl} target="_blank" rel="noreferrer">View commit ↗</a>}</div>}
        {storageWarning && <div className="admin-error" role="alert">This browser couldn’t save the draft. Download a backup before leaving.</div>}
        {recovery && <div className="admin-recovery"><div><strong>You have an unpublished browser draft.</strong><p>{recovery.revision !== revision ? "The repository has changed since this draft. Keep a backup; publishing will require resolving the newer revision." : "Restore it to pick up where you left off."}</p></div><button className="admin-button" type="button" onClick={restoreDraft}>Restore draft</button><button className="admin-link-button" type="button" onClick={() => { localStorage.removeItem(DRAFT_KEY); setRecovery(null); }}>Discard</button></div>}
        {screen === "overview" && <>
          <div className="admin-stat-grid">{[["projects", "Portfolio projects", "Selected work and case studies"], ["experience", "Employment entries", "Roles, focus areas, and history"], ["reviews", "Client reviews", "Public feedback and ratings"]].map(([id, title, sub]) => <button className="admin-stat-card" key={id} onClick={() => navigate(id)}><div><Icon name={id} /><span aria-hidden="true">↗</span></div><strong>{counts[id]}</strong><h2>{title}</h2><p>{sub}</p></button>)}</div>
          <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-overline">FIRST IMPRESSIONS</p><h2>Your featured work.</h2></div><button type="button" className="admin-link-button" onClick={() => navigate("projects")}>Manage projects ↗</button></div><div className="admin-featured-grid">{content.projects.slice(0, 3).map((project, index) => { const source = previewImage(project.images?.[0]); return <button className="admin-featured-project" key={project.slug} onClick={() => navigate("projects", index)}>{source ? <Image src={source} alt="" width={480} height={270} unoptimized /> : <div className="admin-image-placeholder">No cover image</div>}<span className="admin-overline">0{index + 1} / FEATURED</span><h3>{project.title}</h3><p>{project.role || project.category}</p></button>; })}</div></section>
          <div className="admin-overview-bottom"><section className="admin-panel"><div className="admin-panel-heading"><h2>A conversation starter.</h2><Icon name="assistant" /></div><p>Your public assistant uses the same profile, project descriptions, and reviews you manage here.</p><button className="admin-link-button" type="button" onClick={() => navigate("assistant")}>Manage AI assistant ↗</button></section><section className="admin-panel"><div className="admin-panel-heading"><h2>From draft to live.</h2><WorkflowMark /></div><ol className="admin-publish-steps"><li><span>01</span> Edit and review your content</li><li><span>02</span> Publish one versioned update</li><li><span>03</span> Vercel rebuilds your website and résumé</li></ol></section></div>
        </>}
        {screen === "profile" && <section className="admin-panel admin-editor"><h2>The essentials</h2><div className="admin-field-grid">{["name", "title", "location"].map((field) => <Field key={field} label={{ name: "Name", title: "Professional title", location: "Location" }[field]} value={content.profile[field]} onChange={(value) => updateProfile(field, value)} />)}</div><div className="admin-field-grid"><Field label="Headline, first line" value={content.profile.headline?.first} onChange={(first) => updateProfile("headline", { ...content.profile.headline, first })} /><Field label="Headline, second line" value={content.profile.headline?.second} onChange={(second) => updateProfile("headline", { ...content.profile.headline, second })} /></div><Field label="Homepage introduction" multiline rows={3} value={content.profile.introduction} onChange={(value) => updateProfile("introduction", value)} /><Field label="About paragraph" multiline rows={3} value={content.profile.about} onChange={(value) => updateProfile("about", value)} /><Field label="Professional summary" multiline rows={5} value={content.profile.summary} onChange={(value) => updateProfile("summary", value)} /><h2>Professional links</h2><div className="admin-field-grid">{Object.entries(content.profile.links).filter(([key]) => !["resume", "resumeText", "contact"].includes(key)).map(([key, value]) => <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={value} onChange={(next) => updateProfile("links", { ...content.profile.links, [key]: next })} />)}</div><details className="admin-advanced"><summary>Skills, education, and additional profile details</summary>{["skills", "education", "languages", "workPreferences", "expertise", "automationFocus", "professionalFocus", "certifications"].map((field) => rawField(field, content.profile[field], (value) => updateProfile(field, value), ({ professionalFocus: "Professional focus", automationFocus: "Automation focus", workPreferences: "Work preferences", certifications: "Training credentials" })[field] || field.charAt(0).toUpperCase() + field.slice(1)))}</details></section>}
        {["projects", "experience", "reviews"].includes(screen) && <div className="admin-edit-layout"><div className="admin-record-list" role="group" aria-label={label + " records"}>{records().map((record, index) => <button key={(record.slug || record.id) + index} className={selected === index ? "is-selected" : ""} onClick={() => { if (invalid) { setError("Fix the highlighted JSON before selecting another record."); return; } setSelected(index); setRawValues({}); }}><span className="admin-record-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{record.title || record.company || "Untitled"}</strong><small>{record.category || record.role || record.clientName || "Details"}</small></span><span aria-hidden="true">↗</span></button>)}</div>
          {item ? <section className="admin-panel admin-editor"><div className="admin-editor-heading"><p className="admin-overline">{screen === "projects" && selected < 3 ? "FEATURED PROJECT" : "EDIT " + (screen === "experience" ? "ROLE" : screen === "reviews" ? "REVIEW" : "PROJECT")}</p><div className="admin-order-actions"><button type="button" aria-label="Move item up" disabled={selected === 0 || invalid} onClick={() => moveRecord(-1)}>↑</button><button type="button" aria-label="Move item down" disabled={selected === records().length - 1 || invalid} onClick={() => moveRecord(1)}>↓</button></div></div>
            {screen === "projects" && <><div className="admin-project-cover">{preview ? <Image src={preview} alt={item.visualAlt || item.title} width={900} height={500} unoptimized /> : <div className="admin-image-placeholder">Add a project cover</div>}</div><div className="admin-upload-row"><label className="admin-button">Upload image<input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="admin-file-input" disabled={Boolean(busy)} onChange={(event) => void uploadImage(event.target.files?.[0])} /></label><span>PNG, JPG, WebP · 2 MB total per publish</span></div><div className="admin-field-grid"><Field label="Project name" value={item.title} onChange={(value) => updateRecord("title", value)} /><Field label="URL slug" value={item.slug} readOnly={original.projects.some((project) => project.slug === item.slug)} hint="Published slugs stay fixed to preserve existing case-study URLs." onChange={(value) => updateRecord("slug", value)} /><Field label="Category" value={item.category} onChange={(value) => updateRecord("category", value)} /><Field label="Your role" value={item.role} onChange={(value) => updateRecord("role", value)} /></div><Field label="Short description" multiline value={item.description} onChange={(value) => updateRecord("description", value)} /><Field label="Project overview" multiline rows={6} value={Array.isArray(item.detail) ? item.detail.join("\n\n") : item.detail} onChange={(value) => updateRecord("detail", value)} />{listField("tags", item.tags, (value) => updateRecord("tags", value), "Focus tags")}<div className="admin-field-grid"><Field label="Website" value={item.website} onChange={(value) => updateRecord("website", value)} /><Field label="GitHub repository" value={item.github} onChange={(value) => updateRecord("github", value)} /><Field label="Technology stack" value={Array.isArray(item.stack) ? item.stack.join(", ") : item.stack} onChange={(value) => updateRecord("stack", value)} /><Field label="Status" value={item.status} onChange={(value) => updateRecord("status", value)} /></div><details className="admin-advanced"><summary>Images, case-study details, and source references</summary>{listField("images", item.images, (value) => updateRecord("images", value), "Image paths", "\n")}<Field label="Image description" value={item.visualAlt} onChange={(value) => updateRecord("visualAlt", value)} /><div className="admin-field"><label htmlFor="admin-visual-type">Cover type</label><select id="admin-visual-type" value={item.visualType || "screenshot"} onChange={(event) => updateRecord("visualType", event.target.value)}><option value="screenshot">Application screenshot</option><option value="concept">Concept illustration</option></select></div>{["technicalSections", "sources"].map((field) => rawField(field, item[field], (value) => updateRecord(field, value), field === "sources" ? "References" : "Technical sections"))}{rawField("caseStudy", item.caseStudy || null, (value) => updateRecord("caseStudy", value), "Featured case-study context")}</details></>}
            {screen === "experience" && <><div className="admin-field-grid">{[["company", "Company"], ["role", "Role"], ["period", "Displayed period"], ["startYear", "Start year"], ["endYear", "End year"]].map(([field, title]) => <Field key={field} label={title} value={item[field]} onChange={(value) => updateRecord(field, value)} />)}</div><Field label="Role description" multiline value={item.description} onChange={(value) => updateRecord("description", value)} />{listField("focusAreas", item.focusAreas, (value) => updateRecord("focusAreas", value), "Focus areas")}<Field label="Tools" value={item.tools} onChange={(value) => updateRecord("tools", value)} /><Field label="Scope note" multiline rows={2} value={item.scopeNote} onChange={(value) => updateRecord("scopeNote", value)} /><details className="admin-advanced"><summary>Detailed role focus</summary>{rawField("responsibilities", item.responsibilities, (value) => updateRecord("responsibilities", value), "Responsibilities and focus descriptions")}</details></>}
            {screen === "reviews" && <><p className="admin-editor-note">Use the client’s actual words, rating, and attribution. Keep source dates accurate.</p><div className="admin-field-grid">{[["title", "Project / contract title"], ["clientName", "Client name"], ["period", "Displayed period"], ["sourceUrl", "Source URL"], ["startDate", "Start date"], ["endDate", "End date"]].map(([field, title]) => <Field key={field} label={title} type={field.endsWith("Date") ? "date" : "text"} value={item[field]} onChange={(value) => updateRecord(field, value)} />)}<Field label="Rating" type="number" min="0" max={item.ratingScale} step=".1" value={item.rating} onChange={(value) => updateRecord("rating", Number(value))} /></div><Field label="Full client feedback" multiline rows={7} value={item.feedback} onChange={(value) => updateRecord("feedback", value || null)} /><Field label="Short excerpt" multiline rows={3} hint="Optional exact excerpt from the full review." value={item.feedbackExcerpt} onChange={(value) => updateRecord("feedbackExcerpt", value)} /><details className="admin-advanced"><summary>Source snapshot</summary>{rawField("source", content.upwork.source, (value) => setContent((previous) => ({ ...previous, upwork: { ...previous.upwork, source: value } })), "Work source and checked date")}{rawField("profile", content.upwork.profile, (value) => setContent((previous) => ({ ...previous, upwork: { ...previous.upwork, profile: value } })), "Dated Upwork profile indicators")}</details></>}
            <div className="admin-record-footer"><button type="button" className="admin-link-button" onClick={duplicateRecord} disabled={invalid}>Duplicate item</button><button type="button" className="admin-link-button" onClick={() => setConfirm("remove")} disabled={screen === "projects" && records().length <= 1}>Remove item</button></div>
          </section> : <section className="admin-panel admin-empty"><h2>No records yet.</h2><p>Add your first {screen === "experience" ? "role" : "review"} to get started.</p></section>}
        </div>}
        {screen === "assistant" && (operations ? <section className="admin-panel admin-editor"><div className="admin-panel-heading"><div><h2>Assistant controls</h2><p>These settings are private and don’t create a public content commit.</p></div><span className="admin-status-pill">{operations.storage === "shared" ? "Shared storage" : "Local memory"}</span></div><label className="admin-switch"><input type="checkbox" checked={operations.settings.enabled} onChange={(event) => setOperations({ ...operations, settings: { ...operations.settings, enabled: event.target.checked } })} /><span><strong>Enable the portfolio assistant</strong><small>Turn off paid generation while keeping the public website available.</small></span></label><Field label="OpenAI model" value={operations.settings.model} hint="Use a Responses-compatible model available to your OpenAI project." onChange={(model) => setOperations({ ...operations, settings: { ...operations.settings, model } })} /><Field label="Additional response guidance" multiline rows={7} maxLength={2000} value={operations.settings.instructions} hint="Tone and emphasis. The assistant’s factual grounding and privacy rules remain in effect." onChange={(instructions) => setOperations({ ...operations, settings: { ...operations.settings, instructions } })} /><div className="admin-service-status"><span>OpenAI key <strong>{operations.configuration?.openAI ? "Configured" : "Missing"}</strong></span><span>Email service <strong>{operations.configuration?.emailJS ? "Configured" : "Missing"}</strong></span><span>Private storage <strong>{operations.storage === "shared" ? "Connected" : "Development only"}</strong></span></div><p className="admin-editor-note">API keys stay in Vercel’s server environment. This page never displays or stores them. {operations.storage === "memory" && "Local memory resets when the server restarts."}</p><button className="admin-button admin-primary" type="button" disabled={!settingsDirty || Boolean(busy)} onClick={saveSettings}>{busy === "settings" ? "Saving…" : "Save assistant settings"}</button></section> : <section className="admin-panel admin-empty"><p>{busy === "operations" ? "Loading assistant settings…" : "Private storage is not available."}</p><button type="button" className="admin-button" onClick={loadOperations}>Try again</button></section>)}
        {screen === "inbox" && (operations ? <><div className="admin-inbox-toolbar"><div className="admin-field"><label htmlFor="admin-message-filter">Show messages</label><select id="admin-message-filter" value={messageFilter} onChange={(event) => setMessageFilter(event.target.value)}><option value="active">Inbox</option><option value="new">Unread</option><option value="archived">Archived</option><option value="all">All messages</option></select></div><button className="admin-button" type="button" onClick={loadOperations} disabled={Boolean(busy)}>Refresh inbox</button></div><div className="admin-edit-layout"><div className="admin-record-list admin-message-list" role="group" aria-label="Contact messages">{messages.map((message) => <button key={message.id} className={messageId === message.id ? "is-selected" : ""} onClick={() => { setMessageId(message.id); if (message.status === "new") void messageStatus(message.id, "read"); }}><span className={"admin-message-dot" + (message.status === "new" ? " is-new" : "")} /><span><strong>{message.name}</strong><small>{new Date(message.createdAt).toLocaleDateString()}</small><span>{message.message.slice(0, 80)}</span></span></button>)}{!messages.length && <p className="admin-muted">No messages in this view.</p>}</div><section className="admin-panel admin-message-detail">{selectedMessage ? <><p className="admin-overline">{selectedMessage.status.toUpperCase()} / {new Date(selectedMessage.createdAt).toLocaleString()}</p><h2>{selectedMessage.name}</h2><a className="admin-message-email" href={"mailto:" + encodeURIComponent(selectedMessage.email)}>{selectedMessage.email}</a><p className="admin-message-body">{selectedMessage.message}</p><div className="admin-message-actions"><a className="admin-button admin-primary" href={"mailto:" + encodeURIComponent(selectedMessage.email) + "?subject=" + encodeURIComponent("Re: Your portfolio enquiry")}>Reply in email ↗</a><button className="admin-button" type="button" onClick={() => void messageStatus(selectedMessage.id, selectedMessage.status === "archived" ? "read" : "archived")} disabled={Boolean(busy)}>{selectedMessage.status === "archived" ? "Restore to inbox" : "Archive"}</button></div></> : <div className="admin-empty"><Icon name="inbox" /><h2>A place for the next conversation.</h2><p>Select a message to read it here.</p></div>}</section></div><p className="admin-private-note">Contact messages stay in private storage and are retained for 30 days. Archiving keeps a message out of your inbox until retention expires. {operations.storage === "memory" && "This development inbox resets with the server."}</p></> : <section className="admin-panel admin-empty"><p>{busy === "operations" ? "Loading your inbox…" : "Connect private storage to manage messages."}</p><button className="admin-button" type="button" onClick={loadOperations}>Try again</button></section>)}
      </div>
      <footer className="admin-publish-bar"><div><strong>{dirty ? "Content draft — saved in this browser." : publishingConfigured ? "Your draft matches the loaded revision." : "Editing this build’s content snapshot."}</strong><p>{publishingConfigured ? "Publishing updates " + repository + " and starts a Vercel build." : "Add a repository-scoped GitHub token on the server to enable publishing."}</p></div><div><button type="button" className="admin-link-button" onClick={downloadDraft}>Download content draft</button><button className="admin-button admin-primary" type="button" onClick={reviewPublish} disabled={!dirty || invalid || !publishingConfigured || Boolean(busy)}>Publish changes <span aria-hidden="true">↗</span></button></div></footer>
    </div>
    {confirm === "publish" && <ConfirmDialog title="Publish this content?" confirmLabel="Publish portfolio" onClose={() => setConfirm(null)} onConfirm={publish} busy={busy === "publish"}><p>Your profile, projects, employment, and public reviews will be committed together. Vercel will rebuild the website, assistant knowledge, and résumé downloads.</p><p>Inbox messages, AI settings, and server credentials are separate.</p></ConfirmDialog>}
    {confirm === "logout" && <ConfirmDialog title="Sign out of your workspace?" confirmLabel="Sign out" onClose={() => setConfirm(null)} onConfirm={() => { setConfirm(null); void logout(); }}><p>Your valid content draft stays in this browser. Unsaved AI settings will be discarded.</p></ConfirmDialog>}
    {confirm === "reload" && <ConfirmDialog title="Load the latest content?" confirmLabel="Replace content draft" onClose={() => setConfirm(null)} onConfirm={() => { setConfirm(null); void reloadLatest(); }}><p>This replaces the current content draft with the latest repository version. Download a content draft first if you need a backup. Unsaved AI settings stay open.</p></ConfirmDialog>}
    {confirm === "remove" && <ConfirmDialog title="Remove this item from the draft?" confirmLabel="Remove item" onClose={() => setConfirm(null)} onConfirm={removeRecord}><p>This changes your draft. The public website changes after you publish.</p></ConfirmDialog>}
  </div>;
}
