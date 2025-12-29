from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os

app = Flask(__name__)
CORS(app)

# --- DATABASE SETUP ---
# This part finds your ca.pem file automatically in the same folder
basedir = os.path.abspath(os.path.dirname(__file__))
ca_path = os.path.join(basedir, "ca.pem")

# PASTE YOUR NEW SERVICE URI HERE (from the new Aiven region)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://avnadmin:AVNS_haHcW_DduWectuJTAmL@vemsdb-zakiadib4646-91e5.h.aivencloud.com:20218/defaultdb'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Aiven requires this SSL configuration
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "connect_args": {
        "ssl": {
            "ca": ca_path 
        }
    }
}

db = SQLAlchemy(app)

# --- DATABASE MODEL ---
class User(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True)
    password = db.Column(db.String(100))

# This creates the table in your new cloud database automatically
with app.app_context():
    db.create_all()

# --- ROUTES ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(force=True)
    if not data:
        return jsonify({"message": "No data received"}), 400

    user_id = data.get('id')
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    # Check if user already exists
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 400

    new_user = User(id=user_id, name=name, email=email, password=password)

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
    
    # Check the database for this user
    user = User.query.filter_by(email=email, password=password).first()
    
    if user:
        return jsonify({
            "message": "Login successful!",
            "user": {"name": user.name, "email": user.email}
        }), 200
    else:
        return jsonify({"message": "Invalid email or password"}), 401

# Debug route to see your data in the browser
@app.route('/api/view_db', methods=['GET'])
def view_db():
    users = User.query.all()
    return jsonify([{"name": u.name, "email": u.email} for u in users])

if __name__ == '__main__':
    app.run(debug=True, port=5000)