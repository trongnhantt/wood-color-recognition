"""
Flask API Backend for Wood Paint Quality Inspection System
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import cv2
import numpy as np
from skimage import color, morphology
from PIL import Image
import io
import json
import os
from datetime import datetime
import base64
import uuid
import traceback

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize SocketIO with proper async mode
socketio = SocketIO(
    app, 
    cors_allowed_origins="*", 
    async_mode='threading',  # Sử dụng threading mode để tránh lỗi
    ping_timeout=120, 
    ping_interval=25,
    logger=False,  # Tắt debug logs để giảm noise
    engineio_logger=False
)

# Đường dẫn lưu trữ
SAMPLE_LIBRARY_DIR = "sample_library"
SAMPLE_METADATA_FILE = os.path.join(SAMPLE_LIBRARY_DIR, "metadata.json")

# Dictionary để lưu sessions (laptop-phone sync)
active_sessions = {}

# ==================== SOCKETIO HANDLERS ====================

@socketio.on('connect')
def handle_connect():
    """Client kết nối"""
    print(f"🔌 Client connected: {request.sid}")
    emit('connection_response', {'status': 'connected', 'sid': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    """Client ngắt kết nối"""
    print(f"🔌 Client disconnected: {request.sid}")

@socketio.on('create_session')
def handle_create_session(data):
    """Laptop tạo session để nhận kết quả từ phone"""
    session_id = str(uuid.uuid4())[:8].upper()
    active_sessions[session_id] = {
        'laptop_sid': request.sid,
        'phone_sid': None,
        'created_at': datetime.now().isoformat(),
        'status': 'waiting'
    }
    join_room(session_id)
    print(f"📱 Session created: {session_id} by {request.sid}")
    emit('session_created', {'session_id': session_id})

@socketio.on('join_session')
def handle_join_session(data):
    """Phone join vào session"""
    session_id = data.get('session_id', '').upper()
    if session_id in active_sessions:
        active_sessions[session_id]['phone_sid'] = request.sid
        active_sessions[session_id]['status'] = 'connected'
        join_room(session_id)
        print(f"📱 Phone joined session: {session_id}")
        # Thông báo cho laptop
        emit('session_joined', {'status': 'success', 'session_id': session_id})
        emit('phone_connected', {'message': 'Điện thoại đã kết nối'}, room=session_id)
    else:
        emit('session_joined', {'status': 'error', 'message': 'Session không tồn tại'})

@socketio.on('leave_session')
def handle_leave_session(data):
    """Rời khỏi session"""
    session_id = data.get('session_id', '').upper()
    if session_id in active_sessions:
        leave_room(session_id)
        print(f"📱 Client left session: {session_id}")

# ==================== QUẢN LÝ THƯ VIỆN MẪU ====================

def init_sample_library():
    """Khởi tạo thư mục thư viện mẫu"""
    if not os.path.exists(SAMPLE_LIBRARY_DIR):
        os.makedirs(SAMPLE_LIBRARY_DIR)
    if not os.path.exists(SAMPLE_METADATA_FILE):
        with open(SAMPLE_METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f, ensure_ascii=False)

def load_sample_metadata():
    """Đọc metadata của các mẫu"""
    init_sample_library()
    try:
        with open(SAMPLE_METADATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

def save_sample_metadata(metadata):
    """Lưu metadata của các mẫu"""
    init_sample_library()
    with open(SAMPLE_METADATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

def add_sample_to_library(sample_name, sample_img, description="", category=""):
    """Thêm mẫu mới vào thư viện"""
    init_sample_library()
    metadata = load_sample_metadata()
    
    sample_id = f"sample_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    img_path = os.path.join(SAMPLE_LIBRARY_DIR, f"{sample_id}.jpg")
    img_pil = Image.fromarray(sample_img)
    img_pil.save(img_path, quality=95)
    
    metadata[sample_id] = {
        "name": sample_name,
        "description": description,
        "category": category,
        "image_path": img_path,
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    save_sample_metadata(metadata)
    
    return sample_id

def get_sample_from_library(sample_id):
    """Lấy ảnh mẫu từ thư viện"""
    metadata = load_sample_metadata()
    if sample_id in metadata:
        img_path = metadata[sample_id]["image_path"]
        if os.path.exists(img_path):
            img = Image.open(img_path)
            return np.array(img.convert('RGB'))
    return None

def delete_sample_from_library(sample_id):
    """Xóa mẫu khỏi thư viện"""
    metadata = load_sample_metadata()
    if sample_id in metadata:
        img_path = metadata[sample_id]["image_path"]
        if os.path.exists(img_path):
            os.remove(img_path)
        del metadata[sample_id]
        save_sample_metadata(metadata)
        return True
    return False

def update_sample_metadata_info(sample_id, name=None, description=None, category=None):
    """Cập nhật thông tin mẫu"""
    metadata = load_sample_metadata()
    if sample_id in metadata:
        if name:
            metadata[sample_id]["name"] = name
        if description is not None:
            metadata[sample_id]["description"] = description
        if category is not None:
            metadata[sample_id]["category"] = category
        save_sample_metadata(metadata)
        return True
    return False

# ==================== XỬ LÝ ẢNH ====================

def white_balance_geometric(img, strength=0.1):
    """White Balance nhẹ nhàng"""
    img_f = img.astype(np.float32)
    avg_r = np.mean(img_f[..., 0])
    avg_g = np.mean(img_f[..., 1])
    avg_b = np.mean(img_f[..., 2])
    gray = (avg_r * avg_g * avg_b) ** (1/3)

    scale_r = gray / avg_r if avg_r > 0 else 1.0
    scale_g = gray / avg_g if avg_g > 0 else 1.0
    scale_b = gray / avg_b if avg_b > 0 else 1.0

    scale_r = 1.0 + (scale_r - 1.0) * strength
    scale_g = 1.0 + (scale_g - 1.0) * strength
    scale_b = 1.0 + (scale_b - 1.0) * strength

    img_f[..., 0] = np.clip(img_f[..., 0] * scale_r, 0, 255)
    img_f[..., 1] = np.clip(img_f[..., 1] * scale_g, 0, 255)
    img_f[..., 2] = np.clip(img_f[..., 2] * scale_b, 0, 255)
    return img_f.astype(np.uint8)

def remove_edges(img, crop_percentage=0.15):
    """Cắt viền ảnh"""
    h, w = img.shape[:2]
    crop_h = int(h * crop_percentage)
    crop_w = int(w * crop_percentage)
    return img[crop_h:h-crop_h, crop_w:w-crop_w]

def remove_dark_spots_masked(img, threshold=60, min_size=500):
    """Loại bỏ mắt gỗ/vùng tối"""
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    mask = gray > threshold
    mask = morphology.remove_small_objects(mask, min_size=min_size)
    mask = morphology.closing(mask, morphology.disk(5)).astype(np.uint8)

    clean_img = img.copy()
    for c in range(3):
        median_val = np.median(img[..., c][mask == 1])
        clean_img[..., c][mask == 0] = median_val

    return clean_img, mask

def detect_seams(img):
    """Phát hiện và làm mờ đường ghép"""
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    closed = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    diff = cv2.absdiff(gray, closed)
    _, mask_seam = cv2.threshold(diff, 15, 255, cv2.THRESH_BINARY)
    mask_seam = cv2.dilate(mask_seam, np.ones((5, 5), np.uint8), iterations=1)
    
    img_no_seam = img.copy()
    median_color = [np.median(img[:, :, i]) for i in range(3)]
    img_no_seam[mask_seam > 0] = median_color
    return img_no_seam, mask_seam

def preprocess_image(img, crop_ratio=0.15, target_size=(400, 300)):
    """Pipeline xử lý ảnh"""
    img_cropped = remove_edges(img, crop_ratio)
    img_clean, _ = remove_dark_spots_masked(img_cropped)
    img_final, _ = detect_seams(img_clean)
    
    if target_size is not None:
        img_final = cv2.resize(img_final, target_size)
    
    return img_final

def histogram_matching_lab(source, reference, strength=0.15):
    """Histogram Matching trên LAB"""
    from skimage import exposure
    
    source_lab = color.rgb2lab(source / 255.0)
    reference_lab = color.rgb2lab(reference / 255.0)

    matched_lab = source_lab.copy()
    for i in range(3):
        matched_lab[..., i] = exposure.match_histograms(
            source_lab[..., i],
            reference_lab[..., i]
        )

    matched_rgb = np.clip(color.lab2rgb(matched_lab) * 255, 0, 255).astype(np.uint8)
    blended = cv2.addWeighted(source, 1 - strength, matched_rgb, strength, 0)
    return blended

def analyze_color_features(img_rgb):
    """Phân tích màu sắc LAB"""
    img_normalized = img_rgb / 255.0
    img_lab = color.rgb2lab(img_normalized)
    
    lab_features = {
        'mean_L': float(np.mean(img_lab[:, :, 0])),
        'mean_A': float(np.mean(img_lab[:, :, 1])),
        'mean_B': float(np.mean(img_lab[:, :, 2])),
        'std_L': float(np.std(img_lab[:, :, 0])),
        'std_A': float(np.std(img_lab[:, :, 1])),
        'std_B': float(np.std(img_lab[:, :, 2]))
    }
    
    return img_lab, lab_features

def delta_e2000(lab1, lab2):
    """Tính Delta E 2000"""
    lab1 = lab1.reshape(1, 1, 3)
    lab2 = lab2.reshape(1, 1, 3)
    return float(color.deltaE_ciede2000(lab1, lab2)[0, 0])

def mean_lab(img_lab):
    """Tính mean LAB"""
    L_mean = np.mean(img_lab[:, :, 0])
    A_mean = np.mean(img_lab[:, :, 1])
    B_mean = np.mean(img_lab[:, :, 2])
    return np.array([L_mean, A_mean, B_mean])

def process_and_compare(reference_img, test_img, threshold_excellent=1.5, threshold_acceptable=2.5, 
                       crop_ratio=0.15, wb_strength=0.1, match_strength=0.15):
    """Xử lý và so sánh 2 ảnh"""
    # Xử lý ảnh gốc
    ref_processed = preprocess_image(reference_img, crop_ratio=0.2)
    ref_wb = white_balance_geometric(ref_processed, strength=wb_strength)
    
    # Xử lý ảnh test
    test_processed = preprocess_image(test_img, crop_ratio=crop_ratio)
    test_wb = white_balance_geometric(test_processed, strength=wb_strength)
    test_matched = histogram_matching_lab(test_wb, ref_wb, strength=match_strength)
    
    # Phân tích màu
    ref_lab, ref_features = analyze_color_features(ref_wb)
    test_lab, test_features = analyze_color_features(test_matched)
    
    # Tính Delta E
    ref_mean = mean_lab(ref_lab)
    test_mean = mean_lab(test_lab)
    de_2000 = delta_e2000(ref_mean, test_mean)
    
    # Tính các component
    delta_L = float(abs(ref_mean[0] - test_mean[0]))
    delta_A = float(abs(ref_mean[1] - test_mean[1]))
    delta_B = float(abs(ref_mean[2] - test_mean[2]))
    
    # Xác định trạng thái
    if de_2000 < threshold_excellent:
        status = 'TUYỆT VỜI'
        status_emoji = '✅'
        color_code = '#4CAF50'
    elif de_2000 < threshold_acceptable:
        status = 'CHẤP NHẬN ĐƯỢC'
        status_emoji = '⚠️'
        color_code = '#FFC107'
    else:
        status = 'KHÔNG ĐẠT'
        status_emoji = '❌'
        color_code = '#F44336'
    
    return {
        'delta_e': de_2000,
        'delta_L': delta_L,
        'delta_A': delta_A,
        'delta_B': delta_B,
        'status': status,
        'status_emoji': status_emoji,
        'color_code': color_code,
        'ref_features': ref_features,
        'test_features': test_features
    }

def image_to_base64(img):
    """Convert numpy array to base64 string"""
    img_pil = Image.fromarray(img)
    buffered = io.BytesIO()
    img_pil.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode()

def base64_to_image(base64_str):
    """Convert base64 string to numpy array"""
    img_data = base64.b64decode(base64_str.split(',')[1] if ',' in base64_str else base64_str)
    img = Image.open(io.BytesIO(img_data))
    return np.array(img.convert('RGB'))

# ==================== API ENDPOINTS ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'API is running'})

@app.route('/api/library/samples', methods=['GET'])
def get_samples():
    """Lấy danh sách tất cả mẫu"""
    metadata = load_sample_metadata()
    samples = []
    for sample_id, info in metadata.items():
        img = get_sample_from_library(sample_id)
        if img is not None:
            samples.append({
                'id': sample_id,
                'name': info['name'],
                'description': info['description'],
                'category': info['category'],
                'created_at': info['created_at'],
                'image': image_to_base64(img)
            })
    return jsonify({'samples': samples})

@app.route('/api/library/samples', methods=['POST'])
def add_sample():
    """Thêm mẫu mới"""
    data = request.json
    img = base64_to_image(data['image'])
    
    sample_id = add_sample_to_library(
        sample_name=data['name'],
        sample_img=img,
        description=data.get('description', ''),
        category=data.get('category', '')
    )
    
    return jsonify({'success': True, 'sample_id': sample_id})

@app.route('/api/library/samples/<sample_id>', methods=['PUT'])
def update_sample(sample_id):
    """Cập nhật thông tin mẫu"""
    data = request.json
    success = update_sample_metadata_info(
        sample_id=sample_id,
        name=data.get('name'),
        description=data.get('description'),
        category=data.get('category')
    )
    return jsonify({'success': success})

@app.route('/api/library/samples/<sample_id>', methods=['DELETE'])
def delete_sample(sample_id):
    """Xóa mẫu"""
    success = delete_sample_from_library(sample_id)
    return jsonify({'success': success})

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Phân tích chất lượng màu sơn"""
    session_id = None
    try:
        data = request.json
        session_id = data.get('session_id', '').upper() if data.get('session_id') else None
        
        print("=" * 60)
        print("📊 BẮT ĐẦU PHÂN TÍCH CHẤT LƯỢNG MÀU SƠN")
        print("=" * 60)
        
        if session_id:
            print(f"📱 Session ID: {session_id}")
            if session_id in active_sessions:
                socketio.emit('analysis_started', {
                    'message': 'Đang phân tích màu sắc...',
                    'timestamp': datetime.now().isoformat()
                }, room=session_id)
        
        # Lấy ảnh reference
        if 'reference_sample_id' in data:
            print(f"📁 Sử dụng mẫu từ thư viện: {data['reference_sample_id']}")
            reference_img = get_sample_from_library(data['reference_sample_id'])
            if reference_img is None:
                print("❌ Không tìm thấy mẫu trong thư viện!")
                return jsonify({'error': 'Sample not found'}), 404
        else:
            print("📤 Sử dụng ảnh upload từ client")
            try:
                reference_img = base64_to_image(data['reference_image'])
                print(f"   ✅ Ảnh reference: {reference_img.shape}")
            except Exception as e:
                print(f"   ❌ Lỗi decode ảnh reference: {str(e)}")
                return jsonify({'error': f'Invalid reference image: {str(e)}'}), 400
        
        # Lấy thông số
        threshold_excellent = data.get('threshold_excellent', 1.5)
        threshold_acceptable = data.get('threshold_acceptable', 2.5)
        
        print(f"⚙️  Ngưỡng tuyệt vời: {threshold_excellent}")
        print(f"⚙️  Ngưỡng chấp nhận: {threshold_acceptable}")
        
        # Xử lý nhiều ảnh test
        test_images = data['test_images']
        print(f"📷 Số lượng ảnh test: {len(test_images)}")
        results = []
        
        for idx, test_data in enumerate(test_images):
            try:
                print(f"\n🔍 Xử lý ảnh {idx + 1}/{len(test_images)}: {test_data.get('filename', 'unknown')}")
                
                # Broadcast progress to session
                if session_id and session_id in active_sessions:
                    socketio.emit('analysis_progress', {
                        'current': idx + 1,
                        'total': len(test_images),
                        'filename': test_data.get('filename', 'unknown'),
                        'message': f'Đang xử lý ảnh {idx + 1}/{len(test_images)}...'
                    }, room=session_id)
                
                test_img = base64_to_image(test_data['image'])
                print(f"   ✅ Kích thước: {test_img.shape}")
                
                result = process_and_compare(
                    reference_img, test_img,
                    threshold_excellent=threshold_excellent,
                    threshold_acceptable=threshold_acceptable
                )
                result['filename'] = test_data.get('filename', 'unknown')
                results.append(result)
                
                print(f"   ✅ Delta E: {result['delta_e']:.2f} - {result['status']}")
            except Exception as e:
                print(f"   ❌ Lỗi xử lý ảnh {idx + 1}: {str(e)}")
                traceback.print_exc()
                
                if session_id and session_id in active_sessions:
                    socketio.emit('analysis_error', {
                        'error': f'Lỗi xử lý ảnh {idx + 1}: {str(e)}'
                    }, room=session_id)
                
                return jsonify({'error': f'Error processing image {idx + 1}: {str(e)}'}), 500
        
        # Tính thống kê
        delta_e_values = [r['delta_e'] for r in results]
        stats = {
            'total': len(results),
            'excellent': sum(1 for r in results if r['status'] == 'TUYỆT VỜI'),
            'acceptable': sum(1 for r in results if r['status'] == 'CHẤP NHẬN ĐƯỢC'),
            'poor': sum(1 for r in results if r['status'] == 'KHÔNG ĐẠT'),
            'avg_delta_e': float(np.mean(delta_e_values)),
            'min_delta_e': float(np.min(delta_e_values)),
            'max_delta_e': float(np.max(delta_e_values))
        }
        
        print("\n" + "=" * 60)
        print("✅ PHÂN TÍCH HOÀN TẤT!")
        print(f"   📊 Tổng: {stats['total']} | ✅ {stats['excellent']} | ⚠️ {stats['acceptable']} | ❌ {stats['poor']}")
        print(f"   📈 Trung bình ΔE: {stats['avg_delta_e']:.2f}")
        print("=" * 60 + "\n")
        
        response_data = {
            'results': results,
            'stats': stats
        }
        
        # Broadcast kết quả đến session (laptop) - KÈM HÌNH ẢNH
        if session_id and session_id in active_sessions:
            print(f"📤 Broadcasting result to session: {session_id}")
            
            # Chuyển reference image sang base64
            reference_img_base64 = image_to_base64(reference_img)
            
            # Chuyển test images sang base64
            test_images_with_base64 = []
            for test_data in test_images:
                test_img = base64_to_image(test_data['image'])
                test_images_with_base64.append({
                    'filename': test_data.get('filename', 'unknown'),
                    'image': image_to_base64(test_img)
                })
            
            socketio.emit('new_result', {
                'results': results,
                'stats': stats,
                'reference_image': reference_img_base64,  # Thêm ảnh reference
                'test_images': test_images_with_base64,   # Thêm ảnh test
                'timestamp': datetime.now().isoformat()
            }, room=session_id)
        
        return jsonify(response_data)
    
    except KeyError as e:
        print(f"❌ Missing required field: {str(e)}")
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

if __name__ == '__main__':
    init_sample_library()
    print("\n" + "=" * 63)
    print("🚀 ═══════════════════════════════════════════════════════════")
    print("🌟   Wood Paint Quality Checker - Backend Server")
    print("🌟   Powered by Flask + SocketIO + Delta E 2000 Analysis")
    print("═══════════════════════════════════════════════════════════")
    print(f"� Backend API:     http://0.0.0.0:5001/api")
    print(f"🔌 WebSocket:       ws://0.0.0.0:5001")
    print(f"🌐 Network Access:  http://192.168.1.5:5001")
    print("═══════════════════════════════════════════════════════════")
    print("💡 Async Mode:      threading")
    print("💡 CORS:            Enabled for all origins")
    print("=" * 63 + "\n")
    
    socketio.run(
        app, 
        host='0.0.0.0', 
        port=5001, 
        debug=True, 
        use_reloader=False,  # Tắt reloader để tránh conflict với threading
        allow_unsafe_werkzeug=True
    )
