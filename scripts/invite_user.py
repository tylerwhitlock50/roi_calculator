import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    raise SystemExit("Please set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars")

supabase: Client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

def invite_user(email: str, password: str, organization_id: str):
    user_resp = supabase.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
    })
    user = user_resp.user
    if not user:
        raise RuntimeError("Failed to create user: %s" % user_resp)

    supabase.table("users").update({"organization_id": organization_id}).eq("id", user.id).execute()
    invite_link_resp = supabase.auth.admin.generate_link({
        "type": "invite",
        "email": email,
    })
    return invite_link_resp

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Create user and invite link")
    parser.add_argument("email")
    parser.add_argument("password")
    parser.add_argument("organization_id")
    args = parser.parse_args()
    link = invite_user(args.email, args.password, args.organization_id)
    print("Invite link:", link.get("properties", {}).get("action_link"))

