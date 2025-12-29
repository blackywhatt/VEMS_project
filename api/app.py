from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt

app = Flask(__name__)
CORS(app)

# -- Configuration --

# Database connection settings
basedir = os.path.abspath(os.path.dirname(__file__))
ca_path = os.path.join(basedir, "ca.pem")
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://avnadmin:AVNS_haHcW_DduWectuJTAmL@vemsdb-zakiadib4646-91e5.h.aivencloud.com:20218/defaultdb'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "connect_args": {
        "ssl": {
            "ca": ca_path 
        }
    }
}

# JWT (token) configuration
app.config["JWT_SECRET_KEY"] = "5f4d2e8b9a1c7d6e3f0b2a4c9d8e7f1a5b8c0d9e2f4a6b7c1d3e5f0a2b4c6d8e" 
jwt = JWTManager(app)

# A simple in-memory set to store revoked tokens. This gets cleared on server restart.
BLOCKLIST = set()

# This function checks the blocklist every time a protected route is accessed.
@jwt.token_in_blocklist_loader
def check_if_token_in_blocklist(jwt_header, jwt_payload):
    jti = jwt_payload["jti"]
    return jti in BLOCKLIST

# Initialize the database
db = SQLAlchemy(app)

# -- Database Models --

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    real_id = db.Column(db.String(50), unique=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True)
    password = db.Column(db.String(255))
    otp = db.Column(db.String(6))
    role = db.Column(db.String(50))
    reg_date = db.Column(db.DateTime, default=datetime.utcnow)
    
# -- API Routes --

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(force=True)
    if not data:
        return jsonify({"message": "No data received"}), 400

    user_id = data.get('id')
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    # Check if the user or email already exists to prevent duplicates.
    if User.query.filter((User.email == email) | (User.real_id == user_id)).first():
        return jsonify({"message": "Email or ID already registered"}), 400

    new_user = User(
        real_id=user_id,
        name=name,
        email=email,
        password=generate_password_hash(password),
        role="head",
        otp="666666"
    )

    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User created successfully!"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(force=True)
    
    email = data.get('email')
    password = data.get('password')
    
    # Find the user by their email.
    user = User.query.filter_by(email=email).first()
    
    if user and check_password_hash(user.password, password):
        # If credentials are correct, create a new access token with the user's role.
        access_token = create_access_token(identity=user.real_id, additional_claims={"role": user.role})
        
        return jsonify({
            "message": "Login successful!",
            "access_token": access_token,
            "user": {
                "name": user.name,
                "email": user.email,
                "real_id": user.real_id,
                "role": user.role
            }
        }), 200
    else:
        return jsonify({"message": "Invalid email or password"}), 401

@app.route('/api/logout', methods=['DELETE'])
@jwt_required()
def logout():
    # Get the unique identifier for the token and add it to the blocklist.
    jti = get_jwt()["jti"]
    BLOCKLIST.add(jti)
    return jsonify(msg="Successfully logged out"), 200

# A protected route that only users with the 'head' role can access.
@app.route('/api/admin_only', methods=['GET'])
@jwt_required()
def admin_only():
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied: Head only"}), 403
    
    return jsonify({"message": "Welcome to the secret admin area!"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)