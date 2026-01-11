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
      time += 0.1;
      
      if (!isConnected) {
        setBars(new Array(30).fill(2));
        animationFrame = requestAnimationFrame(updateBars);
        return;
      }

      setBars(prev => prev.map((prevHeight, i) => {
        let targetHeight = 2;
        
        // Center index
        const center = 15;
        const dist = Math.abs(i - center);
        const maxDist = 15;
        const distFactor = Math.max(0, 1 - dist / maxDist); // 1 at center, 0 at edges

        if (isSpeaking) {
           // AI Speaking: Sine wave patterns + random noise for robotic feel
           const wave1 = Math.sin(time + i * 0.4) * 10;
           const wave2 = Math.cos(time * 0.5 + i * 0.2) * 5;
           const noise = Math.random() * 8;
           targetHeight = Math.max(2, 6 + (wave1 + wave2 + noise) * distFactor);
        } else {
           // Mic Input: Volume spikes from center
           // Add some idle movement
           const idle = Math.sin(time * 0.5 + i) * 2;
           
           // React to volume
           const volHeight = volume * 150 * distFactor;
           const noise = Math.random() * (volume * 20);
           
           targetHeight = Math.max(2, 4 + idle + volHeight + noise);
        }
        
        // Smooth interpolation
        return prevHeight + (targetHeight - prevHeight) * 0.4;
      }));

      animationFrame = requestAnimationFrame(updateBars);
    };

    updateBars();

    return () => cancelAnimationFrame(animationFrame);
  }, [volume, isSpeaking, isConnected]);

  return (
    <div className="w-full bg-[#05000a] border-y border-[rgba(179,102,255,0.1)] py-2">
        <div className="flex items-end justify-center gap-[2px] h-8 px-4">
        {bars.map((h, i) => (
            <div
            key={i}
            className={`w-1.5 rounded-sm transition-colors duration-75 ${
                !isConnected 
                ? 'bg-[rgba(255,255,255,0.05)]' 
                : isSpeaking 
                    ? 'bg-[#00ff88] shadow-[0_0_8px_rgba(0,255,136,0.6)]' 
                    : volume > 0.02 
                        ? 'bg-[#b366ff] shadow-[0_0_8px_rgba(179,102,255,0.6)]' 
                        : 'bg-[rgba(179,102,255,0.2)]'
            }`}
            style={{ height: `${Math.min(32, h)}px` }}
            />
        ))}
        </div>
    </div>
  );
};