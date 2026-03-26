// 纯前端多OCR引擎解决方案
import * as Tesseract from 'tesseract.js';

// OCR引擎枚举
export enum OCREngine {
  TESSERACT = 'tesseract',
  TESSERACT_CHINESE = 'tesseract_chinese',
  TESSERACT_ENGLISH = 'tesseract_english',
  HYBRID = 'hybrid'
}

// OCR识别结果
export interface FrontendOCRResult {
  engine: OCREngine;
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox?: number[];
  }>;
  processTime?: number;
  success: boolean;
  error?: string;
}

// 纯前端OCR识别类
class FrontendOCREngine {
  private isRecognizing = false;
  private currentJob: any = null;

  // Tesseract.js 配置
  private tesseractConfigs = {
    [OCREngine.TESSERACT]: {
      languages: 'chi_sim+eng',
      options: {
        logger: (m: any) => console.log(`Tesseract: ${m.status} ${Math.round(m.progress * 100)}%`),
      }
    },
    [OCREngine.TESSERACT_CHINESE]: {
      languages: 'chi_sim',
      options: {
        logger: (m: any) => console.log(`Tesseract中文: ${m.status} ${Math.round(m.progress * 100)}%`),
      }
    },
    [OCREngine.TESSERACT_ENGLISH]: {
      languages: 'eng',
      options: {
        logger: (m: any) => console.log(`Tesseract英文: ${m.status} ${Math.round(m.progress * 100)}%`),
      }
    }
  };

  // 图片预处理
  private preprocessImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // 计算合适的尺寸
          const maxWidth = 1024;
          const maxHeight = 1024;
          let { width, height } = img;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;

