import { useState, useCallback } from 'react';
import { recognizeImage, getOCRStatus, stopOCR, OCREngine, FrontendOCRResult, imageUtils } from '../services/frontend-ocr';

export interface UseOCRState {
  isProcessing: boolean;
  progress: number;
  result: FrontendOCRResult | null;
  error: string | null;
  engine: OCREngine;
}

export interface UseOCRActions {
  processImage: (file: File, engine?: OCREngine) => Promise<FrontendOCRResult | null>;
  stopProcessing: () => void;
  clearResults: () => void;
  compressImage: (file: File, maxWidth?: number, quality?: number) => Promise<File>;
  validateImage: (file: File) => { valid: boolean; error?: string };
  getImageInfo: (file: File) => Promise<{ width: number; height: number; size: number }>;
}

export const useOCR = (defaultEngine: OCREngine = OCREngine.HYBRID): UseOCRState & UseOCRActions => {
  const [state, setState] = useState<UseOCRState>({
    isProcessing: false,
    progress: 0,
    result: null,
    error: null,
    engine: defaultEngine
  });

  const processImage = useCallback(async (
    file: File, 
    engine: OCREngine = defaultEngine
  ): Promise<FrontendOCRResult | null> => {
    // 验证图片
    const validation = imageUtils.validateImage(file);
    if (!validation.valid) {
      setState(prev => ({
        ...prev,
        error: validation.error || '图片验证失败',
        isProcessing: false
      }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: 0,
      error: null,
      result: null,
      engine
    }));

    try {
      const result = await recognizeImage(file, engine, (progress) => {
        setState(prev => ({ ...prev, progress: Math.round(progress) }));
      });

      setState(prev => ({
        ...prev,
        result,
        isProcessing: false,
        progress: 100
      }));

      return result;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'OCR识别失败',
        isProcessing: false,
        progress: 0
      }));
      return null;
    }
  }, [defaultEngine]);

  const stopProcessing = useCallback(() => {
    stopOCR();
    setState(prev => ({
      ...prev,
      isProcessing: false,
      progress: 0,
      error: '用户取消识别'
    }));
  }, []);

  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      result: null,
      error: null,
      progress: 0
    }));
  }, []);

  const compressImage = useCallback(async (
    file: File, 
    maxWidth: number = 1024, 
    quality: number = 0.9
  ): Promise<File> => {
    return imageUtils.compressImage(file, maxWidth, quality);
  }, []);

  const validateImage = useCallback((file: File) => {
    return imageUtils.validateImage(file);
  }, []);

  const getImageInfo = useCallback(async (file: File) => {
    return imageUtils.getImageInfo(file);
  }, []);

  return {
    ...state,
    processImage,
    stopProcessing,
    clearResults,
    compressImage,
    validateImage,
    getImageInfo
  };
};
