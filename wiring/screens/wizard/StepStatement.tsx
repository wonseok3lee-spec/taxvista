import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { loadStatements, saveStatement, Statement } from '../../lib/statementStorage';

interface Props {
  selectedId: string | null;
  onSelect: (id: string, text: string) => void;
  onTryPhrase: (phrase: string) => void;
}

export default function StepStatement({ selectedId, onSelect, onTryPhrase }: Props) {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');

  useEffect(() => { loadStatements().then(setStatements); }, []);

  async function handleAdd() {
    if (!newText.trim()) return;
    const stmt = await saveStatement(newText.trim());
    setStatements(prev => [...prev, stmt]);
    onSelect(stmt.id, stmt.text);
    setNewText('');
    setAdding(false);
  }

  return (
    <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
      <Text style={st.title}>Choose your statement</Text>
      <Text style={st.sub}>One alarm. One statement.</Text>
      {statements.map(s => {
        const active = s.id === selectedId;
        return (
          <TouchableOpacity key={s.id} style={[st.card, active && st.cardActive]} onPress={() => onSelect(s.id, s.text)} activeOpacity={0.7}>
            <Text style={[st.cardText, active && st.cardTextActive]}>{s.text}</Text>
          </TouchableOpacity>
        );
      })}
      {adding ? (
        <View style={st.addRow}>
          <TextInput style={st.addInput} value={newText} onChangeText={setNewText} placeholder="Type your statement" placeholderTextColor="#555" autoFocus onSubmitEditing={handleAdd} />
          <TouchableOpacity style={st.addBtn} onPress={handleAdd}><Text style={st.addBtnText}>Add</Text></TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={st.newBtn} onPress={() => setAdding(true)}>
          <Text style={st.newBtnText}>+ Add new statement</Text>
        </TouchableOpacity>
      )}
      {selectedId && (
        <TouchableOpacity style={st.tryBtn} onPress={() => { const s = statements.find(x => x.id === selectedId); if (s) onTryPhrase(s.text); }}>
          <Text style={st.tryBtnText}>Prove it →</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { padding: 24, paddingTop: 0 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  sub: { color: '#666', fontSize: 14, fontWeight: '500', marginBottom: 24 },
  card: { backgroundColor: '#141414', borderRadius: 16, padding: 20, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  cardActive: { borderLeftColor: '#6C63FF' },
  cardText: { color: '#888', fontSize: 16, fontWeight: '500' },
  cardTextActive: { color: '#FFFFFF', fontWeight: '700' },
  newBtn: { paddingVertical: 16, alignItems: 'center' },
  newBtnText: { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addInput: { flex: 1, backgroundColor: '#1A1A1A', color: '#fff', fontSize: 15, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#333' },
  addBtn: { backgroundColor: '#6C63FF', paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700' },
  tryBtn: { borderWidth: 1, borderColor: '#6C63FF', borderRadius: 50, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  tryBtnText: { color: '#6C63FF', fontSize: 14, fontWeight: '600' },
});
