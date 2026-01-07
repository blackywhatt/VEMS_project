import pywhatkit
import pyautogui
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt, get_jwt_identity
from werkzeug.utils import secure_filename
import uuid
import json
import re

app = Flask(__name__)
CORS(app)

# -- Config --

# Database config
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

# File upload config
UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# JWT config
app.config["JWT_SECRET_KEY"] = "5f4d2e8b9a1c7d6e3f0b2a4c9d8e7f1a5b8c0d9e2f4a6b7c1d3e5f0a2b4c6d8e" 
jwt = JWTManager(app)

# Revoked tokens storage
BLOCKLIST = set()

# Check token blocklist
@jwt.token_in_blocklist_loader
def check_if_token_in_blocklist(jwt_header, jwt_payload):
    jti = jwt_payload["jti"]
    return jti in BLOCKLIST

# Init DB
db = SQLAlchemy(app)

# -- Models --

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    real_id = db.Column(db.String(50), unique=True)
    name = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True)
    password = db.Column(db.String(255))
    otp = db.Column(db.String(6))
    phone_number = db.Column(db.String(20))
    role = db.Column(db.String(50))
    assigned_village = db.Column(db.Integer, db.ForeignKey('villages.id'))
    reg_date = db.Column(db.DateTime, default=datetime.utcnow)
    
class Village(db.Model):
    __tablename__ = 'villages'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True)
    population = db.Column(db.Integer)
    emergency_status = db.Column(db.String(50))
    service_status = db.Column(db.String(50))
    todays_reports = db.Column(db.Integer, default=0)

class Report(db.Model):
    __tablename__ = 'reports'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), db.ForeignKey('users.real_id'))
    content = db.Column(db.Text)
    file_paths = db.Column(db.Text)
    report_date = db.Column(db.DateTime)
    longitude = db.Column(db.Float)
    latitude = db.Column(db.Float)
    assigned_village = db.Column(db.Integer, db.ForeignKey('villages.id'))
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)

class Note(db.Model):
    __tablename__ = 'notes'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), db.ForeignKey('users.real_id'))
    content = db.Column(db.Text)
    file_paths = db.Column(db.Text)
    note_date = db.Column(db.DateTime)
    assigned_village = db.Column(db.Integer, db.ForeignKey('villages.id'))
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)

