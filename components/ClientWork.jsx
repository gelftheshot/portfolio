import { upwork } from "@/lib/upwork";
import ReviewRail from "./ReviewRail";

function ClientRating({ rating, scale }) {
  const stars = (rating / scale) * 5;

  return (
    <span className="client-work-rating" role="img" aria-label={`Client rating: ${rating} out of ${scale} stars`}>
      <span className="client-work-stars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span className="client-work-star" key={index}>
            ★<span className="client-work-star-fill" style={{ width: `${Math.max(0, Math.min(1, stars - index)) * 100}%` }}>★</span>
          </span>
        ))}
      </span>
      <span className="client-work-rating-number" aria-hidden="true">{rating} / {scale}</span>
    </span>
  );
}

function clientInitials(name) {
  if (!name) return "UC";
  const words = name.trim().split(/\s+/);
  return [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])]
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase();
}

export default function ClientWork() {
  if (!upwork?.completedWork?.length) return null;

  const { source, profile, completedWork } = upwork;
  const featuredIds = ["langchain-langgraph-saas", "knowledge-based-rag-chatbot", "ai-agent-development"];
  const orderedWork = [
    ...featuredIds.map((id) => completedWork.find((item) => item.id === id)).filter(Boolean),
    ...completedWork.filter((item) => !featuredIds.includes(item.id)),
  ];
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const figuresDate = profile.snapshotDate || source.retrievedAt;
  const figuresDateLabel = figuresDate ? dateFormatter.format(new Date(figuresDate)) : null;

  return (
    <section id="client-work" className="client-work-section section-shell section-space" aria-labelledby="client-work-title">
      <div className="section-heading client-work-heading">
        <div>
          <p className="eyebrow section-label">03 / CLIENT WORK</p>
          <h2 id="client-work-title">Client reviews <span>on Upwork</span></h2>
        </div>
        <div className="client-work-summary">
          <ul className="client-work-highlights" aria-label="Upwork profile figures">
            {profile.badge && <li className="client-work-badge"><strong>{profile.badge}</strong></li>}
            {profile.totalJobCount != null && <li><strong>{profile.totalJobCount}</strong> total jobs</li>}
            {profile.completedJobCount != null && <li><strong>{profile.completedJobCount}</strong> completed jobs</li>}
            {profile.writtenReviewCount != null && <li><strong>{profile.writtenReviewCount}</strong> written reviews</li>}
          </ul>
          <p className="client-work-source">
            {figuresDateLabel && <>As of <time dateTime={figuresDate}>{figuresDateLabel}</time>{" · "}</>}
            <a href={source.profileUrl} target="_blank" rel="noreferrer">View current Upwork profile</a>
          </p>
        </div>
      </div>

      <ReviewRail>
        {orderedWork.map((item) => {
          const feedback = item.feedbackExcerpt || item.feedback;
          const isExcerpt = Boolean(item.feedbackExcerpt && item.feedbackExcerpt !== item.feedback);
          const clientName = item.clientName?.trim();

          return (
            <article className="client-work-card" id={`client-work-${item.id}`} key={item.id} aria-labelledby={`${item.id}-title`}>
              <div className="client-work-meta">
                <p className="mono">{item.period}</p>
                <ClientRating rating={item.rating} scale={item.ratingScale} />
              </div>
              <h3 id={`${item.id}-title`}>{item.title}</h3>
              {feedback ? (
                <blockquote className="client-work-quote" cite={item.sourceUrl}>
                  <p>{feedback}</p>
                </blockquote>
              ) : (
                <p className="client-work-no-feedback">Rated without a written review.</p>
              )}
              <footer className="client-work-footer">
                <div className="client-work-byline">
                  <span className="client-work-avatar" aria-hidden="true">{clientInitials(clientName)}</span>
                  <div>
                    <p className="client-work-client-name">{clientName || "Upwork client"}</p>
                    <p className="client-work-attribution">
                      {clientName ? "Upwork client" : "Completed contract"}{isExcerpt ? " · excerpt" : ""}
                    </p>
                  </div>
                </div>
                <a className="client-work-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
                  View on Upwork <span aria-hidden="true">↗</span>
                </a>
              </footer>
            </article>
          );
        })}
      </ReviewRail>
    </section>
  );
}
