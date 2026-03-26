import React, { useState, useRef } from 'react';
import { useOCR, OCREngine } from '../hooks/useFrontendOCR';

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

  const handleEngineChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEngine(e.target.value as OCREngine);
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
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔍 纯前端OCR识别演示</h1>
      <p>
        这是一个完全基于前端的OCR识别系统，支持多种Tesseract.js配置和智能结果融合。
        无需后端服务器，所有处理都在浏览器中完成。
      </p>

      <div style={{
        background: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>📤 图片上传</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '10px', fontWeight: 'bold' }}>选择OCR引擎：</label>
          <select
            value={selectedEngine}
            onChange={handleEngineChange}
            disabled={isProcessing}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value={OCREngine.HYBRID}>🚀 混合引擎 (推荐)</option>
            <option value={OCREngine.TESSERACT_CHINESE}>🇨🇳 Tesseract.js (中文)</option>
            <option value={OCREngine.TESSERACT_ENGLISH}>🇺🇸 Tesseract.js (英文)</option>
            <option value={OCREngine.TESSERACT}>🌐 Tesseract.js (中英混合)</option>
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
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
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              marginRight: '10px'
            }}
          >
            📤 选择图片
          </button>
          {isProcessing && (
            <button
              onClick={handleStop}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ff4d4f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              ⏹ 停止识别
            </button>
          )}
          <button
            onClick={handleClear}
            style={{
              padding: '10px 20px',
              backgroundColor: '#52c41a',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🗑 清空结果
          </button>
        </div>

        {imageInfo && (
          <div style={{ marginTop: '10px', color: '#666' }}>
            📏 图片信息：{imageInfo.width} × {imageInfo.height} | 
            💾 大小：{formatFileSize(imageInfo.size)}
          </div>
        )}
      </div>

      {isProcessing && (
        <div style={{
          background: '#e6f7ff',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #91d5ff'
        }}>
          <h3>🔄 识别进度</h3>
          <div style={{
            width: '100%',
            height: '20px',
            backgroundColor: '#f0f0f0',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '10px'
          }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#1890ff',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <div>进度: {Math.round(progress)}%</div>
          <div>当前引擎: {getEngineName(selectedEngine)}</div>
        </div>
      )}

      {error && (
        <div style={{
          background: '#fff2f0',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #ffccc7',
          color: '#a8071a'
        }}>
          <h3>❌ 识别错误</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div style={{
          background: '#f6ffed',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #b7eb8f'
        }}>
          <h3>🎯 识别结果</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <span style={{
              background: '#52c41a',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              marginRight: '10px'
            }}>
              {getEngineName(result.engine)}
            </span>
            <span style={{
              background: result.confidence > 80 ? '#52c41a' : result.confidence > 60 ? '#faad14' : '#ff4d4f',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              marginRight: '10px'
            }}>
              置信度: {result.confidence.toFixed(1)}%
            </span>
            {result.processTime && (
              <span style={{
                background: '#1890ff',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px'
              }}>
                耗时: {result.processTime}ms
              </span>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>识别文本：</strong>
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
                overflow: 'auto',
                border: '1px solid #d9d9d9'
              }}
            >
              {result.text || '无文本内容'}
            </div>
          </div>

          {result.allResults && result.allResults.length > 1 && (
            <div style={{ marginTop: '16px' }}>
              <strong>融合详情：</strong>
              <div style={{ marginTop: '8px' }}>
                {result.allResults.map((r: any, index: number) => (
                  <div key={index} style={{ 
                    marginBottom: '8px', 
                    padding: '8px', 
                    background: '#fafafa', 
                    borderRadius: '4px',
                    border: '1px solid #e8e8e8'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {getEngineName(r.engine)}
                    </div>
                    <div style={{ color: '#666', fontSize: '12px' }}>
                      置信度: {r.confidence.toFixed(1)}% | 
                      文本长度: {r.text.length}
                    </div>
                  </div>
                ))}
                {result.fusionReason && (
                  <div style={{ marginTop: '8px', padding: '8px', background: '#f0f5ff', borderRadius: '4px' }}>
                    <strong>融合原因：</strong> {result.fusionReason}
                  </div>
                )}
              </div>
            </div>
          )}

          {result.words && result.words.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <strong>文字详情：</strong>
              <div style={{ 
                marginTop: '8px', 
                maxHeight: '200px', 
                overflow: 'auto',
                border: '1px solid #e8e8e8',
                borderRadius: '4px',
                padding: '8px'
              }}>
                {result.words.map((word: any, index: number) => (
                  <div key={index} style={{ 
                    marginBottom: '4px', 
                    padding: '4px 8px', 
                    background: '#f9f9f9', 
                    borderRadius: '4px',
                    borderBottom: '1px solid #e8e8e8'
                  }}>
                    <span>{word.text}</span>
                    <span style={{ 
                      marginLeft: '8px', 
                      color: '#666', 
                      fontSize: '12px' 
                    }}>
                      ({word.confidence.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{
        background: '#fff',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #e8e8e8'
      }}>
        <h3>📋 功能特点</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <h4>🚀 纯前端解决方案</h4>
          <ul>
            <li>完全基于浏览器运行，无需后端服务器</li>
            <li>支持多种Tesseract.js配置优化</li>
            <li>智能结果融合算法</li>
            <li>实时进度反馈</li>
          </ul>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>🎯 多引擎支持</h4>
          <ul>
            <li>🇨🇳 <strong>中文模式</strong> - 专门优化中文识别</li>
            <li>🇺🇸 <strong>英文模式</strong> - 专门优化英文识别</li>
            <li>🌐 <strong>中英混合</strong> - 支持中英文混合识别</li>
            <li>🚀 <strong>混合引擎</strong> - 智能融合多种配置结果</li>
          </ul>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>🔧 智能优化</h4>
          <ul>
            <li>图片预处理：对比度增强、亮度调整</li>
            <li>结果融合：置信度、关键词、文本长度、数字识别综合评分</li>
            <li>错误处理：自动降级和重试机制</li>
          </ul>
        </div>

        <div>
          <h4>💡 使用建议</h4>
          <ul>
            <li>📸 <strong>图片要求</strong>：JPG、PNG、BMP、WebP格式，不超过10MB</li>
            <li>📏 <strong>分辨率</strong>：建议800×1200以上</li>
            <li>🎯 <strong>文字清晰</strong>：避免模糊、倾斜、反光</li>
            <li>🚀 <strong>引擎选择</strong>：推荐使用混合引擎获得最佳效果</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FrontendOCRDemo;
