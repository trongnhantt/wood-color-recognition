# 🎨 Wood Paint Quality Checker - Hệ Thống Kiểm Tra Chất Lượng Sơn Gỗ

Hệ thống kiểm tra chất lượng sơn gỗ sử dụng phân tích màu sắc với Delta E 2000 và đồng bộ real-time giữa máy tính và điện thoại.

---

## 🚀 Hướng Dẫn Cài Đặt và Chạy

### Bước 1: Cài Đặt Backend (Python/Flask)

```bash
# Di chuyển vào thư mục backend
cd backend

#Tạo môi trường ảo
python -m venv .venv

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

### Bước 2: Cài Đặt Frontend (React)

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt các dependencies
npm install socket.io-client@4.8.1 qrcode --legacy-peer-deps

# ⚠️ NẾU GẶP LỖI "react-scripts: command not found":
# Chạy lệnh sau để sửa lỗi:
npm audit fix --force
# Hoặc cài đặt lại react-scripts:
npm install react-scripts --save --legacy-peer-deps
```

**Lưu ý về lỗi cài đặt Frontend:**
- Nếu `npm install` báo lỗi về peer dependencies, sử dụng flag `--legacy-peer-deps`
- Nếu sau khi cài xong mà chạy `npm start` báo lỗi `react-scripts: command not found`, hãy chạy:
  ```bash
  npm audit fix --force
  ```
  hoặc
  ```bash
  npm install react-scripts --save --legacy-peer-deps
  ```

### Bước 3: Khởi Chạy Hệ Thống

#### Terminal 1 - Khởi động Backend Server

```bash
cd backend

#Để kích hoạt venv trên Windows
.\.venv\Scripts\activate

#Note: Với MacOS hoặc Linux bạn dùng lệnh
source .venv/bin/activate

python app.py
```

**Kiểm tra output thành công:**
```
🚀 ═══════════════════════════════════════════════════════════
🌟   Wood Paint Quality Checker - Backend Server
🌟   Powered by Flask + SocketIO + Delta E 2000 Analysis
═══════════════════════════════════════════════════════════
📡 Backend API:     http://0.0.0.0:5001/api
🔌 WebSocket:       ws://0.0.0.0:5001
🌐 Network Access:  http://192.168.x.x:5001
═══════════════════════════════════════════════════════════
```

**⚠️ QUAN TRỌNG:** Ghi nhớ địa chỉ IP hiển thị ở dòng "Network Access" (ví dụ: `192.168.x.x`)

#### Terminal 2 - Khởi động Frontend

```bash
cd frontend
npm start
```

**Kiểm tra output thành công:**
```
Compiled successfully!

Local:            http://localhost:3000
On Your Network:  http://192.168.x.x:3000
```

**⚠️ QUAN TRỌNG:** Ghi nhớ địa chỉ IP hiển thị ở dòng "On Your Network"

---

## 🎮 Hướng Dẫn Sử Dụng

### Chế Độ 1: Đồng Bộ Laptop - Phone (Real-Time Sync)

#### Trên Laptop:
1. Mở `http://192.168.x.x:3000` (hoặc localhost:3000)
2. Click nút **💻 Laptop Mode**
3. Màn hình sẽ hiển thị mã session (ví dụ: `AB12CD34`)
4. Giữ màn hình laptop mở

#### Trên Điện Thoại:
1. Mở `http://192.168.x.x:3000`
2. Click nút **📱 Phone Mode**
3. Nhập mã session `AB12CD34` → Click **Kết Nối**
4. Upload/chụp ảnh mẫu gốc
5. Upload/chụp ảnh sản phẩm cần kiểm tra
6. Click **Phân Tích Chất Lượng**
7. ✨ Kết quả sẽ tự động hiển thị trên laptop real-time!

### Chế Độ 2: Standalone (Sử Dụng Độc Lập)

1. Mở ứng dụng trên bất kỳ thiết bị nào
2. Click **Bỏ Qua** ở màn hình chọn chế độ
3. Upload/chụp ảnh và xem kết quả ngay trên thiết bị đó

---