import React, { FC } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDigitalCounter } from '@/lib/digital-counter-context';

import { DigitalWheel } from './digital-wheel';

export const DigitalCounter: FC = () => {
  const { max } = useDigitalCounter();

  return (
    <View style={styles.container}>
      {Array.from({ length: max.toString().length }).map((_, index) => (
        <DigitalWheel key={index} index={index} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
