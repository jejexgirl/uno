import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Check,
  Play,
  ArrowRight,
  Sparkles,
  Copy,
  Plus,
  LogOut,
  Volume2,
  VolumeX,
  RotateCw,
  RotateCcw,
  AlertCircle,
  ShieldAlert,
  Flame,
  User,
  Crown,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import { GameState, Card, CardColor, ClientAction } from './types';
import { UnoCard } from './components/UnoCard';

function playSound(type: 'play' | 'draw' | 'uno' | 'error' | 'ready' | 'win', isMuted: boolean) {
  if (isMuted) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'play') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'draw') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.start(); osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'uno') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(); osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.setValueAtTime(110, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'ready') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(); osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'win') {
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
      notes.forEach((freq, idx) => {
        const oscN = ctx.createOscillator();
        const gainN = ctx.createGain();
        oscN.connect(gainN); gainN.connect(ctx.destination);
        oscN.type = 'sine';
        oscN.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gainN.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.12);
        gainN.gain.linearRampToValueAtTime(0.01, ctx.currentTime + idx * 0.12 + 0.35);
        oscN.start(ctx.currentTime + idx * 0.12);
        oscN.stop(ctx.currentTime + idx * 0.12 + 0.35);
      });
    }
  } catch (e) { console.warn('Audio failed:', e); }
}

const colorNamesAr: Record<CardColor, string> = {
  red: 'الأحمر 🔴', yellow: 'الأصفر 🟡', green: 'الأخضر 🟢', blue: 'الأزرق 🔵', wild: 'العشوائي 🎨',
};
const bgColors: Record<CardColor, string> = {
  red: 'bg-red-600', yellow: 'bg-amber-500', green: 'bg-emerald-600', blue: 'bg-blue-600', wild: 'bg-zinc-800',
};

