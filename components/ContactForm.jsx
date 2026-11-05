"use client";

import { useEffect, useId, useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import {
  CONTACT_EMAIL,
  CONTACT_LIMITS,
  buildContactMailto,
  buildContactTemplateParams,
  classifyContactFailure,
  validateContactFields,
} from "@/lib/contact";

const DELIVERY_TIMEOUT_MS = 20_000;
const ARCHIVE_TIMEOUT_MS = 12_000;

export default function ContactForm() {
  const fieldId = useId();
  const submitting = useRef(false);
  const timeout = useRef(null);
  const archiveRequest = useRef(null);
  const submission = useRef(null);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [deliveryUnconfirmed, setDeliveryUnconfirmed] = useState(false);
  const [deliveryReceived, setDeliveryReceived] = useState(false);
  const [status, setStatus] = useState("");
  const [fields, setFields] = useState({ name: "", email: "", message: "" });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timeout.current);
      archiveRequest.current?.abort();
    };
  }, []);

  function reportFailure(error) {
    const failure = classifyContactFailure(error);
    console.warn(`Contact delivery failed (${failure.category}; status ${failure.status ?? "none"})`);
    if (mounted.current) setStatus(failure.message);
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (submitting.current) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const validation = validateContactFields({
      name: data.get("user_name"),
      email: data.get("user_email"),
      message: data.get("message"),
    });
    if (!validation.valid) {
      setStatus(validation.message);
      return;
    }

    const serviceId = process.env.NEXT_PUBLIC_SERVICE_ID;
    const templateId = process.env.NEXT_PUBLIC_TEMPLATE_ID;
    const publicKey = process.env.NEXT_PUBLIC_PUBLIC_KEY;

    submitting.current = true;
    setPending(true);
    setDeliveryUnconfirmed(false);
    setDeliveryReceived(false);
    setStatus("Sending your message…");

    const fingerprint = JSON.stringify(validation.fields);
    if (submission.current?.fingerprint !== fingerprint) {
      submission.current = { fingerprint, id: globalThis.crypto?.randomUUID?.() };
    }
    const id = submission.current.id;
    const archiveAbort = new AbortController();
    archiveRequest.current = archiveAbort;
    let emailAccepted = false;
    let archiveAccepted = false;
    let emailFailure;
    let archiveFailure;
    const reportAccepted = () => {
      if (!mounted.current) return;
      form.reset();
      setFields({ name: "", email: "", message: "" });
      setDeliveryUnconfirmed(false);
      setDeliveryReceived(true);
      setStatus(emailAccepted ? "Thank you. Your message has been sent." : "Thank you. Your message has been received.");
    };

    // EmailJS does not expose cancellation. Keep the submission locked after a
    // confirmation timeout so a slow, accepted request cannot be sent twice.
    timeout.current = setTimeout(() => {
      if (!mounted.current) return;
      if (emailAccepted || archiveAccepted) {
        reportAccepted();
        return;
      }
      setDeliveryUnconfirmed(true);
      reportFailure({ code: "CONTACT_TIMEOUT" });
    }, DELIVERY_TIMEOUT_MS);

    const archiveTimer = setTimeout(() => archiveAbort.abort(), ARCHIVE_TIMEOUT_MS);
    const archive = (async () => {
      try {
        if (!id) return;
        const result = await fetch("/api/contact", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...validation.fields }), signal: archiveAbort.signal,
          credentials: "same-origin", cache: "no-store", redirect: "error",
        });
        if (!result.ok) {
          archiveFailure = { status: result.status };
          return;
        }
        const confirmation = await result.json();
        if (confirmation?.received === true && confirmation.id === id) {
          archiveAccepted = true;
          reportAccepted();
        }
      } catch {
        // Archiving is best effort alongside EmailJS. Its failure cannot prove
        // delivery; keep the same submission ID if the visitor retries.
        archiveFailure = { code: archiveAbort.signal.aborted ? "CONTACT_TIMEOUT" : "CONTACT_NETWORK" };
      } finally { clearTimeout(archiveTimer); }
    })();
    const email = (async () => {
      try {
        if (!serviceId || !templateId || !publicKey) throw new Error("CONTACT_CONFIGURATION");
        await emailjs.send(serviceId, templateId, buildContactTemplateParams(validation.fields), { publicKey });
        emailAccepted = true;
        reportAccepted();
      } catch (error) { emailFailure = error; }
    })();

    try {
      await Promise.all([email, archive]);
      if (emailAccepted || archiveAccepted) {
        reportAccepted();
        submission.current = null;
      } else {
        // A timed-out archive may have been accepted. Retain the UUID and show
        // the same cautious delivery guidance used for uncertain email sends.
        const uncertainArchive = ["CONTACT_TIMEOUT", "CONTACT_NETWORK"].includes(archiveFailure?.code);
        reportFailure(uncertainArchive || !serviceId || !templateId || !publicKey
          ? archiveFailure || emailFailure : emailFailure);
      }
    } finally {
      clearTimeout(timeout.current);
      timeout.current = null;
      archiveRequest.current = null;
      submitting.current = false;
      if (mounted.current) {
        setPending(false);
        setDeliveryUnconfirmed(false);
      }
    }
  }

  return (
    <form className="contact-form" onSubmit={sendMessage}>
      <div className="form-field">
        <label htmlFor={`${fieldId}-name`}>Name</label>
        <input
          className="form-input"
          id={`${fieldId}-name`}
          name="user_name"
          value={fields.name}
          onChange={(event) => setFields({ ...fields, name: event.target.value })}
          type="text"
          autoComplete="name"
          maxLength={CONTACT_LIMITS.name}
          placeholder="Your name"
          readOnly={pending}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-email`}>Email</label>
        <input
          className="form-input"
          id={`${fieldId}-email`}
          name="user_email"
          value={fields.email}
          onChange={(event) => setFields({ ...fields, email: event.target.value })}
          type="email"
          autoComplete="email"
          maxLength={CONTACT_LIMITS.email}
          placeholder="you@example.com"
          readOnly={pending}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-message`}>Message</label>
        <textarea
          className="form-input"
          id={`${fieldId}-message`}
          name="message"
          value={fields.message}
          onChange={(event) => setFields({ ...fields, message: event.target.value })}
          placeholder="Tell me a little about your project or opportunity."
          rows={5}
          maxLength={CONTACT_LIMITS.message}
          readOnly={pending}
          required
        />
      </div>

      <div className="form-footer">
        <button
          className="form-submit button button-dark"
          type="submit"
          disabled={pending}
          aria-busy={pending}
        >
          {deliveryReceived && pending ? "Received" : deliveryUnconfirmed ? "Delivery unconfirmed" : pending ? "Sending…" : "Send message"}
          <span aria-hidden="true">↗</span>
        </button>
        <p className="form-status" role="status" aria-live="polite" aria-atomic="true">
          {status}
        </p>
      </div>
      <div className="contact-email-fallback">
        <a className="contact-email-link" href={buildContactMailto(fields)}>
          Use your email app <span aria-hidden="true">↗</span>
        </a>
        <p className="contact-email-note">
          Opens a draft to {CONTACT_EMAIL} with your details. Review and send it from your email app.
        </p>
        <p className="contact-email-note">
          Messages in the website inbox are kept for up to 30 days. Email copies follow the mailbox’s retention settings.
        </p>
      </div>
    </form>
  );
}
