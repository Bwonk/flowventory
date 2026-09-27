"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

export interface RocketLaunchIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface RocketLaunchIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

// Upstream 6sn sonsuz süzülme + 2sn alev döngüsüydü; DESIGN.md §6 ikon
// hover'ı ≤300ms ve döngüsüz ister → tek seferlik kısa "kalkış": roket
// burun yönüne (sağ üst) kayıp döner, alev bir kez uzayıp toplanır.
const VARIANTS: Variants = {
  normal: {
    x: 0,
    y: 0,
  },
  animate: {
    x: [0, 1.5, 0],
    y: [0, -1.5, 0],
    transition: {
      duration: 0.3,
      ease: "easeInOut",
      times: [0, 0.45, 1],
    },
  },
};

const FIRE_D =
  "M4.81191 16.6408C3.71213 17.4612 3 18.7724 3 20.25C3 20.4869 3.0183 20.7195 3.05356 20.9464C3.28054 20.9817 3.51313 21 3.75 21C5.22758 21 6.53883 20.2879 7.35925 19.1881";
const FIRE_D_LONG =
  "M4.81191 16.6408C3.21213 17.9612 2.5 19.2724 2.5 20.75C2.5 20.9869 2.5183 21.2195 2.55356 21.4464C2.78054 21.4817 3.01313 21.5 3.25 21.5C4.72758 21.5 6.03883 20.7879 6.85925 19.6881";

const FIRE_VARIANTS: Variants = {
  normal: {
    d: FIRE_D,
  },
  animate: {
    d: [FIRE_D, FIRE_D_LONG, FIRE_D],
    transition: {
      duration: 0.3,
      ease: "easeInOut",
      times: [0, 0.45, 1],
    },
  },
};

const RocketLaunchIcon = forwardRef<
  RocketLaunchIconHandle,
  RocketLaunchIconProps
>(({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
  const controls = useAnimation();
  const isControlledRef = useRef(false);

  useImperativeHandle(ref, () => {
    isControlledRef.current = true;

    return {
      startAnimation: () => controls.start("animate"),
      stopAnimation: () => controls.start("normal"),
    };
  });

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseEnter?.(e);
      } else {
        controls.start("animate");
      }
    },
    [controls, onMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isControlledRef.current) {
        onMouseLeave?.(e);
      } else {
        controls.start("normal");
      }
    },
    [controls, onMouseLeave]
  );

  return (
    <div
      className={cn(className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <motion.svg
        animate={controls}
        fill="none"
        height={size}
        initial="normal"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        variants={VARIANTS}
        viewBox="0 0 24 24"
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M15.5904 14.3696C15.6948 14.8128 15.75 15.275 15.75 15.75C15.75 19.0637 13.0637 21.75 9.75 21.75V16.9503M15.5904 14.3696C19.3244 11.6411 21.75 7.22874 21.75 2.25C16.7715 2.25021 12.3595 4.67586 9.63122 8.40975M15.5904 14.3696C13.8819 15.6181 11.8994 16.514 9.75 16.9503M9.63122 8.40975C9.18777 8.30528 8.72534 8.25 8.25 8.25C4.93629 8.25 2.25 10.9363 2.25 14.25H7.05072M9.63122 8.40975C8.38285 10.1183 7.48701 12.1007 7.05072 14.25M9.75 16.9503C9.64659 16.9713 9.54279 16.9912 9.43862 17.0101C8.53171 16.291 7.70991 15.4692 6.99079 14.5623C7.00969 14.4578 7.02967 14.3537 7.05072 14.25M16.5 9C16.5 9.82843 15.8284 10.5 15 10.5C14.1716 10.5 13.5 9.82843 13.5 9C13.5 8.17157 14.1716 7.5 15 7.5C15.8284 7.5 16.5 8.17157 16.5 9Z" />
        <motion.path
          animate={controls}
          d={FIRE_D}
          initial="normal"
          variants={FIRE_VARIANTS}
        />
      </motion.svg>
    </div>
  );
});

RocketLaunchIcon.displayName = "RocketLaunchIcon";

export { RocketLaunchIcon };
