export const CONTACT_LIMITS = Object.freeze({
  name: 100,
  email: 254,
  message: 5000,
});

export const CONTACT_EMAIL = "lihongebre@gmail.com";

export function normalizeContactFields(fields = {}) {
  return {
    name: typeof fields.name === "string" ? fields.name.trim() : "",
    email: typeof fields.email === "string" ? fields.email.trim() : "",
    message: typeof fields.message === "string" ? fields.message.trim() : "",
  };
}

export function validateContactFields(input = {}) {
  const fields = normalizeContactFields(input);
  let message = "";

  if (!fields.name) message = "Please enter your name.";
  else if (fields.name.length > CONTACT_LIMITS.name) {
    message = "Please keep your name to 100 characters or fewer.";
  } else if (
    typeof input.email !== "string" ||
    /[\r\n]/.test(input.email) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)
  ) {
    message = "Please enter a valid email address.";
  } else if (fields.email.length > CONTACT_LIMITS.email) {
    message = "Please keep your email address to 254 characters or fewer.";
  } else if (!fields.message) message = "Please enter a message.";
  else if (fields.message.length > CONTACT_LIMITS.message) {
    message = "Please keep your message to 5,000 characters or fewer.";
  }

  return { valid: !message, fields, message };
}

export function buildContactTemplateParams(fields, now = new Date()) {
  const { name, email, message } = normalizeContactFields(fields);

  return {
    user_name: name,
    user_email: email,
    message,
    name,
    from_name: name,
    email,
    from_email: email,
    reply_to: email,
    to_name: "Lihon Gebre",
    subject: `Portfolio enquiry from ${name.replace(/[\r\n]+/g, " ")}`,
    time: now.toISOString(),
  };
}

function boundedMailtoField(value, limit) {
  let result = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    const safeCharacter = codePoint >= 0xd800 && codePoint <= 0xdfff ? "\ufffd" : character;
    if (result.length + safeCharacter.length > limit) break;
    result += safeCharacter;
  }
  return result;
}

export function buildContactMailto(fields = {}) {
  const normalized = normalizeContactFields(fields);
  const name = boundedMailtoField(normalized.name, CONTACT_LIMITS.name);
  const email = boundedMailtoField(normalized.email, CONTACT_LIMITS.email);
  const message = boundedMailtoField(normalized.message, CONTACT_LIMITS.message);
  const subjectName = name.replace(/[\r\n]+/g, " ");
  const subject = subjectName ? `Portfolio enquiry from ${subjectName}` : "Portfolio enquiry";
  const body = [`Name: ${name}`, `Email: ${email}`, "", message].join("\n");

  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const failureMessages = {
  configuration: "This contact form is not configured yet. Please use the email option below to get in touch.",
  public_key: "The contact form needs an authentication update. Please use the email option below to get in touch.",
  service: "The contact form's email service is unavailable. Please use the email option below to get in touch.",
  template: "The contact form's email template needs an update. Please use the email option below to get in touch.",
  origin: "The email service does not allow messages from this website address yet. Please use the email option below to get in touch.",
  provider_auth: "The email service needs to be reconnected. Please use the email option below to get in touch.",
  rate_limit: "The contact form has reached its sending limit. Please try again later or use the email option below.",
  network: "Delivery could not be confirmed because the connection failed. Your message may still arrive. Please check before sending it again; the email option below is also available.",
  timeout: "Delivery could not be confirmed within 20 seconds. Your message may still arrive. Please do not send it again yet; the email option below is available when you are ready.",
  unknown: "Your message could not be sent. Please try again later or use the email option below to get in touch.",
};

export function classifyContactFailure(error) {
  const rawStatus = Number(error?.status);
  const status = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599
    ? rawStatus
    : null;
  // Provider text is used only for classification. Never return it or log it.
  const text = [
    typeof error === "string" ? error : "",
    error?.text,
    error?.message,
    error?.code,
    error?.name,
  ].filter((value) => typeof value === "string").join(" ").toLowerCase();

  let category = "unknown";

  if (/contact_configuration/.test(text)) category = "configuration";
  else if (/contact_timeout|timeout|timed out/.test(text)) category = "timeout";
  else if (
    status === 429 ||
    /quota|rate.?limit|too many requests|limit.{0,30}exceed|exceed.{0,30}limit/.test(text)
  ) category = "rate_limit";
  else if (
    /(?:origin|domain|referer|referrer).{0,80}(?:not allowed|block|denied|forbidden|allow.?list|whitelist)/.test(text) ||
    /allow.?list|whitelist/.test(text)
  ) category = "origin";
  else if (
    /oauth|invalid[_ -]?grant|authentication scopes?|insufficient auth|refresh.?token|token.{0,20}(?:expired|revoked)|gmail.{0,80}(?:auth|credential|token|access denied)/.test(text)
  ) category = "provider_auth";
  else if (/service.{0,50}(?:not found|invalid|missing|required|does not exist)/.test(text)) {
    category = "service";
  } else if (/template.{0,50}(?:not found|invalid|missing|required|does not exist)/.test(text)) {
    category = "template";
  } else if (/public.?key|user.?id|api.?key/.test(text) || status === 401 || status === 403) {
    category = "public_key";
  } else if (
    error instanceof TypeError ||
    /network|failed to fetch|fetch failed|load failed/.test(text)
  ) category = "network";

  return { status, category, message: failureMessages[category] };
}
