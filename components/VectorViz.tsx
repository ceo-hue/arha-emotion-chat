
import React, { useEffect, useState, useMemo } from 'react';

interface VectorVizProps {
  active: boolean;
  mood: 'neutral' | 'protective' | 'warm' | 'deep';
}

const VectorViz: React.FC<VectorVizProps> = ({ active, mood }) => {
  const [dots, setDots] = useState<{x: number, y: number, color: string, scale: number, id: number}[]>([]);

  const moodSettings = useMemo(() => {
    switch (mood) {
      case 'protective':
        return { 
          colors: ['#e0f2fe', '#bae6fd', '#7dd3fc'], // Light Sky
          interval: 1200, 
          blur: '100px', 
          baseScale: 1.2,
          opacity: 0.3
        };
      case 'warm':
        return { 
          colors: ['#fef3c7', '#fde68a', '#fbbf24'], // Sunny Yellow
          interval: 800, 
          blur: '80px', 
          baseScale: 1.1,
          opacity: 0.4
        };
      case 'deep':
        return { 
          colors: ['#f5f3ff', '#ede9fe', '#ddd6fe'], // Lavender Mist
          interval: 1500, 
          blur: '140px', 
          baseScale: 1.4,
          opacity: 0.35
        };
      default:
        return { 
          colors: ['#f0f9ff', '#e0f2fe', '#d1fae5'], // Mint & Ice
          interval: 1000, 
          blur: '90px', 
          baseScale: 1.0,
          opacity: 0.25
        };
    }
  }, [mood]);

  useEffect(() => {
    const initialDots = Array.from({ length: 6 }).map((_) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: moodSettings.colors[Math.floor(Math.random() * moodSettings.colors.length)],
      scale: (0.5 + Math.random()) * moodSettings.baseScale,
      id: Math.random()
    }));
    setDots(initialDots);
  }, [mood, moodSettings]);

  useEffect(() => {
    const updateInterval = active ? moodSettings.interval * 0.6 : moodSettings.interval;
    
    const interval = setInterval(() => {
      setDots(prev => {
        const newDot = {
          x: Math.random() * 100,
          y: Math.random() * 100,
          color: moodSettings.colors[Math.floor(Math.random() * moodSettings.colors.length)],
          scale: (active ? 1.4 : 1.0) * (0.7 + Math.random()) * moodSettings.baseScale,
          id: Math.random()
        };
        const maxDots = active ? 10 : 5;
        const next = [newDot, ...prev];
        return next.slice(0, maxDots);
      });
    }, updateInterval);
    
    return () => clearInterval(interval);
  }, [active, moodSettings]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-[3000ms]" style={{ opacity: active ? moodSettings.opacity * 1.5 : moodSettings.opacity }}>
      {dots.map((dot, i) => (
        <div 
          key={dot.id}
          className="absolute rounded-full transition-all duration-[8000ms] ease-in-out mix-blend-overlay"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: '400px',
            height: '400px',
            filter: `blur(${moodSettings.blur})`,
            backgroundColor: dot.color,
            transform: `translate(-50%, -50%) scale(${dot.scale * (1.2 - i / dots.length)})`,
            opacity: 0.6 - (i / dots.length) * 0.3
          }}
        />
      ))}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-black text-indigo-900/10 uppercase tracking-[1.5em] whitespace-nowrap select-none">
        Aura_Resonance_Grounding_{mood}
      </div>
    </div>
  );
};

export default VectorViz;
