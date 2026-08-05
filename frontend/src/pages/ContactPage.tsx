import { useState, type FormEvent } from "react";
import { sendContactMessage } from "../api/client";

const CONTACT_EMAIL = "compassmse@gmail.com";

type SubmitStatus = "idle" | "sending" | "sent" | "error";

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      await sendContactMessage({ name, email, message });
      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="w-100 flex-grow-1 d-flex flex-column">
      <div className="bg-body-secondary py-5 w-100 flex-grow-1">
        <div className="container-fluid px-4">
          <h1 className="mb-5 font-display text-center">Contact Us</h1>
          <p className="text-muted mb-5 text-center" >
            Questions, feedback, spotted an issue or maybe
            you're interested in partnering, integrating, or
            working with MSE Compass?
            <br></br>
             <p className="fw-semibold font-display mt-3">We'd love to hear from you.</p>
          </p>

          <div className="row g-4">
            <div className="col-md-6 d-flex">
              <form className="card rounded-0 border-0 p-4 h-100 w-100" onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="contact-name" className="form-label small text-muted text-uppercase">
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    className="form-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="contact-email" className="form-label small text-muted text-uppercase">
                    Your Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="contact-message" className="form-label small text-muted text-uppercase">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    className="form-control"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary align-self-start" disabled={status === "sending"}>
                  {status === "sending" ? "Sending..." : "Send"}
                </button>
                {status === "sent" && (
                  <p className="text-success small mb-0 mt-2">Message sent — thanks for reaching out!</p>
                )}
                {status === "error" && (
                  <p className="text-danger small mb-0 mt-2">
                    Couldn't send your message. Please try again, or email us directly at{" "}
                    <a className="brand-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                  </p>
                )}
              </form>
            </div>

            <div className="col-md-6 d-flex">
              <div className="d-flex flex-column h-100 w-100">
                <div className="card rounded-0 border-0 p-4">
                  <div className="mb-3">
                    <h6 className="text-muted text-uppercase small mb-1">Email</h6>
                    <a className="brand-link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  </div>
                  <div className="mb-3">
                    <h6 className="text-muted text-uppercase small mb-1">Phone</h6>
                    <a className="brand-link" href="tel:+38921234567">+389 2 123 4567</a>
                  </div>
                  <div>
                    <h6 className="text-muted text-uppercase small mb-1">Address</h6>
                    <p className="mb-0">Skopje, North Macedonia</p>
                  </div>
                </div>

                <div className="mt-4 rounded overflow-hidden shadow-sm flex-grow-1" style={{ minHeight: "320px" }}>
                  <iframe
                    title="MSE Compass location"
                    src="https://www.google.com/maps?q=Skopje,+North+Macedonia&output=embed"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="row row-cols-1 row-cols-md-3 g-3 mt-4">
            <div className="col">
              <div className="card text-center p-3 h-100">
                <h6 className="fw-bold mb-3">How quickly will I hear back?</h6>
                <p className="text-muted small mb-0">
                  We aim to reply within 1-2 business days.
                </p>
              </div>
            </div>
            <div className="col">
              <div className="card text-center p-3 h-100">
                <h6 className="fw-bold mb-3">Spotted a data issue?</h6>
                <p className="text-muted small mb-0">
                  Include the page and company/bond name so we can track it down faster.
                </p>
              </div>
            </div>
            <div className="col">
              <div className="card text-center p-3 h-100">
                <h6 className="fw-bold mb-3">Want to partner with us?</h6>
                <p className="text-muted small mb-0">
                  Tell us a bit about your company and what you have in mind.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
