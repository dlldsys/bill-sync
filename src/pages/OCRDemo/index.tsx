// 简化的Web端OCR演示页面
import React, { useState } from 'react';
import { Upload, Button, Card, Progress, Alert, Table, Tag, Space, Typography } from 'antd';
import { InboxOutlined, ClearOutlined, DownloadOutlined } from '@ant-design/icons';
import { useOCR } from '../../hooks/useOCR.js';

const { Title, Text } = Typography;

const OCRDemo = () => {
  const {
    isProcessing,
    progress,
    results,
    error,
    processImage,
    clearResults,
    getStatistics,
    formatResults
  } = useOCR();

  const [fileList, setFileList] = useState([]);

  // 处理文件上传
  const handleUpload = async (file) => {
    setFileList([file]);
    const ocrResults = await processImage(file);
    
    if (ocrResults && ocrResults.length > 0) {
      // 在控制台显示详细结果
      console.log('=== OCR识别详细结果 ===');
      formatResults(ocrResults);
    }
    
    return false; // 阻止默认上传行为
  };

  // 清空所有数据
  const handleClear = () => {
    clearResults();
    setFileList([]);
  };

  // 导出结果为JSON
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

  // 统计信息
  const stats = getStatistics();

  // 表格列定义
  const columns = [
    {
      title: '序号',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '商家名称',
      dataIndex: 'merchant',
      key: 'merchant',
      ellipsis: true,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount, record) => (
        <span style={{ color: record.type === 'expense' ? '#ff4d4f' : '#52c41a' }}>
          {record.type === 'expense' ? '-' : '+'}¥{amount.toFixed(2)}
        </span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => (
        <Tag color={type === 'expense' ? 'red' : 'green'}>
          {type === 'expense' ? '支出' : '收入'}
        </Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category) => <Tag>{category}</Tag>,
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100,
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      <Title level={2}>🚀 统一OCR服务演示</Title>
      <Text type="secondary">支持Web端和打包App的微信账单识别服务</Text>

      {/* 主要功能卡片 */}
      <Card style={{ marginTop: 20 }}>
        <Title level={4}>📸 图片上传与识别</Title>
        
        {/* 文件上传区域 */}
        <Upload.Dragger
          name="file"
          multiple={false}
          fileList={fileList}
          beforeUpload={handleUpload}
          accept="image/*"
          disabled={isProcessing}
          showUploadList={false}
          style={{ marginBottom: 20 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">
            点击或拖拽图片到此区域上传
          </p>
          <p className="ant-upload-hint">
            支持微信账单截图 (JPG, PNG, WebP) - 使用统一OCR服务
          </p>
        </Upload.Dragger>

        {/* 处理状态 */}
        {isProcessing && (
          <div style={{ marginBottom: 20 }}>
            <Alert
              message="🤖 AI正在识别中..."
              description="使用统一OCR服务处理图片，请稍等"
              type="info"
              showIcon
              style={{ marginBottom: 10 }}
            />
            <Progress 
              percent={progress} 
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <Alert
            message="❌ 识别失败"
            description={error}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 20 }}
          />
        )}

        {/* 操作按钮 */}
        {results.length > 0 && (
          <Space style={{ marginBottom: 20 }}>
            <Button 
              icon={<ClearOutlined />} 
              onClick={handleClear}
            >
              清空结果
            </Button>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={handleExport}
              type="primary"
            >
              导出JSON
            </Button>
          </Space>
        )}

        {/* 识别结果 */}
        {results.length > 0 && (
          <div>
            <Title level={4}>📊 识别结果</Title>
            
            {/* 统计信息 */}
            {stats && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                gap: 16, 
                marginBottom: 20 
              }}>
                <div style={{ textAlign: 'center', padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{stats.totalRecords}</div>
                  <div style={{ color: '#666' }}>总记录数</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>+¥{stats.totalIncome.toFixed(2)}</div>
                  <div style={{ color: '#666' }}>总收入</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>-¥{stats.totalExpense.toFixed(2)}</div>
                  <div style={{ color: '#666' }}>总支出</div>
                </div>
                <div style={{ textAlign: 'center', padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                  <div style={{ 
                    fontSize: 24, 
                    fontWeight: 'bold', 
                    color: stats.netAmount >= 0 ? '#52c41a' : '#ff4d4f' 
                  }}>
                    {stats.netAmount >= 0 ? '+' : ''}¥{stats.netAmount.toFixed(2)}
                  </div>
                  <div style={{ color: '#666' }}>净收支</div>
                </div>
              </div>
            )}

            {/* 结果表格 */}
            <Table
              columns={columns}
              dataSource={results}
              rowKey={(record, index) => index}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 600 }}
              size="small"
            />
          </div>
        )}
      </Card>

      {/* 功能说明 */}
      <Card title="🎯 统一OCR服务特性" style={{ marginTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          <div>
            <Title level={5}>🌐 跨平台支持</Title>
            <ul>
              <li>Web浏览器端</li>
              <li>打包App (Electron/Capacitor)</li>
              <li>纯前端实现，无需后端</li>
            </ul>
          </div>
          <div>
            <Title level={5}>🤖 智能识别</Title>
            <ul>
              <li>微信账单自动检测</li>
              <li>压缩格式智能分割</li>
              <li>商家名称精确提取</li>
              <li>自动分类匹配</li>
            </ul>
          </div>
          <div>
            <Title level={5}>📊 高准确率</Title>
            <ul>
              <li>记录数量: 100%</li>
              <li>金额识别: 100%</li>
              <li>商家匹配: 62.5%</li>
              <li>自动分类: 50%</li>
            </ul>
          </div>
          <div>
            <Title level={5}>🔧 易于集成</Title>
            <ul>
              <li>React Hook封装</li>
              <li>TypeScript支持</li>
              <li>详细调试日志</li>
              <li>结果导出功能</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default OCRDemo;
