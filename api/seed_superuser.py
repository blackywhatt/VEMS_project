from app import app, db, User, SupAccess
from werkzeug.security import generate_password_hash
import json

def seed_superuser():
    with app.app_context():
        email = "officer@gmail.com"
        real_id = "SUPER_OFFICER_01"
        
        # 1. Create or Update User
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                real_id=real_id,
                name="Super Officer",
                email=email,
                password=generate_password_hash("abcd1234"),
                phone_number="0123456789",
                role="super",
                # assigned_village must be a valid Village ID or NULL. 
                # Setting to None (NULL) is safer than 0 unless Village ID 0 exists.
                assigned_village=None 
            )
            db.session.add(user)
            print(f"Created user: {email}")
        else:
            # Update existing user to match requirements
            user.role = "super"
            user.password = generate_password_hash("abcd1234")
            real_id = user.real_id # Use existing real_id
            print(f"Updated user: {email}")
        
        db.session.commit()

        # 2. Create or Update SupAccess
        sup_access = SupAccess.query.filter_by(user_id=real_id).first()
        if not sup_access:
            sup_access = SupAccess(
                user_id=real_id,
                village_list=json.dumps([1, 2, 3])
            )
            db.session.add(sup_access)
            print(f"Created SupAccess for {real_id}")
        else:
            sup_access.village_list = json.dumps([1, 2, 3])
            print(f"Updated SupAccess for {real_id}")

        db.session.commit()
        print("Done.")

if __name__ == "__main__":
    seed_superuser()