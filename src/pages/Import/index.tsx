import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Toast } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { useBillStore, useCategoryStore } from '../../stores';
import { recognizeText, parseBillText } from '../../services/ocr';
import { generateId, now, getDeviceId } from '../../utils';
import type { BillRecord, OCRResult, ParsedBill } from '../../types';

function ImportPage() {
  const navigate = useNavigate();
  const importBills = useBillStore((state) => state.importBills);
  const categories = useCategoryStore((state) => state.categories);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
  const [parsedBills, setParsedBills] = useState<ParsedBill[]>([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles(selectedFiles);
    setPreviewUrls(selectedFiles.map((f) => URL.createObjectURL(f)));
    setOcrResults([]);
    setParsedBills([]);
  };

  // 拖拽处理
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (droppedFiles.length === 0) return;

    setFiles(droppedFiles);
    setPreviewUrls(droppedFiles.map((f) => URL.createObjectURL(f)));
    setOcrResults([]);
    setParsedBills([]);
  };

  // OCR 识别
  const handleOCR = async () => {
    if (files.length === 0) {
      Toast.show('请先选择图片');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const results: OCRResult[] = [];
      const parsed: ParsedBill[] = [];

      for (let i = 0; i < files.length; i++) {
        const result = await recognizeText(files[i]);
        results.push(result);
        parsed.push(parseBillText(result.text));
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      setOcrResults(results);
      setParsedBills(parsed);
      Toast.show('识别完成');
    } catch (error) {
      console.error('OCR error:', error);
      Toast.show('识别失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 修改解析结果
  const updateParsedBill = (index: number, field: keyof ParsedBill, value: string | number | Date) => {
    const updated = [...parsedBills];
    updated[index] = { ...updated[index], [field]: value };
    setParsedBills(updated);
  };

  // 保存账单
  const handleSave = async () => {
    if (parsedBills.length === 0) {
      Toast.show('没有可保存的账单');
      return;
    }

    setIsSaving(true);
    try {
      const deviceId = getDeviceId();
      const defaultCategory = categories[0]?.id || '';

      const bills: BillRecord[] = parsedBills.map((parsed, index) => ({
        id: generateId(),
        amount: parsed.amount || 0,
        category: defaultCategory,
        description: parsed.description || `图片${index + 1}`,
        date: parsed.date || now(),
        source: 'ocr' as const,
        rawText: ocrResults[index]?.text,
        createdAt: now(),
        updatedAt: now(),
        deviceId,
        syncVersion: 1,
        syncState: 'pending' as const,
      }));

      await importBills(bills);
      Toast.show(`成功保存 ${bills.length} 笔账单`);
      navigate('/');
    } catch (error) {
      console.error('Save error:', error);
      Toast.show('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page">
      {/* 头部 */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ←
          </button>
          <h1>拍照识别</h1>
        </div>
      </div>

      {/* 内容 */}
      <div className="page-content">
        {/* 文件上传区域 */}
        {previewUrls.length === 0 ? (
          <div
            className="card"
            style={{
              border: '2px dashed #ddd',
              background: '#fafafa',
              textAlign: 'center',
              padding: '60px 20px',
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
            <div style={{ color: '#666', marginBottom: '8px' }}>
              点击或拖拽上传图片
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              支持 JPG、PNG 格式
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>
        ) : (
          <>
            {/* 图片预览 */}
            <div
              className="card"
              style={{ marginBottom: '16px' }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '12px',
                }}
              >
                {previewUrls.map((url, index) => (
                  <div
                    key={index}
                    style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <button
                      onClick={() => {
                        const newFiles = [...files];
                        const newPreviews = [...previewUrls];
                        newFiles.splice(index, 1);
                        newPreviews.splice(index, 1);
                        setFiles(newFiles);
                        setPreviewUrls(newPreviews);
                        setParsedBills([]);
                        setOcrResults([]);
                      }}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '8px',
                    border: '2px dashed #ddd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#999',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  +
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </div>
              <div style={{ fontSize: '13px', color: '#999' }}>
                已选择 {files.length} 张图片
              </div>
            </div>

            {/* OCR 进度 */}
            {isProcessing && (
              <div className="card" style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '8px' }}>识别中... {progress}%</div>
                <div style={{
                  height: '8px',
                  background: '#f0f0f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: '#667eea',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
            )}

            {/* OCR 结果 */}
            {parsedBills.length > 0 && (
              <div className="card" style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    marginBottom: '12px',
                  }}
                >
                  识别结果 ({parsedBills.length})
                </div>
                {parsedBills.map((parsed, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      background: '#f5f5f5',
                      borderRadius: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', color: '#999' }}>金额</div>
                        <input
                          type="number"
                          value={parsed.amount || ''}
                          onChange={(e) =>
                            updateParsedBill(index, 'amount', parseFloat(e.target.value) || 0)
                          }
                          style={{
                            width: '100%',
                            padding: '6px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#999' }}>日期</div>
                        <input
                          type="date"
                          value={parsed.date?.split('T')[0] || ''}
                          onChange={(e) =>
                            updateParsedBill(index, 'date', new Date(e.target.value).toISOString())
                          }
                          style={{
                            width: '100%',
                            padding: '6px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '14px',
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#999' }}>描述</div>
                      <input
                        type="text"
                        value={parsed.description || ''}
                        onChange={(e) =>
                          updateParsedBill(index, 'description', e.target.value)
                        }
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {parsedBills.length === 0 ? (
                <Button
                  block
                  color="primary"
                  size="large"
                  loading={isProcessing}
                  onClick={handleOCR}
                >
                  开始识别
                </Button>
              ) : (
                <>
                  <Button
                    block
                    color="default"
                    size="large"
                    onClick={() => {
                      setParsedBills([]);
                      setOcrResults([]);
                    }}
                  >
                    重新识别
                  </Button>
                  <Button
                    block
                    color="primary"
                    size="large"
                    loading={isSaving}
                    onClick={handleSave}
                  >
                    保存 ({parsedBills.length})
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default ImportPage;
