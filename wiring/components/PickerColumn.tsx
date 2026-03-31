import { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, Keyboard } from 'react-native';

const ITEM_H = 50;
const VISIBLE = 5;
const CENTER = Math.floor(VISIBLE / 2); // row index 2
const COPIES = 100;
const MID_COPY = Math.floor(COPIES / 2);

export { ITEM_H };

interface Props { values: string[]; selectedIndex: number; onChange: (index: number) => void; width?: number; loop?: boolean }

export default function PickerColumn({ values, selectedIndex, onChange, width = 85, loop = true }: Props) {
  const listRef = useRef<FlatList>(null);
  const len = values.length;
  const data = loop ? Array.from({ length: len * COPIES }, (_, i) => values[i % len]) : values;
  const midStart = loop ? MID_COPY * len : 0;

  const [scrollCenter, setScrollCenter] = useState(midStart + selectedIndex);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    const target = midStart + selectedIndex;
    setScrollCenter(target);
    setTimeout(() => { listRef.current?.scrollToOffset({ offset: target * ITEM_H, animated: false }); }, 50);
  }, [selectedIndex, len]);

  const onScroll = useCallback((e: any) => {
    setScrollCenter(Math.round(e.nativeEvent.contentOffset.y / ITEM_H));
  }, []);

  const onSnap = useCallback((e: any) => {
    const rawIdx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    if (loop) {
      const real = ((rawIdx % len) + len) % len;
      const target = midStart + real;
      setScrollCenter(target);
      onChange(real);
      if (Math.abs(rawIdx - target) > len) {
        listRef.current?.scrollToOffset({ offset: target * ITEM_H, animated: false });
      }
    } else {
      const clamped = Math.max(0, Math.min(rawIdx, len - 1));
      setScrollCenter(clamped);
      onChange(clamped);
    }
  }, [len, midStart, loop, onChange]);

  function handleTap() { setEditText(values[selectedIndex]); setEditing(true); }
  function handleEditSubmit() {
    setEditing(false); Keyboard.dismiss();
    const trimmed = editText.trim();
    const idx = values.indexOf(trimmed);
    if (idx >= 0) { onChange(idx); return; }
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) {
      const padded = String(num).padStart(2, '0');
      const pi = values.indexOf(padded);
      if (pi >= 0) { onChange(pi); return; }
      const ri = values.indexOf(String(num));
      if (ri >= 0) onChange(ri);
    }
  }

  const getItemLayout = useCallback((_: any, i: number) => ({ length: ITEM_H, offset: ITEM_H * i, index: i }), []);

  const renderItem = useCallback(({ item, index }: { item: string; index: number }) => {
    const dist = Math.abs(index - scrollCenter);
    const isSel = dist === 0;
    return (
      <TouchableOpacity activeOpacity={1} onPress={isSel ? handleTap : undefined} style={st.item}>
        <Text style={
          dist === 0 ? st.d0 :
          dist === 1 ? st.d1 :
          dist === 2 ? st.d2 : st.d3
        }>{item}</Text>
      </TouchableOpacity>
    );
  }, [scrollCenter]);

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: 'hidden', position: 'relative' }}>
      {/* FIXED highlight bar — never scrolls */}
      <View style={st.bar} pointerEvents="none" />
      {editing && (
        <View style={st.editOverlay}>
          <TextInput style={st.editInput} value={editText} onChangeText={setEditText}
            onSubmitEditing={handleEditSubmit} onBlur={handleEditSubmit}
            keyboardType="number-pad" autoFocus selectTextOnFocus maxLength={2} />
        </View>
      )}
      <FlatList
        ref={listRef} data={data} keyExtractor={(_, i) => String(i)}
        renderItem={renderItem} getItemLayout={getItemLayout}
        snapToInterval={ITEM_H} decelerationRate={0.975}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll} onMomentumScrollEnd={onSnap} onScrollEndDrag={onSnap}
        scrollEventThrottle={16} nestedScrollEnabled
        extraData={scrollCenter}
        contentContainerStyle={{ paddingVertical: ITEM_H * CENTER }}
        style={{ zIndex: 1 }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  bar: { position: 'absolute', top: ITEM_H * CENTER, left: 4, right: 4, height: ITEM_H, backgroundColor: '#1A1A1A', borderRadius: 12, zIndex: 0 },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  d0: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', lineHeight: ITEM_H },
  d1: { fontSize: 24, fontWeight: '600', color: '#AAAAAA', opacity: 0.55, lineHeight: ITEM_H },
  d2: { fontSize: 20, fontWeight: '400', color: '#666666', opacity: 0.25, lineHeight: ITEM_H },
  d3: { fontSize: 18, fontWeight: '400', color: '#444444', opacity: 0.10, lineHeight: ITEM_H },
  editOverlay: { position: 'absolute', top: ITEM_H * CENTER, left: 4, right: 4, height: ITEM_H, zIndex: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A', borderRadius: 12 },
  editInput: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', textAlign: 'center', width: '100%', padding: 0 },
});
