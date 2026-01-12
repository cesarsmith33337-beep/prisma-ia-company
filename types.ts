

export interface SignalData {
  type: 'CALL' | 'PUT' | 'NEUTRAL';
  confidence: number;
  reasons: string[];
  timestamp: number;
  method?: string;
  marketData?: {
    pressureScore: number;
    phase: 'ACUMULAÇÃO' | 'DISTRIBUIÇÃO' | 'MANIPULAÇÃO' | 'EXPANSÃO' | 'NEUTRO' | 'EXAUSTÃO';
    mathPrediction: string;
    mathScore: number;
    breakout: string;
    zone: 'COMPRA' | 'VENDA' | 'NEUTRO';
  };
}

export interface SignalHistoryItem {
  id: number;
  type: 'CALL' | 'PUT';
  time: string;
  method: string;
  result: 'WIN' | 'LOSS' | 'PENDING';
}

export interface ProcessingStats {
  fps: number;
  ocrText: string;
  processingTimeMs: number;
}

// Minimal type definition for the global cv object
export interface OpenCV {
  Mat: new (rows?: number, cols?: number, type?: number, scalar?: any) => any;
  MatVector: new () => any;
  imread: (element: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => any;
  imshow: (canvasSource: string | HTMLCanvasElement, mat: any) => void;
  cvtColor: (src: any, dst: any, code: number) => void;
  inRange: (src: any, lower: any, upper: any, dst: any) => void;
  findContours: (image: any, contours: any, hierarchy: any, mode: number, method: number) => void;
  boundingRect: (contour: any) => { x: number, y: number, width: number, height: number };
  contourArea: (contour: any) => number;
  drawContours: (image: any, contours: any, contourIdx: number, color: any, thickness: number) => void;
  rectangle: (image: any, pt1: {x:number, y:number}, pt2: {x:number, y:number}, color: any, thickness: number) => void;
  line: (image: any, pt1: {x:number, y:number}, pt2: {x:number, y:number}, color: any, thickness: number) => void;
  mean: (src: any, mask?: any) => number[];
  addWeighted: (src1: any, alpha: number, src2: any, beta: number, gamma: number, dst: any) => void;
  threshold: (src: any, dst: any, thresh: number, maxval: number, type: number) => void;
  bitwise_not: (src: any, dst: any) => void;
  putText: (img: any, text: string, org: {x:number, y:number}, fontFace: number, fontScale: number, color: any, thickness: number) => void;
  countNonZero: (src: any) => number;
  Rect: new (x: number, y: number, width: number, height: number) => any;
  Size: new (width: number, height: number) => any;
  Scalar: new (v0: number, v1: number, v2: number, v3?: number) => any;
  COLOR_RGBA2RGB: number;
  COLOR_RGB2HSV: number;
  COLOR_RGBA2GRAY: number;
  THRESH_BINARY: number;
  THRESH_BINARY_INV: number;
  THRESH_OTSU: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  FONT_HERSHEY_PLAIN: number;
}

declare global {
  interface Window {
    cv: OpenCV;
    Tesseract: any;
  }
}