export default function App() {
  const [name, setName] = useState(() => localStorage.getItem('uno_player_name') || '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [yourId, setYourId] = useState<string | null>(null);
  const [yourCards, setYourCards] = useState<Card[]>([]);
  const [connStatus, setConnStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeWildColorPicker, setActiveWildColorPicker] = useState<{ cardId: string; type: 'wild' | 'draw_4' } | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const prevMsgCount = useRef(0);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.logs]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.messages]);

  // Track unread chat messages
  useEffect(() => {
    const msgs = gameState?.messages || [];
    if (msgs.length > prevMsgCount.current) {
      const newCount = msgs.length - prevMsgCount.current;
      if (!chatOpen) setUnreadCount(prev => prev + newCount);
    }
    prevMsgCount.current = msgs.length;
  }, [gameState?.messages, chatOpen]);

  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
  }, [chatOpen]);

  useEffect(() => {
    return () => { if (socketRef.current) socketRef.current.close(); };
  }, []);

  const connectToGame = (roomCode?: string) => {
    if (!name.trim()) { setError('الرجاء إدخال اسمك أولاً!'); playSound('error', isMuted); return; }
    localStorage.setItem('uno_player_name', name.trim());
    setError(null); setConnStatus('connecting');
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    if (socketRef.current) socketRef.current.close();
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    ws.onopen = () => {
      setConnStatus('connected');
      ws.send(JSON.stringify({ type: 'join', name: name.trim(), roomCode: roomCode ? roomCode.toUpperCase() : undefined } as ClientAction));
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'sync') {
        const oldState = gameState;
        setGameState(data.state); setYourId(data.yourId); setYourCards(data.yourCards); setError(null);
        if (data.state.status === 'playing' && oldState?.status === 'lobby') playSound('win', isMuted);
        else if (data.state.logs.length > (oldState?.logs.length || 0)) {
          const latestLog = data.state.logs[data.state.logs.length - 1]?.text || '';
          if (latestLog.includes('أونـو')) playSound('uno', isMuted);
          else if (latestLog.includes('سحب')) playSound('draw', isMuted);
          else if (latestLog.includes('لعب')) playSound('play', isMuted);
          else if (latestLog.includes('جاهز')) playSound('ready', isMuted);
        }
      } else if (data.type === 'error') {
        setError(data.message); playSound('error', isMuted);
      } else if (data.type === 'leave_success') {
        setGameState(null); setYourCards([]); setYourId(null); setConnStatus('disconnected');
      }
    };
    ws.onclose = () => setConnStatus('disconnected');
    ws.onerror = () => { setError('حدث خطأ في الاتصال.'); setConnStatus('disconnected'); playSound('error', isMuted); };
  };

  const sendAction = (action: ClientAction) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(action));
    } else { setError('لا يوجد اتصال بالخادم.'); playSound('error', isMuted); }
  };

  const toggleReady = () => {
    const me = gameState?.players.find(p => p.id === yourId);
    if (me) sendAction({ type: 'ready', isReady: !me.isReady });
  };
  const handleStartGame = () => sendAction({ type: 'start_game' });
  const handleReturnToLobby = () => sendAction({ type: 'return_to_lobby' });
  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendAction({ type: 'send_chat', text });
    setChatInput('');
  };
  const handlePlayCard = (card: Card) => {
    if (!gameState) return;
    if (card.color === 'wild' || card.type === 'draw_4') {
      setActiveWildColorPicker({ cardId: card.id, type: card.type === 'draw_4' ? 'draw_4' : 'wild' });
    } else sendAction({ type: 'play_card', cardId: card.id });
  };
  const selectWildColorAndPlay = (color: CardColor) => {
    if (!activeWildColorPicker) return;
    sendAction({ type: 'play_card', cardId: activeWildColorPicker.cardId, wildColor: color });
    setActiveWildColorPicker(null);
  };
  const handleDrawCard = () => sendAction({ type: 'draw_card' });
  const handlePassTurn = () => sendAction({ type: 'pass_turn' });
  const handleSayUno = () => sendAction({ type: 'say_uno' });
  const handleReportNoUno = () => sendAction({ type: 'report_no_uno' });
  const handleLeaveRoom = () => sendAction({ type: 'leave_room' });
  const handleCopyCode = () => {
    if (!gameState) return;
    navigator.clipboard.writeText(gameState.code);
    setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000);
  };

  const isCardPlayable = (card: Card): boolean => {
    if (!gameState) return false;
    const activePlayer = gameState.players[gameState.currentTurn];
    if (activePlayer.id !== yourId) return false;
    const topCard = gameState.topCard;
    if (!topCard) return false;
    if (card.color === 'wild') return true;
    const targetColor = topCard.color === 'wild' ? gameState.selectedColor : topCard.color;
    if (card.color === targetColor) return true;
    if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
    if (card.type !== 'number' && card.type === topCard.type) return true;
    return false;
  };

  const myIndexInState = gameState ? gameState.players.findIndex(p => p.id === yourId) : -1;
  const orderedOpponents = gameState && myIndexInState !== -1
    ? [...gameState.players.slice(myIndexInState + 1), ...gameState.players.slice(0, myIndexInState)]
    : [];

  const getOpponentPositionStyle = (index: number, total: number) => {
    if (total === 1) return 'top-4 left-1/2 -translate-x-1/2';
    if (total === 2) { if (index === 0) return 'top-[40%] left-3'; return 'top-4 left-1/2 -translate-x-1/2'; }
    if (total === 3) { if (index === 0) return 'top-[42%] left-3'; if (index === 1) return 'top-4 left-1/2 -translate-x-1/2'; return 'top-[42%] right-3'; }
    const positions = ['top-[42%] left-3', 'top-8 left-[16%]', 'top-4 left-1/2 -translate-x-1/2', 'top-8 right-[16%]', 'top-[42%] right-3'];
    return positions[index % positions.length];
  };

  // Floating Chat Component (rendered separately, on top of everything)
  const FloatingChat = () => {
    if (!gameState) return null;
    const messages = gameState.messages || [];

    return (
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {/* Chat window */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ duration: 0.18 }}
              className="w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              style={{ height: '340px' }}
            >
              {/* Chat header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">شات الغرفة 💬</span>
                  <span className="text-[10px] text-slate-500">({gameState.code})</span>
                </div>
                <button onClick={() => setChatOpen(false)} className="text-slate-500 hover:text-slate-200 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-600 text-xs text-center">لا توجد رسائل بعد.<br />ابدأ المحادثة! 👋</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === yourId;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && (
                          <span className="text-[10px] text-slate-500 font-semibold mb-0.5 px-1">{msg.senderName}</span>
                        )}
                        <div className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs leading-relaxed break-words ${
                          isMe
                            ? 'bg-amber-500 text-slate-950 font-semibold rounded-tr-none'
                            : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 py-2.5 border-t border-slate-800 flex items-center gap-2 bg-slate-900">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
                  placeholder="اكتب رسالتك... (أي لغة)"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  dir="auto"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="p-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 rounded-xl transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-slate-950" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle button */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="relative w-12 h-12 bg-amber-500 hover:bg-amber-400 rounded-2xl shadow-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer border-2 border-amber-400"
        >
          <MessageCircle className="w-5 h-5 text-slate-950" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-black text-white flex items-center justify-center border border-red-700">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-slate-900 text-white font-sans overflow-hidden flex flex-col relative" dir="rtl">
      {/* Ambient background */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

      {/* Header */}
      <header className="h-14 border-b border-slate-700/80 flex items-center justify-between px-6 bg-slate-800/60 backdrop-blur-sm z-40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center font-black text-xl shadow-lg text-white italic border border-red-500/30">J</div>
          <div>
            <h1 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
              جيـجي أونـو <span className="text-red-500 text-xs">Jeje Uno</span>
            </h1>
            <p className="text-[9px] text-slate-400">طاولة لعب واقعية مميزة 🎴</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer">
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          {gameState && (
            <button onClick={handleLeaveRoom} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-900/40 hover:bg-red-900/60 text-red-300 transition-colors text-xs font-bold cursor-pointer">
              <LogOut className="w-3.5 h-3.5" /><span>خروج</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content - fills remaining height */}
      <main className="flex-1 overflow-hidden relative z-10">
        <AnimatePresence mode="wait">
          {error && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4">
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 flex items-center gap-3 text-xs shadow-xl backdrop-blur-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <div className="flex-1">{error}</div>
                <button onClick={() => setError(null)} className="text-xs font-bold hover:text-white px-2 py-0.5 rounded bg-red-900/30 cursor-pointer">✕</button>
              </motion.div>
            </div>
          )}

          {/* SCREEN 1: Login */}
          {!gameState && (
            <motion.div key="start" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center p-4">
              <div className="max-w-sm w-full p-7 rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm shadow-xl relative overflow-hidden">
                <div className="absolute top-[-40px] left-[-40px] w-40 h-40 bg-red-600/10 blur-3xl rounded-full" />
                <div className="absolute bottom-[-40px] right-[-40px] w-40 h-40 bg-blue-600/10 blur-3xl rounded-full" />

                <div className="text-center mb-6">
                  <div className="inline-flex gap-1 mb-4 justify-center">
                    {['ج','ي','ج','ي'].map((c, i) => (
                      <div key={i} className={`w-9 h-13 rounded-md border border-white/20 flex items-center justify-center font-black text-white text-sm shadow-md
                        ${i===0?'bg-gradient-to-br from-red-500 to-red-600 -rotate-12':i===1?'bg-gradient-to-br from-amber-400 to-yellow-500':i===2?'bg-gradient-to-br from-emerald-500 to-emerald-600 rotate-6':'bg-gradient-to-br from-blue-500 to-blue-600 rotate-12'}`}
                        style={{width:36,height:52}}>
                        {c}
                      </div>
                    ))}
                    <span className="mx-1 text-slate-500 font-extrabold text-xl self-center">•</span>
                    {['أ','و','ن','و'].map((c, i) => (
                      <div key={i} className={`rounded-md border border-white/20 flex items-center justify-center font-black text-white text-sm shadow-md
                        ${i===0?'bg-gradient-to-br from-red-500 to-red-600 -rotate-12':i===1?'bg-gradient-to-br from-amber-400 to-yellow-500':i===2?'bg-gradient-to-br from-emerald-500 to-emerald-600 rotate-6':'bg-gradient-to-br from-blue-500 to-blue-600 rotate-12'}`}
                        style={{width:36,height:52}}>
                        {c}
                      </div>
                    ))}
                  </div>
                  <h2 className="text-xl font-black text-slate-100">مرحباً في Jeje Uno! 🎉</h2>
                  <p className="text-xs text-slate-400 mt-1">العب مع أصدقائك بشكل مباشر</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">اسمك:</label>
                    <div className="relative">
                      <input type="text" placeholder="مثال: أحمد، سارة..." value={name}
                        onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) connectToGame(); }}
                        maxLength={15}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-center font-bold text-sm" />
                      <User className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 right-3" />
                    </div>
                  </div>

                  <button onClick={() => connectToGame()} disabled={connStatus === 'connecting' || !name.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                    <Plus className="w-4 h-4 stroke-[2.5px]" /><span>إنشاء روم جديدة ✨</span>
                  </button>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-800" />
                    <span className="flex-shrink mx-3 text-slate-500 text-xs font-bold">أو انضم</span>
                    <div className="flex-grow border-t border-slate-800" />
                  </div>

                  <div className="flex gap-2">
                    <input type="text" placeholder="كود الروم (5 حروف)" value={roomCodeInput}
                      onChange={e => setRoomCodeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && roomCodeInput.trim()) connectToGame(roomCodeInput); }}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-center font-mono tracking-widest uppercase font-bold text-sm" />
                    <button onClick={() => connectToGame(roomCodeInput)} disabled={connStatus === 'connecting' || !roomCodeInput.trim() || !name.trim()}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white font-bold active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {connStatus === 'connecting' && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center rounded-2xl">
                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-sm font-bold text-slate-200">جاري الاتصال...</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* SCREEN 2: Lobby */}
          {gameState && gameState.status === 'lobby' && (
            <motion.div key="lobby" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center p-4">
              <div className="max-w-xl w-full p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 shadow-xl overflow-y-auto max-h-full">
                <div className="flex flex-col md:flex-row items-start justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold uppercase">ردهة الانتظار ⏳</span>
                    <h2 className="text-xl font-black mt-1.5 text-slate-100">جهّز كروتك وباسم الله نبدأ!</h2>
                    <p className="text-xs text-slate-400 mt-0.5">الحد الأدنى 2 والأقصى 6 لاعبين.</p>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl px-4 py-3 flex flex-col items-center gap-1 shrink-0">
                    <span className="text-[10px] text-slate-400 font-bold">كود الروم</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-2xl font-bold text-yellow-500 tracking-widest">{gameState.code}</span>
                      <button onClick={handleCopyCode} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-all cursor-pointer">
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
                  {gameState.players.map(p => (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${p.id === yourId ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-800/30 border-slate-700/50'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${p.isOwner ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                          {p.isOwner ? <Crown className="w-4 h-4 text-amber-400" /> : <User className="w-4 h-4" />}
                        </div>
                        <div>
                          <span className="font-bold text-sm text-slate-200 flex items-center gap-1">
                            {p.name}{p.id === yourId && <span className="text-xs text-amber-400">(أنت)</span>}
                          </span>
                          <span className="text-[10px] text-slate-500">{p.isOwner ? 'مضيف الغرفة' : 'لاعب'}</span>
                        </div>
                      </div>
                      {p.isReady ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />جاهز ✅
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-500 border border-slate-700/50 rounded text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />غير جاهز
                        </span>
                      )}
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 2 - gameState.players.length) }).map((_, idx) => (
                    <div key={idx} className="border-2 border-dashed border-slate-800/60 rounded-xl p-4 flex items-center justify-center text-slate-600 text-sm h-16">
                      بانتظار لاعب... 👤
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={toggleReady} className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${gameState.players.find(p => p.id === yourId)?.isReady ? 'bg-slate-700 border border-slate-600 text-red-400 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black border border-emerald-700'}`}>
                    {gameState.players.find(p => p.id === yourId)?.isReady ? 'إلغاء الجاهزية' : 'تفعيل الجاهزية ✅'}
                  </button>
                  {gameState.players.find(p => p.id === yourId)?.isOwner && (
                    <button onClick={handleStartGame} disabled={gameState.players.length < 2 || !gameState.players.every(p => p.isReady)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 border border-amber-600 disabled:opacity-40 cursor-pointer">
                      <Play className="w-4 h-4" /><span>ابدأ اللعب 🎮</span>
                    </button>
                  )}
                </div>

                {gameState.players.find(p => p.id === yourId)?.isOwner && (
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-900/60 text-center text-xs text-slate-400">
                    {gameState.players.length < 2 ? <span className="text-amber-400">شارك كود الروم مع صديقك!</span>
                      : !gameState.players.every(p => p.isReady) ? <span className="text-amber-400">بانتظار جاهزية الجميع...</span>
                      : <span className="text-emerald-400 font-bold animate-pulse">الجميع جاهزون! اضغط ابدأ 🚀</span>}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* SCREEN 3: Gameplay */}
          {gameState && gameState.status === 'playing' && (
            <motion.div key="gameplay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex overflow-hidden">

              {/* Left sidebar: logs */}
              <div className="w-52 flex-shrink-0 flex flex-col border-r border-slate-700/50 bg-slate-800/20 overflow-hidden">
                {/* Direction + color */}
                <div className="p-3 border-b border-slate-700/50 space-y-2">
                  <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-lg">
                    <span className="text-[10px] font-semibold text-slate-400">الاتجاه:</span>
                    <span className="flex items-center gap-1 text-amber-400 font-bold text-[10px]">
                      {gameState.turnDirection === 1
                        ? <><RotateCw className="w-3 h-3 text-emerald-400" />عقارب الساعة</>
                        : <><RotateCcw className="w-3 h-3 text-amber-400" />عكس الساعة</>}
                    </span>
                  </div>
                  {gameState.topCard?.color === 'wild' && gameState.selectedColor && (
                    <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400">اللون:</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${bgColors[gameState.selectedColor]}`}>{colorNamesAr[gameState.selectedColor]}</span>
                    </div>
                  )}
                  {gameState.unoReportablePlayerId && (
                    <button onClick={handleReportNoUno} className="w-full py-1.5 px-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] active:scale-95 transition-all flex items-center justify-center gap-1.5 animate-pulse cursor-pointer">
                      <ShieldAlert className="w-3 h-3" />بلغ! لم يقل أونو 🚨
                    </button>
                  )}
                </div>

                {/* Logs */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <Flame className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] text-slate-400 font-bold">سجل الأحداث</span>
                  </div>
                  {gameState.logs.map(log => (
                    <div key={log.id} className={`p-1.5 rounded-lg text-[10px] leading-relaxed border ${
                      log.text.includes('عقوبة') || log.text.includes('كشف') ? 'border-red-900 bg-red-950/20 text-red-200'
                      : log.text.includes('أونـو') ? 'border-yellow-700 bg-yellow-950/20 text-yellow-100 font-bold'
                      : log.text.includes('فاز') ? 'border-emerald-700 bg-emerald-950/20 text-emerald-100 font-black'
                      : 'bg-slate-900/50 border-slate-800/40 text-slate-300'
                    }`}>{log.text}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>

              {/* Center: Game Table */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Table area */}
                <div className="flex-1 relative overflow-hidden">
                  <div className="absolute inset-3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/90 via-emerald-950 to-slate-950 border-[12px] border-amber-900/80 rounded-[80px] border-double ring-2 ring-amber-800/20 shadow-2xl overflow-hidden">
                    {/* Felt decorative rings */}
                    <div className="absolute inset-6 border border-emerald-500/10 rounded-[65px] pointer-events-none" />
                    <div className="absolute inset-14 border border-yellow-500/8 rounded-[55px] pointer-events-none" />

                    {/* Opponents */}
                    <div className="absolute inset-0 pointer-events-none">
                      {orderedOpponents.map((opp, idx) => {
                        const styleClass = getOpponentPositionStyle(idx, orderedOpponents.length);
                        const isOppTurn = gameState.players[gameState.currentTurn].id === opp.id;
                        return (
                          <div key={opp.id} className={`absolute p-2 rounded-xl bg-slate-900/95 border shadow-xl flex items-center gap-2 pointer-events-auto z-20 ${styleClass} ${isOppTurn ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-800/80'}`}>
                            {isOppTurn && <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-400 text-slate-950 text-[9px] font-black rounded uppercase tracking-wider animate-pulse whitespace-nowrap">دوره 👈</div>}
                            <div className="w-7 h-7 bg-slate-800 rounded flex items-center justify-center font-bold text-slate-300 text-xs relative">
                              {opp.name.charAt(0)}
                              {opp.saidUno && <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-slate-950 text-[7px] font-black px-0.5 rounded">UNO</span>}
                            </div>
                            <div>
                              <span className="font-bold text-xs text-slate-200">{opp.name}{opp.id === yourId && ' (أنت)'}</span>
                              <span className="text-[9px] text-slate-400 flex items-center gap-1 block">كروت: <strong className="text-amber-400">{opp.cardsCount}</strong></span>
                            </div>
                            <div className="flex gap-0.5">
                              {Array.from({ length: Math.min(4, opp.cardsCount) }).map((_, ci) => (
                                <div key={ci} className="w-2.5 h-4 bg-gradient-to-br from-red-600 to-red-700 rounded border border-white/30"
                                  style={{ transform: `rotate(${(ci - 1.5) * 7}deg)` }} />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Center: Deck + Discard */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex items-center gap-8">
                        {/* Draw deck */}
                        <div className="flex flex-col items-center gap-1.5">
                          <div onClick={() => { if (gameState.players[gameState.currentTurn].id === yourId) handleDrawCard(); }}
                            className={`relative w-20 h-30 rounded-xl border-4 border-white/80 bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center shadow-lg select-none cursor-pointer active:scale-95 transition-all ${
                              gameState.players[gameState.currentTurn].id === yourId ? 'ring-4 ring-yellow-400 hover:-translate-y-1' : 'opacity-80'
                            }`} style={{width:80,height:116}}>
                            <div className="absolute top-1 left-1 -right-1 -bottom-1 bg-neutral-800 border-2 border-white/50 rounded-xl -z-10" />
                            <div className="absolute top-2 left-2 -right-2 -bottom-2 bg-neutral-900 border border-white/20 rounded-xl -z-20" />
                            <div className="absolute inset-1.5 border border-amber-400 rounded-lg bg-neutral-900 flex items-center justify-center">
                              <div className="w-16 h-8 bg-red-600 rounded-full rotate-[-25deg] border border-yellow-400 flex items-center justify-center">
                                <span className="text-yellow-300 font-black text-xs tracking-wider drop-shadow">سحب</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-800">كومة السحب 🎴</span>
                        </div>

                        {/* Discard pile */}
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="relative" style={{width:96,height:140}}>
                            {gameState.topCard && (
                              <div style={{ transform: 'rotate(6deg)', transformOrigin: 'center center' }}>
                                <UnoCard card={gameState.topCard} disabled playable={false} size="md" />
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-800">الورقة المكشوفة</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom: Player controls + cards */}
                <div className="flex-shrink-0 bg-slate-800/30 border-t border-slate-700/50 px-4 py-2" style={{maxHeight:'42%'}}>
                  {/* Status bar */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-amber-500 text-slate-950 rounded-lg flex items-center justify-center font-black text-xs">أ</div>
                      <div>
                        <span className="font-bold text-slate-200 text-xs">
                          {gameState.players[gameState.currentTurn]?.id === yourId
                            ? `دورك يا ${gameState.players[myIndexInState]?.name}! 🌟`
                            : `دور ${gameState.players[gameState.currentTurn]?.name} ⏳`}
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          {gameState.players[gameState.currentTurn]?.id === yourId ? 'العب ورقة أو اسحب!' : 'انتظر دورك.'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={handlePassTurn} disabled={gameState.players[gameState.currentTurn].id !== yourId}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-bold text-xs active:scale-95 transition-all disabled:opacity-40 cursor-pointer">
                        تمرير ➡️
                      </button>
                      <button onClick={handleSayUno} disabled={yourCards.length > 2}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs active:scale-95 transition-all disabled:opacity-40 cursor-pointer">
                        أونـو! 📣
                      </button>
                    </div>
                  </div>

                  {/* Hand */}
                  <div>
                    <h4 className="font-bold text-[10px] text-slate-400 mb-1">أوراقك: <strong className="text-amber-400">({yourCards.length})</strong></h4>
                    {yourCards.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-xs border-2 border-dashed border-slate-800 rounded-xl">لا توجد كروت.</div>
                    ) : (
                      <div className="flex items-end overflow-x-auto pb-1" style={{minHeight: 100}}>
                        <div className="flex flex-row-reverse items-end py-2 px-4 mx-auto">
                          {yourCards.map((card, idx) => {
                            const playable = isCardPlayable(card);
                            const isMyTurn = gameState.players[gameState.currentTurn].id === yourId;
                            const angle = (idx - (yourCards.length - 1) / 2) * 3.5;
                            const translateY = Math.abs(idx - (yourCards.length - 1) / 2) * 2.5;
                            return (
                              <div key={card.id} className="shrink-0 transition-all duration-200 hover:z-30 hover:-translate-y-6 relative"
                                style={{ marginLeft: idx === 0 ? 0 : -48, transform: `rotate(${angle}deg) translateY(${translateY}px)`, zIndex: idx }}>
                                <UnoCard card={card} playable={playable && isMyTurn} disabled={!playable || !isMyTurn} onClick={() => handlePlayCard(card)} size="md" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* SCREEN 4: Game Ended */}
          {gameState && gameState.status === 'ended' && (
            <motion.div key="ended" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center p-4">
              <div className="max-w-sm w-full p-7 rounded-2xl bg-slate-800/40 border border-slate-700/50 shadow-xl text-center relative overflow-hidden overflow-y-auto max-h-full">
                <div className="absolute top-[-30px] left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full" />

                <div className="mb-5">
                  <div className="w-14 h-14 bg-amber-500/10 rounded-full border border-amber-500/30 flex items-center justify-center mx-auto animate-bounce mb-3">
                    <Sparkles className="w-7 h-7 text-amber-400" />
                  </div>
                  <h2 className="text-xl font-black text-slate-100">انتهت اللعبة! 🎉</h2>
                  <p className="text-xs text-slate-400 mt-1">مبروك للفائز!</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 my-4">
                  <span className="text-[10px] text-amber-400 font-bold block mb-1">البطل المتوج 🏆</span>
                  <span className="text-xl font-bold text-slate-100">{gameState.players.find(p => p.id === gameState.winnerId)?.name || 'بطل مجهول'}</span>
                </div>

                <div className="mb-5 p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-right">
                  <span className="text-[10px] text-slate-400 font-bold block mb-2 text-center border-b border-slate-800 pb-1.5">نقاط اللاعبين 🏆</span>
                  <div className="space-y-1.5">
                    {[...gameState.players].sort((a, b) => (b.points || 0) - (a.points || 0)).map((p, pi) => (
                      <div key={p.id} className="flex items-center justify-between text-xs py-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 w-4">{pi + 1}</span>
                          <span className={p.id === yourId ? 'text-amber-400 font-bold' : 'text-slate-200'}>{p.name}{p.id === yourId && ' (أنت)'}</span>
                        </div>
                        <span className="font-extrabold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">{p.points || 0} نقطة</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {gameState.players.find(p => p.id === yourId)?.isOwner && (
                    <>
                      <button onClick={handleStartGame} className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
                        جولة جديدة 🎮
                      </button>
                      <button onClick={handleReturnToLobby} className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
                        العودة للردهة ⏳
                      </button>
                    </>
                  )}
                  <button onClick={handleLeaveRoom} className="w-full py-2 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/35 text-red-400 border border-red-900/30 font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <LogOut className="w-3.5 h-3.5" />مغادرة الغرفة 🏠
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Wild Color Picker Modal */}
      <AnimatePresence>
        {activeWildColorPicker && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-xs w-full bg-slate-800/90 border border-slate-700/50 p-6 rounded-2xl shadow-2xl text-center">
              <h3 className="text-lg font-black text-slate-200 mb-2">اختر اللون 🎨</h3>
              <p className="text-xs text-slate-400 mb-5">لعبت ويلد! اختر اللون الجديد:</p>
              <div className="grid grid-cols-2 gap-3">
                {(['red', 'yellow', 'green', 'blue'] as CardColor[]).map(color => (
                  <button key={color} onClick={() => selectWildColorAndPlay(color)}
                    className={`py-3 rounded-xl ${bgColors[color]} text-slate-950 font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow cursor-pointer`}>
                    {colorNamesAr[color]}
                  </button>
                ))}
              </div>
              <button onClick={() => setActiveWildColorPicker(null)} className="mt-4 text-xs text-slate-500 font-bold hover:text-white cursor-pointer">إلغاء</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Chat */}
      <FloatingChat />

      {/* Footer */}
      <footer className="h-10 bg-slate-950/60 border-t border-slate-700/80 flex items-center px-6 text-[10px] text-slate-500 gap-6 select-none flex-shrink-0">
        <div>نظام اللعب: <span className="text-slate-300 font-semibold">Classic Rules</span></div>
        <div>الإصدار 2.0.0</div>
      </footer>
    </div>
  );
}
