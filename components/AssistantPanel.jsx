import Chat from "./chat";

export default function AssistantPanel() {
  return (
    <section id="assistant" className="assistant-panel assistant-section section-shell" aria-labelledby="assistant-title">
      <div className="assistant-section-header">
        <p className="eyebrow">A conversation about my work</p>
        <h2 id="assistant-title">Ask my AI assistant</h2>
        <p>It answers from the projects and work history on this page.</p>
      </div>
      <div className="assistant-body"><Chat /><p className="assistant-data-note">Questions are sent to OpenAI. This conversation clears when you reload the page.</p></div>
    </section>
  );
}
