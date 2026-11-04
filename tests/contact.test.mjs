import test from "node:test";
import assert from "node:assert/strict";
import { EmailJSResponseStatus } from "@emailjs/browser";
import {
  CONTACT_EMAIL,
  CONTACT_LIMITS,
  normalizeContactFields,
  validateContactFields,
  buildContactTemplateParams,
  buildContactMailto,
  classifyContactFailure,
} from "../lib/contact.js";

const validFields = {
  name: "Alex Example",
  email: "alex+portfolio@example.com",
  message: "I would like to discuss an AI engineering opportunity.",
};

test("normalization trims field boundaries and preserves useful message formatting", () => {
  const input = Object.freeze({
    name: "  Alex  Example  ",
    email: "  Alex+Portfolio@Example.com  ",
    message: " \nHello Lihon,\n\nLet's discuss this project.\n ",
    to_email: "unexpected@example.net",
  });
  assert.deepEqual(normalizeContactFields(input), {
    name: "Alex  Example",
    email: "Alex+Portfolio@Example.com",
    message: "Hello Lihon,\n\nLet's discuss this project.",
  });
  assert.equal(input.name, "  Alex  Example  ", "normalization must not alter form input values");
});

test("a valid submission returns the normalized fields", () => {
  const result = validateContactFields({
    name: ` ${validFields.name} `,
    email: ` ${validFields.email} `,
    message: `\n${validFields.message}\n`,
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.fields, validFields);
});

test("missing or non-text form values cannot bypass required field validation", () => {
  assert.deepEqual(normalizeContactFields(), { name: "", email: "", message: "" });
  for (const field of ["name", "email", "message"]) {
    for (const value of [undefined, null, 123, { toString: () => "unexpected" }]) {
      assert.equal(validateContactFields({ ...validFields, [field]: value }).valid, false);
    }
  }
});

test("whitespace-only required fields are rejected even when the browser considers them filled", async (t) => {
  for (const field of ["name", "email", "message"]) {
    await t.test(field, () => {
      const result = validateContactFields({ ...validFields, [field]: " \n\t " });
      assert.equal(result.valid, false);
      assert.equal(typeof result.message, "string");
      assert.ok(result.message.trim());
    });
  }
});

test("name and message length limits accept their boundary and reject excess text", () => {
  assert.equal(validateContactFields({ ...validFields, name: "n".repeat(100) }).valid, true);
  assert.equal(validateContactFields({ ...validFields, name: "n".repeat(101) }).valid, false);
  assert.equal(validateContactFields({ ...validFields, message: "m".repeat(5000) }).valid, true);
  assert.equal(validateContactFields({ ...validFields, message: "m".repeat(5001) }).valid, false);
  assert.equal(validateContactFields({ ...validFields, name: ` ${"n".repeat(100)} ` }).valid, true);
  assert.equal(validateContactFields({ ...validFields, message: `\n${"m".repeat(5000)}\n` }).valid, true);
});

test("email length is bounded independently of valid address syntax", () => {
  const address = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(address.length, 254);
  assert.equal(validateContactFields({ ...validFields, email: address }).valid, true);
  assert.equal(validateContactFields({ ...validFields, email: `${address}d` }).valid, false);
});

test("email addresses reject malformed values and embedded header or whitespace injection", async (t) => {
  const invalid = [
    "alex",
    "alex@",
    "@example.com",
    "alex@@example.com",
    "Alex Example <alex@example.com>",
    "alex @example.com",
    "alex@exa mple.com",
    "alex\t@example.com",
    "alex\n@example.com",
    "alex@example.com\r\nBcc: another@example.net",
  ];
  for (const email of invalid) {
    await t.test(JSON.stringify(email), () => {
      const result = validateContactFields({ ...validFields, email });
      assert.equal(result.valid, false);
      assert.ok(result.message.trim());
    });
  }
});

test("template parameters support existing field names and common EmailJS aliases", () => {
  const params = buildContactTemplateParams(validFields, new Date("2026-10-29T12:00:00Z"));
  for (const key of ["user_name", "name", "from_name"]) assert.equal(params[key], validFields.name);
  for (const key of ["user_email", "email", "from_email", "reply_to"]) assert.equal(params[key], validFields.email);
  assert.equal(params.message, validFields.message);
  assert.equal(params.to_name, "Lihon Gebre");
  assert.equal(typeof params.subject, "string");
  assert.ok(params.subject.trim());
  assert.equal(typeof params.time, "string");
  assert.ok(params.time.trim());
  assert.equal(params.time, buildContactTemplateParams(validFields, new Date("2026-10-29T12:00:00Z")).time);
});

test("visitor fields cannot add or override recipient or provider settings", () => {
  const params = buildContactTemplateParams({
    ...validFields,
    to_email: "unexpected@example.net",
    recipient: "unexpected@example.net",
    to: "unexpected@example.net",
    cc: "unexpected@example.net",
    bcc: "unexpected@example.net",
    to_name: "Unexpected recipient",
    service_id: "unexpected-service",
    template_id: "unexpected-template",
    reply_to: "unexpected@example.net",
    user_email: "unexpected@example.net",
  });
  for (const key of ["to_email", "recipient", "to", "cc", "bcc", "service_id", "template_id"]) {
    assert.equal(Object.hasOwn(params, key), false, `${key} must not be copied from visitor data`);
  }
  assert.equal(params.to_name, "Lihon Gebre");
  assert.equal(params.reply_to, validFields.email);
  assert.equal(params.user_email, validFields.email);
  assert.doesNotMatch(JSON.stringify(params), /unexpected@example\.net|unexpected-service|unexpected-template/);
});

test("the derived email subject cannot contain visitor-supplied header line breaks", () => {
  const params = buildContactTemplateParams({ ...validFields, name: "Alex\r\nAnother line" });
  assert.doesNotMatch(params.subject, /[\r\n]/);
});

test("the email-app fallback always addresses Lihon and cannot accept injected recipients", () => {
  const link = new URL(buildContactMailto({
    ...validFields,
    to: "unexpected@example.net",
    to_email: "unexpected@example.net",
    recipient: "unexpected@example.net",
    cc: "unexpected@example.net",
    bcc: "unexpected@example.net",
  }));
  assert.equal(CONTACT_EMAIL, "lihongebre@gmail.com");
  assert.equal(link.protocol, "mailto:");
  assert.equal(decodeURIComponent(link.pathname), CONTACT_EMAIL);
  assert.deepEqual([...link.searchParams.keys()].sort(), ["body", "subject"]);
  assert.equal(link.href.includes("unexpected@example.net"), false);
});

test("the fallback subject stays on one line even when a visitor inserts email headers", () => {
  const link = new URL(buildContactMailto({
    ...validFields,
    name: "Alex\r\nBcc: unexpected@example.net\nSubject: Another subject",
  }));
  assert.doesNotMatch(link.searchParams.get("subject"), /[\r\n]/);
  assert.ok(link.searchParams.get("subject").includes("Alex"));
  assert.equal(link.searchParams.has("bcc"), false);
  assert.equal(link.searchParams.getAll("subject").length, 1);
  assert.equal(decodeURIComponent(link.pathname), CONTACT_EMAIL);
});

test("the fallback retains unsent fields and safely encodes reserved query characters and Unicode", () => {
  const fields = Object.freeze({
    name: "Alex & Sam = AI? #team",
    email: "alex+portfolio@example.com",
    message: "Let's discuss RAG & graphs? #scope = x+y 100%\nSecond line: ሰላም 🧠",
  });
  const link = new URL(buildContactMailto(fields));
  const body = link.searchParams.get("body");
  assert.ok(body.includes(fields.name));
  assert.ok(body.includes(fields.email));
  assert.ok(body.includes(fields.message));
  assert.ok(link.searchParams.get("subject").includes(fields.name));
  assert.deepEqual([...link.searchParams.keys()].sort(), ["body", "subject"]);
  assert.equal(link.hash, "");
  assert.equal(fields.message.endsWith("ሰላም 🧠"), true, "building a fallback must leave the form data intact");
});

test("fallback payloads stay bounded and encoding tolerates emoji boundaries and lone surrogates", () => {
  const fields = Object.freeze({
    name: `${"n".repeat(CONTACT_LIMITS.name - 1)}${"🧠".repeat(10000)}`,
    email: `${"e".repeat(CONTACT_LIMITS.email)}EMAIL_OVERFLOW`,
    message: `${"m".repeat(CONTACT_LIMITS.message - 1)}${"🧠".repeat(10000)}MESSAGE_OVERFLOW`,
  });
  let href;
  assert.doesNotThrow(() => { href = buildContactMailto(fields); });
  const link = new URL(href);
  const body = link.searchParams.get("body");
  const subject = link.searchParams.get("subject");
  assert.equal(body.isWellFormed(), true);
  assert.equal(subject.isWellFormed(), true);
  assert.ok(body.includes("m".repeat(100)), "retain the beginning of a long unsent message");
  assert.doesNotMatch(body, /EMAIL_OVERFLOW|MESSAGE_OVERFLOW/);
  assert.ok(body.length <= CONTACT_LIMITS.name + CONTACT_LIMITS.email + CONTACT_LIMITS.message + 256);
  assert.ok(subject.length <= CONTACT_LIMITS.name + 100);
  assert.ok(href.length <= 9 * (CONTACT_LIMITS.name + CONTACT_LIMITS.email + CONTACT_LIMITS.message) + 1024);
  assert.ok(fields.message.endsWith("MESSAGE_OVERFLOW"), "clipping the draft must not mutate form data");

  let malformedHref;
  assert.doesNotThrow(() => {
    malformedHref = buildContactMailto({ ...validFields, name: "Alex\ud800", message: "Unsent\udfff message" });
  });
  const malformed = new URL(malformedHref);
  assert.equal(malformed.searchParams.get("subject").isWellFormed(), true);
  assert.equal(malformed.searchParams.get("body").isWellFormed(), true);
});

test("provider failures are categorized using real EmailJS error objects", async (t) => {
  const cases = [
    ["invalid public key", 400, "The Public Key is invalid", "public_key"],
    ["unknown service", 400, "The service ID not found", "service"],
    ["unknown template", 400, "The template ID not found", "template"],
    ["blocked origin", 403, "The origin is not allowed", "origin"],
    ["mailbox authorization", 412, "Gmail_API: Invalid grant. Please reconnect your Gmail account", "provider_auth"],
    ["rate limit", 429, "Too Many Requests", "rate_limit"],
    ["quota exhausted", 402, "Monthly quota exceeded", "rate_limit"],
    ["network failure", 0, "Network Error", "network"],
  ];
  for (const [label, status, text, category] of cases) {
    await t.test(label, () => {
      const result = classifyContactFailure(new EmailJSResponseStatus(status, text));
      assert.equal(result.category, category);
      assert.ok(result.status === null || Number.isInteger(result.status));
      assert.equal(typeof result.message, "string");
      assert.ok(result.message.trim());
    });
  }
});

test("transport exceptions distinguish network failures and uncertain timeout outcomes", () => {
  const network = classifyContactFailure(new TypeError("Failed to fetch"));
  assert.equal(network.category, "network");
  const timeout = classifyContactFailure(Object.assign(new Error("Contact request timed out"), { name: "TimeoutError" }));
  assert.equal(timeout.category, "timeout");
  assert.equal(timeout.status, null);
  assert.ok(timeout.message.trim());
  assert.match(timeout.message, /may still arrive/);
  assert.match(timeout.message, /do not send it again/);
});

test("local configuration failures and unknown errors have safe fallback guidance", () => {
  const configuration = classifyContactFailure({ code: "CONTACT_CONFIGURATION" });
  assert.equal(configuration.category, "configuration");
  assert.equal(configuration.status, null);
  assert.match(configuration.message, /email option/);
  const unknown = classifyContactFailure(new Error("Unexpected failure"));
  assert.equal(unknown.category, "unknown");
  assert.equal(unknown.status, null);
  assert.match(unknown.message, /email option/);
});

test("error results contain safe diagnostics and never raw provider or visitor details", () => {
  const marker = "PRIVATE_DETAIL_DO_NOT_DISPLAY";
  const failures = [
    new EmailJSResponseStatus(400, `${marker} unknown request failure`),
    new EmailJSResponseStatus(412, `${marker} Gmail_API invalid_grant ${validFields.email}`),
    new EmailJSResponseStatus(429, `${marker} monthly quota exceeded`),
    Object.assign(new Error(`${marker} ${validFields.message}`), { status: 500, stack: marker }),
    { status: 403, text: `${marker} origin not allowed`, headers: { authorization: marker }, apiKey: marker },
    null,
    undefined,
  ];
  for (const failure of failures) {
    const result = classifyContactFailure(failure);
    assert.deepEqual(Object.keys(result).sort(), ["category", "message", "status"]);
    assert.ok(result.status === null || Number.isInteger(result.status));
    assert.equal(typeof result.category, "string");
    assert.equal(typeof result.message, "string");
    assert.doesNotMatch(JSON.stringify(result), new RegExp(marker));
    assert.equal(JSON.stringify(result).includes(validFields.email), false);
    assert.equal(JSON.stringify(result).includes(validFields.message), false);
  }
});
