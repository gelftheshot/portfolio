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

export default function ContactForm() {
  const fieldId = useId();
  const submitting = useRef(false);
  const timeout = useRef(null);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [deliveryUnconfirmed, setDeliveryUnconfirmed] = useState(false);
  const [status, setStatus] = useState("");
  const [fields, setFields] = useState({ name: "", email: "", message: "" });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timeout.current);
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

    if (!serviceId || !templateId || !publicKey) {
      reportFailure({ code: "CONTACT_CONFIGURATION" });
      return;
    }

    submitting.current = true;
    setPending(true);
    setDeliveryUnconfirmed(false);
    setStatus("Sending your message…");

    // EmailJS does not expose cancellation. Keep the submission locked after a
    // confirmation timeout so a slow, accepted request cannot be sent twice.
    timeout.current = setTimeout(() => {
      if (!mounted.current) return;
      setDeliveryUnconfirmed(true);
      reportFailure({ code: "CONTACT_TIMEOUT" });
    }, DELIVERY_TIMEOUT_MS);

    try {
      await emailjs.send(
        serviceId,
        templateId,
        buildContactTemplateParams(validation.fields),
        { publicKey }
      );
      if (mounted.current) {
        form.reset();
        setFields({ name: "", email: "", message: "" });
        setStatus("Thank you. Your message has been sent.");
      }
    } catch (error) {
      reportFailure(error);
    } finally {
      clearTimeout(timeout.current);
      timeout.current = null;
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
          {deliveryUnconfirmed ? "Delivery unconfirmed" : pending ? "Sending…" : "Send message"}
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
      </div>
    </form>
  );
}
