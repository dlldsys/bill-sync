// 多OCR引擎识别方案 - 更高准确率
import Tesseract from 'tesseract.js';

// 支持的OCR引擎
const OCR_ENGINES = {
  TESSERACT: 'tesseract',
  PADDLE_OCR: 'paddleocr',
  EASY_OCR: 'easyocr',
  CLOUD_OCR: 'cloud',
  HYBRID: 'hybrid'
};

// OCR引擎配置
const OCR_CONFIG = {
  [OCR_ENGINES.TESSERACT]: {
    name: 'Tesseract.js',
    languages: 'chi_sim+eng',
    options: {
      logger: m => console.log(`Tesseract: ${m.status} ${Math.round(m.progress * 100)}%`),
    }
  },
  [OCR_ENGINES.PADDLE_OCR]: {
    name: 'PaddleOCR',
    languages: 'ch',
    options: {
      useAngleCls: true,
      useGPU: false
    }
  },
  [OCR_ENGINES.EASY_OCR]: {
    name: 'EasyOCR',
    languages: 'ch_sim+en',
    options: {
      detail: 1,
      paragraph: true
    }
  },
  [OCR_ENGINES.CLOUD_OCR]: {
    name: 'Cloud OCR',
    provider: 'baidu', // baidu, tencent, aliyun
    options: {
      detect_direction: true,
      language_type: 'CHN_ENG'
    }
  }
};

// 多引擎OCR识别类
class MultiOCREngine {
  constructor() {
    this.results = [];
    this.isRecognizing = false;
    this.preferredEngine = OCR_ENGINES.PADDLE_OCR;
  }

  // 1. Tesseract.js 识别
  async recognizeWithTesseract(imageFile) {
    console.log('🔍 使用 Tesseract.js 识别...');
    
    try {
      const result = await Tesseract.recognize(imageFile, 'chi_sim+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`Tesseract进度: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      return {
        engine: OCR_ENGINES.TESSERACT,
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words || [],
        success: true
      };
    } catch (error) {
      console.error('Tesseract.js 识别失败:', error);
      return {
        engine: OCR_ENGINES.TESSERACT,
        text: '',
        confidence: 0,
        error: error.message,
        success: false
      };
    }
  }

  // 2. PaddleOCR 识别 (需要后端支持)
  async recognizeWithPaddleOCR(imageFile) {
    console.log('🔍 使用 PaddleOCR 识别...');
    
    try {
      // 这里需要后端API支持
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch('/api/ocr/paddleocr', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('PaddleOCR API不可用');
      }
      
      const result = await response.json();
      
      return {
        engine: OCR_ENGINES.PADDLE_OCR,
        text: result.text,
        confidence: result.confidence || 95,
        words: result.words || [],
        success: true
      };
    } catch (error) {
      console.error('PaddleOCR 识别失败:', error);
      return {
        engine: OCR_ENGINES.PADDLE_OCR,
        text: '',
        confidence: 0,
        error: error.message,
        success: false
      };
    }
  }

