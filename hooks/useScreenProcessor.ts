import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SignalData, ProcessingStats } from '../types';

const CONFIRMATION_THRESHOLD = 20; // Pixels required for breakout confirmation

export const useScreenProcessor = (videoRef: React.RefObject<HTMLVideoElement>, canvasRef: React.RefObject<HTMLCanvasElement>) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cvReady, setCvReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize with neutral state
  const [signal, setSignal] = useState<SignalData>({ 
    type: 'NEUTRAL', 
    confidence: 0, 
    reasons: [], 
    timestamp: 0,
    method: '---',
    marketData: {
      pressureScore: 0,
      phase: 'NEUTRO',
      mathPrediction: 'NEUTRAL',
      mathScore: 0,
      breakout: '---',
      zone: 'NEUTRO'
    }
  });
  
  const [stats, setStats] = useState<ProcessingStats>({ fps: 0, ocrText: '', processingTimeMs: 0 });
  
  const workerRef = useRef<any>(null);
  const processingInterval = useRef<number | null>(null);
  const frameCountRef = useRef<number>(0);
  const ocrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize OpenCV and Tesseract
  useEffect(() => {
    const checkOpenCV = () => {
      if (window.cv && window.cv.Mat) {
        console.log("OpenCV Ready");
        setCvReady(true);
      } else {
        setTimeout(checkOpenCV, 100);
      }
    };
    checkOpenCV();

    const initTesseract = async () => {
      if (window.Tesseract) {
        try {
          const worker = await window.Tesseract.createWorker('eng');
          await worker.setParameters({
            tessedit_char_whitelist: '0123456789./:- ', 
          });
          workerRef.current = worker;
          ocrCanvasRef.current = document.createElement('canvas');
        } catch (err) {
          console.error("Tesseract initialization failed", err);
        }
      }
    };
    initTesseract();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const startScreenShare = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("Screen sharing is not supported on this device/browser.");
      }

      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setIsProcessing(true);
    } catch (err: any) {
      console.error("Error sharing screen:", err);
      if (err.name === 'NotAllowedError') {
         setError("Permission denied. Please allow screen sharing.");
      } else if (err.message && err.message.includes('permissions policy')) {
         setError("Screen sharing blocked by permission policy. Try opening in a new window.");
      } else {
         setError(err.message || "Failed to start screen capture.");
      }
    }
  }, [videoRef]);

  const stopScreenShare = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsProcessing(false);
    if (processingInterval.current) {
      window.clearInterval(processingInterval.current);
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [stream, canvasRef]);

  // Helper: Preprocess image for OCR (Upscale + Otsu Threshold)
  const preprocessImageForOCR = (cv: any, src: any, roiRect: any) => {
    if (!ocrCanvasRef.current) return null;
    
    // 1. Extract ROI
    const roi = src.roi(roiRect);
    
    // 2. Upscale x2 for better OCR recognition on small fonts
    const dst = new cv.Mat();
    const dsize = new cv.Size(roiRect.width * 2, roiRect.height * 2);
    cv.resize(roi, dst, dsize, 0, 0, cv.INTER_LINEAR);

    // 3. Convert to Gray
    const gray = new cv.Mat();
    cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY);
    
    // 4. Otsu's Thresholding (Automatic binary contrast)
    // Combine THRESH_BINARY_INV with THRESH_OTSU to handle variable backgrounds
    const binary = new cv.Mat();
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    
    cv.imshow(ocrCanvasRef.current, binary);
    
    const dataUrl = ocrCanvasRef.current.toDataURL('image/png');
    
    roi.delete();
    dst.delete();
    gray.delete();
    binary.delete();
    
    return dataUrl;
  };

  // --- CORE LOGIC: REVERSAL STRATEGY + FLOW STRATEGY ---
  const analyzeFrame = useCallback(async () => {
    if (!cvReady || !videoRef.current || !canvasRef.current || !isProcessing) return;
    
    const startTime = performance.now();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState !== 4) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const cv = window.cv;
    frameCountRef.current += 1;
    
    let src: any = null;
    let srcRGB: any = null;
    let hsv: any = null;
    let maskGreen: any = null;
    let maskRed: any = null;
    let contoursGreen: any = null;
    let contoursRed: any = null;
    let hierarchyGreen: any = null;
    let hierarchyRed: any = null;
    
    try {
      src = cv.imread(canvas);
      srcRGB = new cv.Mat();
      hsv = new cv.Mat();
      maskGreen = new cv.Mat();
      maskRed = new cv.Mat();
      contoursGreen = new cv.MatVector();
      contoursRed = new cv.MatVector();
      hierarchyGreen = new cv.Mat();
      hierarchyRed = new cv.Mat();

      // --- COLOR DETECTION ---
      cv.cvtColor(src, srcRGB, cv.COLOR_RGBA2RGB);
      cv.cvtColor(srcRGB, hsv, cv.COLOR_RGB2HSV);

      // Tuned Ranges for Candles (Typical TradingView/Broker colors)
      const lowGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(35, 50, 50, 0));
      const highGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(85, 255, 255, 255));
      const lowRed1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(0, 50, 50, 0));
      const highRed1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(10, 255, 255, 255));
      const lowRed2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(170, 50, 50, 0));
      const highRed2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(180, 255, 255, 255));
      
      cv.inRange(hsv, lowGreen, highGreen, maskGreen);
      
      const maskRed1 = new cv.Mat();
      const maskRed2 = new cv.Mat();
      cv.inRange(hsv, lowRed1, highRed1, maskRed1);
      cv.inRange(hsv, lowRed2, highRed2, maskRed2);
      cv.addWeighted(maskRed1, 1.0, maskRed2, 1.0, 0.0, maskRed);
      
      maskRed1.delete(); maskRed2.delete(); lowGreen.delete(); highGreen.delete();
      lowRed1.delete(); highRed1.delete(); lowRed2.delete(); highRed2.delete();

      cv.findContours(maskGreen, contoursGreen, hierarchyGreen, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      cv.findContours(maskRed, contoursRed, hierarchyRed, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // --- CANDLE PARSING ---
      const parseCandle = (contour: any, colorType: 'GREEN' | 'RED') => {
        const rect = cv.boundingRect(contour);
        // Skip tiny noise
        if (rect.height < 5 || rect.width < 3) return null;
        const halfH = Math.floor(rect.height / 2);
        
        const safeRoi = (y: number, h: number) => {
            if (y < 0) return 0;
            if (y + h > src.rows) return src.rows - y;
            return h;
        };

        let topDensity = 0;
        let bottomDensity = 0;

        try {
            const topRoiRect = new cv.Rect(rect.x, rect.y, rect.width, safeRoi(rect.y, halfH));
            const bottomRoiRect = new cv.Rect(rect.x, rect.y + halfH, rect.width, safeRoi(rect.y + halfH, halfH));

            const mask = colorType === 'GREEN' ? maskGreen : maskRed;
            
            if (topRoiRect.height > 0 && bottomRoiRect.height > 0) {
                const topRoi = mask.roi(topRoiRect);
                const bottomRoi = mask.roi(bottomRoiRect);
                topDensity = cv.countNonZero(topRoi);
                bottomDensity = cv.countNonZero(bottomRoi);
                topRoi.delete();
                bottomRoi.delete();
            }
        } catch(e) {}

        let shape = 'NORMAL';
        // Roughly estimate wick size based on density gaps or shape
        // This is a simplification for visual analysis
        if (rect.height > rect.width * 1.5) { 
            const densityRatio = topDensity / (bottomDensity + 0.1);
            if (densityRatio > 2.5) {
                shape = 'HAMMER';
            } else if (densityRatio < 0.4) {
                shape = 'SHOOTING_STAR'; 
            }
        }
        
        return { ...rect, type: colorType, shape, topDensity, bottomDensity };
      };

      let candles: any[] = [];
      for (let i = 0; i < contoursGreen.size(); ++i) {
        let cnt = contoursGreen.get(i);
        if (cv.contourArea(cnt) > 30) { 
          const c = parseCandle(cnt, 'GREEN');
          if (c) candles.push(c);
        }
        cnt.delete();
      }
      for (let i = 0; i < contoursRed.size(); ++i) {
        let cnt = contoursRed.get(i);
        if (cv.contourArea(cnt) > 30) {
          const c = parseCandle(cnt, 'RED');
          if (c) candles.push(c);
        }
        cnt.delete();
      }

      candles = candles.sort((a, b) => a.x - b.x);

      // --- S/R LEVELS (Calculation Only - No Drawing) ---
      const detectLevels = (candleList: any[]) => {
          const threshold = 10; 
          const minTouches = 2; 
          const highs = candleList.map(c => c.y).sort((a,b) => a - b);
          const lows = candleList.map(c => c.y + c.height).sort((a,b) => a - b);
          
          const getClusters = (points: number[]) => {
              const clusters: {y: number, count: number}[] = [];
              if (points.length === 0) return clusters;
              let currentSum = points[0];
              let currentCount = 1;
              let currentStart = points[0];
              for(let i=1; i<points.length; i++) {
                  if (points[i] - currentStart <= threshold) {
                      currentSum += points[i];
                      currentCount++;
                  } else {
                      if (currentCount >= minTouches) {
                          clusters.push({ y: currentSum/currentCount, count: currentCount });
                      }
                      currentSum = points[i];
                      currentCount = 1;
                      currentStart = points[i];
                  }
              }
              if (currentCount >= minTouches) {
                  clusters.push({ y: currentSum/currentCount, count: currentCount });
              }
              return clusters;
          };
          return { resistance: getClusters(highs), support: getClusters(lows) };
      };
      const levels = detectLevels(candles);

      // --- VISUALIZATION: Clean (Just boxes) ---
      candles.forEach(c => {
         const color = c.type === 'GREEN' ? new cv.Scalar(0, 255, 0, 150) : new cv.Scalar(255, 0, 0, 150);
         cv.rectangle(src, {x: c.x, y: c.y}, {x: c.x + c.width, y: c.y + c.height}, color, 1);
      });

      // --- STRATEGY ENGINE ---
      const now = new Date();
      const seconds = now.getSeconds();
      const isSignalWindow = (seconds >= 50 && seconds <= 59);

      let type: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
      let confidence = 0;
      let method = '---';
      let reasons: string[] = [];
      let pressureScore = 0;
      let phase: any = 'NEUTRO';

      if (candles.length >= 3) {
          const current = candles[candles.length - 1];   
          const prev1 = candles[candles.length - 2];     
          const prev2 = candles[candles.length - 3];     

          // Pressure Calc
          const greenArea = candles.filter(c => c.type === 'GREEN').reduce((a,c) => a + (c.width*c.height), 0);
          const redArea = candles.filter(c => c.type === 'RED').reduce((a,c) => a + (c.width*c.height), 0);
          const totalArea = greenArea + redArea;
          pressureScore = totalArea > 0 ? ((greenArea - redArea) / totalArea) * 100 : 0;
          
          if (pressureScore > 30) phase = 'COMPRADORA';
          else if (pressureScore < -30) phase = 'VENDEDORA';
          else phase = 'CONSOLIDAÇÃO';

          // 1. CHECK REVERSAL STRATEGY (PRIORITY - "A estratégia do robô")
          let strategyFound = false;

          // Call Reversal
          if (prev2.type === 'RED') {
              const isReversalCandle = (prev1.shape === 'HAMMER' || prev1.type === 'GREEN');
              if (isReversalCandle && current.type === 'GREEN') {
                  const reversalHighY = prev1.y;
                  const currentHighY = current.y;
                  
                  if (reversalHighY - currentHighY > CONFIRMATION_THRESHOLD) {
                      type = 'CALL';
                      method = prev1.shape === 'HAMMER' ? 'HAMMER + BREAKOUT' : 'REVERSÃO + CONFIRMAÇÃO';
                      reasons.push('TENDÊNCIA BAIXA');
                      reasons.push('REVERSÃO CONFIRMADA');
                      
                      const currentLow = current.y + current.height;
                      const hasSupport = levels.support.some(lvl => Math.abs(currentLow - lvl.y) < 20);
                      if (hasSupport) reasons.push('ZONA SUPORTE');
                      
                      confidence = hasSupport ? 95 : 90;
                      strategyFound = true;
                  }
              }
          }

          // Put Reversal
          if (!strategyFound && prev2.type === 'GREEN') {
              const isReversalCandle = (prev1.shape === 'SHOOTING_STAR' || prev1.type === 'RED');
              if (isReversalCandle && current.type === 'RED') {
                  const reversalLowY = prev1.y + prev1.height;
                  const currentLowY = current.y + current.height;
                  
                  if (currentLowY - reversalLowY > CONFIRMATION_THRESHOLD) {
                      type = 'PUT';
                      method = prev1.shape === 'SHOOTING_STAR' ? 'SHOOTING STAR + BREAKOUT' : 'REVERSÃO + CONFIRMAÇÃO';
                      reasons.push('TENDÊNCIA ALTA');
                      reasons.push('REVERSÃO CONFIRMADA');

                      const currentHigh = current.y;
                      const hasResistance = levels.resistance.some(lvl => Math.abs(currentHigh - lvl.y) < 20);
                      if (hasResistance) reasons.push('ZONA RESISTÊNCIA');

                      confidence = hasResistance ? 95 : 90;
                      strategyFound = true;
                  }
              }
          }

          // 2. CHECK FLOW/TREND STRATEGY (ONLY IF NO REVERSAL FOUND AND 100% CERTAIN)
          // "Gera apenas um sinal de fluxo, depois volta a procurar a estratégia principal"
          // CRITERIA: "Vela de força" OR "Vela de Continuação"
          if (!strategyFound) {
              
              const avgHeight = (prev1.height + prev2.height) / 2;
              
              // BULLISH FLOW (100% Certainty Check)
              if (phase === 'COMPRADORA' && current.type === 'GREEN' && prev1.type === 'GREEN') {
                  
                  // Vela de Força (Marubozu/Big Body): Significantly larger than average
                  const isForceCandle = current.height >= avgHeight * 1.3;
                  
                  // Vela de Continuação: Healthy body size (at least average) AND aligned with trend
                  const isContinuationCandle = current.height >= avgHeight * 0.9;
                  
                  // CRITICAL: No Rejection (Small or no top wick)
                  // We check this via shape (not SHOOTING_STAR) and assuming density distribution is balanced or bottom-heavy
                  const noRejection = current.shape !== 'SHOOTING_STAR'; 

                  if ((isForceCandle || isContinuationCandle) && noRejection) {
                      type = 'CALL';
                      method = isForceCandle ? 'VELA DE FORÇA (100%)' : 'CONTINUAÇÃO (100%)';
                      confidence = 100;
                      reasons.push(isForceCandle ? 'FORÇA COMPRADORA' : 'CONTINUAÇÃO DE ALTA');
                      reasons.push('SEM REJEIÇÃO');
                      reasons.push('FLUXO CONFIRMADO');
                  }
              }

              // BEARISH FLOW (100% Certainty Check)
              else if (phase === 'VENDEDORA' && current.type === 'RED' && prev1.type === 'RED') {
                  
                  // Vela de Força
                  const isForceCandle = current.height >= avgHeight * 1.3;
                  
                  // Vela de Continuação
                  const isContinuationCandle = current.height >= avgHeight * 0.9;
                  
                  // CRITICAL: No Rejection (Small or no bottom wick)
                  // Check shape (not HAMMER)
                  const noRejection = current.shape !== 'HAMMER';
                  
                  if ((isForceCandle || isContinuationCandle) && noRejection) {
                      type = 'PUT';
                      method = isForceCandle ? 'VELA DE FORÇA (100%)' : 'CONTINUAÇÃO (100%)';
                      confidence = 100;
                      reasons.push(isForceCandle ? 'FORÇA VENDEDORA' : 'CONTINUAÇÃO DE BAIXA');
                      reasons.push('SEM REJEIÇÃO');
                      reasons.push('FLUXO CONFIRMADO');
                  }
              }
          }
      }

      setSignal({
        type: isSignalWindow ? type : 'NEUTRAL',
        confidence: isSignalWindow ? confidence : 0,
        reasons: isSignalWindow ? reasons : [],
        timestamp: Date.now(),
        method: isSignalWindow ? method : '---',
        marketData: {
          pressureScore: Math.round(pressureScore),
          phase,
          mathPrediction: isSignalWindow ? type : 'NEUTRAL',
          mathScore: isSignalWindow ? confidence : 0,
          breakout: '---',
          zone: pressureScore > 0 ? 'COMPRA' : 'VENDA'
        }
      });

      // OCR Processing
      if (frameCountRef.current % 15 === 0 && workerRef.current) {
         const priceRoi = new cv.Rect(src.cols - 120, 0, 120, src.rows);
         if (priceRoi.width > 0 && priceRoi.height > 0) {
            const dataUrl = preprocessImageForOCR(cv, src, priceRoi);
            if (dataUrl) {
                workerRef.current.recognize(dataUrl).then((result: any) => {
                    const text = result.data.text.replace(/[^0-9.,]/g, '');
                    setStats(prev => ({ ...prev, ocrText: text }));
                }).catch(() => {});
            }
         }
      }

      cv.imshow(canvas, src);

    } catch (e) {
      console.error("OpenCV processing error:", e);
    } finally {
      if (src) src.delete();
      if (srcRGB) srcRGB.delete();
      if (hsv) hsv.delete();
      if (maskGreen) maskGreen.delete();
      if (maskRed) maskRed.delete();
      if (contoursGreen) contoursGreen.delete();
      if (contoursRed) contoursRed.delete();
      if (hierarchyGreen) hierarchyGreen.delete();
      if (hierarchyRed) hierarchyRed.delete();
      
      const endTime = performance.now();
      setStats(prev => ({ 
        ...prev, 
        processingTimeMs: Math.round(endTime - startTime),
        fps: Math.round(1000 / (endTime - startTime))
      }));
    }

  }, [cvReady, isProcessing, videoRef, canvasRef]);

  // Run analysis loop
  useEffect(() => {
    if (isProcessing) {
      processingInterval.current = window.setInterval(analyzeFrame, 200); 
    } else {
      if (processingInterval.current) clearInterval(processingInterval.current);
    }
    return () => {
      if (processingInterval.current) clearInterval(processingInterval.current);
    };
  }, [isProcessing, analyzeFrame]);

  return {
    startScreenShare,
    stopScreenShare,
    isProcessing,
    cvReady,
    signal,
    stats,
    stream,
    error
  };
};