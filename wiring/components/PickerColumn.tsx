import { useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

const ITEM_H = 44;
const REPEATS = 3;

interface Props {
  data: (string | number)[];
  initial: number;
  onChange: (index: number) => void;
}

export { ITEM_H };

export default function PickerColumn({ data, initial, onChange }: Props) {
  const ref = useRef<ScrollView>(null);
  const idxRef = useRef(initial);
  const len = data.length;
  const looped = Array.from({ length: len * REPEATS }, (_, i) => data[i % len]);

  useEffect(() => {
    const offset = (len + initial) * ITEM_H;
    setTimeout(() => ref.current?.scrollTo({ y: offset, animated: false }), 50);
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const rawIdx = Math.round(y / ITEM_H);
    const mapped = ((rawIdx % len) + len) % len;
    if (mapped !== idxRef.current) {
      idxRef.current = mapped;
      onChange(mapped);
    }
    if (rawIdx < len * 0.5 || rawIdx >= len * (REPEATS - 0.5)) {
      const resetY = (len + mapped) * ITEM_H;
      setTimeout(() => ref.current?.scrollTo({ y: resetY, animated: false }), 10);
    }
  }, [len, onChange]);

  return (
    <View style={styles.col}>
      <ScrollView
        ref={ref}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
      >
        {looped.map((v, i) => (
          <View key={i} style={styles.item}>
            <Text style={styles.text}>{typeof v === 'number' ? String(v).padStart(2, '0') : v}</Text>
          </View>
        ))}
      </ScrollView>
      <View pointerEvents="none" style={styles.highlight} />
    </View>
  );
}

const styles = StyleSheet.create({
  col: { width: 70, height: ITEM_H * 5, overflow: 'hidden' },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 28, fontWeight: '300' },
  highlight: { position: 'absolute', top: ITEM_H * 2, left: 0, right: 0, height: ITEM_H, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#6C63FF' },
});
