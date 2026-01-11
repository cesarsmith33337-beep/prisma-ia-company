import React from 'react';
import { SignalData } from '../types';

interface SignalDisplayProps {
  signal: SignalData;
  timer: number;
}

export const SignalDisplay: React.FC<SignalDisplayProps> = ({ signal, timer }) => {
  const isCall = signal.type === 'CALL';
  const isPut = signal.type === 'PUT';
  const isNeutral = signal.type === 'NEUTRAL';
  
  const market = signal.marketData || { 
      pressureScore: 0, 
      phase: 'NEUTRO', 
      mathPrediction: '---', 
      mathScore: 0, 
      breakout: '---', 
      zone: '---' 
  };

  // Format time for entry
  const entryTime = new Date().toLocaleTimeString('pt-BR');

  return (
    <div className="flex flex-col gap-0 bg-[rgba(0,0,0,0.4)] p-6">
        
        {/* Main Signal Text */}
        <div className="text-center mb-2">
            <div className={`font-outfit text-5xl font-black uppercase transition-all duration-300 ${
                isCall ? 'text-[#00ff88] drop-shadow-[0_0_30px_rgba(0,255,136,0.8)]' : 
                isPut ? 'text-[#ff3366] drop-shadow-[0_0_30px_rgba(255,51,102,0.8)]' : 
                'text-[#333]'
            }`}>
                {isNeutral ? 'AGUARDANDO' : isCall ? '⬆ CALL' : '⬇ PUT'}
            </div>
            <div className={`text-xs font-outfit mt-2 transition-colors duration-300 ${isCall ? 'text-[#00ff88]' : isPut ? 'text-[#ff3366]' : 'text-[#999]'}`}>
                {isNeutral ? 'Analisando mercado em tempo real...' : `Sinal Detectado - ${signal.reasons.length} confluências`}
            </div>
        </div>

        {/* Confluence Tags */}
        <div className="flex flex-wrap gap-2 justify-center mb-4 min-h-[24px]">
            {signal.reasons.map((reason, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-xl bg-[rgba(179,102,255,0.2)] border border-[rgba(179,102,255,0.4)] text-[#da99ff] text-[9px] font-outfit uppercase font-bold">
                    {reason}
                </span>
            ))}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[rgba(179,102,255,0.05)] p-2 rounded-lg border border-[rgba(179,102,255,0.2)]">
                <div className="text-[9px] text-[#b366ff] uppercase mb-1 tracking-widest font-outfit">PADRÃO</div>
                <div className="font-outfit text-sm font-bold text-white">{signal.method || '---'}</div>
            </div>
            <div className="bg-[rgba(179,102,255,0.05)] p-2 rounded-lg border border-[rgba(179,102,255,0.2)]">
                <div className="text-[9px] text-[#b366ff] uppercase mb-1 tracking-widest font-outfit">HORÁRIO</div>
                <div className="font-outfit text-sm font-bold text-white">{isNeutral ? '--:--:--' : entryTime}</div>
            </div>
            <div className="bg-[rgba(179,102,255,0.05)] p-2 rounded-lg border border-[rgba(179,102,255,0.2)]">
                <div className="text-[9px] text-[#b366ff] uppercase mb-1 tracking-widest font-outfit">PRESSÃO</div>
                <div className="font-outfit text-sm font-bold text-white">{market.zone}</div>
            </div>
            <div className="bg-[rgba(179,102,255,0.05)] p-2 rounded-lg border border-[rgba(179,102,255,0.2)]">
                <div className="text-[9px] text-[#b366ff] uppercase mb-1 tracking-widest font-outfit">PROBABILIDADE</div>
                <div className="font-outfit text-sm font-bold text-white">
                    {market.mathPrediction !== 'NEUTRAL' ? `${market.mathScore}%` : '---'}
                </div>
            </div>
        </div>

        {/* Confidence Bar */}
        <div className="w-full h-1.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden mb-2">
            <div 
                className="h-full bg-gradient-to-r from-[#b366ff] to-[#da99ff] transition-all duration-700 ease-out shadow-[0_0_15px_rgba(179,102,255,0.6)]"
                style={{ width: `${isNeutral ? 0 : signal.confidence}%` }}
            ></div>
        </div>

    </div>
  );
};