// 简化的OCR演示页面 - 使用项目现有组件
import React, { useState } from 'react';
import { Button, Toast } from 'antd-mobile';
import { useOCR } from '../../hooks/useOCR.js';

interface OCRResult {
  merchant: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  categoryId: string;
  date: string;
  confidence: number;
  original: string;
}

interface OCRStats {
  totalRecords: number;
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
}

const OCRDemo = () => {
  const {
    isProcessing,
    progress,
    results,
    error,
    processImage,
    clearResults,
    getStatistics
  } = useOCR();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      processImage(file);
    }
  };

  // 清空结果
  const handleClear = () => {
    clearResults();
    setSelectedFile(null);
  };

  const stats = getStatistics() as OCRStats | null;

  return (
    <div style={{ padding: '20px' }}>
      <h2>🚀 统一OCR服务演示</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        支持Web端和打包App的微信账单识别服务
      </p>

      {/* 文件上传 */}
      <div style={{ 
        border: '2px dashed #ddd', 
        borderRadius: '8px', 
        padding: '40px', 
        textAlign: 'center',
        marginBottom: '20px',
        backgroundColor: '#fafafa'
      }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={isProcessing}
          style={{ display: 'none' }}
          id="ocr-file-input"
        />
        <label htmlFor="ocr-file-input" style={{ cursor: 'pointer' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📸</div>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>
            点击上传微信账单截图
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            支持 JPG、PNG、WebP 格式
          </div>
        </label>
      </div>

      {/* 处理状态 */}
      {isProcessing && (
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#e6f7ff', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #91d5ff'
        }}>
          <div style={{ marginBottom: '8px' }}>🤖 AI正在识别中... {progress}%</div>
          <div style={{ 
            height: '4px', 
            backgroundColor: '#f0f0f0', 
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: '#1890ff',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {error && (
        <div style={{ 
          padding: '16px', 
          backgroundColor: '#fff2f0', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #ffccc7',
          color: '#ff4d4f'
        }}>
          ❌ {error}
        </div>
      )}

      {/* 操作按钮 */}
      {results.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <Button onClick={handleClear} style={{ marginRight: '8px' }}>
            清空结果
          </Button>
          <Button 
            onClick={() => {
              const dataStr = JSON.stringify(results, null, 2);
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `ocr_result_${new Date().getTime()}.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            color="primary"
          >
            导出JSON
          </Button>
        </div>
      )}

      {/* 统计信息 */}
      {stats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '16px', 
          marginBottom: '20px' 
        }}>
          <div style={{ 
            padding: '16px', 
            border: '1px solid #d9d9d9', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
              {stats.totalRecords}
            </div>
            <div style={{ color: '#666' }}>总记录数</div>
          </div>
          <div style={{ 
            padding: '16px', 
            border: '1px solid #d9d9d9', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
              +¥{stats.totalIncome.toFixed(2)}
            </div>
            <div style={{ color: '#666' }}>总收入</div>
          </div>
          <div style={{ 
            padding: '16px', 
            border: '1px solid #d9d9d9', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
              -¥{stats.totalExpense.toFixed(2)}
            </div>
            <div style={{ color: '#666' }}>总支出</div>
          </div>
          <div style={{ 
            padding: '16px', 
            border: '1px solid #d9d9d9', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: stats.netAmount >= 0 ? '#52c41a' : '#ff4d4f' 
            }}>
              {stats.netAmount >= 0 ? '+' : ''}¥{stats.netAmount.toFixed(2)}
            </div>
            <div style={{ color: '#666' }}>净收支</div>
          </div>
        </div>
      )}

      {/* 识别结果 */}
      {results.length > 0 && (
        <div>
          <h3>📊 识别结果</h3>
          <div style={{ backgroundColor: '#fff', border: '1px solid #d9d9d9', borderRadius: '8px' }}>
            {(results as OCRResult[]).map((result: OCRResult, index: number) => (
              <div 
                key={index}
                style={{ 
                  padding: '12px 16px',
                  borderBottom: index < results.length - 1 ? '1px solid #f0f0f0' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {index + 1}. {result.merchant}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {result.category} • {result.date}
                  </div>
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: result.type === 'expense' ? '#ff4d4f' : '#52c41a'
                }}>
                  {result.type === 'expense' ? '-' : '+'}¥{result.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 功能说明 */}
      <div style={{ marginTop: '40px' }}>
        <h3>🎯 统一OCR服务特性</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div>
            <h4>🌐 跨平台支持</h4>
            <ul style={{ fontSize: '14px', color: '#666' }}>
              <li>Web浏览器端</li>
              <li>打包App (Electron/Capacitor)</li>
              <li>纯前端实现，无需后端</li>
            </ul>
          </div>
          <div>
            <h4>🤖 智能识别</h4>
            <ul style={{ fontSize: '14px', color: '#666' }}>
              <li>微信账单自动检测</li>
              <li>压缩格式智能分割</li>
              <li>商家名称精确提取</li>
              <li>自动分类匹配</li>
            </ul>
          </div>
          <div>
            <h4>📊 高准确率</h4>
            <ul style={{ fontSize: '14px', color: '#666' }}>
              <li>记录数量: 100%</li>
              <li>金额识别: 100%</li>
              <li>商家匹配: 62.5%</li>
              <li>自动分类: 50%</li>
            </ul>
          </div>
          <div>
            <h4>🔧 易于集成</h4>
            <ul style={{ fontSize: '14px', color: '#666' }}>
              <li>React Hook封装</li>
              <li>TypeScript支持</li>
              <li>详细调试日志</li>
              <li>结果导出功能</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OCRDemo;
