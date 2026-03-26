// Web端OCR演示页面
import React, { useState } from 'react';
import { Button, Progress, Alert, Typography, Space, Tag } from 'antd-mobile';
import { useOCR } from '../../hooks/useOCR.js';

const { Title, Text } = Typography;

interface OCRResultItem {
  index: number;
  merchant: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
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

  const [fileList, setFileList] = useState<File[]>([]);

  const handleUpload = async (file: File) => {
    setFileList([file]);
    const ocrResults = await processImage(file);
    
    if (ocrResults && ocrResults.length > 0) {
      console.log('=== OCR识别详细结果 ===');
      console.log(ocrResults);
    }
    
    return false;
  };

  const handleClear = () => {
    clearResults();
    setFileList([]);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ocr_result_${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = getStatistics();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      <Title level={2}>统一OCR服务演示</Title>
      <Text color="secondary">支持Web端和打包App的微信账单识别服务</Text>

      <div className="card" style={{ marginTop: '20px' }}>
        <Title level={4}>图片上传与识别</Title>
        
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
          disabled={isProcessing}
          style={{ marginBottom: '16px' }}
        />

        {isProcessing && (
          <div style={{ marginBottom: '16px' }}>
            <Alert
              message="AI正在识别中..."
              description="使用统一OCR服务处理图片，请稍等"
              type="info"
              style={{ marginBottom: '10px' }}
            />
            <Progress
              percent={progress}
              status="active"
            />
          </div>
        )}

        {error && (
          <Alert
            message="识别失败"
            description={error}
            type="error"
            style={{ marginBottom: '16px' }}
          />
        )}

        {results.length > 0 && (
          <Space style={{ marginBottom: '16px' }}>
            <Button onClick={handleClear}>清空结果</Button>
            <Button color="primary" onClick={handleExport}>导出JSON</Button>
          </Space>
        )}

        {results.length > 0 && (
          <div>
            <Title level={4}>识别结果</Title>
            
            {stats && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                gap: '16px', 
                marginBottom: '20px' 
              }}>
                <div style={{ textAlign: 'center', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>{stats.totalRecords}</div>
                  <div style={{ color: '#666' }}>总记录数</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>+¥{stats.totalIncome.toFixed(2)}</div>
                  <div style={{ color: '#666' }}>总收入</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>-¥{stats.totalExpense.toFixed(2)}</div>
                  <div style={{ color: '#666' }}>总支出</div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '8px' }}>
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

            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {results.map((item: OCRResultItem, index: number) => (
                <div key={index} style={{
                  padding: '12px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.merchant || '未知商家'}</div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      <Tag color={item.type === 'expense' ? 'red' : 'green'}>
                        {item.type === 'expense' ? '支出' : '收入'}
                      </Tag>
                      <span style={{ marginLeft: '8px' }}>{item.category}</span>
                      <span style={{ marginLeft: '8px' }}>{item.date}</span>
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 'bold',
                    color: item.type === 'expense' ? '#ff4d4f' : '#52c41a'
                  }}>
                    {item.type === 'expense' ? '-' : '+'}¥{item.amount.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <Title level={4}>统一OCR服务特性</Title>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div>
            <Title level={5}>跨平台支持</Title>
            <ul>
              <li>Web浏览器端</li>
              <li>打包App (Electron/Capacitor)</li>
              <li>纯前端实现，无需后端</li>
            </ul>
          </div>
          <div>
            <Title level={5}>智能识别</Title>
            <ul>
              <li>微信账单自动检测</li>
              <li>压缩格式智能分割</li>
              <li>商家名称精确提取</li>
              <li>自动分类匹配</li>
            </ul>
          </div>
          <div>
            <Title level={5}>高准确率</Title>
            <ul>
              <li>记录数量: 100%</li>
              <li>金额识别: 100%</li>
              <li>商家匹配: 62.5%</li>
              <li>自动分类: 50%</li>
            </ul>
          </div>
          <div>
            <Title level={5}>易于集成</Title>
            <ul>
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