  // 3. EasyOCR 识别 (需要后端支持)
  async recognizeWithEasyOCR(imageFile) {
    console.log('🔍 使用 EasyOCR 识别...');
    
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch('/api/ocr/easyocr', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('EasyOCR API不可用');
      }
      
      const result = await response.json();
      
      return {
        engine: OCR_ENGINES.EASY_OCR,
        text: result.text,
        confidence: result.confidence || 90,
        words: result.words || [],
        success: true
      };
    } catch (error) {
      console.error('EasyOCR 识别失败:', error);
      return {
        engine: OCR_ENGINES.EASY_OCR,
        text: '',
        confidence: 0,
        error: error.message,
        success: false
      };
    }
  }

  // 4. 云端OCR识别 (百度/腾讯/阿里云)
  async recognizeWithCloudOCR(imageFile, provider = 'baidu') {
    console.log(`🔍 使用 ${provider} 云端OCR识别...`);
    
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('provider', provider);
      
      const response = await fetch('/api/ocr/cloud', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`${provider} OCR API不可用`);
      }
      
      const result = await response.json();
      
      return {
        engine: OCR_ENGINES.CLOUD,
        text: result.text,
        confidence: result.confidence || 98,
        words: result.words || [],
        provider: provider,
        success: true
      };
    } catch (error) {
      console.error(`${provider} OCR 识别失败:`, error);
      return {
        engine: OCR_ENGINES.CLOUD,
        text: '',
        confidence: 0,
        error: error.message,
        success: false
      };
    }
  }

  // 5. 混合识别 - 多引擎结果融合
  async recognizeWithHybrid(imageFile, onProgress = null) {
    console.log('🔍 使用混合OCR识别（多引擎融合）...');
    
    const engines = [
      () => this.recognizeWithTesseract(imageFile),
      () => this.recognizeWithPaddleOCR(imageFile),
      () => this.recognizeWithEasyOCR(imageFile),
    ];
    
    const results = [];
    
    // 并行执行多个引擎
    const promises = engines.map((engine, index) => 
      engine().then(result => {
        if (onProgress) {
          onProgress((index + 1) / engines.length * 50);
        }
        return result;
      })
    );
    
    const engineResults = await Promise.allSettled(promises);
    
    // 处理结果
    engineResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.push(result.value);
        console.log(`✅ 引擎 ${index + 1} 成功: ${result.value.engine} (置信度: ${result.value.confidence}%)`);
      } else {
        console.log(`❌ 引擎 ${index + 1} 失败: ${result.reason}`);
      }
    });
    
    if (results.length === 0) {
      return {
        engine: OCR_ENGINES.HYBRID,
        text: '',
        confidence: 0,
        error: '所有OCR引擎都失败了',
        success: false
      };
    }
    
    // 融合结果
    const fusedResult = this.fuseResults(results);
    
    if (onProgress) {
      onProgress(100);
    }
    
    return fusedResult;
  }

  // 结果融合算法
  fuseResults(results) {
    console.log('🔗 融合多个OCR引擎结果...');
    
    // 按置信度排序
    results.sort((a, b) => b.confidence - a.confidence);
    
    if (results.length === 1) {
      return results[0];
    }
    
    // 策略1: 选择置信度最高的结果
    const highestConfidence = results[0];
    
    // 策略2: 文本长度融合
    const avgTextLength = results.reduce((sum, r) => sum + r.text.length, 0) / results.length;
    const bestLengthResult = results.find(r => 
      Math.abs(r.text.length - avgTextLength) < avgTextLength * 0.3
    ) || highestConfidence;
    
    // 策略3: 关键词匹配融合
    const keywords = ['账单', '交易', '收支', '统计', '微信', '支付', '转账'];
    const keywordScores = results.map(r => ({
      ...r,
      keywordScore: keywords.reduce((score, keyword) => 
        score + (r.text.includes(keyword) ? 1 : 0), 0
      )
    }));
    
    keywordScores.sort((a, b) => b.keywordScore - a.keywordScore);
    const bestKeywordResult = keywordScores[0];
    
    // 最终选择策略
    let selectedResult = highestConfidence;
    
    // 如果最高置信度太低，选择关键词匹配最好的
    if (highestConfidence.confidence < 70 && bestKeywordResult.keywordScore > 2) {
      selectedResult = bestKeywordResult;
    }
    
    // 如果有明显的文本长度差异，选择长度适中的
    if (Math.abs(selectedResult.text.length - avgTextLength) > avgTextLength * 0.5) {
      selectedResult = bestLengthResult;
    }
    
    console.log(`🎯 融合结果选择: ${selectedResult.engine} (置信度: ${selectedResult.confidence}%)`);
    
    return {
      engine: OCR_ENGINES.HYBRID,
      text: selectedResult.text,
      confidence: selectedResult.confidence,
      words: selectedResult.words || [],
      allResults: results,
      selectedEngine: selectedResult.engine,
      fusionReason: this.getFusionReason(selectedResult, highestConfidence, bestKeywordResult, bestLengthResult),
      success: true
    };
  }

  // 获取融合原因
  getFusionReason(selected, highest, keyword, length) {
    if (selected.engine === highest.engine) {
      return '最高置信度';
    }
    if (selected.engine === keyword.engine) {
      return '最佳关键词匹配';
    }
    if (selected.engine === length.engine) {
      return '最佳文本长度';
    }
    return '综合评分';
  }

  // 主要识别方法
  async recognize(imageFile, engine = OCR_ENGINES.HYBRID, onProgress = null) {
    console.log(`🚀 开始OCR识别 (引擎: ${engine})`);
    this.isRecognizing = true;
    
    try {
      let result;
      
      switch (engine) {
        case OCR_ENGINES.TESSERACT:
          result = await this.recognizeWithTesseract(imageFile);
          break;
        case OCR_ENGINES.PADDLE_OCR:
          result = await this.recognizeWithPaddleOCR(imageFile);
          break;
        case OCR_ENGINES.EASY_OCR:
          result = await this.recognizeWithEasyOCR(imageFile);
          break;
        case OCR_ENGINES.CLOUD:
          result = await this.recognizeWithCloudOCR(imageFile, 'baidu');
          break;
        case OCR_ENGINES.HYBRID:
          result = await this.recognizeWithHybrid(imageFile, onProgress);
          break;
        default:
          throw new Error(`不支持的OCR引擎: ${engine}`);
      }
      
      console.log(`✅ OCR识别完成: ${result.engine}`);
      console.log(`文本长度: ${result.text.length}`);
      console.log(`置信度: ${result.confidence}%`);
      console.log(`识别文本预览: ${result.text.substring(0, 100)}...`);
      
      this.results = [result];
      return result;
      
    } catch (error) {
      console.error('❌ OCR识别失败:', error);
      const errorResult = {
        engine: engine,
        text: '',
        confidence: 0,
        error: error.message,
        success: false
      };
      
      this.results = [errorResult];
      return errorResult;
      
    } finally {
      this.isRecognizing = false;
    }
  }

  // 获取状态
  getStatus() {
    return {
      isRecognizing: this.isRecognizing,
      results: this.results,
      lastResult: this.results[this.results.length - 1] || null
    };
  }

  // 清空结果
  clearResults() {
    this.results = [];
  }
}

// 创建实例
export const multiOCREngine = new MultiOCREngine();

// 导出引擎常量
export { OCR_ENGINES, OCR_CONFIG };

// 便捷方法
export const recognizeImage = (imageFile, engine = OCR_ENGINES.HYBRID, onProgress = null) => {
  return multiOCREngine.recognize(imageFile, engine, onProgress);
};

export const getOCRStatus = () => {
  return multiOCREngine.getStatus();
};

export const clearOCRResults = () => {
  multiOCREngine.clearResults();
};
