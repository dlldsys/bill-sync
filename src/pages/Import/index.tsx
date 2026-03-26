import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Toast } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { useBillStore, useCategoryStore } from '../../stores';
import { recognizeText, parseBillTextWithAutoMatch, parseBillText, type ParseBillResult } from '../../services/ocr';
import { generateId, now, getDeviceId, formatDate } from '../../utils';
import type { BillRecord, OCRResult } from '../../types';

// 每张图片的识别结果
interface ImageParseResult {
  imageIndex: number;
  ocrResult: OCRResult;
  parsedBills: ParseBillResult[];
}

function ImportPage() {
  const navigate = useNavigate();
  const importBills = useBillStore((state) => state.importBills);
  const categories = useCategoryStore((state) => state.categories);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [imageResults, setImageResults] = useState<ImageParseResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // 分离支出和收入分类
  const expenseCategories = categories.filter(c => !c.type || c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  // 计算所有识别结果
  const allParsedBills = useMemo(() => {
    return imageResults.flatMap(r => r.parsedBills);
  }, [imageResults]);

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles(selectedFiles);
    setPreviewUrls(selectedFiles.map((f) => URL.createObjectURL(f)));
    setImageResults([]);
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
    setPreviewUrls(droppedFiles.map((f) => URL.createObjectURL(f)));
    setImageResults([]);
    setCurrentImageIndex(0);
  };

  // OCR 识别 - 修复版本
  const handleOCR = async () => {
    if (files.length === 0) {
      Toast.show('请先选择图片');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setImageResults([]);

    try {
      const results: ImageParseResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ocrResult = await recognizeText(file);

        // 解析当前图片的账单
        const parsedBills = await parseBillTextWithAutoMatch(ocrResult.text);

        results.push({
          imageIndex: i,
          ocrResult,
          parsedBills,
        });

        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      setImageResults(results);

      // 统计信息
      const totalBills = results.reduce((sum, r) => sum + r.parsedBills.length, 0);
      const matchedCount = results.reduce((sum, r) =>
        sum + r.parsedBills.filter(b => b.matchedCategoryId).length, 0);

      if (totalBills > 0) {
        Toast.show(`识别完成，共 ${totalBills} 条记录（${matchedCount} 条已匹配分类）`);
      } else {
        Toast.show('未识别到有效记录');
      }
    } catch (error) {
      console.error('OCR error:', error);
      Toast.show('识别失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // 修改解析结果 - 修复版本
  const updateParsedBill = (imageIndex: number, billIndex: number, field: string, value: string | number) => {
    setImageResults(prev => {
      const updated = [...prev];
      const imageResult = updated.find(r => r.imageIndex === imageIndex);
      if (imageResult && imageResult.parsedBills[billIndex]) {
        (imageResult.parsedBills[billIndex] as any)[field] = value;
      }
      return updated;
    });
  };

  // 批量设置分类
  const batchSetCategory = (categoryId: string) => {
    if (!categoryId) {
      Toast.show('请先选择分类');
      return;
    }

    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    setImageResults(prev => {
      const updated = prev.map(imageResult => ({
        ...imageResult,
        parsedBills: imageResult.parsedBills.map(bill => ({
          ...bill,
          matchedCategoryId: categoryId,
          matchedCategoryName: category.name,
          category: category.name,
          billType: category.type || 'expense',
        })),
      }));
      return updated;
    });

    Toast.show(`已为所有记录设置为「${category.name}」`);
  };

  // 删除单条记录
  const deleteParsedBill = (imageIndex: number, billIndex: number) => {
    setImageResults(prev => {
      const updated = [...prev];
      const imageResult = updated.find(r => r.imageIndex === imageIndex);
      if (imageResult) {
        imageResult.parsedBills = imageResult.parsedBills.filter((_, idx) => idx !== billIndex);
      }
      return updated;
    });
  };

  // 检查有多少记录还未选择分类
  const getUnmatchedCount = () => {
    return allParsedBills.filter(p => !p.matchedCategoryId).length;
  };

  // 保存账单
  const handleSave = async () => {
    if (allParsedBills.length === 0) {
      Toast.show('没有可保存的账单');
      return;
    }

    // 检查未设置分类的记录
    const unmatchedCount = getUnmatchedCount();
    if (unmatchedCount > 0) {
      const confirm = window.confirm(`还有 ${unmatchedCount} 条记录未选择分类，确定要保存吗？未选择分类的记录将使用默认分类。`);
      if (!confirm) return;
    }

    setIsSaving(true);
    try {
      const deviceId = getDeviceId();
      let billIndex = 0;

      const bills: BillRecord[] = allParsedBills.map((parsed) => {
        let matchedCategory = '';

        // 如果有自动匹配的分类ID，直接使用
        if (parsed.matchedCategoryId) {
          matchedCategory = parsed.matchedCategoryId;
        } else {
          // 使用对应类型的第一个分类作为默认
          const targetCategories = !parsed.billType || parsed.billType === 'expense'
            ? expenseCategories
            : incomeCategories;
          if (targetCategories.length > 0) {
            matchedCategory = targetCategories[0].id;
          }
        }

        billIndex++;

        return {
          id: generateId(),
          amount: parsed.amount || 0,
          category: matchedCategory,
          description: parsed.description || `记录${billIndex}`,
          date: parsed.date || now(),
          source: 'ocr' as const,
          rawText: parsed.merchant ? `商家：${parsed.merchant}\n${parsed.description}` : parsed.description,
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
  const getCategoryColor = (categoryId?: string) => {
    if (!categoryId) return '#999';
    const matched = categories.find(c => c.id === categoryId);
    return matched?.color || '#999';
  };

  // 获取当前图片的识别结果
  const currentImageResult = imageResults.find(r => r.imageIndex === currentImageIndex);

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
              color: 'var(--text-primary)',
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
              border: '2px dashed var(--border-color)',
              background: 'var(--bg-primary)',
              textAlign: 'center',
              padding: '60px 20px',
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              点击或拖拽上传账单截图
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              支持 JPG、PNG 格式，可批量上传
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
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
                {previewUrls.map((url, index) => {
                  const result = imageResults.find(r => r.imageIndex === index);
                  const billCount = result ? result.parsedBills.length : 0;

                  return (
                    <div
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        position: 'relative',
                        border: currentImageIndex === index ? '2px solid var(--primary-color)' : '2px solid var(--border-light)',
                        cursor: 'pointer',
                      }}
                    >
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {billCount > 0 && (
                        <div style={{
                          position: 'absolute',
                          bottom: '2px',
                          right: '2px',
                          background: 'var(--primary-color)',
                          color: 'white',
                          fontSize: '10px',
                          borderRadius: '4px',
                          padding: '0 4px',
                        }}>
                          {billCount}
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
                          setImageResults([]);
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
                  );
                })}
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '8px',
                    border: '2px dashed var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
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
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                已选择 {files.length} 张图片 · {allParsedBills.length} 条记录待确认
              </div>
            </div>

            {/* OCR 进度 */}
            {isProcessing && (
              <div className="card" style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  识别中... {progress}%
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* OCR 结果 */}
            {imageResults.length > 0 && currentImageResult && (
              <div className="card" style={{ marginBottom: '16px' }}>
                {/* 标题栏 */}
                <div style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: 'var(--text-primary)',
                }}>
                  <span>
                    图片 {currentImageIndex + 1}/{files.length} 识别结果
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 'normal', marginLeft: '8px' }}>
                      ({currentImageResult.parsedBills.length} 条)
                    </span>
                  </span>
                  {getUnmatchedCount() > 0 && (
                    <span style={{
                      color: 'var(--accent-warning)',
                      fontSize: '12px',
                      fontWeight: 'normal',
                      background: 'rgba(250, 173, 20, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                    }}>
                      {getUnmatchedCount()} 条未分类
                    </span>
                  )}
                </div>

                {/* 批量选择分类 */}
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: 'var(--bg-primary)',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    批量设置分类：
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => {
                        const catId = e.target.value;
                        setSelectedCategoryId(catId);
                        if (catId) {
                          batchSetCategory(catId);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        background: 'white',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <option value="">选择分类...</option>
                      <optgroup label="支出分类">
                        {expenseCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </optgroup>
                      {incomeCategories.length > 0 && (
                        <optgroup label="收入分类">
                          {incomeCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>

                {/* 当前图片的识别结果列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {currentImageResult.parsedBills.map((parsed, billIndex) => (
                    <div
                      key={billIndex}
                      style={{
                        padding: '16px',
                        background: 'var(--bg-primary)',
                        borderRadius: '12px',
                        borderLeft: `3px solid ${getCategoryColor(parsed.matchedCategoryId)}`,
                      }}
                    >
                      {/* 头部：序号和删除按钮 */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          fontWeight: '500',
                        }}>
                          记录 #{billIndex + 1}
                          {parsed.rawDate && (
                            <span style={{ marginLeft: '8px', color: 'var(--primary-color)' }}>
                              (识别到日期)
                            </span>
                          )}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {parsed.matchedCategoryId && (
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              background: getCategoryColor(parsed.matchedCategoryId),
                              color: 'white',
                              borderRadius: '10px',
                            }}>
                              {parsed.category}
                            </span>
                          )}
                          <button
                            onClick={() => deleteParsedBill(currentImageIndex, billIndex)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-danger)',
                              cursor: 'pointer',
                              fontSize: '18px',
                              padding: '0 4px',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {/* 金额和日期 */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        marginBottom: '12px',
                      }}>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            金额 (元)
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={parsed.amount || ''}
                            onChange={(e) =>
                              updateParsedBill(currentImageIndex, billIndex, 'amount', parseFloat(e.target.value) || 0)
                            }
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: 'white',
                            }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            日期 {parsed.rawDate && '✓'}
                          </div>
                          <input
                            type="date"
                            value={parsed.date ? parsed.date.split('T')[0] : ''}
                            onChange={(e) =>
                              updateParsedBill(currentImageIndex, billIndex, 'date', new Date(e.target.value).toISOString())
                            }
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: 'white',
                            }}
                          />
                        </div>
                      </div>

                      {/* 商家 */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          商家
                        </div>
                        <input
                          type="text"
                          value={parsed.merchant || ''}
                          onChange={(e) =>
                            updateParsedBill(currentImageIndex, billIndex, 'merchant', e.target.value)
                          }
                          placeholder="自动识别，可手动修改"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            background: 'white',
                          }}
                        />
                      </div>

                      {/* 收支类型 */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          类型
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className={`btn ${!parsed.billType || parsed.billType === 'expense' ? 'btn-primary' : 'btn-outline'}`}
                            style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                            onClick={() => updateParsedBill(currentImageIndex, billIndex, 'billType', 'expense')}
                          >
                            支出
                          </button>
                          <button
                            className={`btn ${parsed.billType === 'income' ? 'btn-primary' : 'btn-outline'}`}
                            style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                            onClick={() => updateParsedBill(currentImageIndex, billIndex, 'billType', 'income')}
                          >
                            收入
                          </button>
                        </div>
                      </div>

                      {/* 单独分类选择 */}
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          分类
                        </div>
                        <select
                          value={parsed.matchedCategoryId || ''}
                          onChange={(e) => {
                            const catId = e.target.value;
                            const category = categories.find(c => c.id === catId);
                            if (category) {
                              setImageResults(prev => {
                                const updated = [...prev];
                                const imageResult = updated.find(r => r.imageIndex === currentImageIndex);
                                if (imageResult && imageResult.parsedBills[billIndex]) {
                                  imageResult.parsedBills[billIndex].matchedCategoryId = catId;
                                  imageResult.parsedBills[billIndex].matchedCategoryName = category.name;
                                  imageResult.parsedBills[billIndex].category = category.name;
                                  imageResult.parsedBills[billIndex].billType = category.type || 'expense';
                                  imageResult.parsedBills[billIndex].icon = category.icon;
                                }
                                return updated;
                              });
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            background: 'white',
                            cursor: 'pointer',
                            color: parsed.matchedCategoryId ? getCategoryColor(parsed.matchedCategoryId) : 'var(--text-muted)',
                          }}
                        >
                          <option value="">选择分类...</option>
                          <optgroup label="支出分类">
                            {expenseCategories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.name}
                              </option>
                            ))}
                          </optgroup>
                          {incomeCategories.length > 0 && (
                            <optgroup label="收入分类">
                              {incomeCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.icon} {cat.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* 描述 */}
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          描述
                        </div>
                        <input
                          type="text"
                          value={parsed.description || ''}
                          onChange={(e) =>
                            updateParsedBill(currentImageIndex, billIndex, 'description', e.target.value)
                          }
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            background: 'white',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 切换图片提示 */}
                {files.length > 1 && (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    marginTop: '16px',
                    padding: '12px',
                    background: 'var(--bg-primary)',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}>
                    点击上方缩略图切换查看其他图片的识别结果
                  </div>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {imageResults.length === 0 ? (
                <Button
                  block
                  color="primary"
                  size="large"
                  loading={isProcessing}
                  onClick={handleOCR}
                  style={{
                    background: 'var(--primary-color)',
                    borderRadius: '24px',
                  }}
                >
                  开始识别
                </Button>
              ) : (
                <>
                  <Button
                    block
                    size="large"
                    onClick={() => {
                      setImageResults([]);
                    }}
                    style={{
                      borderRadius: '24px',
                      border: '1px solid var(--border-color)',
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
                    style={{
                      background: 'var(--primary-color)',
                      borderRadius: '24px',
                    }}
                  >
                    保存 ({allParsedBills.length})
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
