import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Button,
  Card,
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
  Tab
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
  Assessment
} from '@mui/icons-material';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'http://localhost:5002/api';

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
  const [thresholdExcellent, setThresholdExcellent] = useState(1.5);
  const [thresholdAcceptable, setThresholdAcceptable] = useState(2.5);
  
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

  const loadSamples = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/library/samples`);
      setSamples(response.data.samples);
    } catch (error) {
      console.error('Error loading samples:', error);
    }
  };

  const handleReferenceUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImage(e.target.result);
        setSelectedSample(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestUpload = (event) => {
    const files = Array.from(event.target.files);
    const imagePromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            filename: file.name,
            image: e.target.result
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(imagePromises).then(images => {
      setTestImages(images);
    });
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
    try {
      const requestData = {
        threshold_excellent: thresholdExcellent,
        threshold_acceptable: thresholdAcceptable,
        test_images: testImages
      };

      if (selectedSample) {
        requestData.reference_sample_id = selectedSample.id;
      } else {
        requestData.reference_image = referenceImage;
      }

      const response = await axios.post(`${API_BASE_URL}/analyze`, requestData);
      setResults(response.data);
    } catch (error) {
      console.error('Error analyzing:', error);
      alert('Có lỗi xảy ra khi phân tích!');
    } finally {
      setLoading(false);
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
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
                fullWidth
                sx={{ mb: 1 }}
              >
                Upload Ảnh Mới
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleReferenceUpload}
                />
              </Button>
              
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
            
            <Button
              variant="outlined"
              component="label"
              startIcon={<PhotoLibrary />}
              fullWidth
              sx={{ mb: 2 }}
            >
              Chọn Nhiều Ảnh
              <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={handleTestUpload}
              />
            </Button>

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
          {loading ? 'Đang phân tích...' : 'Phân Tích Chất Lượng'}
        </Button>
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

  return (
    <Box className="App">
      {/* Dashboard Header */}
      <Box className="dashboard-header">
        <Container maxWidth="xl">
          <Typography className="dashboard-welcome">
            Chào mừng đến với Wood Color Quality Checker
          </Typography>
          <Typography className="dashboard-subtitle">
            Hệ thống kiểm tra chất lượng màu sơn gỗ sử dụng Delta E 2000
          </Typography>
        </Container>
      </Box>

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
