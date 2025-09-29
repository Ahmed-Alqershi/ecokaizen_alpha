import sqlite3
import random
from typing import Dict, Optional, List


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                avatar TEXT
            )
            """
        )

        # Ensure avatar column exists for older installations
        try:
            conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
        except sqlite3.OperationalError:
            pass

        # Assign avatars to users who don't have one yet
        cur = conn.execute(
            "SELECT id, username FROM users WHERE avatar IS NULL OR avatar = ''"
        )
        for row in cur.fetchall():
            color = "#%06x" % random.randint(0, 0xFFFFFF)
            avatar = f"{row['username'][0].upper()}|{color}"
            conn.execute("UPDATE users SET avatar=? WHERE id=?", (avatar, row['id']))

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                template_id TEXT NOT NULL,
                params TEXT,
                sam TEXT,
                results TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                template TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )

        # ensure new columns exist for older databases
        cur = conn.execute("PRAGMA table_info(projects)")
        columns = [row[1] for row in cur.fetchall()]
        if 'description' not in columns:
            conn.execute("ALTER TABLE projects ADD COLUMN description TEXT")
        if 'template' not in columns:
            conn.execute("ALTER TABLE projects ADD COLUMN template TEXT")
        if 'status' not in columns:
            conn.execute(
                "ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'open'"
            )

        conn.commit()


# Users / Runs helpers
def get_user_id(username: str) -> int | None:
    with get_db_connection() as conn:
        cur = conn.execute('SELECT id FROM users WHERE username=?', (username,))
        row = cur.fetchone()
        return row['id'] if row else None


def insert_run(user_id: int, template_id: str, params: Dict, sam: Optional[Dict], results: Dict) -> int:
    with get_db_connection() as conn:
        cur = conn.execute(
            'INSERT INTO runs (user_id, template_id, params, sam, results) VALUES (?, ?, ?, ?, ?)',
            (user_id, template_id, json_dumps(params), json_dumps(sam) if sam else None, json_dumps(results)),
        )
        conn.commit()
        return cur.lastrowid


def fetch_runs_for_user(user_id: int) -> List[Dict]:
    with get_db_connection() as conn:
        cur = conn.execute(
            'SELECT id, template_id, params, sam, results, created_at FROM runs WHERE user_id=? ORDER BY created_at DESC',
            (user_id,),
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]


def fetch_run(run_id: int) -> Optional[Dict]:
    with get_db_connection() as conn:
        cur = conn.execute(
            'SELECT id, user_id, template_id, params, sam, results, created_at FROM runs WHERE id=?',
            (run_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def delete_run(run_id: int) -> None:
    with get_db_connection() as conn:
        conn.execute('DELETE FROM runs WHERE id=?', (run_id,))
        conn.commit()


def delete_runs_for_user(user_id: int) -> None:
    with get_db_connection() as conn:
        conn.execute('DELETE FROM runs WHERE user_id=?', (user_id,))
        conn.commit()


# Projects helpers
def insert_project(
    user_id: int, name: str, description: str = '', template: str = 'A'
) -> int:
    with get_db_connection() as conn:
        cur = conn.execute(
            'INSERT INTO projects (user_id, name, description, template, status) VALUES (?, ?, ?, ?, ?)',
            (user_id, name, description, template, 'open'),
        )
        conn.commit()
        return cur.lastrowid


def fetch_projects_for_user(user_id: int) -> List[Dict]:
    with get_db_connection() as conn:
        cur = conn.execute(
            'SELECT id, name, description, template, status, created_at, updated_at FROM projects WHERE user_id=? ORDER BY created_at DESC',
            (user_id,),
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]


def fetch_project(project_id: int) -> Optional[Dict]:
    with get_db_connection() as conn:
        cur = conn.execute(
            'SELECT id, user_id, name, description, template, status, created_at, updated_at FROM projects WHERE id=?',
            (project_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def update_project_status(project_id: int, status: str) -> None:
    with get_db_connection() as conn:
        conn.execute(
            'UPDATE projects SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            (status, project_id),
        )
        conn.commit()


def delete_project(project_id: int) -> None:
    with get_db_connection() as conn:
        conn.execute('DELETE FROM projects WHERE id=?', (project_id,))
        conn.commit()


# Small JSON helpers to avoid circular deps
def json_dumps(obj: Optional[Dict]) -> Optional[str]:
    if obj is None:
        return None
    try:
        import json
        return json.dumps(obj)
    except Exception:
        return None


