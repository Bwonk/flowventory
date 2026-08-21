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

// Ölçek: kapalı = ince çizgi, aktif = tam genişlik.
const COLLAPSED_SCALE = 0.1;

/**
 * Trend grafiği bar şekli (evilcharts monospace-bar-chart'tan uyarlandı):
 * hover'da bar tam genişliğe açılır ve değeri mono etiketle üstünde gösterir.
 * Dinlenmedeki ince-çizgi hali bilinçli bir tasarım tercihi.
 */
export const BarShape = (props: BarProps) => {
  const { fill, x, y, width, height, index, value, isActive } = props;

  const xPos = Number(x || 0);
  const yPos = Number(y || 0);
  const realWidth = Number(width || 0);
  const realHeight = Number(height || 0);

  const centerX = xPos + realWidth / 2;
  const centerY = yPos + realHeight / 2;

  return (
    <>
      <Rectangle {...props} fill="transparent" />

      <AnimatePresence>
        <motion.rect
          key={`bar-${index}`}
          x={xPos}
          y={yPos}
          width={realWidth}
          height={realHeight}
          fill={fill}
          initial={{ scaleX: isActive ? COLLAPSED_SCALE : 1 }}
          animate={{ scaleX: isActive ? 1 : COLLAPSED_SCALE }}
          exit={{ scaleX: COLLAPSED_SCALE }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          style={{
            transformOrigin: `${centerX}px ${centerY}px`,
            transformBox: 'fill-box',
          }}
        />
      </AnimatePresence>
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
