import * as Localization from 'expo-localization';

export interface UIStrings {
  appTitle: string; noAlarms: string; noAlarmsSub: string; everyDay: string; deleteAlarm: string; addAlarm: string; editAlarm: string; repeat: string; daily: string;
  wakePhrase: string; phrasePlaceholder: string; phraseHelper: string; alarmSound: string; soundDefault: string;
  intensity: string; intGentle: string; intBrutal: string; intLevel: string; vibration: string; vibOff: string; vibLight: string; vibStrong: string;
  save: string; cancel: string; tryNow: string; btn: string; btnRec: string; btnListening: string;
  recognized: string; similarity: string; match: string; noMatch: string; phraseLabel: string; saved: string; phraseRequired: string;
  transcribing: string; almostThere: string; successTitle: string; successSub: string; chip1: string; chip2: string; chip3: string; streak: string;
}

const UI: Record<string, UIStrings> = {
  ko: {
    appTitle: 'Wiring', noAlarms: '알람이 없습니다.', noAlarmsSub: '되고 싶은 나를 시작하세요.', everyDay: '매일', deleteAlarm: '삭제',
    addAlarm: '새 알람', editAlarm: '알람 수정', repeat: 'REPEAT', daily: '매일',
    wakePhrase: 'YOUR INTENTION', phrasePlaceholder: '나는 나타난다. 나는 해낸다. 나는 된다.', phraseHelper: '되고 싶은 내가 되기 위해, 이 말로 하루를 시작하세요.',
    alarmSound: '알람 소리', soundDefault: '기본',
    intensity: 'WAKE INTENSITY', intGentle: 'Gentle', intBrutal: 'Brutal', intLevel: 'Level',
    vibration: 'VIBRATION', vibOff: '끔', vibLight: '약하게', vibStrong: '강하게',
    save: '알람 설정', cancel: '취소', tryNow: '다짐 연습하기 →',
    btn: '🎤 길게 눌러 말하기', btnRec: '🔴 듣는 중...', btnListening: '👂 듣는 중...',
    recognized: '당신이 말한 것:', similarity: '명확도:', match: '✅ 다짐 완료.', noMatch: '아직. 다시 해보세요.',
    phraseLabel: '당신의 다짐을 소리 내어 말하세요.', saved: '저장됨', phraseRequired: '먼저 다짐을 입력하세요',
    transcribing: '확인 중...', almostThere: '거의 다 됐어요...',
    successTitle: '해냈습니다.', successSub: '🌅',
    chip1: '나는 매일 빠짐없이 나타난다.', chip2: '나는 내가 말한 대로 되어간다.', chip3: '나는 어려운 일을 한다.',
    streak: '일 연속',
  },
  en: {
    appTitle: 'Wiring', noAlarms: 'No alarms yet.', noAlarmsSub: 'Add one to start becoming.', everyDay: 'Every day', deleteAlarm: 'Delete',
    addAlarm: 'New Alarm', editAlarm: 'Edit Alarm', repeat: 'REPEAT', daily: 'Every day',
    wakePhrase: 'YOUR INTENTION', phrasePlaceholder: 'I show up. I follow through. I become.', phraseHelper: 'Say this to start your day as who you want to be.',
    alarmSound: 'Alarm sound', soundDefault: 'Standard',
    intensity: 'WAKE INTENSITY', intGentle: 'Gentle', intBrutal: 'Brutal', intLevel: 'Level',
    vibration: 'VIBRATION', vibOff: 'Off', vibLight: 'Light', vibStrong: 'Strong',
    save: 'Set Alarm', cancel: 'Cancel', tryNow: 'Practice your commitment →',
    btn: '🎤 Hold to speak', btnRec: '🔴 Listening...', btnListening: '👂 Listening...',
    recognized: 'You said:', similarity: 'Clarity:', match: '✅ Committed.', noMatch: 'Not yet. Try again.',
    phraseLabel: 'Say your intention out loud.', saved: 'Saved', phraseRequired: 'Enter your intention first',
    transcribing: 'Checking...', almostThere: 'Almost there...',
    successTitle: 'You showed up.', successSub: '🌅',
    chip1: 'I show up every single day.', chip2: 'I am becoming who I say I am.', chip3: 'I do hard things.',
    streak: 'day streak',
  },
  es: {
    appTitle: 'Wiring', noAlarms: 'Sin alarmas.', noAlarmsSub: 'Agrega una y empieza a ser.', everyDay: 'Todos los días', deleteAlarm: 'Eliminar',
    addAlarm: 'Nueva alarma', editAlarm: 'Editar alarma', repeat: 'REPEAT', daily: 'Todos los días',
    wakePhrase: 'TU INTENCIÓN', phrasePlaceholder: 'Me presento. Cumplo. Me convierto.', phraseHelper: 'Di esto para empezar el día como quien quieres ser.',
    alarmSound: 'Sonido', soundDefault: 'Estándar',
    intensity: 'INTENSIDAD', intGentle: 'Suave', intBrutal: 'Brutal', intLevel: 'Nivel',
    vibration: 'VIBRACIÓN', vibOff: 'Apagar', vibLight: 'Ligera', vibStrong: 'Fuerte',
    save: 'Crear alarma', cancel: 'Cancelar', tryNow: 'Practica tu compromiso →',
    btn: '🎤 Mantén para hablar', btnRec: '🔴 Escuchando...', btnListening: '👂 Escuchando...',
    recognized: 'Dijiste:', similarity: 'Claridad:', match: '✅ Comprometido.', noMatch: 'Aún no. Inténtalo.',
    phraseLabel: 'Di tu intención en voz alta.', saved: 'Guardado', phraseRequired: 'Ingresa tu intención primero',
    transcribing: 'Verificando...', almostThere: 'Casi...',
    successTitle: 'Te presentaste.', successSub: '🌅',
    chip1: 'Me presento todos los días.', chip2: 'Me estoy convirtiendo en quien digo ser.', chip3: 'Hago cosas difíciles.',
    streak: 'días seguidos',
  },
  zh: {
    appTitle: 'Wiring', noAlarms: '还没有闹钟。', noAlarmsSub: '添加一个，开始成为。', everyDay: '每天', deleteAlarm: '删除',
    addAlarm: '新闹钟', editAlarm: '编辑闹钟', repeat: 'REPEAT', daily: '每天',
    wakePhrase: '你的决心', phrasePlaceholder: '我出现。我坚持。我成为。', phraseHelper: '说出这句话，以你想成为的人开始新的一天。',
    alarmSound: '闹钟声音', soundDefault: '标准',
    intensity: '唤醒强度', intGentle: '轻柔', intBrutal: '强烈', intLevel: '等级',
    vibration: '震动', vibOff: '关闭', vibLight: '轻微', vibStrong: '强烈',
    save: '设置闹钟', cancel: '取消', tryNow: '练习你的承诺 →',
    btn: '🎤 长按说话', btnRec: '🔴 聆听中...', btnListening: '👂 聆听中...',
    recognized: '你说了:', similarity: '清晰度:', match: '✅ 已承诺。', noMatch: '还没有。再试一次。',
    phraseLabel: '大声说出你的决心。', saved: '已保存', phraseRequired: '请先输入你的决心',
    transcribing: '确认中...', almostThere: '快了...',
    successTitle: '你出现了。', successSub: '🌅',
    chip1: '我每一天都出现。', chip2: '我正在成为我所说的人。', chip3: '我做困难的事。',
    streak: '天连续',
  },
  ja: {
    appTitle: 'Wiring', noAlarms: 'アラームなし。', noAlarmsSub: '追加して、なりたい自分を始めよう。', everyDay: '毎日', deleteAlarm: '削除',
    addAlarm: '新しいアラーム', editAlarm: 'アラーム編集', repeat: 'REPEAT', daily: '毎日',
    wakePhrase: 'YOUR INTENTION', phrasePlaceholder: '私は現れる。やり遂げる。なる。', phraseHelper: 'なりたい自分として一日を始めるために、この言葉を言う。',
    alarmSound: 'アラーム音', soundDefault: '標準',
    intensity: '起床強度', intGentle: '穏やか', intBrutal: '強烈', intLevel: 'レベル',
    vibration: '振動', vibOff: 'オフ', vibLight: '弱い', vibStrong: '強い',
    save: 'アラーム設定', cancel: 'キャンセル', tryNow: '決意を練習する →',
    btn: '🎤 長押しで話す', btnRec: '🔴 聞いています...', btnListening: '👂 聞いています...',
    recognized: 'あなたが言ったこと:', similarity: '明確度:', match: '✅ 決意完了。', noMatch: 'まだ。もう一度。',
    phraseLabel: '決意を声に出して。', saved: '保存済み', phraseRequired: 'まず決意を入力してください',
    transcribing: '確認中...', almostThere: 'もう少し...',
    successTitle: 'やり遂げた。', successSub: '🌅',
    chip1: '私は毎日必ず現れる。', chip2: '私は言った通りの人間になる。', chip3: '私は困難なことをする。',
    streak: '日連続',
  },
  pt: {
    appTitle: 'Wiring', noAlarms: 'Sem alarmes.', noAlarmsSub: 'Adicione um e comece a se tornar.', everyDay: 'Todos os dias', deleteAlarm: 'Excluir',
    addAlarm: 'Novo alarme', editAlarm: 'Editar alarme', repeat: 'REPEAT', daily: 'Todos os dias',
    wakePhrase: 'SUA INTENÇÃO', phrasePlaceholder: 'Eu apareço. Eu cumpro. Eu me torno.', phraseHelper: 'Diga isso para começar o dia como quem você quer ser.',
    alarmSound: 'Som do alarme', soundDefault: 'Padrão',
    intensity: 'INTENSIDADE', intGentle: 'Suave', intBrutal: 'Brutal', intLevel: 'Nível',
    vibration: 'VIBRAÇÃO', vibOff: 'Desligado', vibLight: 'Leve', vibStrong: 'Forte',
    save: 'Criar alarme', cancel: 'Cancelar', tryNow: 'Pratique seu compromisso →',
    btn: '🎤 Segure para falar', btnRec: '🔴 Ouvindo...', btnListening: '👂 Ouvindo...',
    recognized: 'Você disse:', similarity: 'Clareza:', match: '✅ Comprometido.', noMatch: 'Ainda não. Tente de novo.',
    phraseLabel: 'Diga sua intenção em voz alta.', saved: 'Salvo', phraseRequired: 'Digite sua intenção primeiro',
    transcribing: 'Verificando...', almostThere: 'Quase...',
    successTitle: 'Você apareceu.', successSub: '🌅',
    chip1: 'Eu apareço todo santo dia.', chip2: 'Estou me tornando quem eu digo ser.', chip3: 'Eu faço coisas difíceis.',
    streak: 'dias seguidos',
  },
  fr: {
    appTitle: 'Wiring', noAlarms: 'Aucune alarme.', noAlarmsSub: 'Ajoutez-en une pour commencer à devenir.', everyDay: 'Tous les jours', deleteAlarm: 'Supprimer',
    addAlarm: 'Nouvelle alarme', editAlarm: 'Modifier alarme', repeat: 'REPEAT', daily: 'Tous les jours',
    wakePhrase: 'VOTRE INTENTION', phrasePlaceholder: 'Je me présente. Je tiens. Je deviens.', phraseHelper: 'Dites ceci pour commencer la journée comme qui vous voulez être.',
    alarmSound: 'Son d\'alarme', soundDefault: 'Standard',
    intensity: 'INTENSITÉ', intGentle: 'Doux', intBrutal: 'Brutal', intLevel: 'Niveau',
    vibration: 'VIBRATION', vibOff: 'Désactivé', vibLight: 'Légère', vibStrong: 'Forte',
    save: 'Créer alarme', cancel: 'Annuler', tryNow: 'Pratiquez votre engagement →',
    btn: '🎤 Maintenez pour parler', btnRec: '🔴 Écoute...', btnListening: '👂 Écoute...',
    recognized: 'Vous avez dit :', similarity: 'Clarté :', match: '✅ Engagé.', noMatch: 'Pas encore. Réessayez.',
    phraseLabel: 'Dites votre intention à voix haute.', saved: 'Enregistré', phraseRequired: 'Entrez votre intention d\'abord',
    transcribing: 'Vérification...', almostThere: 'Presque...',
    successTitle: 'Vous êtes là.', successSub: '🌅',
    chip1: 'Je me présente chaque jour.', chip2: 'Je deviens qui je dis être.', chip3: 'Je fais des choses difficiles.',
    streak: 'jours de suite',
  },
  de: {
    appTitle: 'Wiring', noAlarms: 'Keine Alarme.', noAlarmsSub: 'Füge einen hinzu und fang an zu werden.', everyDay: 'Jeden Tag', deleteAlarm: 'Löschen',
    addAlarm: 'Neuer Alarm', editAlarm: 'Alarm bearbeiten', repeat: 'REPEAT', daily: 'Jeden Tag',
    wakePhrase: 'DEIN VORSATZ', phrasePlaceholder: 'Ich erscheine. Ich ziehe durch. Ich werde.', phraseHelper: 'Sage dies, um den Tag als der zu beginnen, der du sein willst.',
    alarmSound: 'Alarmton', soundDefault: 'Standard',
    intensity: 'WECKINTENSITÄT', intGentle: 'Sanft', intBrutal: 'Brutal', intLevel: 'Stufe',
    vibration: 'VIBRATION', vibOff: 'Aus', vibLight: 'Leicht', vibStrong: 'Stark',
    save: 'Alarm erstellen', cancel: 'Abbrechen', tryNow: 'Übe dein Commitment →',
    btn: '🎤 Halten zum Sprechen', btnRec: '🔴 Zuhören...', btnListening: '👂 Zuhören...',
    recognized: 'Du sagtest:', similarity: 'Klarheit:', match: '✅ Committed.', noMatch: 'Noch nicht. Nochmal.',
    phraseLabel: 'Sage deinen Vorsatz laut.', saved: 'Gespeichert', phraseRequired: 'Gib zuerst deinen Vorsatz ein',
    transcribing: 'Prüfe...', almostThere: 'Fast...',
    successTitle: 'Du bist da.', successSub: '🌅',
    chip1: 'Ich erscheine jeden einzelnen Tag.', chip2: 'Ich werde, wer ich sage.', chip3: 'Ich tue schwierige Dinge.',
    streak: 'Tage in Folge',
  },
};

export function getLang(): string {
  const locale = Localization.getLocales?.()[0]?.languageCode ?? 'en';
  return UI[locale] ? locale : 'en';
}

export function getStrings(lang: string): UIStrings {
  return UI[lang] ?? UI['en'];
}
