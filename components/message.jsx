export function getSafeChatLink(value) {
  const href = value.trim();
  if (/[\u0000-\u0020\u007f]/.test(href)) return null;
  if (href.startsWith("#") || (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\"))) {
    return href;
  }
  try {
    const url = new URL(href);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function renderInline(text, keyPrefix) {
  const pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)|(\*\*([^*\n]+)\*\*)|(`([^`\n]+)`)|(\*([^*\n]+)\*)|(https?:\/\/[^\s<>]+)/g;
  const parts = [];
  let start = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > start) parts.push(text.slice(start, match.index));
    const key = `${keyPrefix}-${match.index}`;
    if (match[1]) {
      const href = getSafeChatLink(match[2]);
      parts.push(href
        ? <a key={key} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>{match[1]}</a>
        : match[1]);
    } else if (match[4]) {
      parts.push(<strong key={key}>{match[4]}</strong>);
    } else if (match[6]) {
      parts.push(<code key={key}>{match[6]}</code>);
    } else if (match[8]) {
      parts.push(<em key={key}>{match[8]}</em>);
    } else {
      const rawUrl = match[9];
      const url = rawUrl.replace(/[.,;:!?]+$/, "");
      const suffix = rawUrl.slice(url.length);
      const href = getSafeChatLink(url);
      parts.push(href
        ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{url}</a>
        : url);
      if (suffix) parts.push(suffix);
    }
    start = pattern.lastIndex;
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts;
}

function AssistantText({ content }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const key = `block-${index}`;
    if (line.startsWith("```")) {
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<pre key={key}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const pattern = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/;
      const items = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(<li key={index}>{renderInline(lines[index].replace(pattern, ""), `item-${index}`)}</li>);
        index += 1;
      }
      blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      blocks.push(<p key={key}><strong>{renderInline(line.replace(/^#{1,6}\s+/, ""), key)}</strong></p>);
      index += 1;
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim()) {
      if (paragraph.length && /^(?:\s*[-*]\s+|\s*\d+[.)]\s+|#{1,6}\s+|```)/.test(lines[index])) break;
      paragraph.push(lines[index++]);
    }
    blocks.push(<p key={key}>{renderInline(paragraph.join("\n"), key)}</p>);
  }
  return <div className="chat-markdown">{blocks}</div>;
}

export default function Message({ role, content, status = "complete" }) {
  const isUser = role === "user";
  const note = status === "stopped"
    ? "Response stopped."
    : status === "incomplete"
      ? "Incomplete response. Please try again."
      : status === "failed"
        ? "No answer received."
        : "";

  return (
    <div className={`chat-message chat-message-${isUser ? "user" : "assistant"}`}>
      <p className="chat-author">{isUser ? "You" : "Portfolio assistant"}</p>
      {content ? (
        <div className="chat-bubble">
          {isUser ? content : <AssistantText content={content} />}
        </div>
      ) : status === "pending" ? (
        <div className="chat-bubble chat-thinking" aria-hidden="true">Thinking…</div>
      ) : null}
      {!isUser && note && <p className="chat-message-note">{note}</p>}
    </div>
  );
}
