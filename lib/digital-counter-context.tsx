import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import type { WheelDirection } from '@/lib/types/daily-steps';

type DigitalCounterContextValue = {
  counter: SharedValue<number>;
  currentWheelDigits: SharedValue<number[]>;
  previousWheelDigits: SharedValue<number[]>;
  direction: SharedValue<WheelDirection>;
  max: number;
  handleIncrement: () => void;
  handleDecrement: () => void;
};

type DigitalCounterProviderProps = {
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange?: (nextValue: number) => void;
  children: React.ReactNode;
};

const DigitalCounterContext = createContext<DigitalCounterContextValue | null>(null);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toWheelDigits(value: number, maxDigits: number): number[] {
  return String(value)
    .padStart(maxDigits, '0')
    .split('')
    .map((digit) => Number(digit));
}

export function DigitalCounterProvider({
  value,
  min = 0,
  max,
  step = 1,
  onChange,
  children,
}: DigitalCounterProviderProps) {
  const safeMin = Math.max(0, Math.round(min));
  const safeMax = Math.max(safeMin, Math.round(max));
  const safeStep = Math.max(1, Math.round(step));
  const maxDigits = useMemo(() => Math.max(1, String(safeMax).length), [safeMax]);

  const initialCounter = clamp(Math.round(value), safeMin, safeMax);
  const counter = useSharedValue(initialCounter);
  const currentWheelDigits = useSharedValue<number[]>(toWheelDigits(initialCounter, maxDigits));
  const previousWheelDigits = useSharedValue<number[]>(toWheelDigits(initialCounter, maxDigits));
  const direction = useSharedValue<WheelDirection>('idle');
  const lastValueRef = useRef(initialCounter);

  const setCounter = useCallback(
    (nextValue: number, nextDirection: WheelDirection, emitOnChange: boolean) => {
      const normalizedValue = clamp(Math.round(nextValue), safeMin, safeMax);
      if (normalizedValue === counter.get()) {
        return;
      }

      previousWheelDigits.set(currentWheelDigits.get());
      currentWheelDigits.set(toWheelDigits(normalizedValue, maxDigits));
      direction.set(nextDirection);
      counter.set(normalizedValue);
      lastValueRef.current = normalizedValue;

      if (emitOnChange) {
        onChange?.(normalizedValue);
      }
    },
    [counter, currentWheelDigits, direction, maxDigits, onChange, previousWheelDigits, safeMax, safeMin]
  );

  useEffect(() => {
    const normalizedValue = clamp(Math.round(value), safeMin, safeMax);
    if (normalizedValue === lastValueRef.current) {
      return;
    }

    const nextDirection: WheelDirection = normalizedValue > counter.get() ? 'increase' : 'decrease';
    setCounter(normalizedValue, nextDirection, false);
  }, [counter, safeMax, safeMin, setCounter, value]);

  const handleIncrement = useCallback(() => {
    setCounter(counter.get() + safeStep, 'increase', true);
  }, [counter, safeStep, setCounter]);

  const handleDecrement = useCallback(() => {
    setCounter(counter.get() - safeStep, 'decrease', true);
  }, [counter, safeStep, setCounter]);

  const contextValue = useMemo(
    () => ({
      counter,
      currentWheelDigits,
      previousWheelDigits,
      direction,
      max: safeMax,
      handleIncrement,
      handleDecrement,
    }),
    [
      counter,
      currentWheelDigits,
      previousWheelDigits,
      direction,
      safeMax,
      handleIncrement,
      handleDecrement,
    ]
  );

  return <DigitalCounterContext.Provider value={contextValue}>{children}</DigitalCounterContext.Provider>;
}

export function useDigitalCounter(): DigitalCounterContextValue {
  const context = useContext(DigitalCounterContext);
  if (!context) {
    throw new Error('useDigitalCounter must be used inside DigitalCounterProvider');
  }
  return context;
}
