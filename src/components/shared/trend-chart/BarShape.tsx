'use client';

import { Rectangle } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface BarProps {
  index?: number;
  value?: number | [number, number];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  isActive?: boolean;
}

/**
 * Trend grafiği bar şekli: barlar dinlenmede tam genişlikte çizilir
 * (grafik ilk bakışta okunur kalır); hover yalnızca vurgu + mono değer
 * etiketi ekler.
 */
export const BarShape = (props: BarProps) => {
  const { fill, x, y, width, height, index, value, isActive } = props;

  const xPos = Number(x || 0);
  const yPos = Number(y || 0);
  const realWidth = Number(width || 0);
  const realHeight = Number(height || 0);

  const centerX = xPos + realWidth / 2;

  return (
    <>
      {/* Hover hitbox — barın tüm kolon alanı. */}
      <Rectangle {...props} fill="transparent" />

      <rect
        x={xPos}
        y={yPos}
        width={realWidth}
        height={realHeight}
        fill={fill}
        opacity={isActive ? 1 : 0.85}
      />
      {isActive && (
        <AnimatePresence>
          <motion.text
            className="font-mono"
            key={`text-${index}`}
            initial={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
            transition={{ duration: 0.2 }}
            x={centerX}
            y={yPos - 8}
            textAnchor="middle"
            fill={fill}
            style={{ pointerEvents: 'none' }}
          >
            {value}
          </motion.text>
        </AnimatePresence>
      )}
    </>
  );
};
