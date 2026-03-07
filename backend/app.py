from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from llm_agent import LLM_Agent
from data_processor import DataProcessor
import os
import logging
import time
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

load_dotenv()

logging.basicConfig(level=logging.INFO)
logging.getLogger('matplotlib').setLevel(logging.WARNING)
logging.getLogger('PIL').setLevel(logging.WARNING)
logging.getLogger('plotly').setLevel(logging.WARNING)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=os.path.join(BASE_DIR, '..', 'static'))

CORS(app, origins=[
    "https://llm-integrated-excel-plotter-app.vercel.app",
    "http://localhost:8080",
    "http://localhost:3000",
], supports_credentials=False)

agent = LLM_Agent()

UPLOAD_FOLDER     = os.path.join(BASE_DIR, '..', 'data', 'uploads')
ALLOWED_EXTENSIONS = {'csv', 'xls', 'xlsx'}
MAX_UPLOAD_BYTES   = 10 * 1024 * 1024  # 10 MB

app.config['UPLOAD_FOLDER']        = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH']   = MAX_UPLOAD_BYTES

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    return jsonify({
        "status": "ok",
        "message": "AI Data Visualization API",
        "endpoints": ["/plot", "/upload", "/stats", "/models"]
    })


@app.route('/models', methods=['GET'])
def models():
    return jsonify({
        "models": [
            {"id": "qwen",   "name": "Qwen2.5-1.5B",    "provider": "Local (transformers)", "free": True},
            {"id": "bart",   "name": "BART (fine-tuned)", "provider": "Local (transformers)", "free": True},
            {"id": "gemini", "name": "Gemini 2.0 Flash", "provider": "Google AI (API key)",  "free": False},
            {"id": "grok",   "name": "Grok-3 Mini",      "provider": "xAI (API key)",       "free": False},
        ],
        "default": "qwen"
    })


@app.route('/plot', methods=['POST'])
def plot():
    t0   = time.time()
    data = request.get_json(force=True)
    if not data or not data.get('query'):
        return jsonify({'error': 'Missing required field: query'}), 400

    logging.info(f"Plot request: model={data.get('model','qwen')} query={data.get('query')[:80]}")
    result = agent.process_request(data)
    logging.info(f"Plot completed in {time.time() - t0:.2f}s")
    return jsonify(result)


@app.route('/static/<path:filename>')
def serve_static(filename):
    resp = send_from_directory(app.static_folder, filename)
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Cache-Control'] = 'public, max-age=300'
    return resp


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in request'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed. Use CSV, XLS, or XLSX'}), 400

    filename  = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)

    dp = DataProcessor(file_path)
    return jsonify({
        'message':   'File uploaded successfully',
        'columns':   dp.get_columns(),
        'dtypes':    dp.get_dtypes(),
        'preview':   dp.preview(5),
        'file_path': file_path,
        'row_count': len(dp.data),
    })


@app.route('/stats', methods=['POST'])
def stats():
    data      = request.get_json(force=True) or {}
    file_path = data.get('file_path')
    dp        = DataProcessor(file_path) if file_path and os.path.exists(file_path) else agent.data_processor
    return jsonify({
        'columns':   dp.get_columns(),
        'dtypes':    dp.get_dtypes(),
        'stats':     dp.get_stats(),
        'row_count': len(dp.data),
    })


@app.errorhandler(413)
def file_too_large(e):
    return jsonify({'error': f'File too large. Maximum size is {MAX_UPLOAD_BYTES // (1024*1024)} MB'}), 413


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7860)