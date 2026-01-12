import React, { useEffect, useState } from 'react';

interface VisualizerProps {
  volume: number;
  isSpeaking: boolean;
  isConnected: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ volume, isSpeaking, isConnected }) => {
  const [bars, setBars] = useState<number[]>(new Array(30).fill(2));

  useEffect(() => {
    let animationFrame: number;
    let time = 0;
    
    const updateBars = () => {
      time += 0.15; // Slightly faster time for fluid animation
      
      if (!isConnected) {
        setBars(new Array(30).fill(2));
        animationFrame = requestAnimationFrame(updateBars);
        return;
      }

      setBars(prev => prev.map((prevHeight, i) => {
        let targetHeight = 2;
        
        // Center index calculations
        const center = 14.5; // True center of 30 items
        const dist = Math.abs(i - center);
        const maxDist = 15;
        // Non-linear falloff for a sharper "peak" look
        const distFactor = Math.pow(Math.max(0, 1 - dist / maxDist), 1.5); 

        if (isSpeaking) {
           // AI Speaking: Organic sine wave patterns
           const wave1 = Math.sin(time + i * 0.5) * 12;
           const wave2 = Math.cos(time * 0.8 - i * 0.3) * 8;
           const noise = Math.random() * 4;
           targetHeight = Math.max(3, 8 + (wave1 + wave2 + noise) * distFactor);
        } else {
           // Mic Input: Sharp reaction to volume
           // Base idle movement (breathing effect)
           const idle = Math.sin(time * 0.2 + i * 0.5) * 1.5;
           
           // Volume reaction (boosted multiplier)
           const volHeight = volume * 220 * distFactor;
           const noise = Math.random() * (volume * 30);
           
           targetHeight = Math.max(2, 3 + idle + volHeight + noise);
        }
        
        // Clamp max height
        targetHeight = Math.min(40, targetHeight);

        // Smooth interpolation: Jump up fast, fall down slow (gravity effect)
        const riseSpeed = 0.6;
        const fallSpeed = 0.2;
        
        if (targetHeight > prevHeight) {
            return prevHeight + (targetHeight - prevHeight) * riseSpeed;
        } else {
            return prevHeight + (targetHeight - prevHeight) * fallSpeed;
        }
      }));

      animationFrame = requestAnimationFrame(updateBars);
    };

    updateBars();

    return () => cancelAnimationFrame(animationFrame);
  }, [volume, isSpeaking, isConnected]);

  return (
    <div className="w-full bg-[#05000a] border-y border-[rgba(179,102,255,0.1)] py-3 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(179,102,255,0.03)] to-transparent pointer-events-none"></div>

        <div className="flex items-end justify-center gap-[3px] h-10 px-4 relative z-10">
        {bars.map((h, i) => {
            // Determine styles based on state
            let background = 'rgba(255, 255, 255, 0.05)';
            let boxShadow = 'none';
            const isActive = h > 4;

            if (isConnected) {
                if (isSpeaking) {
                    // AI: Neon Green Gradient
                    background = 'linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)';
                    if (isActive) boxShadow = '0 0 12px rgba(0, 255, 136, 0.4)';
                } else if (isActive) {
                    // Mic: Blue to Purple Gradient (Requested)
                    background = 'linear-gradient(180deg, #3b82f6 0%, #b366ff 100%)';
                    boxShadow = '0 0 12px rgba(59, 130, 246, 0.5)';
                }
            }

            return (
                <div
                    key={i}
                    className="w-1.5 rounded-full transition-all duration-75"
                    style={{ 
                        height: `${h}px`,
                        background: background,
                        boxShadow: boxShadow,
                        opacity: isActive || isSpeaking ? 1 : 0.3
                    }}
                />
            );
        })}
        </div>
    </div>
  );
};