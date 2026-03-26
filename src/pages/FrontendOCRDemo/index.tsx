import React, { useState, useRef } from 'react';
import { Button, Progress, Typography, Space, Alert, Tag } from 'antd-mobile';
import { useOCR, OCREngine } from '../../hooks/useFrontendOCR';

const { Title, Text, Paragraph } = Typography;

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
    validateImage,
    getImageInfo
  } = useOCR();

  const [selectedEngine, setSelectedEngine] = useState<OCREngine>(OCREngine.HYBRID);
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number; size: number } | null>(null);

  const handleFileSelect = async (file: File) => {
    const validation = validateImage(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    try {
      const info = await getImageInfo(file);
      setImageInfo(info);
    } catch (err) {
      console.error('获取图片信息失败:', err);
    }

    await processImage(file, selectedEngine);
  };

  const handleEngineChange = (value: OCREngine) => {
    setSelectedEngine(value);
    clearResults();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getEngineColor = (eng: OCREngine) => {
    const colors: Record<OCREngine, string> = {
      [OCREngine.TESSERACT]: '#1677ff',
      [OCREngine.TESSERACT_CHINESE]: '#52c41a',
      [OCREngine.TESSERACT_ENGLISH]: '#fa8c16',
      [OCREngine.HYBRID]: '#722ed1'
    };
    return colors[eng] || '#999';
  };

  const getEngineName = (eng: OCREngine) => {
    const names: Record<OCREngine, string> = {
      [OCREngine.TESSERACT]: 'Tesseract.js (中英混合)',
      [OCREngine.TESSERACT_CHINESE]: 'Tesseract.js (中文)',
      [OCREngine.TESSERACT_ENGLISH]: 'Tesseract.js (英文)',
      [OCREngine.HYBRID]: '混合引擎 (推荐)'
    };
    return names[eng] || eng;
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
      <Title level={2}>纯前端OCR识别演示</Title>
      <Paragraph>
        这是一个完全基于前端的OCR识别系统，支持多种Tesseract.js配置和智能结果融合。
        无需后端服务器，所有处理都在浏览器中完成。
      </Paragraph>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <Text style={{ fontWeight: 500 }}>选择OCR引擎：</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {[
              { value: OCREngine.HYBRID, color: '#722ed1' },
              { value: OCREngine.TESSERACT_CHINESE, color: '#52c41a' },
              { value: OCREngine.TESSERACT_ENGLISH, color: '#fa8c16' },
              { value: OCREngine.TESSERACT, color: '#1677ff' }
            ].map(item => (
              <Tag
                key={item.value}
                color={selectedEngine === item.value ? item.color : undefined}
                fill={selectedEngine === item.value ? 'solid' : 'outline'}
                onClick={() => handleEngineChange(item.value)}
                style={{ cursor: 'pointer' }}
              >
                {getEngineName(item.value)}
              </Tag>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
            color="primary"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
          >
            选择图片
          </Button>
          {isProcessing && (
            <Button color="danger" onClick={stopProcessing}>
              停止识别
            </Button>
          )}
          <Button onClick={clearResults}>
            清空结果
          </Button>
        </div>

        {imageInfo && (
          <div style={{ marginTop: '12px' }}>
            <Text type="secondary">
              图片信息：{imageInfo.width} × {imageInfo.height} | 大小：{formatFileSize(imageInfo.size)}
            </Text>
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <Text style={{ fontWeight: 500 }}>识别进度</Text>
          <Progress
            percent={progress}
            status={progress === 100 ? 'success' : 'active'}
          />
          <div style={{ marginTop: '8px' }}>
            <Text>当前引擎：<Tag color={getEngineColor(engine)}>{getEngineName(engine)}</Tag></Text>
          </div>
        </div>
      )}

      {error && (
        <Alert
          message="识别错误"
          description={error}
          type="error"
          style={{ marginBottom: '16px' }}
        />
      )}

      {result && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <Text style={{ fontWeight: 500 }}>识别结果</Text>
            <Space>
              <Tag color={getEngineColor(result.engine)}>
                {getEngineName(result.engine)}
              </Tag>
              <Tag color={result.confidence > 80 ? 'success' : result.confidence > 60 ? 'warning' : 'danger'}>
                置信度: {result.confidence.toFixed(1)}%
              </Tag>
              {result.processTime && (
                <Tag color="primary">
                  耗时: {result.processTime}ms
                </Tag>
              )}
            </Space>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <Text style={{ fontWeight: 500 }}>识别文本：</Text>
            <div
              style={{
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '8px',
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
            <div style={{ marginTop: '12px' }}>
              <Text style={{ fontWeight: 500 }}>融合详情：</Text>
              <div style={{ marginTop: '8px' }}>
                {result.allResults.map((r, index) => (
                  <div key={index} style={{ marginBottom: '8px', padding: '8px', background: '#fafafa', borderRadius: '4px' }}>
                    <Tag color={getEngineColor(r.engine)} style={{ marginRight: '8px' }}>
                      {getEngineName(r.engine)}
                    </Tag>
                    <Text type="secondary">
                      置信度: {r.confidence.toFixed(1)}% | 文本长度: {r.text.length}
                    </Text>
                  </div>
                ))}
                {result.fusionReason && (
                  <div style={{ marginTop: '8px' }}>
                    <Text style={{ fontWeight: 500 }}>融合原因：</Text>
                    <Tag color="primary" style={{ marginLeft: '8px' }}>
                      {result.fusionReason}
                    </Tag>
                  </div>
                )}
              </div>
            </div>
          )}

          {result.words && result.words.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <Text style={{ fontWeight: 500 }}>文字详情：</Text>
              <div style={{ marginTop: '8px', maxHeight: '200px', overflow: 'auto' }}>
                {result.words.map((word, index) => (
                  <div key={index} style={{ marginBottom: '4px', padding: '4px 8px', background: '#fafafa', borderRadius: '4px' }}>
                    <Text>{word.text}</Text>
                    <Text type="secondary" style={{ marginLeft: '8px' }}>
                      ({word.confidence.toFixed(1)}%)
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: '16px' }}>
        <Title level={5}>纯前端解决方案</Title>
        <ul>
          <li>完全基于浏览器运行，无需后端服务器</li>
          <li>支持多种Tesseract.js配置优化</li>
          <li>智能结果融合算法</li>
          <li>实时进度反馈</li>
        </ul>

        <Title level={5}>多引擎支持</Title>
        <ul>
          <li><Tag color="success">中文模式</Tag> - 专门优化中文识别</li>
          <li><Tag color="warning">英文模式</Tag> - 专门优化英文识别</li>
          <li><Tag color="primary">中英混合</Tag> - 支持中英文混合识别</li>
          <li><Tag color="secondary">混合引擎</Tag> - 智能融合多种配置结果</li>
        </ul>

        <Title level={5}>智能优化</Title>
        <ul>
          <li>图片预处理：对比度增强、亮度调整</li>
          <li>结果融合：置信度、关键词、文本长度、数字识别综合评分</li>
          <li>错误处理：自动降级和重试机制</li>
        </ul>
      </div>

      <div className="card">
        <Title level={5}>图片要求</Title>
        <ul>
          <li>支持格式：JPG、PNG、BMP、WebP</li>
          <li>文件大小：不超过10MB</li>
          <li>建议分辨率：800×1200以上</li>
          <li>文字清晰：避免模糊、倾斜、反光</li>
        </ul>

        <Title level={5}>引擎选择</Title>
        <ul>
          <li><strong>混合引擎</strong>：推荐使用，自动选择最佳结果</li>
          <li><strong>中文模式</strong>：纯中文文档识别效果最佳</li>
          <li><strong>英文模式</strong>：纯英文文档识别速度最快</li>
          <li><strong>中英混合</strong>：中英文混合文档</li>
        </ul>
      </div>
    </div>
  );
};

export default FrontendOCRDemo;
