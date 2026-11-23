import os
import queue
import time
from contextlib import contextmanager
from typing import Iterator

import psycopg
from dotenv import load_dotenv

load_dotenv()

def get_connection() -> psycopg.Connection:
    """Open a new connection. Use as a context manager:

        with get_connection() as conn:
            with conn.cursor() as cur:
                ...
            conn.commit()
    """
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# --- Small connection pool for the API ------------------------------------
# Opening a Postgres connection (TCP + TLS + auth) to a remote host costs
# far more than the queries the API actually runs, so the API reuses idle
# connections instead of opening one per request. Kept dependency-free on
# purpose; scripts/scrapers keep using get_connection() directly.

POOL_MAX_IDLE = int(os.getenv("DB_POOL_MAX_IDLE", 5))
# Hosted Postgres providers tend to drop connections that sit idle for a
# while; recycle ours before that happens rather than handing out a dead one.
POOL_MAX_IDLE_SECONDS = int(os.getenv("DB_POOL_MAX_IDLE_SECONDS", 240))

_idle: "queue.LifoQueue[tuple[float, psycopg.Connection]]" = queue.LifoQueue()


def _acquire() -> psycopg.Connection:
    while True:
        try:
            idle_since, conn = _idle.get_nowait()
        except queue.Empty:
            conn = get_connection()
            conn.autocommit = True
            return conn
        idle_for = time.monotonic() - idle_since
        if conn.closed or idle_for > POOL_MAX_IDLE_SECONDS:
            conn.close()
            continue
        if idle_for > 30:
            # Cheap one-round-trip liveness check, only after a quiet spell
            # (back-to-back requests skip it).
            try:
                conn.execute("SELECT 1")
            except psycopg.Error:
                conn.close()
                continue
        return conn


def _release(conn: psycopg.Connection) -> None:
    healthy = (
        not conn.closed
        and conn.info.transaction_status == psycopg.pq.TransactionStatus.IDLE
    )
    if healthy and _idle.qsize() < POOL_MAX_IDLE:
        _idle.put((time.monotonic(), conn))
    else:
        conn.close()


@contextmanager
def pooled_connection() -> Iterator[psycopg.Connection]:
    """Borrow an autocommit connection from the API's pool:

        with pooled_connection() as conn:
            with conn.cursor() as cur:
                ...

    If the borrowed connection turns out to be dead (server dropped it),
    the error propagates and the connection is discarded, not re-pooled.
    """
    conn = _acquire()
    try:
        yield conn
    except psycopg.OperationalError:
        conn.close()
        raise
    finally:
        _release(conn)


if __name__ == "__main__":
    with get_connection() as conn:
        print("Connected!")
