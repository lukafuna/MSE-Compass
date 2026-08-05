import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { sendCompanyChatStream, type ChatMessage } from "../api/client";

interface CompanyChatProps {
  companyId: number;
  companyName: string;
}

function CompanyChat({ companyId, companyName }: CompanyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const historyForRequest = messages;
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "model", content: "" }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      await sendCompanyChatStream(companyId, text, historyForRequest, (chunk) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
        });
      });
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      setError("Couldn't reach Gemini. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  return (
    <div className="card rounded-0 p-4">
      <h6 className="text-muted small mb-3">Ask Gemini about {companyName}</h6>

      <div className="gemini-chat-body mb-3" ref={bodyRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`gemini-chat-bubble ${
              m.role === "user" ? "gemini-chat-bubble-user" : "gemini-chat-bubble-model"
            } ${m.role === "model" && !m.content ? "text-muted" : ""}`}
          >
            {m.content || (m.role === "model" && sending ? "Thinking…" : "")}
          </div>
        ))}
        {error && <p className="text-danger small mb-0">{error}</p>}
      </div>

      <div className="d-flex gap-2">
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Compare stocks, get more data, ask for an explanation or maybe a simple analysis ... "
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          type="button"
          className="btn btn-sm btn-brand flex-shrink-0"
          onClick={handleSend}
          disabled={sending || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default CompanyChat;