          // 绘制并增强图片
          if (ctx) {
            // 先绘制原图
            ctx.drawImage(img, 0, 0, width, height);
            
            // 获取图像数据
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // 增强对比度和亮度
            const contrast = 1.2;
            const brightness = 1.1;
            
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128 + brightness));     // R
              data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128 + brightness)); // G
              data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128 + brightness)); // B
            }

            // 放回处理后的图像
            ctx.putImageData(imageData, 0, 0);
            
            // 转换为Blob
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                resolve(url);
              } else {
                reject(new Error('图片预处理失败'));
              }
            }, 'image/jpeg', 0.9);
          } else {
            reject(new Error('Canvas context获取失败'));
          }
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  // Tesseract.js 识别
  private async recognizeWithTesseract(file: File, engine: OCREngine, onProgress?: (progress: number) => void): Promise<FrontendOCRResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 使用 ${engine} 识别...`);
      
      const config = this.tesseractConfigs[engine];
      if (!config) {
        throw new Error(`不支持的引擎: ${engine}`);
      }

      // 预处理图片
      const processedImageUrl = await this.preprocessImage(file);
      
      // 创建图片元素
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = processedImageUrl;
      });

      const result = await Tesseract.recognize(img, config.languages, {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(m.progress * 100);
          }
        }
      });

      // 清理资源
      URL.revokeObjectURL(processedImageUrl);

      const processTime = Date.now() - startTime;

      return {
        engine,
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words || [],
        processTime,
        success: true
      };

    } catch (error) {
      return {
        engine,
        text: '',
        confidence: 0,
        success: false,
        error: error.message
      };
    }
  }

  // 混合识别 - 多种Tesseract配置
  private async recognizeWithHybrid(file: File, onProgress?: (progress: number) => void): Promise<FrontendOCRResult> {
    console.log('🔍 使用混合OCR识别（多配置融合）...');
    
    const engines = [
      OCREngine.TESSERACT_CHINESE,
      OCREngine.TESSERACT_ENGLISH,
      OCREngine.TESSERACT
    ];

    const results: FrontendOCRResult[] = [];
    
    // 串行执行以避免资源竞争
    for (let i = 0; i < engines.length; i++) {
      const engine = engines[i];
      
      try {
        const result = await this.recognizeWithTesseract(file, engine, (progress) => {
          if (onProgress) {
            onProgress((i + progress / 100) / engines.length * 100);
          }
        });
        
        if (result.success) {
          results.push(result);
          console.log(`✅ ${engine} 成功: 置信度${result.confidence}%`);
        } else {
          console.log(`❌ ${engine} 失败: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${engine} 失败: ${error.message}`);
      }
    }

    if (results.length === 0) {
      return {
        engine: OCREngine.HYBRID,
        text: '',
        confidence: 0,
        success: false,
        error: '所有OCR配置都失败了'
      };
    }

    // 融合结果
    const fusedResult = this.fuseResults(results);
    
    if (onProgress) onProgress(100);
    
    return {
      engine: OCREngine.HYBRID,
      text: fusedResult.text,
      confidence: fusedResult.confidence,
      words: fusedResult.words,
      processTime: fusedResult.processTime,
      success: true,
      allResults: results
    };
  }

  // 结果融合算法
  private fuseResults(results: FrontendOCRResult[]): FrontendOCRResult {
    console.log('🔗 融合多个OCR结果...');
    
    if (results.length === 1) {
      return results[0];
    }

    // 按置信度排序
    const sortedByConfidence = [...results].sort((a, b) => b.confidence - a.confidence);
    const highest = sortedByConfidence[0];

    // 关键词评分
    const keywords = ['账单', '交易', '收支', '统计', '微信', '支付', '转账', '金额', '商家', '日期'];
    const keywordScores = results.map(r => ({
      ...r,
      keywordScore: keywords.reduce((score, keyword) => 
        score + (r.text.includes(keyword) ? 1 : 0), 0
    )
    }));

    keywordScores.sort((a, b) => b.keywordScore - a.keywordScore);
    const bestKeyword = keywordScores[0];

    // 文本长度评分
    const avgLength = results.reduce((sum, r) => sum + r.text.length, 0) / results.length;
    const bestLength = results.find(r => 
      Math.abs(r.text.length - avgLength) < avgLength * 0.3
    ) || highest;

    // 数字识别评分
    const numberScores = results.map(r => ({
      ...r,
      numberScore: (r.text.match(/\d+\.?\d*/g) || []).length
    }));

    numberScores.sort((a, b) => b.numberScore - a.numberScore);
    const bestNumbers = numberScores[0];

    // 选择最佳结果
    let selected = highest;
    let fusionReason = '最高置信度';

    if (highest.confidence < 70 && bestKeyword.keywordScore > 2) {
      selected = bestKeyword;
      fusionReason = '最佳关键词匹配';
    }

    if (bestNumbers.numberScore > bestKeyword.keywordScore && bestNumbers.numberScore > 3) {
      selected = bestNumbers;
      fusionReason = '最佳数字识别';
    }

    if (Math.abs(selected.text.length - avgLength) > avgLength * 0.5) {
      selected = bestLength;
      fusionReason = '最佳文本长度';
    }

    console.log(`🎯 融合结果选择: ${selected.engine} (${fusionReason})`);

    return {
      engine: OCREngine.HYBRID,
      text: selected.text,
      confidence: selected.confidence,
      words: selected.words || [],
      processTime: selected.processTime || 0,
      success: true,
      fusionReason
    };
  }

  // 主要识别方法
  async recognize(file: File, engine: OCREngine = OCREngine.HYBRID, onProgress?: (progress: number) => void): Promise<FrontendOCRResult> {
    if (this.isRecognizing) {
      throw new Error('OCR识别正在进行中');
    }

    this.isRecognizing = true;

    try {
      console.log(`🚀 开始OCR识别 (引擎: ${engine})`);
      
      let result: FrontendOCRResult;

      switch (engine) {
        case OCREngine.TESSERACT:
        case OCREngine.TESSERACT_CHINESE:
        case OCREngine.TESSERACT_ENGLISH:
          result = await this.recognizeWithTesseract(file, engine, onProgress);
          break;
        case OCREngine.HYBRID:
          result = await this.recognizeWithHybrid(file, onProgress);
          break;
        default:
          throw new Error(`不支持的OCR引擎: ${engine}`);
      }

      console.log(`✅ OCR识别完成: ${result.engine}`);
      console.log(`📝 文本长度: ${result.text.length}`);
      console.log(`🎯 置信度: ${result.confidence}%`);
      console.log(`⏱️ 处理时间: ${result.processTime || 0}ms`);

      return result;

    } catch (error) {
      console.error('❌ OCR识别失败:', error);
      return {
        engine,
        text: '',
        confidence: 0,
        success: false,
        error: error.message
      };
    } finally {
      this.isRecognizing = false;
    }
  }

  // 停止识别
  stop(): void {
    if (this.currentJob) {
      this.currentJob.terminate();
      this.currentJob = null;
    }
    this.isRecognizing = false;
  }

  // 获取状态
  getStatus(): { isRecognizing: boolean; currentEngine?: OCREngine } {
    return {
      isRecognizing: this.isRecognizing,
      currentEngine: this.currentJob?.engine
    };
  }
}

// 创建实例
export const frontendOCREngine = new FrontendOCREngine();

// 便捷方法
export const recognizeImage = (file: File, engine: OCREngine = OCREngine.HYBRID, onProgress?: (progress: number) => void) => {
  return frontendOCREngine.recognize(file, engine, onProgress);
};

export const getOCRStatus = () => {
  return frontendOCREngine.getStatus();
};

export const stopOCR = () => {
  frontendOCREngine.stop();
};

// 图片处理工具
export const imageUtils = {
  // 压缩图片
  compressImage: (file: File, maxWidth: number = 1024, quality: number = 0.9): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          const ratio = Math.min(maxWidth / img.width, 1);
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;

          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                reject(new Error('图片压缩失败'));
              }
            }, 'image/jpeg', quality);
          } else {
            reject(new Error('Canvas context获取失败'));
          }
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  },

  // 获取图片信息
  getImageInfo: (file: File): Promise<{ width: number; height: number; size: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height,
          size: file.size
        });
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  },

  // 验证图片
  validateImage: (file: File): { valid: boolean; error?: string } => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      return { valid: false, error: '只支持 JPG、PNG、BMP、WebP 格式的图片' };
    }

    if (file.size > maxSize) {
      return { valid: false, error: '图片大小不能超过 10MB' };
    }

    return { valid: true };
  }
};
