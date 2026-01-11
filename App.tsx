import React, { useRef, useState, useEffect } from 'react';
import { useScreenProcessor } from './hooks/useScreenProcessor';
import { useLiveSession } from './hooks/useLiveSession';
import { SignalDisplay } from './components/SignalDisplay';
import { Visualizer } from './components/Visualizer';
import { MarketPressure } from './components/MarketPressure';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- STATS STATE ---
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);

  // --- TIMER LOGIC (Sync to system seconds) ---
  const [timer, setTimer] = useState(60);
  useEffect(() => {
    const interval = setInterval(() => {
        const seconds = new Date().getSeconds();
        setTimer(60 - seconds);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const {
    startScreenShare,
    stopScreenShare,
    isProcessing,
    cvReady,
    signal,
    stats,
    error: screenError
  } = useScreenProcessor(videoRef, canvasRef);

  const {
    connect: connectLive,
    disconnect: disconnectLive,
    isConnected: isLiveConnected,
    isSpeaking,
    audioVolume
  } = useLiveSession(videoRef);

  // Handle connection flow (both screen and audio)
  const handleConnect = async () => {
    if (!isProcessing) {
        await startScreenShare();
        if (!isLiveConnected && process.env.API_KEY) {
            connectLive();
        }
    }
  };

  const handleDisconnect = () => {
      stopScreenShare();
      disconnectLive();
  };

  // Stats calculation
  const total = wins + losses;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : 0;
  const accuracyColor = Number(winRate) >= 80 ? '#00ff88' : Number(winRate) >= 50 ? '#ffaa00' : '#ff3366';

  // Dynamic Styles based on Signal
  const isCall = signal.type === 'CALL';
  const isPut = signal.type === 'PUT';
  const containerBorder = isCall ? 'border-[#00ff88]' : isPut ? 'border-[#ff3366]' : 'border-[#b366ff]';
  const containerShadow = isCall 
    ? 'shadow-[0_0_60px_rgba(0,255,136,0.6)]' 
    : isPut 
    ? 'shadow-[0_0_60px_rgba(255,51,102,0.6)]' 
    : 'shadow-[0_0_60px_rgba(179,102,255,0.6)]';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0015] to-[#1a0033]">
      
      {/* Draggable Container (Visually) */}
      <div className={`relative w-full max-w-[480px] bg-gradient-to-br from-[#1a0033] to-[#0d001a] border-[3px] rounded-3xl overflow-hidden transition-all duration-300 ${containerBorder} ${containerShadow}`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 bg-gradient-to-r from-[rgba(179,102,255,0.3)] to-[rgba(179,102,255,0.05)] border-b-2 border-[rgba(179,102,255,0.5)] cursor-move select-none">
            <div>
                <div className="font-outfit text-[22px] font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-[#b366ff] to-[#da99ff]">
                    PRISMA IA
                </div>
                <div className="text-[10px] font-bold text-[#00ff88] tracking-widest font-outfit">
                    SISTEMA INTELIGENTE
                </div>
            </div>
            {/* Status Pulse */}
            <div className={`w-3 h-3 rounded-full shadow-[0_0_15px] animate-[pulse_2s_infinite] ${isProcessing ? 'bg-[#00ff88] shadow-[#00ff88]' : 'bg-red-500 shadow-red-500'}`}></div>
        </div>

        {/* Video Monitor Section */}
        <div className="relative w-full h-[200px] bg-black overflow-hidden group">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover opacity-50"
            />
            <canvas 
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
            />
            
            {/* Scan Line Animation */}
            <div className="scan-line"></div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(179,102,255,0.1)] to-transparent pointer-events-none"></div>

            {/* Timer Display */}
            <div className="absolute bottom-4 right-5 font-outfit text-4xl font-black text-[rgba(179,102,255,0.4)] drop-shadow-[0_0_20px_rgba(179,102,255,0.6)]">
                {timer}
            </div>

            {/* Status Badge */}
            <div className="absolute top-4 left-5 px-2.5 py-1 bg-[rgba(0,0,0,0.6)] rounded text-[11px] font-bold text-[#b366ff] uppercase tracking-widest font-outfit">
                {isProcessing ? 'MONITORANDO GRÁFICO' : 'AGUARDANDO CONEXÃO'}
            </div>
            
            {/* Error Badge */}
            {screenError && (
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-900/80 px-4 py-2 rounded text-red-200 text-xs font-bold border border-red-500">
                     {screenError}
                 </div>
            )}
        </div>

        {/* Audio Visualizer Strip */}
        <Visualizer 
            volume={audioVolume} 
            isSpeaking={isSpeaking} 
            isConnected={isLiveConnected} 
        />

        {/* Signal Zone */}
        <SignalDisplay signal={signal} timer={timer} />

        {/* Market Volume / Pressure */}
        <MarketPressure pressure={signal.marketData?.pressureScore || 0} />

        {/* Controls */}
        <div className="p-6 bg-[rgba(0,0,0,0.3)] border-t border-[rgba(179,102,255,0.2)]">
            
            {!isProcessing ? (
                <button 
                    onClick={handleConnect}
                    className="w-full py-4 bg-gradient-to-br from-[#b366ff] to-[#9933ff] text-white rounded-xl font-outfit text-[15px] font-black uppercase shadow-[0_5px_25px_rgba(179,102,255,0.4)] hover:translate-y-[-2px] hover:shadow-[0_8px_35px_rgba(179,102,255,0.6)] active:translate-y-0 transition-all duration-300"
                >
                    🚀 CONECTAR PRISMA IA
                </button>
            ) : (
                <button 
                    onClick={handleDisconnect}
                    className="w-full py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl font-outfit text-xs font-bold uppercase hover:bg-red-500/30 transition-all"
                >
                    DESCONECTAR
                </button>
            )}

            {/* Stats Row */}
            <div className="flex justify-between mt-4 text-[13px] font-outfit font-semibold">
                <div className="flex items-center gap-2">
                    <span className="text-[#999] text-[11px]">WINS:</span>
                    <span 
                        onClick={() => setWins(w => w + 1)}
                        className="font-outfit text-[#00ff88] cursor-pointer hover:scale-110 transition-transform select-none"
                    >
                        {wins}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[#999] text-[11px]">LOSS:</span>
                    <span 
                        onClick={() => setLosses(l => l + 1)}
                        className="font-outfit text-[#ff3366] cursor-pointer hover:scale-110 transition-transform select-none"
                    >
                        {losses}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[#999] text-[11px]">TAXA:</span>
                    <span className="font-outfit text-[#b366ff]">{winRate}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[#999] text-[11px]">ASSERTIVIDADE:</span>
                    <span 
                        className="font-outfit"
                        style={{ color: accuracyColor }}
                    >
                        {total > 0 ? `${winRate}%` : '--'}
                    </span>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;