class SOSRequest(db.Model):
    __tablename__ = 'sos_requests'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), db.ForeignKey('users.real_id'))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    message = db.Column(db.Text)
    status = db.Column(db.String(50), default='Pending')
    assigned_village = db.Column(db.Integer, db.ForeignKey('villages.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Announcement(db.Model):
    __tablename__ = 'announcements'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), db.ForeignKey('users.real_id'))
    title = db.Column(db.String(200))
    content = db.Column(db.Text)
    assigned_village = db.Column(db.Integer, db.ForeignKey('villages.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Polygon(db.Model):
    __tablename__ = 'polygons'
    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(200))
    polygon_data = db.Column(db.Text)  # Stores GeoJSON string
    assigned_village = db.Column(db.Integer, db.ForeignKey('villages.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SupAccess(db.Model):
    __tablename__ = 'supAccess'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), db.ForeignKey('users.real_id'), unique=True, nullable=False)
    village_list = db.Column(db.Text) # Storing list of village IDs as a JSON string

# -- Routes --

@app.route('/api/villages', methods=['GET'])
def get_villages():
    villages = Village.query.all()
    output = [{'id': v.id, 'name': v.name} for v in villages]
    return jsonify(output), 200

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(force=True)
    if not data:
        return jsonify({"message": "No data received"}), 400

    user_id = data.get('id')
    name = data.get('name')
    email = data.get('email')
    phone_number = data.get('phone_number')
    password = data.get('password')
    assigned_village = data.get('assigned_village')

    # Input validation
    if not name or len(name.strip()) < 2:
        return jsonify({"message": "Invalid name"}), 400

    if not email or not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"message": "Invalid email format"}), 400

    if not phone_number or not re.match(r"^[0-9+\-\s]{9,15}$", phone_number):
        return jsonify({"message": "Invalid phone number format"}), 400

    if not user_id or not re.match(r"^[a-zA-Z0-9]+$", user_id):
        return jsonify({"message": "Invalid ID format"}), 400

    if not password or len(password) < 8 or not re.search(r"\d", password):
        return jsonify({"message": "Password must be at least 8 characters and contain a number"}), 400

    # Check duplicates
    if User.query.filter((User.email == email) | (User.real_id == user_id)).first():
        return jsonify({"message": "Email or ID already registered"}), 400

    new_user = User(
        real_id=user_id,
        name=name,
        email=email,
        password=generate_password_hash(password),
        phone_number=phone_number,
        role="villager",
        otp="666666",
        assigned_village=assigned_village
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
    
    # Find user
    user = User.query.filter_by(email=email).first()
    
    if user and check_password_hash(user.password, password):
        # Verify password & generate token
        access_token = create_access_token(identity=user.real_id, additional_claims={"role": user.role})
        
        village_name = None
        if user.assigned_village:
            v = Village.query.get(user.assigned_village)
            if v:
                village_name = v.name

        user_data = {
            "name": user.name,
            "email": user.email,
            "real_id": user.real_id,
            "role": user.role,
            "village_name": village_name
        }

        if user.role == 'super':
            sup_access = SupAccess.query.filter_by(user_id=user.real_id).first()
            if sup_access and sup_access.village_list:
                try:
                    user_data['village_ids'] = json.loads(sup_access.village_list)
                except:
                    user_data['village_ids'] = []

        return jsonify({
            "message": "Login successful!",
            "access_token": access_token,
            "user": user_data
        }), 200
    else:
        return jsonify({"message": "Invalid email or password"}), 401

@app.route('/api/logout', methods=['DELETE'])
@jwt_required()
def logout():
    # Revoke token
    jti = get_jwt()["jti"]
    BLOCKLIST.add(jti)
    return jsonify(msg="Successfully logged out"), 200

@app.route('/api/submit_report', methods=['POST'])
@jwt_required()
def submit_report():
    # Parse form data
    content = request.form.get('content')
    report_date_str = request.form.get('report_date')
    files = request.files.getlist('files')

    user_id = get_jwt_identity()

    # Parse content JSON to get location data
    content_data = {}
    if content:
        try:
            content_data = json.loads(content)
        except json.JSONDecodeError:
            return jsonify({"message": "Invalid content format"}), 400

    # Get location from content data
    longitude = content_data.get('longitude')
    latitude = content_data.get('latitude')

    # Get user's village
    user = User.query.filter_by(real_id=user_id).first()
    assigned_village_id = user.assigned_village if user else None
    
    # Set timestamp
    current_time = datetime.utcnow()
    
    report_date = None
    if report_date_str:
        try:
            report_date = datetime.fromisoformat(report_date_str.replace('Z', '+00:00'))
        except ValueError:
            pass
    
    # Handle files
    saved_files = []
    if len(files) > 3:
        return jsonify({"message": "Maximum 3 files allowed"}), 400

    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            unique_filename = f"{uuid.uuid4().hex}_{filename}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
            saved_files.append(unique_filename)
        elif file.filename:
            return jsonify({"message": f"Invalid file type. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"}), 400

    new_report = Report(
        user_id=user_id,
        content=content,
        file_paths=json.dumps(saved_files),
        report_date=report_date,
        longitude=float(longitude) if longitude else None,
        latitude=float(latitude) if latitude else None,
        assigned_village=assigned_village_id,
        submitted_at=current_time
    )
    
    try:
        # Add the new report to the session
        db.session.add(new_report)
        
        # --- INCREMENT VILLAGE REPORT COUNTER ---
        if assigned_village_id:
            village = Village.query.get(assigned_village_id)
            if village:
                # Initialize to 0 if the current value is None
                if village.todays_reports is None:
                    village.todays_reports = 0
                village.todays_reports += 1
        
        # Commit both the new report and the village update
        db.session.commit()
        
        return jsonify({
            "message": "Report submitted successfully", 
            "time": current_time.isoformat()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500

@app.route('/api/reports/<int:report_id>', methods=['DELETE'])
def resolve_report(report_id):
    try:
        report = Report.query.get(report_id)
        if not report:
            return jsonify({"message": "Report not found"}), 404
        
        db.session.delete(report)
        db.session.commit()
        return jsonify({"message": "Report resolved and removed successfully"}), 200
    except Exception as e:
        return jsonify({"message": "Error resolving report", "error": str(e)}), 500

@app.route('/api/submit_note', methods=['POST'])
@jwt_required()
def submit_note():
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied: Head only"}), 403
        
    # Parse form data
    content = request.form.get('content')
    note_date_str = request.form.get('note_date')
    files = request.files.getlist('files')

    user_id = get_jwt_identity()

    # Get user's village
    user = User.query.filter_by(real_id=user_id).first()
    assigned_village = user.assigned_village if user else None
    
    # Set timestamp
    current_time = datetime.utcnow()
    
    note_date = None
    if note_date_str:
        try:
            note_date = datetime.fromisoformat(note_date_str.replace('Z', '+00:00'))
        except ValueError:
            pass
    
    # Handle files
    saved_files = []
    if len(files) > 3:
        return jsonify({"message": "Maximum 3 files allowed"}), 400

    for file in files:
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            unique_filename = f"{uuid.uuid4().hex}_{filename}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
            saved_files.append(unique_filename)
        elif file.filename:
            return jsonify({"message": f"Invalid file type. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"}), 400

    new_note = Note(
        user_id=user_id,
        content=content,
        file_paths=json.dumps(saved_files),
        note_date=note_date,
        assigned_village=assigned_village,
        submitted_at=current_time
    )
    
    try:
        db.session.add(new_note)
        db.session.commit()
        return jsonify({"message": "Note submitted successfully", "time": current_time.isoformat()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500

@app.route('/api/reports', methods=['GET'])
@jwt_required()
def get_reports():
    user_id = get_jwt_identity()
    claims = get_jwt()    
    role = claims.get('role')

    query = Report.query

    if role == 'super':
        sup_access = SupAccess.query.filter_by(user_id=user_id).first()
        if sup_access and sup_access.village_list:
            village_ids = json.loads(sup_access.village_list)
            query = query.filter(Report.assigned_village.in_(village_ids))
        else:
            return jsonify([]), 200 # Supervisor with no villages assigned
    elif role == 'villager':
        query = query.filter_by(user_id=user_id)
    # For 'head', no initial filter, gets all reports

    # Optional filter by specific village ID from query args
    village_id_filter = request.args.get('village_id', type=int)
    if village_id_filter:
        query = query.filter(Report.assigned_village == village_id_filter)

    reports = query.order_by(Report.submitted_at.desc()).all()

    output = []
    for report in reports:
        output.append({
            'id': report.id,
            'content': report.content,
            'file_paths': json.loads(report.file_paths) if report.file_paths else [],
            'report_date': report.report_date.isoformat() if report.report_date else None,
            'longitude': report.longitude,
            'latitude': report.latitude,
            'submitted_at': report.submitted_at.isoformat() 
        })
    
    return jsonify(output), 200

@app.route('/api/notes', methods=['GET'])
@jwt_required()
def get_notes():
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied: Head only"}), 403
        
    notes = Note.query.order_by(Note.submitted_at.desc()).all()
    
    output = []
    for note in notes:
        output.append({
            'id': note.id,
            'user_id': note.user_id,
            'content': note.content,
            'file_paths': json.loads(note.file_paths) if note.file_paths else [],
            'note_date': note.note_date.isoformat() if note.note_date else None,
            'submitted_at': note.submitted_at.isoformat()
        })
    
    return jsonify(output), 200

@app.route('/api/sos_requests', methods=['GET'])
@jwt_required()
def get_sos_requests():
    user_id = get_jwt_identity()
    claims = get_jwt()
    role = claims.get('role')

    query = SOSRequest.query

    if role == 'super':
        sup_access = SupAccess.query.filter_by(user_id=user_id).first()
        if sup_access and sup_access.village_list:
            village_ids = json.loads(sup_access.village_list)
            query = query.filter(SOSRequest.assigned_village.in_(village_ids))
        else:
            return jsonify([]), 200

    # Optional filter by specific village ID from query args
    village_id_filter = request.args.get('village_id', type=int)
    if village_id_filter:
        query = query.filter(SOSRequest.assigned_village == village_id_filter)

    requests = query.order_by(SOSRequest.created_at.desc()).all()
    output = []
    for req in requests:
        output.append({
            'id': req.id,
            'user_id': req.user_id,
            'latitude': req.latitude,
            'longitude': req.longitude,
            'message': req.message,
            'status': req.status,
            'created_at': req.created_at.isoformat()
        })
    return jsonify(output), 200

@app.route('/api/sos', methods=['POST'])
@jwt_required()
def submit_sos():
    data = request.get_json(force=True)
    user_id = get_jwt_identity()
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    
    # Validate coords
    try:
        lat_val = float(latitude)
        lon_val = float(longitude)
        if not (-90 <= lat_val <= 90) or not (-180 <= lon_val <= 180):
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid coordinates"}), 400

    user = User.query.filter_by(real_id=user_id).first()
    assigned_village = user.assigned_village if user else None

    new_sos = SOSRequest(
        user_id=user_id,
        latitude=latitude,
        longitude=longitude,
        message="Emergency SOS Signal",
        assigned_village=assigned_village
    )
    
    try:
        db.session.add(new_sos)
        db.session.commit()
        return jsonify({"message": "SOS signal received"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500

@app.route('/api/sos_requests/<int:sos_id>/resolve', methods=['PUT'])
@jwt_required()
def resolve_sos_request(sos_id):
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied"}), 403

    sos = SOSRequest.query.get(sos_id)
    if not sos:
        return jsonify({"message": "SOS not found"}), 404

    sos.status = 'Resolved'

    try:
        db.session.commit()
        return jsonify({"message": "SOS resolved"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500

@app.route('/api/sos_requests/cleanup', methods=['DELETE'])
@jwt_required()
def cleanup_resolved_sos():
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied"}), 403

    try:
        SOSRequest.query.filter_by(status='Resolved').delete()
        db.session.commit()
        return jsonify({"message": "Resolved SOS deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500


@app.route('/api/update_village_status', methods=['POST'])
@jwt_required()
def update_village_status():
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied"}), 403
    
    user_id = get_jwt_identity()
    user = User.query.filter_by(real_id=user_id).first()
    if not user or not user.assigned_village:
        return jsonify({"message": "User not assigned to a village"}), 400
        
    village = Village.query.get(user.assigned_village)
    if not village:
        return jsonify({"message": "Village not found"}), 404
        
    data = request.get_json(force=True)
    village.emergency_status = data.get('emergency_status', village.emergency_status)
    village.service_status = data.get('service_status', village.service_status)
    
    # --- FIX: Ensure database saves changes ---
    try:
        db.session.commit()
        return jsonify({
            "message": "Status updated",
            "emergency_status": village.emergency_status,
            "service_status": village.service_status
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating status", "error": str(e)}), 500

@app.route('/api/submit_announcement', methods=['POST'])
@jwt_required()
def submit_announcement():
    claims = get_jwt()
    role = claims.get('role')
    if role not in ['head', 'super']:
        return jsonify({"message": "Access denied: Admin/Supervisor only"}), 403
        
    data = request.get_json(force=True)
    user_id = get_jwt_identity()
    title = data.get('title')
    content = data.get('content')
    village_id = data.get('village_id') # New field for super user

    assigned_village = None
    if role == 'head':
        user = User.query.filter_by(real_id=user_id).first()
        assigned_village = user.assigned_village if user else None
    elif role == 'super':
        # If village_id is provided, use it. Otherwise, it's a global announcement.
        assigned_village = village_id
    
    new_announcement = Announcement(
        user_id=user_id,
        title=title,
        content=content,
        assigned_village=assigned_village
    )
    
    try:
        db.session.add(new_announcement)
        db.session.commit()
        return jsonify({"message": "Announcement created successfully"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500

@app.route('/api/announcements', methods=['GET'])
@jwt_required()
def get_announcements():
    village_id_filter = request.args.get('village_id', type=int)
    
    query = Announcement.query

    if village_id_filter:
        query = query.filter(db.or_(Announcement.assigned_village == village_id_filter, Announcement.assigned_village == None))

    announcements = query.order_by(Announcement.created_at.desc()).all()
    output = []
    for a in announcements:
        output.append({
            'id': a.id,
            'title': a.title,
            'content': a.content,
            'user_id': a.user_id,
            'created_at': a.created_at.isoformat()
        })
    return jsonify(output), 200

@app.route('/api/polygons', methods=['POST'])
@jwt_required()
def save_polygon():
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied: Head only"}), 403
    
    user_id = get_jwt_identity()
    user = User.query.filter_by(real_id=user_id).first()
    if not user or not user.assigned_village:
        return jsonify({"message": "User not assigned to a village"}), 400
    
    data = request.get_json(force=True)
    category = data.get('category', 'Caution')
    polygon_data = data.get('polygon_data')  # GeoJSON
    
    if not polygon_data:
        return jsonify({"message": "Polygon data is required"}), 400
    
    new_polygon = Polygon(
        category=category,
        polygon_data=json.dumps(polygon_data),
        assigned_village=user.assigned_village
    )
    
    try:
        db.session.add(new_polygon)
        db.session.commit()
        return jsonify({
            "message": "Polygon saved successfully",
            "id": new_polygon.id
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500

@app.route('/api/polygons', methods=['GET'])
@jwt_required()
def get_polygons():
    user_id = get_jwt_identity()
    user = User.query.filter_by(real_id=user_id).first()
    if not user or not user.assigned_village:
        return jsonify({"message": "User not assigned to a village"}), 400
    
    polygons = Polygon.query.filter_by(assigned_village=user.assigned_village).order_by(Polygon.created_at.desc()).all()
    output = []
    for p in polygons:
        output.append({
            'id': p.id,
            'category': p.category,
            'polygon_data': json.loads(p.polygon_data) if p.polygon_data else None,
            'created_at': p.created_at.isoformat()
        })
    return jsonify(output), 200

@app.route('/api/polygons/<int:polygon_id>', methods=['PUT'])
@jwt_required()
def update_polygon(polygon_id):
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied: Head only"}), 403
    
    polygon = Polygon.query.get(polygon_id)
    if not polygon:
        return jsonify({"message": "Polygon not found"}), 404
    
    data = request.get_json(force=True)
    polygon.category = data.get('category', polygon.category)
    
    if 'polygon_data' in data:
        polygon.polygon_data = json.dumps(data.get('polygon_data'))
    
    try:
        db.session.commit()
        return jsonify({"message": "Polygon updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500

@app.route('/api/polygons/<int:polygon_id>', methods=['DELETE'])
@jwt_required()
def delete_polygon(polygon_id):
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied: Head only"}), 403
    
    polygon = Polygon.query.get(polygon_id)
    if not polygon:
        return jsonify({"message": "Polygon not found"}), 404
    
    try:
        db.session.delete(polygon)
        db.session.commit()
        return jsonify({"message": "Polygon deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Database error", "error": str(e)}), 500

@app.route('/api/village_status', methods=['GET'])
@jwt_required()
def get_village_status():
    user_id = get_jwt_identity()
    user = User.query.filter_by(real_id=user_id).first()    
    village_id_arg = request.args.get('village_id', type=int)
    
    target_village_id = None
    if village_id_arg:
        target_village_id = village_id_arg
    elif user and user.assigned_village:
        target_village_id = user.assigned_village

    if not target_village_id:
        return jsonify({"message": "Village not found or specified"}), 404
        
    village = Village.query.get(target_village_id)
    if not village:
        return jsonify({"message": "Village not found"}), 404
        
    return jsonify({
        "emergency_status": village.emergency_status,
        "service_status": village.service_status,
        "todays_reports": village.todays_reports if village.todays_reports else 0
    }), 200

# Admin only route
@app.route('/api/admin_only', methods=['GET'])
@jwt_required()
def admin_only():
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied: Head only"}), 403
    
    return jsonify({"message": "Welcome to the secret admin area!"})

@app.route('/api/broadcast_whatsapp', methods=['POST'])
@jwt_required()
def broadcast_whatsapp():
    # Only Head Admin can send broadcasts
    claims = get_jwt()
    if claims.get('role') != 'head':
        return jsonify({"message": "Access denied"}), 403

    data = request.get_json(force=True)
    message_content = data.get('message', 'Emergency Alert from VEMS')

    # Filter for valid Malaysian numbers (starts with +60 or 60 or 01)
    users = User.query.filter(User.phone_number.isnot(None)).all()
    
    sent_count = 0
    
    try:
        for user in users:
            phone = user.phone_number

            # Assuming Malaysian numbers (e.g., 0123456789 -> +60123456789)
            if phone.startswith('0'):
                phone = '+60' + phone[1:]
            elif not phone.startswith('+'):
                phone = '+' + phone

            # Send the message
            # wait_time=15 (time to load web), tab_close=True (close after sending)
            pywhatkit.sendwhatmsg_instantly(phone, message_content, 15, True, 3)
            sent_count += 1
            time.sleep(2) 

        return jsonify({"message": f"Broadcast sent to {sent_count} villagers!"}), 200

    except Exception as e:
        print(f"WhatsApp Error: {e}")
        return jsonify({"message": "Failed to send WhatsApp messages", "error": str(e)}), 500

@app.route('/api/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    with app.app_context():
        # Add missing columns to reports table
        try:
            with db.engine.connect() as conn:
                try:
                    conn.execute(db.text('ALTER TABLE reports ADD COLUMN longitude FLOAT'))
                    print("Added longitude column to reports table")
                except:
                    pass
                try:
                    conn.execute(db.text('ALTER TABLE reports ADD COLUMN latitude FLOAT'))
                    print("Added latitude column to reports table")
                except:
                    pass
                
                conn.commit()
        except Exception as e:
            print(f"Error updating tables: {e}")
        
        # Create all tables
        db.create_all()
        print("Database tables created/updated")
    
    app.run(debug=True, port=5000)