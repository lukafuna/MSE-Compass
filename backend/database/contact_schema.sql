-- Submissions from the site's Contact page. Always written on submit,
-- regardless of whether email delivery succeeds -- `emailed` just records
-- whether the best-effort SMTP send went through, so nothing is lost if
-- SMTP_* env vars aren't configured or a send fails.

CREATE TABLE IF NOT EXISTS contact_messages (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    message       TEXT NOT NULL,
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    emailed       BOOLEAN NOT NULL DEFAULT false
);
