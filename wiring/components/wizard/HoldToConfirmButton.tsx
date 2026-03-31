import { useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

interface Props { onConfirm: () => void; label?: string }

export default function HoldToConfirmButton({ onConfirm, label = 'Hold to lock' }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const hasConfirmed = useRef(false);

  function onPressIn() {
    if (hasConfirmed.current) return;
    anim.current = Animated.timing(progress, { toValue: 1, duration: 1500, useNativeDriver: false });
    anim.current.start(({ finished }) => {
      if (finished && !hasConfirmed.current) {
        hasConfirmed.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onConfirm();
      }
    });
  }

  function onPressOut() {
    if (hasConfirmed.current) return;
    anim.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  }

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} delayPressIn={100} style={st.btn}>
        <Animated.View style={[st.fill, { width }]} />
        <Text style={st.label}>{label}</Text>
      </Pressable>
      <Text style={st.hint}>There is no snooze. No escape.</Text>
    </View>
  );
}

const st = StyleSheet.create({
  btn: { height: 56, borderRadius: 28, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#6C63FF', borderRadius: 28 },
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', zIndex: 1 },
  hint: { color: '#444', fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 12 },
});
