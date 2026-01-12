import React, { useRef, useState, useEffect } from 'react';
import { useScreenProcessor } from './hooks/useScreenProcessor';
import { useLiveSession } from './hooks/useLiveSession';
import { SignalDisplay } from './components/SignalDisplay';
import { Visualizer } from './components/Visualizer';
import { MarketPressure } from './components/MarketPressure';
import { LoginScreen } from './components/LoginScreen';
import { speakSystemMessage } from './utils/audioUtils';
import { SignalHistoryItem } from './types';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [nickname, setNickname] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- STATS STATE & HISTORY ---
  const [history, setHistory] = useState<SignalHistoryItem[]>(() => {
    // Carregar histórico salvo (Nuvem Local)
    const saved = localStorage.getItem('prismaHistory');
    return saved ? JSON.parse(saved) : [];
  });
  
  const lastSignalTimeRef = useRef<number>(0);

  // --- TIMER LOGIC ---
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

  // --- SYSTEM VOICE TRIGGER & HISTORY ADDITION ---
  useEffect(() => {
    if (signal.type !== 'NEUTRAL' && signal.timestamp !== lastSignalTimeRef.current) {
        // Voice Alert
        if (signal.type === 'CALL') {
            speakSystemMessage('Sinal de compra confirmado com análise matemática. Entrada para Call.');
        } else if (signal.type === 'PUT') {
            speakSystemMessage('Sinal de venda confirmado com análise matemática. Entrada para Put.');
        }

        // Add to History
        const newItem: SignalHistoryItem = {
            id: signal.timestamp,
            type: signal.type as 'CALL' | 'PUT',
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            method: signal.method || 'Análise Técnica',
            result: 'PENDING'
        };

        setHistory(prev => {
            const updated = [newItem, ...prev];
            localStorage.setItem('prismaHistory', JSON.stringify(updated));
            return updated;
        });

        lastSignalTimeRef.current = signal.timestamp;
    }
  }, [signal]);

  const handleLogin = (userNickname: string) => {
    setNickname(userNickname);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    disconnectLive();
    stopScreenShare();
    setIsLoggedIn(false);
    setNickname('');
  };

  const handleConnectSystem = async () => {
    if (!isProcessing) {
        await startScreenShare();
        if (!isLiveConnected && process.env.API_KEY) {
            connectLive(nickname);
        }
    }
  };

  // --- HISTORY MANAGEMENT ---
  const markResult = (id: number, result: 'WIN' | 'LOSS') => {
      setHistory(prev => {
          const updated = prev.map(item => item.id === id ? { ...item, result } : item);
          localStorage.setItem('prismaHistory', JSON.stringify(updated));
          return updated;
      });
  };

  const clearHistory = () => {
      if (confirm('Tem certeza que deseja apagar todo o histórico de operações?')) {
          setHistory([]);
          localStorage.removeItem('prismaHistory');
      }
  };

  // Stats calculation based on history
  const completedSignals = history.filter(h => h.result !== 'PENDING');
  const wins = completedSignals.filter(h => h.result === 'WIN').length;
  const losses = completedSignals.filter(h => h.result === 'LOSS').length;
  const total = wins + losses;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : 0;
  const accuracyColor = Number(winRate) >= 80 ? '#00ff88' : Number(winRate) >= 50 ? '#ffaa00' : '#ff3366';

  const isCall = signal.type === 'CALL';
  const isPut = signal.type === 'PUT';
  const containerBorder = isCall ? 'border-[#00ff88]' : isPut ? 'border-[#ff3366]' : 'border-[#b366ff]';
  const containerShadow = isCall 
    ? 'shadow-[0_0_60px_rgba(0,255,136,0.6)]' 
    : isPut 
    ? 'shadow-[0_0_60px_rgba(255,51,102,0.6)]' 
    : 'shadow-[0_0_60px_rgba(179,102,255,0.6)]';

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a0015] to-[#1a0033] overflow-y-auto">
      
      {/* Main App Container */}
      <div className={`relative w-full max-w-[480px] bg-gradient-to-br from-[#1a0033] to-[#0d001a] border-[3px] rounded-3xl overflow-hidden transition-all duration-300 ${containerBorder} ${containerShadow} my-8`}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 bg-gradient-to-r from-[rgba(179,102,255,0.3)] to-[rgba(179,102,255,0.05)] border-b-2 border-[rgba(179,102,255,0.5)] cursor-move select-none">
            <div>
                <div className="font-outfit text-[22px] font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-[#b366ff] to-[#da99ff]">
                    PRISMA IA
                </div>
                <div className="text-[10px] font-bold text-[#00ff88] tracking-widest font-outfit uppercase">
                    Olá, {nickname}
                </div>
            </div>
            {/* Logout Button (Small) */}
            <button 
                onClick={handleLogout}
                className="ml-auto mr-4 text-[10px] text-[#ff3366] font-bold uppercase hover:text-white transition-colors"
            >
                Sair
            </button>
            {/* Status Pulse */}
            <div className={`w-3 h-3 rounded-full shadow-[0_0_15px] animate-[pulse_2s_infinite] ${isProcessing ? 'bg-[#00ff88] shadow-[#00ff88]' : 'bg-red-500 shadow-red-500'}`}></div>
        </div>

        {/* Video Monitor Section */}
        <div className="relative w-full h-[250px] bg-black overflow-hidden group">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover opacity-60"
            />
            <canvas 
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
            />
            
            <div className="scan-line"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(179,102,255,0.1)] to-transparent pointer-events-none"></div>

            <div className="absolute bottom-4 right-5 font-outfit text-4xl font-black text-[rgba(179,102,255,0.4)] drop-shadow-[0_0_20px_rgba(179,102,255,0.6)]">
                {timer}
            </div>

            <div className="absolute top-4 left-5 px-2.5 py-1 bg-[rgba(0,0,0,0.6)] rounded text-[11px] font-bold text-[#b366ff] uppercase tracking-widest font-outfit border border-[#b366ff]/30">
                {isProcessing ? 'MONITORANDO ESTRATÉGIA' : 'SISTEMA EM ESPERA'}
            </div>
            
            {screenError && (
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-900/80 px-4 py-2 rounded text-red-200 text-xs font-bold border border-red-500">
                     {screenError}
                 </div>
            )}
        </div>

        <Visualizer 
            volume={audioVolume} 
            isSpeaking={isSpeaking} 
            isConnected={isLiveConnected} 
        />

        <SignalDisplay signal={signal} timer={timer} />
        <MarketPressure pressure={signal.marketData?.pressureScore || 0} />

        {/* Controls */}
        <div className="p-6 bg-[rgba(0,0,0,0.3)] border-t border-[rgba(179,102,255,0.2)]">
            
            {!isProcessing ? (
                <button 
                    onClick={handleConnectSystem}
                    className="w-full py-4 bg-gradient-to-br from-[#b366ff] to-[#9933ff] text-white rounded-xl font-outfit text-[15px] font-black uppercase shadow-[0_5px_25px_rgba(179,102,255,0.4)] hover:translate-y-[-2px] hover:shadow-[0_8px_35px_rgba(179,102,255,0.6)] active:translate-y-0 transition-all duration-300"
                >
                    🚀 INICIAR OPERAÇÕES
                </button>
            ) : (
                <div className="w-full py-3 bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] rounded-xl font-outfit text-xs font-bold uppercase text-center animate-pulse">
                    SISTEMA ATIVO - ANALISANDO PADRÕES...
                </div>
            )}

            {/* Stats Row */}
            <div className="flex justify-between mt-4 text-[13px] font-outfit font-semibold">
                <div className="flex items-center gap-2">
                    <span className="text-[#999] text-[11px]">WINS:</span>
                    <span className="font-outfit text-[#00ff88] text-lg drop-shadow-[0_0_8px_rgba(0,255,136,0.5)]">
                        {wins}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[#999] text-[11px]">LOSS:</span>
                    <span className="font-outfit text-[#ff3366] text-lg drop-shadow-[0_0_8px_rgba(255,51,102,0.5)]">
                        {losses}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[#999] text-[11px]">ASSERTIVIDADE:</span>
                    <span 
                        className="font-outfit text-lg"
                        style={{ color: accuracyColor, textShadow: `0 0 10px ${accuracyColor}40` }}
                    >
                        {total > 0 ? `${winRate}%` : '--'}
                    </span>
                </div>
            </div>
        </div>

        {/* History Section */}
        <div className="bg-[#05000a] p-4 border-t border-[rgba(179,102,255,0.1)]">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-[#da99ff] font-outfit text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Histórico de Sinais
                </h3>
                {history.length > 0 && (
                    <button 
                        onClick={clearHistory}
                        className="text-[#ff3366] hover:text-white transition-colors"
                        title="Limpar Histórico"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {history.length === 0 ? (
                    <div className="text-center text-[#999] text-xs py-4 opacity-50">
                        Nenhum sinal registrado ainda.
                    </div>
                ) : (
                    history.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] rounded-lg p-3 hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`text-xs font-black px-2 py-1 rounded ${item.type === 'CALL' ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-[#ff3366]/20 text-[#ff3366]'}`}>
                                    {item.type}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white text-xs font-bold">{item.time}</span>
                                    <span className="text-[#999] text-[9px] uppercase">{item.method}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {item.result === 'PENDING' ? (
                                    <>
                                        <button 
                                            onClick={() => markResult(item.id, 'WIN')}
                                            className="w-7 h-7 flex items-center justify-center rounded bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 hover:bg-[#00ff88] hover:text-black transition-all"
                                            title="Marcar Win"
                                        >
                                            ✓
                                        </button>
                                        <button 
                                            onClick={() => markResult(item.id, 'LOSS')}
                                            className="w-7 h-7 flex items-center justify-center rounded bg-[#ff3366]/10 text-[#ff3366] border border-[#ff3366]/30 hover:bg-[#ff3366] hover:text-white transition-all"
                                            title="Marcar Loss"
                                        >
                                            ✕
                                        </button>
                                    </>
                                ) : (
                                    <span className={`text-xs font-black tracking-wider ${item.result === 'WIN' ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                                        {item.result}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;