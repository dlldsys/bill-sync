import React, { useState, useRef } from 'react';
import { Button, Upload, Select, Card, Progress, Typography, Space, Alert, Tag, Divider } from 'antd';
import { UploadOutlined, StopOutlined, ClearOutlined, PictureOutlined } from '@ant-design/icons';
import { useOCR, OCREngine } from '../hooks/useFrontendOCR';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const FrontendOCRDemo: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    isProcessing,
    progress,
    result,
    error,
    engine,
    processImage,
    stopProcessing,
    clearResults,
    compressImage,
    validateImage,
    getImageInfo
  } = useOCR();

  const [selectedEngine, setSelectedEngine] = useState<OCREngine>(OCREngine.HYBRID);
  const [imageInfo, setImageInfo] = useState<any>(null);

  const handleFileSelect = async (file: File) => {
    // 验证图片
    const validation = validateImage(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // 获取图片信息
    try {
      const info = await getImageInfo(file);
      setImageInfo(info);
    } catch (error) {
      console.error('获取图片信息失败:', error);
    }

    // 处理图片
    await processImage(file, selectedEngine);
  };

  const handleEngineChange = (value: OCREngine) => {
    setSelectedEngine(value);
    clearResults();
  };

  const handleStop = () => {
    stopProcessing();
  };

  const handleClear = () => {
    clearResults();
    setImageInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getEngineColor = (engine: OCREngine) => {
    const colors = {
      [OCREngine.TESSERACT]: 'blue',
      [OCREngine.TESSERACT_CHINESE]: 'green',
      [OCREngine.TESSERACT_ENGLISH]: 'orange',
      [OCREngine.HYBRID]: 'purple'
    };
    return colors[engine] || 'default';
  };

  const getEngineName = (engine: OCREngine) => {
    const names = {
      [OCREngine.TESSERACT]: 'Tesseract.js (中英混合)',
      [OCREngine.TESSERACT_CHINESE]: 'Tesseract.js (中文)',
      [OCREngine.TESSERACT_ENGLISH]: 'Tesseract.js (英文)',
      [OCREngine.HYBRID]: '混合引擎 (推荐)'
    };
    return names[engine] || engine;
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
      <Title level={2}>🔍 纯前端OCR识别演示</Title>
      <Paragraph>
        这是一个完全基于前端的OCR识别系统，支持多种Tesseract.js配置和智能结果融合。
        无需后端服务器，所有处理都在浏览器中完成。
      </Paragraph>

      <Card title="📤 图片上传" style={{ marginBottom: 20 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>选择OCR引擎：</Text>
            <Select
              value={selectedEngine}
              onChange={handleEngineChange}
              style={{ width: 300, marginLeft: 10 }}
              disabled={isProcessing}
            >
              <Option value={OCREngine.HYBRID}>
                <Tag color="purple">混合引擎 (推荐)</Tag>
              </Option>
              <Option value={OCREngine.TESSERACT_CHINESE}>
                <Tag color="green">Tesseract.js (中文)</Tag>
              </Option>
              <Option value={OCREngine.TESSERACT_ENGLISH}>
                <Tag color="orange">Tesseract.js (英文)</Tag>
              </Option>
              <Option value={OCREngine.TESSERACT}>
                <Tag color="blue">Tesseract.js (中英混合)</Tag>
              </Option>
            </Select>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file);
                }
              }}
              style={{ display: 'none' }}
            />
            <Button
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              type="primary"
            >
              选择图片
            </Button>
            {isProcessing && (
              <Button
                icon={<StopOutlined />}
                onClick={handleStop}
                danger
                style={{ marginLeft: 10 }}
              >
                停止识别
              </Button>
            )}
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              style={{ marginLeft: 10 }}
            >
              清空结果
            </Button>
          </div>

          {imageInfo && (
            <div style={{ marginTop: 10 }}>
              <Text type="secondary">
                图片信息：{imageInfo.width} × {imageInfo.height} | 
                大小：{formatFileSize(imageInfo.size)}
              </Text>
            </div>
          )}
        </Space>
      </Card>

      {isProcessing && (
        <Card title="🔄 识别进度" style={{ marginBottom: 20 }}>
          <Progress
            percent={progress}
            status={progress === 100 ? 'success' : 'active'}
            format={(percent) => `${percent}%`}
          />
          <div style={{ marginTop: 10 }}>
            <Text>当前引擎：<Tag color={getEngineColor(engine)}>{getEngineName(engine)}</Tag></Text>
          </div>
        </Card>
      )}

      {error && (
        <Alert
          message="识别错误"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      {result && (
        <Card 
          title="🎯 识别结果" 
          style={{ marginBottom: 20 }}
          extra={
            <Space>
              <Tag color={getEngineColor(result.engine)}>
                {getEngineName(result.engine)}
              </Tag>
              <Tag color={result.confidence > 80 ? 'green' : result.confidence > 60 ? 'orange' : 'red'}>
                置信度: {result.confidence.toFixed(1)}%
              </Tag>
              {result.processTime && (
                <Tag color="blue">
                  耗时: {result.processTime}ms
                </Tag>
              )}
            </Space>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <Text strong>识别文本：</Text>
            <div
              style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '6px',
                marginTop: '8px',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: '1.5',
                maxHeight: '300px',
                overflow: 'auto'
              }}
            >
              {result.text || '无文本内容'}
            </div>
          </div>

          {result.allResults && result.allResults.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <Text strong>融合详情：</Text>
              <div style={{ marginTop: 8 }}>
                {result.allResults.map((r, index) => (
                  <div key={index} style={{ marginBottom: 4 }}>
                    <Tag color={getEngineColor(r.engine)} style={{ marginRight: 8 }}>
                      {getEngineName(r.engine)}
                    </Tag>
                    <Text type="secondary">
                      置信度: {r.confidence.toFixed(1)}% | 
                      文本长度: {r.text.length}
                    </Text>
                  </div>
                ))}
                {result.fusionReason && (
                  <div style={{ marginTop: 8 }}>
                    <Text strong>融合原因：</Text>
                    <Tag color="purple" style={{ marginLeft: 8 }}>
                      {result.fusionReason}
                    </Tag>
                  </div>
                )}
              </div>
            </div>
          )}

          {result.words && result.words.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong>文字详情：</Text>
              <div style={{ marginTop: 8, maxHeight: '200px', overflow: 'auto' }}>
                {result.words.map((word, index) => (
                  <div key={index} style={{ marginBottom: 4, padding: '4px 8px', background: '#fafafa', borderRadius: '4px' }}>
                    <Text>{word.text}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      ({word.confidence.toFixed(1)}%)
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card title="📋 功能特点" style={{ marginBottom: 20 }}>
        <div>
          <Title level={5}>🚀 纯前端解决方案</Title>
          <ul>
            <li>完全基于浏览器运行，无需后端服务器</li>
            <li>支持多种Tesseract.js配置优化</li>
            <li>智能结果融合算法</li>
            <li>实时进度反馈</li>
          </ul>

          <Title level={5}>🎯 多引擎支持</Title>
          <ul>
            <li><Tag color="green">中文模式</Tag> - 专门优化中文识别</li>
            <li><Tag color="orange">英文模式</Tag> - 专门优化英文识别</li>
            <li><Tag color="blue">中英混合</Tag> - 支持中英文混合识别</li>
            <li><Tag color="purple">混合引擎</Tag> - 智能融合多种配置结果</li>
          </ul>

          <Title level={5}>🔧 智能优化</Title>
          <ul>
            <li>图片预处理：对比度增强、亮度调整</li>
            <li>结果融合：置信度、关键词、文本长度、数字识别综合评分</li>
            <li>错误处理：自动降级和重试机制</li>
          </ul>
        </div>
      </Card>

      <Card title="💡 使用建议">
        <div>
          <Title level={5}>📸 图片要求</Title>
          <ul>
            <li>支持格式：JPG、PNG、BMP、WebP</li>
            <li>文件大小：不超过10MB</li>
            <li>建议分辨率：800×1200以上</li>
            <li>文字清晰：避免模糊、倾斜、反光</li>
          </ul>

          <Title level={5}>🎯 引擎选择</Title>
          <ul>
            <li><strong>混合引擎</strong>：推荐使用，自动选择最佳结果</li>
            <li><strong>中文模式</strong>：纯中文文档识别效果最佳</li>
            <li><strong>英文模式</strong>：纯英文文档识别速度最快</li>
            <li><strong>中英混合</strong>：中英文混合文档</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default FrontendOCRDemo;
