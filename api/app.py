from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/login', methods=['POST'])
def login():
    # Get JSON data from request
    data = request.get_json()

    email = data.get('email')
    password = data.get('password')
    
    #db logic
    
@app.route('/api/register', methods=['POST'])
def register():
    # Get JSON data from request
    data = request.get_json()

    name = data.get('name')
    email = data.get('email')
    id = data.get('id')
    password = data.get('password')

    #db logic
    
if __name__ == '__main__':
    app.run(debug=True, port=5000)