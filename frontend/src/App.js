import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Button,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Paper,
  Alert,
  AlertTitle
} from '@mui/material';
import {
  CloudUpload,
  PhotoLibrary,
  Add,
  Edit,
  Delete,
  CheckCircle,
  Warning,
  Cancel,
  Assessment,
  Smartphone,
  Laptop
} from '@mui/icons-material';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import './App.css';

// Tự động detect API URL
// Nếu truy cập từ localhost → dùng localhost
// Nếu truy cập từ IP (điện thoại) → dùng IP đó
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  
  // Nếu đang ở localhost/127.0.0.1, dùng localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5001/api';
  }
  
  // Nếu đang ở IP (ví dụ: 192.168.1.5), dùng IP đó
  return `http://${hostname}:5001/api`;
};

const API_BASE_URL = getApiBaseUrl();
const SOCKET_URL = API_BASE_URL.replace('/api', '');

console.log('🌐 API Base URL:', API_BASE_URL);
console.log('🔌 Socket URL:', SOCKET_URL);

const CATEGORIES = [
  'Gỗ sồi',
  'Gỗ thông',
  'Gỗ óc chó',
  'Màu tùy chỉnh',
  'Khác'
];

const COLORS = {
  excellent: '#4CAF50',
  acceptable: '#FFC107',
  poor: '#F44336'
};

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [testImages, setTestImages] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [thresholdExcellent, setThresholdExcellent] = useState(1.5);
  const [thresholdAcceptable, setThresholdAcceptable] = useState(2.5);
  
  // Socket.IO states
  const [socket, setSocket] = useState(null);
  const [displayMode, setDisplayMode] = useState(null); // null, 'phone', 'laptop'
  const [sessionId, setSessionId] = useState(null);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [sessionInput, setSessionInput] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // Dialog states
  const [openAddSample, setOpenAddSample] = useState(false);
  const [openEditSample, setOpenEditSample] = useState(false);
  const [sampleForm, setSampleForm] = useState({
    name: '',
    category: '',
    description: '',
    image: null
  });

  // Load samples
  useEffect(() => {
    loadSamples();
  }, []);

  // Initialize Socket.IO
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to server:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
    });

    newSocket.on('session_created', (data) => {
      console.log('📱 Session created:', data.session_id);
      setSessionId(data.session_id);
      // Generate QR code
      QRCode.toDataURL(`${window.location.origin}?session=${data.session_id}`, {
        width: 200,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      }).then(url => setQrCodeUrl(url));
    });

    newSocket.on('session_joined', (data) => {
      if (data.status === 'success') {
        console.log('📱 Joined session successfully');
        setSessionId(data.session_id);
      } else {
        alert(data.message || 'Không thể kết nối session');
        setSessionInput('');
      }
    });

    newSocket.on('phone_connected', (data) => {
      console.log('📱 Phone connected:', data);
      setPhoneConnected(true);
    });

    newSocket.on('analysis_started', (data) => {
      console.log('📊 Analysis started:', data.message);
      setLoading(true);
      setLoadingMessage(data.message);
    });

    newSocket.on('analysis_progress', (data) => {
      console.log('📊 Progress:', data);
      setLoadingMessage(`${data.message} (${data.current}/${data.total})`);
    });

    newSocket.on('new_result', (data) => {
      console.log('📊 Received result:', data);
      setResults(data);
      
      // Lưu hình ảnh nếu có (từ phone)
      if (data.reference_image) {
        setReferenceImage(`data:image/jpeg;base64,${data.reference_image}`);
      }
      if (data.test_images && data.test_images.length > 0) {
        setTestImages(data.test_images.map(img => ({
          filename: img.filename,
          image: `data:image/jpeg;base64,${img.image}`
        })));
      }
      
      setLoading(false);
      setLoadingMessage('');
    });

    newSocket.on('analysis_error', (data) => {
      console.error('❌ Analysis error:', data);
      alert(data.error);
      setLoading(false);
      setLoadingMessage('');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const loadSamples = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/library/samples`);
      setSamples(response.data.samples);
    } catch (error) {
      console.error('Error loading samples:', error);
    }
  };

  // Session handlers
  const handleCreateSession = () => {
    if (socket) {
      socket.emit('create_session', {});
      setDisplayMode('laptop');
      setResults(null);
    }
  };

  const handleJoinSession = () => {
    if (socket && sessionInput) {
      socket.emit('join_session', { session_id: sessionInput.toUpperCase() });
      setDisplayMode('phone');
    }
  };

  const handleSkipSession = () => {
    setDisplayMode('phone');
    setSessionId(null);
  };

  // Hàm resize ảnh để giảm kích thước
  const resizeImage = (file, maxWidth = 800, maxHeight = 800) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Tính toán kích thước mới giữ tỷ lệ
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Chuyển về base64 với chất lượng 0.85
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleReferenceUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        // Hiển thị loading
        setLoading(true);
        setLoadingMessage('Đang xử lý ảnh mẫu gốc...');
        const resizedImage = await resizeImage(file, 1200, 1200);
        setReferenceImage(resizedImage);
        setSelectedSample(null);
        setLoadingMessage('');
      } catch (error) {
        console.error('Error processing image:', error);
        alert('Lỗi khi xử lý ảnh. Vui lòng thử lại!');
        setLoadingMessage('');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTestUpload = async (event) => {
    const files = Array.from(event.target.files);
    
    if (files.length === 0) return;

    try {
      // Hiển thị loading
      setLoading(true);
      setLoadingMessage(`Đang xử lý ${files.length} ảnh sản phẩm...`);
      
      const imagePromises = files.map(async (file, index) => {
        setLoadingMessage(`Đang xử lý ảnh ${index + 1}/${files.length}...`);
        const resizedImage = await resizeImage(file, 1200, 1200);
        return {
          filename: file.name,
          image: resizedImage
        };
      });

      const images = await Promise.all(imagePromises);
      setTestImages(images);
      
      // Hiển thị thông báo thành công
      console.log(`✅ Đã xử lý ${images.length} ảnh thành công`);
      setLoadingMessage('');
    } catch (error) {
      console.error('Error processing images:', error);
      alert('Lỗi khi xử lý ảnh. Vui lòng thử lại!');
      setLoadingMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSample = (sample) => {
    setSelectedSample(sample);
    setReferenceImage(`data:image/jpeg;base64,${sample.image}`);
  };

  const handleAnalyze = async () => {
    if (!referenceImage || testImages.length === 0) {
      alert('Vui lòng chọn ảnh mẫu và ít nhất 1 ảnh sản phẩm!');
      return;
    }

    setLoading(true);
    setLoadingMessage('Đang phân tích màu sắc...');
    
    try {
      const requestData = {
        threshold_excellent: thresholdExcellent,
        threshold_acceptable: thresholdAcceptable,
        test_images: testImages,
        session_id: sessionId || undefined
      };

      if (selectedSample) {
        requestData.reference_sample_id = selectedSample.id;
      } else {
        requestData.reference_image = referenceImage;
      }

      console.log('📤 Đang gửi request phân tích...');
      console.log(`   - Số lượng ảnh test: ${testImages.length}`);
      console.log(`   - Ngưỡng tuyệt vời: ${thresholdExcellent}`);
      console.log(`   - Ngưỡng chấp nhận: ${thresholdAcceptable}`);

      const response = await axios.post(`${API_BASE_URL}/analyze`, requestData, {
        timeout: 120000, // 2 phút timeout
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('✅ Phân tích thành công!');
      
      // Nếu không có session (standalone), set results local
      if (!sessionId) {
        setResults(response.data);
      }
      // Nếu có session, kết quả đã được broadcast qua socket
      
      setLoadingMessage('');
    } catch (error) {
      console.error('❌ Error analyzing:', error);
      
      let errorMessage = 'Có lỗi xảy ra khi phân tích!';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Timeout! Quá trình phân tích mất quá nhiều thời gian. Hãy thử giảm số lượng ảnh hoặc kích thước ảnh.';
      } else if (error.response) {
        // Server responded with error
        errorMessage = `Lỗi từ server: ${error.response.data?.error || error.response.statusText}`;
        console.error('Server error details:', error.response.data);
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra:\n' +
                      '1. Backend có đang chạy không? (http://localhost:5001)\n' +
                      '2. Kiểm tra kết nối mạng';
      }
      
      alert(errorMessage);
      setLoadingMessage('');
    } finally {
      if (!sessionId) {
        setLoading(false);
      }
    }
  };

  const handleAddSample = async () => {
    try {
      await axios.post(`${API_BASE_URL}/library/samples`, sampleForm);
      setOpenAddSample(false);
      setSampleForm({ name: '', category: '', description: '', image: null });
      loadSamples();
    } catch (error) {
      console.error('Error adding sample:', error);
    }
  };

  const handleUpdateSample = async () => {
    try {
      await axios.put(`${API_BASE_URL}/library/samples/${sampleForm.id}`, {
        name: sampleForm.name,
        category: sampleForm.category,
        description: sampleForm.description
      });
      setOpenEditSample(false);
      setSampleForm({ name: '', category: '', description: '', image: null });
      loadSamples();
    } catch (error) {
      console.error('Error updating sample:', error);
    }
  };

  const handleDeleteSample = async (sampleId) => {
    if (window.confirm('Bạn có chắc muốn xóa mẫu này?')) {
      try {
        await axios.delete(`${API_BASE_URL}/library/samples/${sampleId}`);
        loadSamples();
      } catch (error) {
        console.error('Error deleting sample:', error);
      }
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'TUYỆT VỜI') return <CheckCircle sx={{ color: COLORS.excellent }} />;
    if (status === 'CHẤP NHẬN ĐƯỢC') return <Warning sx={{ color: COLORS.acceptable }} />;
    return <Cancel sx={{ color: COLORS.poor }} />;
  };

  const renderLibraryTab = () => (
    <Box sx={{ p: 2 }} className="fade-in">
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 4,
        p: 3,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
      }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#333' }}>
          📚 Thư Viện Mẫu Gốc
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenAddSample(true)}
          sx={{ 
            px: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)'
          }}
        >
          Thêm Mẫu Mới
        </Button>
      </Box>

      <div className="library-grid">
        {samples.map((sample) => (
          <div key={sample.id} className="library-item">
            <img
              className="library-item-image"
              src={`data:image/jpeg;base64,${sample.image}`}
              alt={sample.name}
            />
            <div className="library-item-content">
              <Typography className="library-item-title">
                {sample.name}
              </Typography>
              <Chip 
                label={sample.category} 
                size="small" 
                sx={{ 
                  mb: 1,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontWeight: 600
                }} 
              />
              <Typography className="library-item-desc">
                {sample.description}
              </Typography>
              <Typography variant="caption" sx={{ color: '#999', display: 'block', mb: 2 }}>
                📅 {sample.created_at}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => {
                    setSampleForm(sample);
                    setOpenEditSample(true);
                  }}
                  sx={{ flex: 1 }}
                >
                  Sửa
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={() => handleDeleteSample(sample.id)}
                  sx={{ flex: 1 }}
                >
                  Xóa
                </Button>
              </Box>
            </div>
          </div>
        ))}
      </div>
      
      {samples.length === 0 && (
        <Box sx={{ 
          textAlign: 'center', 
          p: 8,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px'
        }}>
          <Typography variant="h6" sx={{ color: '#999' }}>
            📭 Chưa có mẫu nào
          </Typography>
          <Typography variant="body2" sx={{ color: '#999', mt: 1 }}>
            Nhấn "Thêm Mẫu Mới" để bắt đầu
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderInspectionTab = () => (
    <Box className="fade-in">
      {/* Dashboard Cards */}
      {results && (
        <div className="dashboard-grid">
          <div className="dashboard-card card-blue">
            <div className="card-icon icon-blue">📊</div>
            <div className="card-title">Tổng số mẫu</div>
            <div className="card-value">{results.stats.total}</div>
            <div className="card-description">Đã phân tích trong lần này</div>
          </div>
          
          <div className="dashboard-card card-green">
            <div className="card-icon icon-green">✅</div>
            <div className="card-title">Tuyệt vời</div>
            <div className="card-value">{results.stats.excellent}</div>
            <div className="card-description">Delta E &lt; {thresholdExcellent}</div>
            <span className="card-badge badge-green">Chất lượng cao</span>
          </div>
          
          <div className="dashboard-card card-orange">
            <div className="card-icon icon-orange">⚠️</div>
            <div className="card-title">Chấp nhận được</div>
            <div className="card-value">{results.stats.acceptable}</div>
            <div className="card-description">Delta E &lt; {thresholdAcceptable}</div>
            <span className="card-badge badge-orange">Cần theo dõi</span>
          </div>
          
          <div className="dashboard-card card-red">
            <div className="card-icon icon-red">❌</div>
            <div className="card-title">Không đạt</div>
            <div className="card-value">{results.stats.poor}</div>
            <div className="card-description">Delta E ≥ {thresholdAcceptable}</div>
            <span className="card-badge badge-red">Cần xử lý</span>
          </div>
        </div>
      )}

      {/* Thresholds */}
      <Box className="content-section" sx={{ mb: 3 }}>
        <Typography className="section-title">
          ⚙️ Cấu hình ngưỡng đánh giá
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom sx={{ fontWeight: 500, color: '#2e7d32' }}>
              ✅ Tuyệt vời (&lt; {thresholdExcellent})
            </Typography>
            <Slider
              value={thresholdExcellent}
              onChange={(e, value) => setThresholdExcellent(value)}
              min={0.5}
              max={3.0}
              step={0.1}
              valueLabelDisplay="auto"
              sx={{ color: '#2e7d32' }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom sx={{ fontWeight: 500, color: '#ed6c02' }}>
              ⚠️ Chấp nhận (&lt; {thresholdAcceptable})
            </Typography>
            <Slider
              value={thresholdAcceptable}
              onChange={(e, value) => setThresholdAcceptable(value)}
              min={thresholdExcellent}
              max={5.0}
              step={0.1}
              valueLabelDisplay="auto"
              sx={{ color: '#ed6c02' }}
            />
          </Grid>
        </Grid>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Reference Image */}
        <Grid item xs={12} md={6}>
          <Box className="content-section">
            <Typography className="section-title">
              📷 1. Ảnh Mẫu Gốc
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={1} sx={{ mb: 1 }}>
                <Grid item xs={6}>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<CloudUpload />}
                    fullWidth
                  >
                    Upload Ảnh
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handleReferenceUpload}
                    />
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    variant="contained"
                    component="label"
                    startIcon={<PhotoLibrary />}
                    fullWidth
                    color="primary"
                  >
                    📸 Chụp Ảnh
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      capture="environment"
                      onChange={handleReferenceUpload}
                    />
                  </Button>
                </Grid>
              </Grid>
              
              <FormControl fullWidth>
                <InputLabel>Hoặc chọn từ thư viện</InputLabel>
                <Select
                  value={selectedSample?.id || ''}
                  onChange={(e) => {
                    const sample = samples.find(s => s.id === e.target.value);
                    if (sample) handleSelectSample(sample);
                  }}
                >
                  {samples.map((sample) => (
                    <MenuItem key={sample.id} value={sample.id}>
                      {sample.name} ({sample.category})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {referenceImage && (
              <div className="single-image-preview">
                <img
                  src={referenceImage}
                  alt="Reference"
                />
                {selectedSample && (
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Chip label={selectedSample.category} color="primary" size="small" />
                    <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.9)' }}>
                      {selectedSample.description}
                    </Typography>
                  </Box>
                )}
              </div>
            )}
          </Box>
        </Grid>

        {/* Test Images */}
        <Grid item xs={12} md={6}>
          <Box className="content-section">
            <Typography className="section-title">
              📷 2. Ảnh Sản Phẩm Kiểm Tra
            </Typography>
            
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoLibrary />}
                  fullWidth
                >
                  Chọn Ảnh
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    onChange={handleTestUpload}
                  />
                </Button>
              </Grid>
              <Grid item xs={6}>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={<PhotoLibrary />}
                  fullWidth
                  color="success"
                >
                  📸 Chụp Ảnh
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    capture="environment"
                    onChange={handleTestUpload}
                  />
                </Button>
              </Grid>
            </Grid>

            {testImages.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
                  ✅ Đã chọn {testImages.length} ảnh
                </Typography>
                <div className="image-preview-container">
                  {testImages.map((img, idx) => (
                    <div key={idx} className="image-preview-item">
                      <img
                        src={img.image}
                        alt={img.filename}
                      />
                      <div className="image-preview-overlay">
                        {img.filename}
                      </div>
                      <div className="image-preview-badge">
                        #{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Analyze Button */}
      <Box sx={{ textAlign: 'center', my: 4 }}>
        <Button
          variant="contained"
          size="large"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Assessment />}
          onClick={handleAnalyze}
          disabled={loading || !referenceImage || testImages.length === 0}
          sx={{ 
            px: 8, 
            py: 2.5,
            fontSize: '1.05rem',
            fontWeight: 700,
            background: '#1976d2',
            '&:hover': {
              background: '#1565c0'
            }
          }}
        >
          {loading ? (loadingMessage || 'Đang xử lý...') : 'Phân Tích Chất Lượng'}
        </Button>
        {loading && loadingMessage && (
          <Typography variant="body2" sx={{ mt: 2, color: '#1976d2', fontWeight: 500 }}>
            {loadingMessage}
          </Typography>
        )}
      </Box>

      {/* Results */}
      {results && (
        <Box className="content-section fade-in">
          <Typography className="section-title">
            📊 Kết Quả Phân Tích Chi Tiết
          </Typography>

          {/* Comparison Images */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1976d2' }}>
                  📷 Ảnh Mẫu Gốc
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#f8f9fa', 
                  borderRadius: '8px',
                  border: '2px solid #1976d2'
                }}>
                  <img
                    src={referenceImage}
                    alt="Reference"
                    style={{ 
                      width: '100%', 
                      maxHeight: '250px',
                      objectFit: 'contain',
                      borderRadius: '6px'
                    }}
                  />
                </Box>
                <Chip 
                  label="Chuẩn so sánh" 
                  color="primary" 
                  sx={{ mt: 2, fontWeight: 600 }}
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#2e7d32' }}>
                  ✅ Ảnh Tốt Nhất
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#e8f5e9', 
                  borderRadius: '8px',
                  border: '2px solid #2e7d32'
                }}>
                  {(() => {
                    const best = results.results.reduce((min, r) => r.delta_e < min.delta_e ? r : min);
                    return (
                      <>
                        <img
                          src={testImages.find(img => img.filename === best.filename)?.image}
                          alt="Best"
                          style={{ 
                            width: '100%', 
                            maxHeight: '250px',
                            objectFit: 'contain',
                            borderRadius: '6px'
                          }}
                        />
                        <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>
                          {best.filename}
                        </Typography>
                        <Chip 
                          label={`ΔE: ${best.delta_e.toFixed(2)}`}
                          size="small"
                          sx={{ 
                            mt: 1, 
                            bgcolor: '#2e7d32', 
                            color: 'white',
                            fontWeight: 700
                          }}
                        />
                      </>
                    );
                  })()}
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#d32f2f' }}>
                  ❌ Ảnh Kém Nhất
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: '#ffebee', 
                  borderRadius: '8px',
                  border: '2px solid #d32f2f'
                }}>
                  {(() => {
                    const worst = results.results.reduce((max, r) => r.delta_e > max.delta_e ? r : max);
                    return (
                      <>
                        <img
                          src={testImages.find(img => img.filename === worst.filename)?.image}
                          alt="Worst"
                          style={{ 
                            width: '100%', 
                            maxHeight: '250px',
                            objectFit: 'contain',
                            borderRadius: '6px'
                          }}
                        />
                        <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>
                          {worst.filename}
                        </Typography>
                        <Chip 
                          label={`ΔE: ${worst.delta_e.toFixed(2)}`}
                          size="small"
                          sx={{ 
                            mt: 1, 
                            bgcolor: '#d32f2f', 
                            color: 'white',
                            fontWeight: 700
                          }}
                        />
                      </>
                    );
                  })()}
                </Box>
              </Box>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#2c3e50' }}>
                📊 So Sánh Delta E 2000 Với Mẫu Gốc
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={results.results.map((r, i) => ({
                  name: `SP${i + 1}`,
                  deltaE: r.delta_e,
                  fill: r.delta_e < thresholdExcellent ? '#2e7d32' : 
                        r.delta_e < thresholdAcceptable ? '#ed6c02' : '#d32f2f'
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: 'Delta E 2000', angle: -90, position: 'insideLeft' }}
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #ddd',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="deltaE" radius={[8, 8, 0, 0]}>
                    {results.results.map((r, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={r.delta_e < thresholdExcellent ? '#2e7d32' : 
                              r.delta_e < thresholdAcceptable ? '#ed6c02' : '#d32f2f'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#2c3e50' }}>
                🎨 So Sánh Các Thành Phần Màu LAB
              </Typography>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={results.results.map((r, i) => ({
                  name: `SP${i + 1}`,
                  'ΔL*': Math.abs(r.delta_L),
                  'Δa*': Math.abs(r.delta_A),
                  'Δb*': Math.abs(r.delta_B)
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <YAxis 
                    label={{ value: 'Độ lệch màu', angle: -90, position: 'insideLeft' }}
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #ddd',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="ΔL*" fill="#607d8b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Δa*" fill="#e91e63" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Δb*" fill="#ffc107" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 2 }}>
                <Chip 
                  label="ΔL* (Độ sáng)" 
                  size="small" 
                  sx={{ bgcolor: '#607d8b', color: 'white', fontWeight: 600 }}
                />
                <Chip 
                  label="Δa* (Đỏ-Xanh lá)" 
                  size="small" 
                  sx={{ bgcolor: '#e91e63', color: 'white', fontWeight: 600 }}
                />
                <Chip 
                  label="Δb* (Vàng-Xanh dương)" 
                  size="small" 
                  sx={{ bgcolor: '#ffc107', color: 'white', fontWeight: 600 }}
                />
              </Box>
            </Grid>
          </Grid>

          {/* Results Table */}
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: '#2c3e50', mt: 4 }}>
            📋 Bảng Chi Tiết Kết Quả
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>STT</TableCell>
                  <TableCell>Tên file</TableCell>
                  <TableCell align="center">ΔE 2000</TableCell>
                  <TableCell align="center">ΔL*</TableCell>
                  <TableCell align="center">Δa*</TableCell>
                  <TableCell align="center">Δb*</TableCell>
                  <TableCell align="center">Kết quả</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.results.map((result, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{result.filename}</TableCell>
                    <TableCell align="center">
                      <strong>{result.delta_e.toFixed(2)}</strong>
                    </TableCell>
                    <TableCell align="center">{result.delta_L.toFixed(2)}</TableCell>
                    <TableCell align="center">{result.delta_A.toFixed(2)}</TableCell>
                    <TableCell align="center">{result.delta_B.toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <span className={`status-badge status-${
                        result.delta_e < thresholdExcellent ? 'excellent' :
                        result.delta_e < thresholdAcceptable ? 'acceptable' : 'poor'
                      }`}>
                        {getStatusIcon(result.status)}
                        {result.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );

  // Render mode selection
  if (!displayMode) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 3 }}>
            🎨 Wood Color Quality Checker
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Chọn chế độ sử dụng:
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<Smartphone />}
                onClick={handleSkipSession}
                sx={{ 
                  py: 3,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  fontSize: '1.1rem'
                }}
              >
                📱 Điện Thoại
                <Typography variant="caption" display="block" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                  Chụp ảnh và phân tích
                </Typography>
              </Button>
            </Grid>
            
            <Grid item xs={12}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={<Laptop />}
                onClick={handleCreateSession}
                sx={{ 
                  py: 3,
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  fontSize: '1.1rem'
                }}
              >
                💻 Laptop
                <Typography variant="caption" display="block" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                  Hiển thị kết quả cho khách hàng
                </Typography>
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    );
  }

  // Render laptop display mode
  if (displayMode === 'laptop') {
    return (
      <Box className="App">
        <Box className="dashboard-header">
          <Container maxWidth="xl">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography className="dashboard-welcome">
                  💻 Màn Hình Hiển Thị (Laptop)
                </Typography>
                <Typography className="dashboard-subtitle">
                  Kết quả sẽ hiển thị real-time từ điện thoại
                </Typography>
              </Box>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => {
                  setDisplayMode(null);
                  setSessionId(null);
                  setPhoneConnected(false);
                  setResults(null);
                }}
              >
                Đổi Chế Độ
              </Button>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="xl" sx={{ mt: 3 }}>
          {sessionId && (
            <Alert 
              severity={phoneConnected ? "success" : "warning"} 
              sx={{ mb: 3, p: 3 }}
            >
              <AlertTitle sx={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {phoneConnected ? '✅ Điện Thoại Đã Kết Nối!' : '⏳ Đang Chờ Điện Thoại Kết Nối'}
              </AlertTitle>
              
              <Box sx={{ my: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Nhập mã này trên điện thoại:
                </Typography>
                <Box sx={{ 
                  bgcolor: 'background.paper', 
                  p: 2, 
                  borderRadius: 2, 
                  display: 'inline-block',
                  border: '2px solid',
                  borderColor: phoneConnected ? 'success.main' : 'warning.main'
                }}>
                  <Typography 
                    variant="h3" 
                    sx={{ 
                      fontFamily: 'monospace', 
                      letterSpacing: '0.1em',
                      fontWeight: 700,
                      color: phoneConnected ? 'success.main' : 'warning.main'
                    }}
                  >
                    {sessionId}
                  </Typography>
                </Box>
              </Box>

              {qrCodeUrl && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography variant="body2" gutterBottom>
                    Hoặc quét QR Code:
                  </Typography>
                  <Box sx={{ display: 'inline-block', bgcolor: 'white', p: 2, borderRadius: 2 }}>
                    <img src={qrCodeUrl} alt="QR Code" style={{ width: 150, height: 150 }} />
                  </Box>
                </Box>
              )}
            </Alert>
          )}

          {loading && (
            <Box sx={{ textAlign: 'center', my: 8 }}>
              <CircularProgress size={80} thickness={4} />
              <Typography variant="h5" sx={{ mt: 3, color: '#1976d2', fontWeight: 600 }}>
                {loadingMessage || 'Đang chờ kết quả từ điện thoại...'}
              </Typography>
            </Box>
          )}

          {results && !loading && (
            <Box className="fade-in">
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 4, color: '#1976d2' }}>
                📊 Kết Quả Phân Tích Từ Điện Thoại
              </Typography>

              {/* Comparison Images Section */}
              {referenceImage && testImages.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3, color: '#2c3e50' }}>
                    🖼️ So Sánh Hình Ảnh
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#1976d2' }}>
                          📷 Ảnh Mẫu Gốc
                        </Typography>
                        <Box sx={{ 
                          p: 2, 
                          bgcolor: '#f8f9fa', 
                          borderRadius: '12px',
                          border: '3px solid #1976d2',
                          boxShadow: '0 4px 12px rgba(25,118,210,0.2)'
                        }}>
                          <img
                            src={referenceImage}
                            alt="Reference"
                            style={{ 
                              width: '100%', 
                              maxHeight: '300px',
                              objectFit: 'contain',
                              borderRadius: '8px'
                            }}
                          />
                        </Box>
                        <Chip 
                          label="Chuẩn So Sánh" 
                          color="primary" 
                          sx={{ mt: 2, fontWeight: 700, fontSize: '0.9rem', py: 2.5 }}
                        />
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#2e7d32' }}>
                          ✅ Ảnh Tốt Nhất
                        </Typography>
                        <Box sx={{ 
                          p: 2, 
                          bgcolor: '#e8f5e9', 
                          borderRadius: '12px',
                          border: '3px solid #2e7d32',
                          boxShadow: '0 4px 12px rgba(46,125,50,0.2)'
                        }}>
                          {(() => {
                            const best = results.results.reduce((min, r) => r.delta_e < min.delta_e ? r : min);
                            const bestImage = testImages.find(img => img.filename === best.filename);
                            return (
                              <>
                                {bestImage && (
                                  <img
                                    src={bestImage.image}
                                    alt="Best"
                                    style={{ 
                                      width: '100%', 
                                      maxHeight: '300px',
                                      objectFit: 'contain',
                                      borderRadius: '8px'
                                    }}
                                  />
                                )}
                                <Typography variant="body2" sx={{ mt: 2, fontWeight: 600, fontSize: '0.85rem' }}>
                                  {best.filename}
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                  <Chip 
                                    label={`ΔE: ${best.delta_e.toFixed(2)}`}
                                    size="small"
                                    sx={{ 
                                      bgcolor: '#2e7d32', 
                                      color: 'white',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      px: 1.5,
                                      py: 2
                                    }}
                                  />
                                  <Chip 
                                    label={best.status}
                                    size="small"
                                    sx={{ 
                                      ml: 1,
                                      bgcolor: best.color_code, 
                                      color: 'white',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      px: 1.5,
                                      py: 2
                                    }}
                                  />
                                </Box>
                              </>
                            );
                          })()}
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: '#d32f2f' }}>
                          ❌ Ảnh Kém Nhất
                        </Typography>
                        <Box sx={{ 
                          p: 2, 
                          bgcolor: '#ffebee', 
                          borderRadius: '12px',
                          border: '3px solid #d32f2f',
                          boxShadow: '0 4px 12px rgba(211,47,47,0.2)'
                        }}>
                          {(() => {
                            const worst = results.results.reduce((max, r) => r.delta_e > max.delta_e ? r : max);
                            const worstImage = testImages.find(img => img.filename === worst.filename);
                            return (
                              <>
                                {worstImage && (
                                  <img
                                    src={worstImage.image}
                                    alt="Worst"
                                    style={{ 
                                      width: '100%', 
                                      maxHeight: '300px',
                                      objectFit: 'contain',
                                      borderRadius: '8px'
                                    }}
                                  />
                                )}
                                <Typography variant="body2" sx={{ mt: 2, fontWeight: 600, fontSize: '0.85rem' }}>
                                  {worst.filename}
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                  <Chip 
                                    label={`ΔE: ${worst.delta_e.toFixed(2)}`}
                                    size="small"
                                    sx={{ 
                                      bgcolor: '#d32f2f', 
                                      color: 'white',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      px: 1.5,
                                      py: 2
                                    }}
                                  />
                                  <Chip 
                                    label={worst.status}
                                    size="small"
                                    sx={{ 
                                      ml: 1,
                                      bgcolor: worst.color_code, 
                                      color: 'white',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      px: 1.5,
                                      py: 2
                                    }}
                                  />
                                </Box>
                              </>
                            );
                          })()}
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Render existing results section */}
              {renderInspectionTab()}
            </Box>
          )}

          {!results && !loading && (
            <Box sx={{ textAlign: 'center', my: 12 }}>
              <Smartphone sx={{ fontSize: 100, color: '#ccc', mb: 2 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom>
                Chờ điện thoại gửi kết quả...
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nhập mã <strong>{sessionId}</strong> trên điện thoại để bắt đầu
              </Typography>
            </Box>
          )}
        </Container>
      </Box>
    );
  }

  return (
    <Box className="App">
      {/* Dashboard Header */}
      <Box className="dashboard-header">
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography className="dashboard-welcome">
                {sessionId ? '📱 Điện Thoại (Đã Kết Nối)' : '📱 Điện Thoại (Độc Lập)'}
              </Typography>
              <Typography className="dashboard-subtitle">
                {sessionId ? `Session: ${sessionId}` : 'Hệ thống kiểm tra chất lượng màu sơn gỗ sử dụng Delta E 2000'}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => {
                setDisplayMode(null);
                setSessionId(null);
                setSessionInput('');
              }}
            >
              Đổi Chế Độ
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Session Join Alert */}
      {!sessionId && displayMode === 'phone' && (
        <Container maxWidth="xl" sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Kết nối với Laptop (Tùy chọn)</AlertTitle>
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <TextField
                size="small"
                placeholder="Nhập mã 8 ký tự..."
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinSession()}
              />
              <Button variant="contained" onClick={handleJoinSession}>
                Kết Nối
              </Button>
            </Box>
          </Alert>
        </Container>
      )}

      {/* Tabs */}
      <Container maxWidth="xl" sx={{ mt: 0 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, v) => setTabValue(v)}
          sx={{ mb: 3 }}
        >
          <Tab 
            icon={<Assessment />}
            iconPosition="start"
            label="Kiểm Tra Chất Lượng" 
            sx={{ fontSize: '15px', px: 3 }}
          />
          <Tab 
            icon={<PhotoLibrary />}
            iconPosition="start"
            label="Thư Viện Mẫu" 
            sx={{ fontSize: '15px', px: 3 }}
          />
        </Tabs>

        {tabValue === 0 && renderInspectionTab()}
        {tabValue === 1 && renderLibraryTab()}
      </Container>

      {/* Add Sample Dialog */}
      <Dialog open={openAddSample} onClose={() => setOpenAddSample(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Thêm Mẫu Mới</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Tên mẫu"
            value={sampleForm.name}
            onChange={(e) => setSampleForm({ ...sampleForm, name: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Danh mục</InputLabel>
            <Select
              value={sampleForm.category}
              onChange={(e) => setSampleForm({ ...sampleForm, category: e.target.value })}
            >
              {CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Mô tả"
            multiline
            rows={3}
            value={sampleForm.description}
            onChange={(e) => setSampleForm({ ...sampleForm, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <Button
            variant="outlined"
            component="label"
            fullWidth
          >
            Chọn Ảnh
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    setSampleForm({ ...sampleForm, image: event.target.result });
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddSample(false)}>Hủy</Button>
          <Button onClick={handleAddSample} variant="contained">Lưu</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Sample Dialog */}
      <Dialog open={openEditSample} onClose={() => setOpenEditSample(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chỉnh Sửa Mẫu</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Tên mẫu"
            value={sampleForm.name}
            onChange={(e) => setSampleForm({ ...sampleForm, name: e.target.value })}
            sx={{ mt: 2, mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Danh mục</InputLabel>
            <Select
              value={sampleForm.category}
              onChange={(e) => setSampleForm({ ...sampleForm, category: e.target.value })}
            >
              {CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Mô tả"
            multiline
            rows={3}
            value={sampleForm.description}
            onChange={(e) => setSampleForm({ ...sampleForm, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditSample(false)}>Hủy</Button>
          <Button onClick={handleUpdateSample} variant="contained">Cập Nhật</Button>
        </DialogActions>
      </Dialog>

      {/* Footer */}
      <Box sx={{ bgcolor: '#f5f5f5', py: 3, mt: 5, textAlign: 'center', borderTop: '1px solid #ddd' }}>
        <Typography variant="body2" color="text.secondary">
          © 2025 - Hệ Thống Kiểm Tra Chất Lượng Màu Sơn Gỗ
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Sử dụng Delta E 2000 (CIEDE2000) - Chuẩn quốc tế CIE
        </Typography>
      </Box>
    </Box>
  );
}

export default App;
