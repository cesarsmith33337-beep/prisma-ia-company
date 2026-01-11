import React from 'react';

interface MarketPressureProps {
  pressure: number; // -100 to 100
}

export const MarketPressure: React.FC<MarketPressureProps> = ({ pressure }) => {
  // Normalize pressure for display logic
  // pressure goes from -100 (Full Bear) to 100 (Full Bull)
  
  const buyPercentage = Math.min(100, Math.max(0, 50 + pressure / 2));
  const sellPercentage = 100 - buyPercentage;
  
  // Create 40 segments for the bar
  const segments = 40;

  return (
    <div className="bg-[rgba(0,0,0,0.2)] px-6 py-4 border-t border-[rgba(179,102,255,0.1)]">
        <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-outfit font-bold text-[#ff3366] uppercase tracking-wider drop-shadow-[0_0_5px_rgba(255,51,102,0.5)]">
                VENDEDORES {Math.round(sellPercentage)}%
            </span>
            <span className="text-[9px] font-outfit font-bold text-[#999] uppercase tracking-widest opacity-60">
                VOLUME / PRESSÃO
            </span>
            <span className="text-[10px] font-outfit font-bold text-[#00ff88] uppercase tracking-wider drop-shadow-[0_0_5px_rgba(0,255,136,0.5)]">
                {Math.round(buyPercentage)}% COMPRADORES
            </span>
        </div>
        
        {/* Bar Container */}
        <div className="relative h-3 bg-[#0a0015] rounded-sm overflow-hidden flex gap-[2px]">
            {Array.from({ length: segments }).map((_, i) => {
                // Calculate position percentage of this segment (0 to 100)
                const segmentPos = (i / segments) * 100;
                
                let isActive = false;
                let isBullish = false;
                
                // Logic: Center is 50%.
                if (pressure >= 0) {
                    // Bullish: Fill from 50% to Right
                    // Active if segment is >= 50% AND segment < (50 + pressure/2)
                    if (segmentPos >= 50 && segmentPos < 50 + (pressure / 2)) {
                        isActive = true;
                        isBullish = true;
                    }
                } else {
                    // Bearish: Fill from 50% to Left
                    // Active if segment >= (50 + pressure/2) AND segment < 50
                    if (segmentPos >= 50 + (pressure / 2) && segmentPos < 50) {
                        isActive = true;
                        isBullish = false;
                    }
                }

                return (
                    <div 
                        key={i} 
                        className={`flex-1 rounded-[1px] transition-all duration-300 ${
                            isActive 
                                ? (isBullish ? 'bg-[#00ff88] shadow-[0_0_8px_#00ff88]' : 'bg-[#ff3366] shadow-[0_0_8px_#ff3366]') 
                                : 'bg-[rgba(255,255,255,0.05)]'
                        }`}
                    />
                );
            })}
            
            {/* Center Line Marker */}
            <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/30 -translate-x-1/2 z-10"></div>
        </div>
    </div>
  );
};