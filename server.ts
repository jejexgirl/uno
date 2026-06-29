import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { Card, CardColor, CardType, Player, GameState, GameLog, ClientAction } from './src/types';

// Standard helpers for Arabic UNO translation
const colorsAr: Record<CardColor, string> = {
  red: 'الأحمر 🔴',
  yellow: 'الأصفر 🟡',
  green: 'الأخضر 🟢',
  blue: 'الأزرق 🔵',
  wild: 'العشوائي 🎨',
};

function getCardNameAr(card: Card): string {
  if (card.type === 'number') {
    return `رقم ${card.value} بلون ${colorsAr[card.color]}`;
  }
  if (card.type === 'skip') {
    return `تخطي دور 🚫 بلون ${colorsAr[card.color]}`;
  }
  if (card.type === 'reverse') {
    return `عكس الاتجاه 🔄 بلون ${colorsAr[card.color]}`;
  }
  if (card.type === 'draw_2') {
    return `سحب 2 + 🎴 بلون ${colorsAr[card.color]}`;
  }
  if (card.type === 'wild') {
    return 'تغيير اللون 🎨';
  }
  if (card.type === 'draw_4') {
    return 'سحب 4 وتغيير اللون 🔥';
  }
  return 'بطاقة غير معروفة';
}

function createUnoDeck(): Card[] {
  const colors: CardColor[] = ['red', 'yellow', 'green', 'blue'];
  const deck: Card[] = [];
  let cardIdCounter = 1;

  colors.forEach((color) => {
    // Number 0 card
    deck.push({ id: `c_${cardIdCounter++}`, color, type: 'number', value: 0 });

    // Numbers 1-9 (two of each)
    for (let val = 1; val <= 9; val++) {
      deck.push({ id: `c_${cardIdCounter++}`, color, type: 'number', value: val });
      deck.push({ id: `c_${cardIdCounter++}`, color, type: 'number', value: val });
    }

    // Special cards (two of each)
    for (let i = 0; i < 2; i++) {
      deck.push({ id: `c_${cardIdCounter++}`, color, type: 'skip' });
      deck.push({ id: `c_${cardIdCounter++}`, color, type: 'reverse' });
      deck.push({ id: `c_${cardIdCounter++}`, color, type: 'draw_2' });
    }
  });

  // Wild cards (four of each)
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c_${cardIdCounter++}`, color: 'wild', type: 'wild' });
    deck.push({ id: `c_${cardIdCounter++}`, color: 'wild', type: 'draw_4' });
  }

  return deck;
}

function shuffle(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

function isValidPlay(card: Card, topCard: Card, selectedColor: CardColor | null): boolean {
  if (card.color === 'wild') return true;

  const targetColor = topCard.color === 'wild' ? selectedColor : topCard.color;

  if (card.color === targetColor) return true;

  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;

  if (card.type !== 'number' && card.type === topCard.type) return true;

  return false;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface ServerRoom {
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  players: {
    id: string;
    name: string;
    isReady: boolean;
    isOwner: boolean;
    cards: Card[];
    saidUno: boolean;
    points: number;
  }[];
  deck: Card[];
  discardPile: Card[];
  currentTurn: number;
  turnDirection: 1 | -1;
  selectedColor: CardColor | null;
  winnerId: string | null;
  logs: GameLog[];
  messages: ChatMessage[];
  unoReportablePlayerId: string | null;
  unoReportedAt: number | null;
}

const rooms = new Map<string, ServerRoom>();

interface ClientInfo {
  playerId: string;
  roomCode: string;
}
const socketClients = new Map<WebSocket, ClientInfo>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function addLog(room: ServerRoom, text: string) {
  const log: GameLog = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    text,
    timestamp: Date.now(),
  };
  room.logs.push(log);
  if (room.logs.length > 50) {
    room.logs.shift();
  }
}

function drawCardForPlayer(room: ServerRoom, playerId: string, count: number = 1): Card[] {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return [];

  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      if (room.discardPile.length <= 1) {
        room.deck = shuffle(createUnoDeck());
      } else {
        const topCard = room.discardPile[room.discardPile.length - 1];
        const recycle = room.discardPile.slice(0, -1);
        room.deck = shuffle(recycle);
        room.discardPile = [topCard];
      }
    }

    const card = room.deck.pop();
    if (card) {
      player.cards.push(card);
      drawn.push(card);
    }
  }

  if (player.cards.length > 1) {
    player.saidUno = false;
    if (room.unoReportablePlayerId === player.id) {
      room.unoReportablePlayerId = null;
    }
  }

  return drawn;
}

function broadcastToRoom(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;

  socketClients.forEach((info, ws) => {
    if (info.roomCode === roomCode && ws.readyState === WebSocket.OPEN) {
      const pId = info.playerId;
      const selfPlayer = room.players.find((p) => p.id === pId);

      const clientPlayers: Player[] = room.players.map((p) => ({
        id: p.id,
        name: p.name,
        isReady: p.isReady,
        isOwner: p.isOwner,
        cardsCount: p.cards.length,
        saidUno: p.saidUno,
        points: p.points || 0,
      }));

      const gameState: GameState = {
        code: room.code,
        players: clientPlayers,
        status: room.status,
        currentTurn: room.currentTurn,
        turnDirection: room.turnDirection,
        topCard: room.discardPile[room.discardPile.length - 1] || null,
        selectedColor: room.selectedColor,
        winnerId: room.winnerId,
        logs: room.logs,
        messages: room.messages || [],
        unoReportablePlayerId: room.unoReportablePlayerId,
        unoReportedAt: room.unoReportedAt,
      };

      ws.send(JSON.stringify({
        type: 'sync',
        state: gameState,
        yourId: pId,
        yourCards: selfPlayer ? selfPlayer.cards : [],
      }));
    }
  });
}

function handleDisconnect(ws: WebSocket) {
  const clientInfo = socketClients.get(ws);
  if (!clientInfo) return;

  const { playerId, roomCode } = clientInfo;
  socketClients.delete(ws);

  const room = rooms.get(roomCode);
  if (!room) return;

  const playerIndex = room.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return;

  const player = room.players[playerIndex];

  if (room.status === 'lobby') {
    // Remove completely in lobby
    room.players.splice(playerIndex, 1);
    addLog(room, `غادر ${player.name} الغرفة.`);

    if (room.players.length === 0) {
      rooms.delete(roomCode);
      return;
    }

    if (player.isOwner) {
      room.players[0].isOwner = true;
      addLog(room, `أصبح ${room.players[0].name} مالك الغرفة الجديد.`);
    }
  } else {
    // During gameplay, we can either remove or treat as empty
    room.players.splice(playerIndex, 1);
    addLog(room, `خرج ${player.name} من اللعبة وتم توزيع كروته.`);

    if (room.players.length < 2) {
      room.status = 'ended';
      const survivor = room.players[0];
      room.winnerId = survivor?.id || null;
      if (survivor) {
        survivor.points = (survivor.points || 0) + 1;
      }
      addLog(room, `انتهت اللعبة لعدم وجود لاعبين كافيين!`);
    } else {
      // Adjust turn pointer if needed
      if (room.currentTurn >= room.players.length) {
        room.currentTurn = 0;
      }
    }
  }

  broadcastToRoom(roomCode);
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // JSON parsing and static assets setup
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', roomsCount: rooms.size });
  });

  // Attach WebSocket server to standard HTTP port 3000
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '/';
    if (pathname === '/ws' || pathname === '/') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const action: ClientAction = JSON.parse(message.toString());
        
        if (action.type === 'join') {
          let code = action.roomCode ? action.roomCode.toUpperCase().trim() : '';
          const name = action.name.trim() || 'لاعب مجهول';
          const playerId = `p_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

          let room: ServerRoom | undefined;

          if (code) {
            room = rooms.get(code);
            if (!room) {
              ws.send(JSON.stringify({ type: 'error', message: 'الغرفة غير موجودة!' }));
              return;
            }
            if (room.status !== 'lobby') {
              ws.send(JSON.stringify({ type: 'error', message: 'اللعبة بدأت بالفعل في هذه الغرفة!' }));
              return;
            }
            if (room.players.length >= 6) {
              ws.send(JSON.stringify({ type: 'error', message: 'الغرفة ممتلئة بالكامل! الحد الأقصى 6 لاعبين.' }));
              return;
            }
          } else {
            // Create brand new room
            code = generateRoomCode();
            room = {
              code,
              status: 'lobby',
              players: [],
              deck: [],
              discardPile: [],
              currentTurn: 0,
              turnDirection: 1,
              selectedColor: null,
              winnerId: null,
              logs: [],
              unoReportablePlayerId: null,
              unoReportedAt: null,
              messages: [],
            };
            rooms.set(code, room);
          }

          const isOwner = room.players.length === 0;
          const newPlayer = {
            id: playerId,
            name,
            isReady: isOwner, // Owner is ready by default
            isOwner,
            cards: [],
            saidUno: false,
            points: 0,
          };

          room.players.push(newPlayer);
          addLog(room, `انضم اللاعب ${name} إلى الغرفة.`);

          socketClients.set(ws, { playerId, roomCode: code });
          broadcastToRoom(code);
          return;
        }

        // For other actions, resolve the client's session
        const clientInfo = socketClients.get(ws);
        if (!clientInfo) {
          ws.send(JSON.stringify({ type: 'error', message: 'الجلسة غير صالحة. الرجاء الانضمام مجدداً!' }));
          return;
        }

        const { playerId, roomCode } = clientInfo;
        const room = rooms.get(roomCode);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'الغرفة غير موجودة!' }));
          return;
        }

        const player = room.players.find((p) => p.id === playerId);
        if (!player) {
          ws.send(JSON.stringify({ type: 'error', message: 'اللاعب غير موجود بالروم!' }));
          return;
        }

        switch (action.type) {
          case 'ready': {
            if (room.status !== 'lobby') return;
            player.isReady = action.isReady;
            addLog(room, `${player.name} جاهز الآن: ${action.isReady ? 'نعم ✅' : 'لا ❌'}`);
            broadcastToRoom(roomCode);
            break;
          }

          case 'start_game': {
            if (room.status !== 'lobby' && room.status !== 'ended') return;
            if (!player.isOwner) {
              ws.send(JSON.stringify({ type: 'error', message: 'مالك الغرفة فقط من يستطيع بدء اللعب!' }));
              return;
            }
            if (room.players.length < 2) {
              ws.send(JSON.stringify({ type: 'error', message: 'تحتاج لاعبين على الأقل لبدء اللعب!' }));
              return;
            }
            if (room.status === 'lobby') {
              const allReady = room.players.every((p) => p.isReady);
              if (!allReady) {
                ws.send(JSON.stringify({ type: 'error', message: 'يجب أن يكون جميع اللاعبين جاهزين (ريدي) أولاً!' }));
                return;
              }
            }

            // Game starts!
            const fullDeck = createUnoDeck();
            room.deck = shuffle(fullDeck);
            room.discardPile = [];

            // Deal 7 cards to each
            room.players.forEach((p) => {
              p.cards = [];
              p.saidUno = false;
              for (let i = 0; i < 7; i++) {
                const card = room.deck.pop();
                if (card) p.cards.push(card);
              }
            });

            // Put a valid number card as starting card
            let topCard: Card | null = null;
            let index = room.deck.length - 1;
            while (index >= 0) {
              const card = room.deck[index];
              if (card.color !== 'wild' && card.type === 'number') {
                topCard = room.deck.splice(index, 1)[0];
                break;
              }
              index--;
            }
            if (!topCard) {
              topCard = room.deck.pop() || null;
            }

            if (topCard) {
              room.discardPile.push(topCard);
            }

            room.status = 'playing';
            room.currentTurn = Math.floor(Math.random() * room.players.length);
            room.turnDirection = 1;
            room.selectedColor = null;
            room.winnerId = null;
            room.unoReportablePlayerId = null;
            room.unoReportedAt = null;

            room.logs = [];
            addLog(room, `🎉 بدأت اللعبة بتوزيع كروت اللاعبين! كرت البداية: ${getCardNameAr(topCard!)}`);
            addLog(room, `دور اللاعب: ${room.players[room.currentTurn].name} الآن.`);

            broadcastToRoom(roomCode);
            break;
          }

          case 'play_card': {
            if (room.status !== 'playing') return;
            
            const activePlayer = room.players[room.currentTurn];
            if (activePlayer.id !== playerId) {
              ws.send(JSON.stringify({ type: 'error', message: 'ليس دورك حالياً!' }));
              return;
            }

            const cardIndex = player.cards.findIndex((c) => c.id === action.cardId);
            if (cardIndex === -1) {
              ws.send(JSON.stringify({ type: 'error', message: 'البطاقة غير موجودة في يدك!' }));
              return;
            }

            const cardToPlay = player.cards[cardIndex];
            const topCard = room.discardPile[room.discardPile.length - 1];

            if (!isValidPlay(cardToPlay, topCard, room.selectedColor)) {
              ws.send(JSON.stringify({ type: 'error', message: 'لا يمكنك لعب هذا الكرت! يجب مطابقة اللون أو الرقم/النوع أو استخدام ويلد.' }));
              return;
            }

            // Remove and place card
            player.cards.splice(cardIndex, 1);
            room.discardPile.push(cardToPlay);

            let logText = '';
            let skipCount = 1;

            if (cardToPlay.color === 'wild' || cardToPlay.type === 'draw_4') {
              const chosenColor = action.wildColor || 'red';
              room.selectedColor = chosenColor;
            } else {
              room.selectedColor = null;
            }

            // Trigger action logic
            if (cardToPlay.type === 'skip') {
              skipCount = 2;
              const nextP = room.players[(room.currentTurn + room.turnDirection + room.players.length) % room.players.length];
              logText = `لعب ${player.name} كرت تخطي الدور 🚫، تم تخطي دور ${nextP.name}.`;
            } else if (cardToPlay.type === 'reverse') {
              if (room.players.length === 2) {
                skipCount = 2;
                const nextP = room.players[(room.currentTurn + room.turnDirection + room.players.length) % room.players.length];
                logText = `لعب ${player.name} كرت عكس الاتجاه 🔄 (تخطي)، تم تخطي دور ${nextP.name}.`;
              } else {
                room.turnDirection = (room.turnDirection === 1) ? -1 : 1;
                logText = `لعب ${player.name} كرت عكس الاتجاه 🔄.`;
              }
            } else if (cardToPlay.type === 'draw_2') {
              const nextTurnIdx = (room.currentTurn + room.turnDirection + room.players.length) % room.players.length;
              const nextP = room.players[nextTurnIdx];
              drawCardForPlayer(room, nextP.id, 2);
              skipCount = 2;
              logText = `لعب ${player.name} كرت سحب 2 🎴 على ${nextP.name}! سحب كرتين وتجاوز دوره.`;
            } else if (cardToPlay.type === 'wild') {
              logText = `لعب ${player.name} كرت تغيير اللون 🎨 واختار اللون ${colorsAr[action.wildColor || 'red']}.`;
            } else if (cardToPlay.type === 'draw_4') {
              const nextTurnIdx = (room.currentTurn + room.turnDirection + room.players.length) % room.players.length;
              const nextP = room.players[nextTurnIdx];
              drawCardForPlayer(room, nextP.id, 4);
              skipCount = 2;
              logText = `لعب ${player.name} كرت سحب 4 وتغيير اللون 🔥 على ${nextP.name}! سحب 4 كروت واختار اللون ${colorsAr[action.wildColor || 'red']}.`;
            } else {
              logText = `لعب ${player.name} ${getCardNameAr(cardToPlay)}.`;
            }

            addLog(room, logText);

            // Win condition check
            if (player.cards.length === 0) {
              room.status = 'ended';
              room.winnerId = player.id;
              player.points = (player.points || 0) + 1;
              addLog(room, `🏆 فاز اللاعب ${player.name} باللعبة بعد التخلص من جميع كروته! 🎉 مبروك!`);
              broadcastToRoom(roomCode);
              return;
            }

            // Check if player has exactly 1 card left and didn't say UNO
            if (player.cards.length === 1 && !player.saidUno) {
              room.unoReportablePlayerId = player.id;
              room.unoReportedAt = Date.now();
            } else {
              room.unoReportablePlayerId = null;
            }

            // Advance turns
            room.currentTurn = (room.currentTurn + (room.turnDirection * skipCount) + room.players.length) % room.players.length;
            addLog(room, `دور اللاعب التالي: ${room.players[room.currentTurn].name}.`);

            broadcastToRoom(roomCode);
            break;
          }

          case 'draw_card': {
            if (room.status !== 'playing') return;

            const activePlayer = room.players[room.currentTurn];
            if (activePlayer.id !== playerId) {
              ws.send(JSON.stringify({ type: 'error', message: 'ليس دورك حالياً!' }));
              return;
            }

            const drawn = drawCardForPlayer(room, playerId, 1);
            if (drawn.length > 0) {
              const card = drawn[0];
              addLog(room, `سحب ${player.name} بطاقة جديدة من السحب.`);
              
              // Clear UNO reporter since player took an action
              room.unoReportablePlayerId = null;
            }

            broadcastToRoom(roomCode);
            break;
          }

          case 'pass_turn': {
            if (room.status !== 'playing') return;

            const activePlayer = room.players[room.currentTurn];
            if (activePlayer.id !== playerId) {
              ws.send(JSON.stringify({ type: 'error', message: 'ليس دورك حالياً!' }));
              return;
            }

            // Advance turn by 1
            room.currentTurn = (room.currentTurn + room.turnDirection + room.players.length) % room.players.length;
            addLog(room, `مرر ${player.name} دوره. دور اللاعب التالي: ${room.players[room.currentTurn].name}.`);
            
            room.unoReportablePlayerId = null;
            broadcastToRoom(roomCode);
            break;
          }

          case 'say_uno': {
            if (room.status !== 'playing') return;

            if (player.cards.length <= 2) {
              player.saidUno = true;
              addLog(room, `📣 صاح ${player.name}: أونـو! 🎴 (متبقي كرت واحد)`);
              
              if (room.unoReportablePlayerId === player.id) {
                room.unoReportablePlayerId = null;
              }
              broadcastToRoom(roomCode);
            } else {
              ws.send(JSON.stringify({ type: 'error', message: 'لا يمكنك قول أونو إلا إذا كان لديك كرتين أو أقل في يدك!' }));
            }
            break;
          }

          case 'report_no_uno': {
            if (room.status !== 'playing') return;

            if (room.unoReportablePlayerId) {
              const targetPlayer = room.players.find((p) => p.id === room.unoReportablePlayerId);
              if (targetPlayer && targetPlayer.cards.length === 1 && !targetPlayer.saidUno) {
                // Inflict 2 penalty cards
                drawCardForPlayer(room, targetPlayer.id, 2);
                targetPlayer.saidUno = true; // Protect them from continuous penalties
                addLog(room, `🚨 كشف ${player.name} اللاعب ${targetPlayer.name} الذي لم يقل أونو! سحب ${targetPlayer.name} كرتين كعقوبة!`);
                room.unoReportablePlayerId = null;
                broadcastToRoom(roomCode);
              } else {
                ws.send(JSON.stringify({ type: 'error', message: 'لا يوجد لاعب يمكن الإبلاغ عنه حالياً!' }));
              }
            } else {
              ws.send(JSON.stringify({ type: 'error', message: 'لا يوجد لاعب يمكن الإبلاغ عنه حالياً!' }));
            }
            break;
          }

          case 'return_to_lobby': {
            if (room.status !== 'ended') return;
            if (!player.isOwner) {
              ws.send(JSON.stringify({ type: 'error', message: 'مالك الغرفة فقط من يستطيع إرجاع اللاعبين للردهة!' }));
              return;
            }

            room.status = 'lobby';
            room.winnerId = null;
            room.selectedColor = null;
            room.discardPile = [];
            room.deck = [];
            room.currentTurn = 0;
            room.turnDirection = 1;

            room.players.forEach((p) => {
              p.cards = [];
              p.saidUno = false;
              p.isReady = p.isOwner;
            });

            room.logs = [];
            addLog(room, `🔄 أعاد مالك الغرفة جميع اللاعبين إلى ردهة الانتظار.`);
            broadcastToRoom(roomCode);
            break;
          }

          case 'send_chat': {
            const text = (action.text || '').trim();
            if (!text) return;
            const chatMsg: ChatMessage = {
              id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              senderId: player.id,
              senderName: player.name,
              text,
              timestamp: Date.now(),
            };
            if (!room.messages) room.messages = [];
            room.messages.push(chatMsg);
            if (room.messages.length > 100) {
              room.messages.shift();
            }
            broadcastToRoom(roomCode);
            break;
          }

          case 'leave_room': {
            handleDisconnect(ws);
            ws.send(JSON.stringify({ type: 'leave_success' }));
            break;
          }
        }
      } catch (err) {
        console.error('Action error:', err);
      }
    });

    ws.on('close', () => {
      handleDisconnect(ws);
    });
  });

  // Vite development integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`UNO Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
