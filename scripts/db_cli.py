import os
from pathlib import Path
import click
import psycopg

BASE_DIR = Path(__file__).resolve().parent.parent
SCHEMA_SQL = BASE_DIR / "database" / "schema.sql"
RESET_SQL = BASE_DIR / "database" / "reset-schema.sql"

DB_URL = os.getenv("SUPABASE_DB_URL")

if not DB_URL:
    raise SystemExit("SUPABASE_DB_URL environment variable is required")


def run_sql(path: Path):
    sql = path.read_text()
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()


@click.group()
def cli():
    """Utility commands for managing the Supabase database."""
    pass


@cli.command()
def apply():
    """Apply the main database schema."""
    click.echo(f"Running schema from {SCHEMA_SQL}...")
    run_sql(SCHEMA_SQL)
    click.echo("Schema applied successfully.")


@cli.command()
def reset():
    """Reset RLS policies using reset-schema.sql."""
    click.echo(f"Running reset script {RESET_SQL}...")
    run_sql(RESET_SQL)
    click.echo("Reset complete.")


@cli.command()
@click.argument("file", type=click.Path(exists=True))
def exec(file):
    """Execute an arbitrary SQL file."""
    path = Path(file)
    click.echo(f"Executing {path}...")
    run_sql(path)
    click.echo("Execution complete.")


if __name__ == "__main__":
    cli()
