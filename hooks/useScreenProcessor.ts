import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SignalData, ProcessingStats } from '../types';

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
            tessedit_char_whitelist: '0123456789./: ', 
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

  // --- CORE LOGIC: REAL CANDLE DETECTION ---
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
    
    // Declare all Mats for safe cleanup with explicit any type
    let src: any = null;
    let srcRGB: any = null;
    let hsv: any = null;
    let maskGreen: any = null;
    let maskRed: any = null;
    let contoursGreen: any = null;
    let contoursRed: any = null;
    let hierarchyGreen: any = null;
    let hierarchyRed: any = null;
    
    let lowGreen: any = null;
    let highGreen: any = null;
    let lowRed1: any = null;
    let highRed1: any = null;
    let lowRed2: any = null;
    let highRed2: any = null;
    let maskRed1: any = null;
    let maskRed2: any = null;

    let roiSrc: any = null;
    let roiGray: any = null;
    let roiBinary: any = null;

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

      // --- OCR PROCESSING ---
      if (workerRef.current && ocrCanvasRef.current && frameCountRef.current % 5 === 0) {
          const roiX = Math.floor(canvas.width * 0.85);
          const roiW = canvas.width - roiX;
          if (roiW > 0) {
            const rect = new cv.Rect(roiX, 0, roiW, canvas.height);
            roiSrc = src.roi(rect);
            roiGray = new cv.Mat();
            roiBinary = new cv.Mat();
            cv.cvtColor(roiSrc, roiGray, cv.COLOR_RGBA2GRAY);
            cv.threshold(roiGray, roiBinary, 150, 255, cv.THRESH_BINARY);
            cv.bitwise_not(roiBinary, roiBinary);
            
            // Render to canvas for Tesseract (Critical fix: Tesseract can't read cv.Mat directly)
            cv.imshow(ocrCanvasRef.current, roiBinary);
            
            workerRef.current.recognize(ocrCanvasRef.current)
                .then((result: any) => {
                    const text = result.data.text;
                    const priceMatch = text.match(/(\d+\.\d{2,})/);
                    const cleanText = priceMatch ? priceMatch[0] : text.replace(/[^0-9.:]/g, '').slice(0, 10);
                    setStats(prev => ({ ...prev, ocrText: cleanText || prev.ocrText }));
                }).catch(() => {});
          }
      }

      // --- COLOR DETECTION ---
      cv.cvtColor(src, srcRGB, cv.COLOR_RGBA2RGB);
      cv.cvtColor(srcRGB, hsv, cv.COLOR_RGB2HSV);

      lowGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(35, 50, 50, 0));
      highGreen = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(85, 255, 255, 255));
      lowRed1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(0, 50, 50, 0));
      highRed1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(10, 255, 255, 255));
      lowRed2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(170, 50, 50, 0));
      highRed2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), new cv.Scalar(180, 255, 255, 255));
      
      cv.inRange(hsv, lowGreen, highGreen, maskGreen);
      
      maskRed1 = new cv.Mat();
      maskRed2 = new cv.Mat();
      cv.inRange(hsv, lowRed1, highRed1, maskRed1);
      cv.inRange(hsv, lowRed2, highRed2, maskRed2);
      cv.addWeighted(maskRed1, 1.0, maskRed2, 1.0, 0.0, maskRed);

      cv.findContours(maskGreen, contoursGreen, hierarchyGreen, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      cv.findContours(maskRed, contoursRed, hierarchyRed, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let greenCandles: any[] = [];
      let redCandles: any[] = [];

      // FIX MEMORY LEAK: Must delete cnt after getting from MatVector
      for (let i = 0; i < contoursGreen.size(); ++i) {
        let cnt = contoursGreen.get(i);
        if (cv.contourArea(cnt) > 50) {
          let rect = cv.boundingRect(cnt);
          greenCandles.push({ ...rect, type: 'GREEN' });
        }
        cnt.delete();
      }

      for (let i = 0; i < contoursRed.size(); ++i) {
        let cnt = contoursRed.get(i);
        if (cv.contourArea(cnt) > 50) {
          let rect = cv.boundingRect(cnt);
          redCandles.push({ ...rect, type: 'RED' });
        }
        cnt.delete();
      }

      const allCandles = [...greenCandles, ...redCandles].sort((a, b) => a.x - b.x);

      // --- DRAW CANDLES & VOLUME HIGHLIGHT ---
      // Restore drawing for ALL candles as requested
      allCandles.forEach((c, index) => {
        const isLast = index === allCandles.length - 1;
        const color = c.type === 'GREEN' ? new cv.Scalar(0, 255, 0, 255) : new cv.Scalar(255, 0, 0, 255);
        
        // Draw the bounding box for ALL candles
        cv.rectangle(src, {x: c.x, y: c.y}, {x: c.x + c.width, y: c.y + c.height}, color, 2);
        
        // Highlight active (LAST) candle specially
        if (isLast) {
          // Glow effect
          cv.rectangle(src, {x: c.x - 2, y: c.y - 2}, {x: c.x + c.width + 2, y: c.y + c.height + 2}, new cv.Scalar(255, 255, 255, 100), 1);
          
          // Show Volume (Area size) with Background
          const volume = c.width * c.height;
          const volText = `VOL: ${volume}`;
          const textY = c.type === 'GREEN' ? c.y - 15 : c.y + c.height + 25;
          const textX = Math.max(0, c.x - 20); // Prevent off-screen
          
          // Text Background
          const textWidth = volText.length * 10;
          cv.rectangle(src, {x: textX - 2, y: textY - 12}, {x: textX + textWidth, y: textY + 4}, new cv.Scalar(0, 0, 0, 180), -1);
          
          cv.putText(src, volText, {x: textX, y: textY}, cv.FONT_HERSHEY_PLAIN, 1.1, new cv.Scalar(255, 255, 255, 255), 1);
        }
      });

      // --- ZONES & TARGETS LOGIC ---
      if (allCandles.length > 0) {
        const lastCandle = allCandles[allCandles.length - 1];
        const currentPriceY = lastCandle.type === 'GREEN' ? lastCandle.y : (lastCandle.y + lastCandle.height);

        // Collect levels
        const levels: number[] = [];
        allCandles.forEach(c => {
            levels.push(c.y); 
            levels.push(c.y + c.height); 
        });
        levels.sort((a, b) => a - b);

        // Calculate Zones
        const zones: { y: number, strength: number }[] = [];
        const tolerance = 15;
        if (levels.length > 0) {
            let currentGroup = [levels[0]];
            for(let i=1; i<levels.length; i++) {
                if (levels[i] - currentGroup[0] <= tolerance) {
                    currentGroup.push(levels[i]);
                } else {
                    if (currentGroup.length >= 3) {
                        const avg = currentGroup.reduce((a,b)=>a+b,0) / currentGroup.length;
                        zones.push({ y: avg, strength: currentGroup.length });
                    }
                    currentGroup = [levels[i]];
                }
            }
            if (currentGroup.length >= 3) {
                const avg = currentGroup.reduce((a,b)=>a+b,0) / currentGroup.length;
                zones.push({ y: avg, strength: currentGroup.length });
            }
        }

        // FILTER: Find only CLOSEST Support and Resistance
        let closestResistance = null;
        let closestSupport = null;

        const resistances = zones.filter(z => z.y < currentPriceY - 20).sort((a, b) => b.y - a.y);
        const supports = zones.filter(z => z.y > currentPriceY + 20).sort((a, b) => a.y - b.y);

        if (resistances.length > 0) closestResistance = resistances[0];
        if (supports.length > 0) closestSupport = supports[0];

        // Draw ONLY the closest zones with Clean Labels
        if (closestResistance) {
             const y = Math.round(closestResistance.y);
             // Line
             cv.line(src, {x: 0, y: y}, {x: canvas.width, y: y}, new cv.Scalar(255, 50, 100, 200), 2);
             
             // Label with Background
             const label = "ALVO: VENDA";
             const labelX = canvas.width - 160;
             cv.rectangle(src, {x: labelX - 5, y: y - 25}, {x: canvas.width, y: y - 2}, new cv.Scalar(180, 20, 50, 200), -1);
             cv.putText(src, label, {x: labelX, y: y - 10}, cv.FONT_HERSHEY_PLAIN, 1.2, new cv.Scalar(255, 255, 255, 255), 1);
        }

        if (closestSupport) {
             const y = Math.round(closestSupport.y);
             // Line
             cv.line(src, {x: 0, y: y}, {x: canvas.width, y: y}, new cv.Scalar(50, 255, 100, 200), 2);
             
             // Label with Background
             const label = "ALVO: COMPRA";
             const labelX = canvas.width - 160;
             cv.rectangle(src, {x: labelX - 5, y: y + 2}, {x: canvas.width, y: y + 25}, new cv.Scalar(20, 180, 50, 200), -1);
             cv.putText(src, label, {x: labelX, y: y + 18}, cv.FONT_HERSHEY_PLAIN, 1.2, new cv.Scalar(255, 255, 255, 255), 1);
        }
      }

      // --- MARKET ANALYSIS LOOP ---
      // ... (Rest of logic remains same, but using locals) ...
      const now = new Date();
      const seconds = now.getSeconds();
      const isSignalWindow = (seconds >= 50 && seconds <= 59);

      let pressureScore = 0;
      let phase: any = 'NEUTRO';
      let sma9 = 0;
      let validBB = false;
      let type: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
      let confidence = 0;
      let reasons: string[] = [];
      let method = '---';
      let isStrategySignal = false;
      let breakoutState = '---';

      if (allCandles.length >= 4) {
        const getCloseY = (c: any) => c.type === 'GREEN' ? c.y : (c.y + c.height);
        
        if (allCandles.length >= 9) {
            const period = 9;
            const deviation = 1.5;
            const lastCandles = allCandles.slice(-period);
            const sumY = lastCandles.reduce((sum, c) => sum + getCloseY(c), 0);
            sma9 = sumY / period;
            const squaredDiffs = lastCandles.map(c => Math.pow(getCloseY(c) - sma9, 2));
            const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;
            const stdDev = Math.sqrt(avgSquaredDiff);
            const upperBandY = sma9 - (stdDev * deviation);
            const lowerBandY = sma9 + (stdDev * deviation);

            validBB = true;
            
            // Draw Bands VERY Faintly
            cv.line(src, {x: 0, y: Math.round(sma9)}, {x: canvas.width, y: Math.round(sma9)}, new cv.Scalar(255, 255, 0, 60), 1);
            cv.line(src, {x: 0, y: Math.round(upperBandY)}, {x: canvas.width, y: Math.round(upperBandY)}, new cv.Scalar(0, 255, 255, 40), 1);
            cv.line(src, {x: 0, y: Math.round(lowerBandY)}, {x: canvas.width, y: Math.round(lowerBandY)}, new cv.Scalar(0, 255, 255, 40), 1);
        }

        const greenArea = greenCandles.reduce((acc, c) => acc + (c.width * c.height), 0);
        const redArea = redCandles.reduce((acc, c) => acc + (c.width * c.height), 0);
        const totalArea = greenArea + redArea;
        pressureScore = totalArea > 0 ? ((greenArea - redArea) / totalArea) * 100 : 0;

        if (Math.abs(pressureScore) < 20) phase = 'ACUMULAÇÃO';
        else if (Math.abs(pressureScore) > 70) phase = 'EXPANSÃO';
        else phase = 'DISTRIBUIÇÃO';

        if (isSignalWindow) {
            const lastCandle = allCandles[allCandles.length - 1];
            let consecutiveCount = 1;
            for (let i = allCandles.length - 2; i >= 0; i--) {
                if (allCandles[i].type === lastCandle.type) {
                    consecutiveCount++;
                } else {
                    break;
                }
            }

            let isExhausted = false;
            const recentCandles = allCandles.slice(-4, -1);
            if (recentCandles.length > 0) {
                const avgHeight = recentCandles.reduce((sum, c) => sum + c.height, 0) / recentCandles.length;
                if (lastCandle.height > avgHeight * 2.5) { 
                    isExhausted = true;
                    phase = 'EXAUSTÃO (CLÍMAX)';
                }
            }
            if (consecutiveCount >= 5) {
                isExhausted = true;
                phase = 'EXAUSTÃO (SEQUÊNCIA)';
            }

            if (validBB && !isExhausted) {
                 const lastCloseY = getCloseY(lastCandle);
                 method = 'ANÁLISE TÉCNICA';

                 if (consecutiveCount === 4 && lastCandle.type === 'GREEN') {
                     if (lastCloseY < sma9 - 2) { 
                         type = 'CALL';
                         method = '4 VELAS + BB';
                         reasons.push('4 VELAS ALTA');
                         reasons.push('ROMPIMENTO MÉDIA');
                         isStrategySignal = true;
                         breakoutState = 'CONFIRMADO';
                     }
                 }
                 else if (consecutiveCount === 4 && lastCandle.type === 'RED') {
                     if (lastCloseY > sma9 + 2) {
                         type = 'PUT';
                         method = '4 VELAS + BB';
                         reasons.push('4 VELAS BAIXA');
                         reasons.push('ROMPIMENTO MÉDIA');
                         isStrategySignal = true;
                         breakoutState = 'CONFIRMADO';
                     }
                 }
            }

            confidence = 50 + Math.abs(pressureScore) * 0.4;
            if (isStrategySignal) confidence += 20;
            confidence = Math.min(confidence, 99);
        }
      }

      setSignal({
        type: isSignalWindow ? type : 'NEUTRAL',
        confidence: isSignalWindow ? Math.round(confidence) : 0,
        reasons: isSignalWindow ? reasons.slice(0, 3) : [],
        timestamp: Date.now(),
        method: isSignalWindow ? method : '---',
        marketData: {
          pressureScore: Math.round(pressureScore),
          phase,
          mathPrediction: isSignalWindow ? type : 'NEUTRAL',
          mathScore: isSignalWindow ? Math.round(confidence) : 0,
          breakout: isSignalWindow ? breakoutState : '---',
          zone: pressureScore > 0 ? 'COMPRA' : 'VENDA'
        }
      });

      cv.imshow(canvas, src);

    } catch (e) {
      console.error("OpenCV processing error:", e);
    } finally {
      // CLEANUP ALL MATS
      if (src) src.delete();
      if (srcRGB) srcRGB.delete();
      if (hsv) hsv.delete();
      if (maskGreen) maskGreen.delete();
      if (maskRed) maskRed.delete();
      if (contoursGreen) contoursGreen.delete();
      if (contoursRed) contoursRed.delete();
      if (hierarchyGreen) hierarchyGreen.delete();
      if (hierarchyRed) hierarchyRed.delete();
      
      if (lowGreen) lowGreen.delete();
      if (highGreen) highGreen.delete();
      if (lowRed1) lowRed1.delete();
      if (highRed1) highRed1.delete();
      if (lowRed2) lowRed2.delete();
      if (highRed2) highRed2.delete();
      if (maskRed1) maskRed1.delete();
      if (maskRed2) maskRed2.delete();
      
      if (roiSrc) roiSrc.delete();
      if (roiGray) roiGray.delete();
      if (roiBinary) roiBinary.delete();

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
      processingInterval.current = window.setInterval(analyzeFrame, 250); 
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