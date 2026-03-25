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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles(selectedFiles);
    setPreviewUrls(selectedFiles.map((f) => URL.createObjectURL(f)));
    setOcrResults([]);
    setParsedBills([]);
    setCurrentImageIndex(0);
  };

  // 拖拽处理
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (droppedFiles.length === 0) return;

    setFiles(droppedFiles);
    setPreviewUrls(droppedFiles.map((f) => URL.createObjectURL(droppedFiles[0])));
    setOcrResults([]);
    setParsedBills([]);
    setCurrentImageIndex(0);
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
      const allParsed: ParsedBill[] = [];

      for (let i = 0; i < files.length; i++) {
        const result = await recognizeText(files[i]);
        results.push(result);
        const parsed = parseBillText(result.text);
        allParsed.push(...parsed);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      setOcrResults(results);
      setParsedBills(allParsed);
      Toast.show(`识别完成，共 ${allParsed.length} 条记录`);
    } catch (error) {
      console.error('OCR error:', error);
      Toast.show('识别失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 修改解析结果
  const updateParsedBill = (index: number, field: keyof ParsedBill, value: string | number) => {
    const updated = [...parsedBills];
    updated[index] = { ...updated[index], [field]: value };
    setParsedBills(updated);
  };

  // 删除单条记录
  const deleteParsedBill = (index: number) => {
    const updated = [...parsedBills];
    updated.splice(index, 1);
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

      // 匹配识别的类目到系统类目
      const bills: BillRecord[] = parsedBills.map((parsed, index) => {
        // 尝试匹配类目
        let matchedCategory = categories[0]?.id || '';
        if (parsed.category) {
          const matched = categories.find(c => 
            c.name.includes(parsed.category!) ||
            parsed.category!.includes(c.name)
          );
          if (matched) {
            matchedCategory = matched.id;
          }
        }

        return {
          id: generateId(),
          amount: parsed.amount || 0,
          category: matchedCategory,
          description: parsed.description || `图片${index + 1}`,
          date: parsed.date || now(),
          source: 'ocr' as const,
          rawText: ocrResults[currentImageIndex]?.text,
          createdAt: now(),
          updatedAt: now(),
          deviceId,
          syncVersion: 1,
          syncState: 'pending' as const,
        };
      });

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

  // 获取类目颜色
  const getCategoryColor = (categoryName?: string) => {
    if (!categoryName) return '#999';
    const matched = categories.find(c => 
      c.name.includes(categoryName) || categoryName.includes(c.name)
    );
    return matched?.color || '#999';
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
              点击或拖拽上传账单截图
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              支持 JPG、PNG 格式，可批量上传
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              支持微信/支付宝/银行账单截图
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
            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {previewUrls.map((url, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative',
                      border: currentImageIndex === index ? '2px solid #667eea' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {parsedBills.filter((_, i) => i >= getStartIndex(index) && i < getStartIndex(index + 1)).length > 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        background: '#667eea',
                        color: 'white',
                        fontSize: '10px',
                        borderRadius: '4px',
                        padding: '0 4px',
                      }}>
                        {parsedBills.filter((_, i) => i >= getStartIndex(index) && i < getStartIndex(index + 1)).length}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
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
                        top: '2px',
                        right: '2px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '8px',
                    border: '2px dashed #ddd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#999',
                    fontSize: '20px',
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
                已选择 {files.length} 张图片 · {parsedBills.length} 条记录待确认
              </div>
            </div>

            {/* OCR 进度 */}
            {isProcessing && (
              <div className="card" style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '8px' }}>
                  识别中... {progress}%
                  {progress < 100 && ' (请耐心等待)'}
                </div>
                <div style={{
                  height: '8px',
                  background: '#f0f0f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
            )}

            {/* OCR 结果 */}
            {parsedBills.length > 0 && (
              <div className="card" style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span>识别结果 ({parsedBills.length} 条)</span>
                  <span style={{ fontSize: '12px', color: '#999', fontWeight: 'normal' }}>
                    点击编辑
                  </span>
                </div>
                
                {/* 显示当前图片的识别结果 */}
                {(() => {
                  const startIdx = getStartIndex(currentImageIndex);
                  const endIdx = getStartIndex(currentImageIndex + 1);
                  const currentResults = parsedBills.slice(startIdx, endIdx);
                  
                  return currentResults.map((parsed, localIdx) => {
                    const globalIdx = startIdx + localIdx;
                    return (
                      <div
                        key={globalIdx}
                        style={{
                          padding: '12px',
                          background: '#f9f9f9',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          borderLeft: `3px solid ${getCategoryColor(parsed.category)}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#666' }}>
                            #{globalIdx + 1}
                          </span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {parsed.category && (
                              <span style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                background: getCategoryColor(parsed.category),
                                color: 'white',
                                borderRadius: '4px',
                              }}>
                                {parsed.category}
                              </span>
                            )}
                            <span style={{
                              fontSize: '10px',
                              color: parsed.confidence >= 60 ? '#52c41a' : parsed.confidence >= 40 ? '#faad14' : '#f5222d'
                            }}>
                              {parsed.confidence >= 60 ? '✓ 高' : parsed.confidence >= 40 ? '中' : '低'}
                            </span>
                            <button
                              onClick={() => deleteParsedBill(globalIdx)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#f5222d',
                                cursor: 'pointer',
                                fontSize: '16px',
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: '#999' }}>金额 (元)</div>
                            <input
                              type="number"
                              step="0.01"
                              value={parsed.amount || ''}
                              onChange={(e) =>
                                updateParsedBill(globalIdx, 'amount', parseFloat(e.target.value) || 0)
                              }
                              style={{
                                width: '100%',
                                padding: '6px 8px',
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
                                updateParsedBill(globalIdx, 'date', new Date(e.target.value).toISOString())
                              }
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '14px',
                              }}
                            />
                          </div>
                        </div>
                        
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#999' }}>商家</div>
                          <input
                            type="text"
                            value={parsed.merchant || ''}
                            onChange={(e) =>
                              updateParsedBill(globalIdx, 'merchant', e.target.value)
                            }
                            placeholder="自动识别，可手动修改"
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                            }}
                          />
                        </div>
                        
                        <div>
                          <div style={{ fontSize: '12px', color: '#999' }}>描述</div>
                          <input
                            type="text"
                            value={parsed.description || ''}
                            onChange={(e) =>
                              updateParsedBill(globalIdx, 'description', e.target.value)
                            }
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
                
                {/* 其他图片的记录数提示 */}
                {files.length > 1 && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    marginTop: '8px',
                    padding: '8px',
                    background: '#f0f0f0',
                    borderRadius: '4px',
                    textAlign: 'center'
                  }}>
                    共 {files.length} 张图片，点击上方缩略图切换查看
                  </div>
                )}
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
  
  // 辅助函数：计算每个图片的起始索引
  function getStartIndex(imageIndex: number): number {
    let count = 0;
    for (let i = 0; i < imageIndex && i < ocrResults.length; i++) {
      count += parseBillText(ocrResults[i].text).length;
    }
    return count;
  }
}

export default ImportPage;
