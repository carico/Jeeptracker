import firebase_admin
from firebase_admin import credentials, auth

# Load Firebase Admin credentials
cred = credentials.Certificate("path/to/your/firebase-adminsdk.json")
firebase_admin.initialize_app(cred)

# Assign a role to a user
user_email = "driver1@example.com"
role = "driver"  # can also be "passenger"

user = auth.get_user_by_email(user_email)
auth.set_custom_user_claims(user.uid, {"role": role})
print(f"Set {role} role for {user.email}")
