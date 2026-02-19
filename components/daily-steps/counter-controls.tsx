import { FC } from 'react';
import { StyleSheet, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

import { useDigitalCounter } from '@/lib/digital-counter-context';

import { CounterButton } from './counter-button';

export const CounterControls: FC = () => {
  const { handleIncrement, handleDecrement } = useDigitalCounter();

  return (
    <View style={styles.container}>
      <CounterButton onPress={handleDecrement} icon={<Minus size={18} color="rgba(15, 23, 42, 0.82)" />} />
      <View style={styles.separator} />
      <CounterButton onPress={handleIncrement} icon={<Plus size={18} color="rgba(15, 23, 42, 0.82)" />} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    overflow: 'hidden',
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
  },
});
