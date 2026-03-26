// React Hook for OCR Service
import { useState, useCallback } from 'react';
import { ocrService } from '../services/unified-ocr.js';

export const useOCR = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  // 处理图片OCR识别
  const processImage = useCallback(async (file) => {
    if (!file) {
      setError('请选择图片文件');
      return null;
    }

    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('请选择有效的图片文件 (JPG, PNG, WebP)');
      return null;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setResults([]);

    try {
      // 调用OCR服务
      const ocrResults = await ocrService.parseImage(file, (progressValue) => {
        setProgress(progressValue);
      });

      setResults(ocrResults);
      
      if (ocrResults.length === 0) {
        setError('未识别到有效的交易记录，请确保图片清晰且为微信账单');
      }

      return ocrResults;
    } catch (err) {
      console.error('OCR处理失败:', err);
      setError('OCR识别失败，请重试');
      return null;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  // 清空结果
  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setProgress(0);
    ocrService.clearResults();
  }, []);

  // 获取统计信息
  const getStatistics = useCallback(() => {
    if (results.length === 0) return null;

    const incomeRecords = results.filter(r => r.type === 'income');
    const expenseRecords = results.filter(r => r.type === 'expense');
    
    const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenseRecords.reduce((sum, r) => sum + r.amount, 0);

    return {
      totalRecords: results.length,
      incomeCount: incomeRecords.length,
      expenseCount: expenseRecords.length,
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense
    };
  }, [results]);

  return {
    // 状态
    isProcessing,
    progress,
    results,
    error,
    
    // 方法
    processImage,
    clearResults,
    getStatistics,
    
    // 工具方法
    getStatus: ocrService.getStatus.bind(ocrService),
    formatResults: ocrService.formatResults.bind(ocrService)
  };
};
