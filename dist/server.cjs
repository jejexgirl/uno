var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_ws = require("ws");
var colorsAr = {
  red: "\u0627\u0644\u0623\u062D\u0645\u0631 \u{1F534}",
  yellow: "\u0627\u0644\u0623\u0635\u0641\u0631 \u{1F7E1}",
  green: "\u0627\u0644\u0623\u062E\u0636\u0631 \u{1F7E2}",
  blue: "\u0627\u0644\u0623\u0632\u0631\u0642 \u{1F535}",
  wild: "\u0627\u0644\u0639\u0634\u0648\u0627\u0626\u064A \u{1F3A8}"
};
function getCardNameAr(card) {
  if (card.type === "number") {
    return `\u0631\u0642\u0645 ${card.value} \u0628\u0644\u0648\u0646 ${colorsAr[card.color]}`;
  }
  if (card.type === "skip") {
    return `\u062A\u062E\u0637\u064A \u062F\u0648\u0631 \u{1F6AB} \u0628\u0644\u0648\u0646 ${colorsAr[card.color]}`;
  }
  if (card.type === "reverse") {
    return `\u0639\u0643\u0633 \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u{1F504} \u0628\u0644\u0648\u0646 ${colorsAr[card.color]}`;
  }
  if (card.type === "draw_2") {
    return `\u0633\u062D\u0628 2 + \u{1F3B4} \u0628\u0644\u0648\u0646 ${colorsAr[card.color]}`;
  }
  if (card.type === "wild") {
    return "\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0644\u0648\u0646 \u{1F3A8}";
  }
  if (card.type === "draw_4") {
    return "\u0633\u062D\u0628 4 \u0648\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0644\u0648\u0646 \u{1F525}";
  }
  return "\u0628\u0637\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641\u0629";
}
function createUnoDeck() {
  const colors = ["red", "yellow", "green", "blue"];
  const deck = [];
  let cardIdCounter = 1;
  colors.forEach((color) => {
    deck.push({ id: `c_${cardIdCounter++}`, color, type: "number", value: 0 });
    for (let val = 1; val <= 9; val++) {
      deck.push({ id: `c_${cardIdCounter++}`, color, type: "number", value: val });
      deck.push({ id: `c_${cardIdCounter++}`, color, type: "number", value: val });
    }
    for (let i = 0; i < 2; i++) {
      deck.push({ id: `c_${cardIdCounter++}`, color, type: "skip" });
      deck.push({ id: `c_${cardIdCounter++}`, color, type: "reverse" });
      deck.push({ id: `c_${cardIdCounter++}`, color, type: "draw_2" });
    }
  });
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c_${cardIdCounter++}`, color: "wild", type: "wild" });
    deck.push({ id: `c_${cardIdCounter++}`, color: "wild", type: "draw_4" });
  }
  return deck;
}
function shuffle(deck) {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}
function isValidPlay(card, topCard, selectedColor) {
  if (card.color === "wild") return true;
  const targetColor = topCard.color === "wild" ? selectedColor : topCard.color;
  if (card.color === targetColor) return true;
  if (card.type === "number" && topCard.type === "number" && card.value === topCard.value) return true;
  if (card.type !== "number" && card.type === topCard.type) return true;
  return false;
}
var rooms = /* @__PURE__ */ new Map();
var socketClients = /* @__PURE__ */ new Map();
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
function addLog(room, text) {
  const log = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
    text,
    timestamp: Date.now()
  };
  room.logs.push(log);
  if (room.logs.length > 50) {
    room.logs.shift();
  }
}
function drawCardForPlayer(room, playerId, count = 1) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return [];
  const drawn = [];
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
function broadcastToRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  socketClients.forEach((info, ws) => {
    if (info.roomCode === roomCode && ws.readyState === import_ws.WebSocket.OPEN) {
      const pId = info.playerId;
      const selfPlayer = room.players.find((p) => p.id === pId);
      const clientPlayers = room.players.map((p) => ({
        id: p.id,
        name: p.name,
        isReady: p.isReady,
        isOwner: p.isOwner,
        cardsCount: p.cards.length,
        saidUno: p.saidUno,
        points: p.points || 0
      }));
      const gameState = {
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
        unoReportedAt: room.unoReportedAt
      };
      ws.send(JSON.stringify({
        type: "sync",
        state: gameState,
        yourId: pId,
        yourCards: selfPlayer ? selfPlayer.cards : []
      }));
    }
  });
}
function handleDisconnect(ws) {
  const clientInfo = socketClients.get(ws);
  if (!clientInfo) return;
  const { playerId, roomCode } = clientInfo;
  socketClients.delete(ws);
  const room = rooms.get(roomCode);
  if (!room) return;
  const playerIndex = room.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return;
  const player = room.players[playerIndex];
  if (room.status === "lobby") {
    room.players.splice(playerIndex, 1);
    addLog(room, `\u063A\u0627\u062F\u0631 ${player.name} \u0627\u0644\u063A\u0631\u0641\u0629.`);
    if (room.players.length === 0) {
      rooms.delete(roomCode);
      return;
    }
    if (player.isOwner) {
      room.players[0].isOwner = true;
      addLog(room, `\u0623\u0635\u0628\u062D ${room.players[0].name} \u0645\u0627\u0644\u0643 \u0627\u0644\u063A\u0631\u0641\u0629 \u0627\u0644\u062C\u062F\u064A\u062F.`);
    }
  } else {
    room.players.splice(playerIndex, 1);
    addLog(room, `\u062E\u0631\u062C ${player.name} \u0645\u0646 \u0627\u0644\u0644\u0639\u0628\u0629 \u0648\u062A\u0645 \u062A\u0648\u0632\u064A\u0639 \u0643\u0631\u0648\u062A\u0647.`);
    if (room.players.length < 2) {
      room.status = "ended";
      const survivor = room.players[0];
      room.winnerId = survivor?.id || null;
      if (survivor) {
        survivor.points = (survivor.points || 0) + 1;
      }
      addLog(room, `\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u0644\u0639\u0628\u0629 \u0644\u0639\u062F\u0645 \u0648\u062C\u0648\u062F \u0644\u0627\u0639\u0628\u064A\u0646 \u0643\u0627\u0641\u064A\u064A\u0646!`);
    } else {
      if (room.currentTurn >= room.players.length) {
        room.currentTurn = 0;
      }
    }
  }
  broadcastToRoom(roomCode);
}
async function startServer() {
  const app = (0, import_express.default)();
  const server = import_http.default.createServer(app);
  const PORT = parseInt(process.env.PORT || "3000", 10);
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", roomsCount: rooms.size });
  });
  const wss = new import_ws.WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url || "/";
    if (pathname === "/ws" || pathname === "/") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });
  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      try {
        const action = JSON.parse(message.toString());
        if (action.type === "join") {
          let code = action.roomCode ? action.roomCode.toUpperCase().trim() : "";
          const name = action.name.trim() || "\u0644\u0627\u0639\u0628 \u0645\u062C\u0647\u0648\u0644";
          const playerId2 = `p_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
          let room2;
          if (code) {
            room2 = rooms.get(code);
            if (!room2) {
              ws.send(JSON.stringify({ type: "error", message: "\u0627\u0644\u063A\u0631\u0641\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629!" }));
              return;
            }
            if (room2.status !== "lobby") {
              ws.send(JSON.stringify({ type: "error", message: "\u0627\u0644\u0644\u0639\u0628\u0629 \u0628\u062F\u0623\u062A \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u063A\u0631\u0641\u0629!" }));
              return;
            }
            if (room2.players.length >= 6) {
              ws.send(JSON.stringify({ type: "error", message: "\u0627\u0644\u063A\u0631\u0641\u0629 \u0645\u0645\u062A\u0644\u0626\u0629 \u0628\u0627\u0644\u0643\u0627\u0645\u0644! \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 6 \u0644\u0627\u0639\u0628\u064A\u0646." }));
              return;
            }
          } else {
            code = generateRoomCode();
            room2 = {
              code,
              status: "lobby",
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
              messages: []
            };
            rooms.set(code, room2);
          }
          const isOwner = room2.players.length === 0;
          const newPlayer = {
            id: playerId2,
            name,
            isReady: isOwner,
            // Owner is ready by default
            isOwner,
            cards: [],
            saidUno: false,
            points: 0
          };
          room2.players.push(newPlayer);
          addLog(room2, `\u0627\u0646\u0636\u0645 \u0627\u0644\u0644\u0627\u0639\u0628 ${name} \u0625\u0644\u0649 \u0627\u0644\u063A\u0631\u0641\u0629.`);
          socketClients.set(ws, { playerId: playerId2, roomCode: code });
          broadcastToRoom(code);
          return;
        }
        const clientInfo = socketClients.get(ws);
        if (!clientInfo) {
          ws.send(JSON.stringify({ type: "error", message: "\u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629. \u0627\u0644\u0631\u062C\u0627\u0621 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0645\u062C\u062F\u062F\u0627\u064B!" }));
          return;
        }
        const { playerId, roomCode } = clientInfo;
        const room = rooms.get(roomCode);
        if (!room) {
          ws.send(JSON.stringify({ type: "error", message: "\u0627\u0644\u063A\u0631\u0641\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629!" }));
          return;
        }
        const player = room.players.find((p) => p.id === playerId);
        if (!player) {
          ws.send(JSON.stringify({ type: "error", message: "\u0627\u0644\u0644\u0627\u0639\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0631\u0648\u0645!" }));
          return;
        }
        switch (action.type) {
          case "ready": {
            if (room.status !== "lobby") return;
            player.isReady = action.isReady;
            addLog(room, `${player.name} \u062C\u0627\u0647\u0632 \u0627\u0644\u0622\u0646: ${action.isReady ? "\u0646\u0639\u0645 \u2705" : "\u0644\u0627 \u274C"}`);
            broadcastToRoom(roomCode);
            break;
          }
          case "start_game": {
            if (room.status !== "lobby" && room.status !== "ended") return;
            if (!player.isOwner) {
              ws.send(JSON.stringify({ type: "error", message: "\u0645\u0627\u0644\u0643 \u0627\u0644\u063A\u0631\u0641\u0629 \u0641\u0642\u0637 \u0645\u0646 \u064A\u0633\u062A\u0637\u064A\u0639 \u0628\u062F\u0621 \u0627\u0644\u0644\u0639\u0628!" }));
              return;
            }
            if (room.players.length < 2) {
              ws.send(JSON.stringify({ type: "error", message: "\u062A\u062D\u062A\u0627\u062C \u0644\u0627\u0639\u0628\u064A\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0644\u0628\u062F\u0621 \u0627\u0644\u0644\u0639\u0628!" }));
              return;
            }
            if (room.status === "lobby") {
              const allReady = room.players.every((p) => p.isReady);
              if (!allReady) {
                ws.send(JSON.stringify({ type: "error", message: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u062C\u0645\u064A\u0639 \u0627\u0644\u0644\u0627\u0639\u0628\u064A\u0646 \u062C\u0627\u0647\u0632\u064A\u0646 (\u0631\u064A\u062F\u064A) \u0623\u0648\u0644\u0627\u064B!" }));
                return;
              }
            }
            const fullDeck = createUnoDeck();
            room.deck = shuffle(fullDeck);
            room.discardPile = [];
            room.players.forEach((p) => {
              p.cards = [];
              p.saidUno = false;
              for (let i = 0; i < 7; i++) {
                const card = room.deck.pop();
                if (card) p.cards.push(card);
              }
            });
            let topCard = null;
            let index = room.deck.length - 1;
            while (index >= 0) {
              const card = room.deck[index];
              if (card.color !== "wild" && card.type === "number") {
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
            room.status = "playing";
            room.currentTurn = Math.floor(Math.random() * room.players.length);
            room.turnDirection = 1;
            room.selectedColor = null;
            room.winnerId = null;
            room.unoReportablePlayerId = null;
            room.unoReportedAt = null;
            room.logs = [];
            addLog(room, `\u{1F389} \u0628\u062F\u0623\u062A \u0627\u0644\u0644\u0639\u0628\u0629 \u0628\u062A\u0648\u0632\u064A\u0639 \u0643\u0631\u0648\u062A \u0627\u0644\u0644\u0627\u0639\u0628\u064A\u0646! \u0643\u0631\u062A \u0627\u0644\u0628\u062F\u0627\u064A\u0629: ${getCardNameAr(topCard)}`);
            addLog(room, `\u062F\u0648\u0631 \u0627\u0644\u0644\u0627\u0639\u0628: ${room.players[room.currentTurn].name} \u0627\u0644\u0622\u0646.`);
            broadcastToRoom(roomCode);
            break;
          }
          case "play_card": {
            if (room.status !== "playing") return;
            const activePlayer = room.players[room.currentTurn];
            if (activePlayer.id !== playerId) {
              ws.send(JSON.stringify({ type: "error", message: "\u0644\u064A\u0633 \u062F\u0648\u0631\u0643 \u062D\u0627\u0644\u064A\u0627\u064B!" }));
              return;
            }
            const cardIndex = player.cards.findIndex((c) => c.id === action.cardId);
            if (cardIndex === -1) {
              ws.send(JSON.stringify({ type: "error", message: "\u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u064A\u062F\u0643!" }));
              return;
            }
            const cardToPlay = player.cards[cardIndex];
            const topCard = room.discardPile[room.discardPile.length - 1];
            if (!isValidPlay(cardToPlay, topCard, room.selectedColor)) {
              ws.send(JSON.stringify({ type: "error", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0644\u0639\u0628 \u0647\u0630\u0627 \u0627\u0644\u0643\u0631\u062A! \u064A\u062C\u0628 \u0645\u0637\u0627\u0628\u0642\u0629 \u0627\u0644\u0644\u0648\u0646 \u0623\u0648 \u0627\u0644\u0631\u0642\u0645/\u0627\u0644\u0646\u0648\u0639 \u0623\u0648 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0648\u064A\u0644\u062F." }));
              return;
            }
            player.cards.splice(cardIndex, 1);
            room.discardPile.push(cardToPlay);
            let logText = "";
            let skipCount = 1;
            if (cardToPlay.color === "wild" || cardToPlay.type === "draw_4") {
              const chosenColor = action.wildColor || "red";
              room.selectedColor = chosenColor;
            } else {
              room.selectedColor = null;
            }
            if (cardToPlay.type === "skip") {
              skipCount = 2;
              const nextP = room.players[(room.currentTurn + room.turnDirection + room.players.length) % room.players.length];
              logText = `\u0644\u0639\u0628 ${player.name} \u0643\u0631\u062A \u062A\u062E\u0637\u064A \u0627\u0644\u062F\u0648\u0631 \u{1F6AB}\u060C \u062A\u0645 \u062A\u062E\u0637\u064A \u062F\u0648\u0631 ${nextP.name}.`;
            } else if (cardToPlay.type === "reverse") {
              if (room.players.length === 2) {
                skipCount = 2;
                const nextP = room.players[(room.currentTurn + room.turnDirection + room.players.length) % room.players.length];
                logText = `\u0644\u0639\u0628 ${player.name} \u0643\u0631\u062A \u0639\u0643\u0633 \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u{1F504} (\u062A\u062E\u0637\u064A)\u060C \u062A\u0645 \u062A\u062E\u0637\u064A \u062F\u0648\u0631 ${nextP.name}.`;
              } else {
                room.turnDirection = room.turnDirection === 1 ? -1 : 1;
                logText = `\u0644\u0639\u0628 ${player.name} \u0643\u0631\u062A \u0639\u0643\u0633 \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u{1F504}.`;
              }
            } else if (cardToPlay.type === "draw_2") {
              const nextTurnIdx = (room.currentTurn + room.turnDirection + room.players.length) % room.players.length;
              const nextP = room.players[nextTurnIdx];
              drawCardForPlayer(room, nextP.id, 2);
              skipCount = 2;
              logText = `\u0644\u0639\u0628 ${player.name} \u0643\u0631\u062A \u0633\u062D\u0628 2 \u{1F3B4} \u0639\u0644\u0649 ${nextP.name}! \u0633\u062D\u0628 \u0643\u0631\u062A\u064A\u0646 \u0648\u062A\u062C\u0627\u0648\u0632 \u062F\u0648\u0631\u0647.`;
            } else if (cardToPlay.type === "wild") {
              logText = `\u0644\u0639\u0628 ${player.name} \u0643\u0631\u062A \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0644\u0648\u0646 \u{1F3A8} \u0648\u0627\u062E\u062A\u0627\u0631 \u0627\u0644\u0644\u0648\u0646 ${colorsAr[action.wildColor || "red"]}.`;
            } else if (cardToPlay.type === "draw_4") {
              const nextTurnIdx = (room.currentTurn + room.turnDirection + room.players.length) % room.players.length;
              const nextP = room.players[nextTurnIdx];
              drawCardForPlayer(room, nextP.id, 4);
              skipCount = 2;
              logText = `\u0644\u0639\u0628 ${player.name} \u0643\u0631\u062A \u0633\u062D\u0628 4 \u0648\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0644\u0648\u0646 \u{1F525} \u0639\u0644\u0649 ${nextP.name}! \u0633\u062D\u0628 4 \u0643\u0631\u0648\u062A \u0648\u0627\u062E\u062A\u0627\u0631 \u0627\u0644\u0644\u0648\u0646 ${colorsAr[action.wildColor || "red"]}.`;
            } else {
              logText = `\u0644\u0639\u0628 ${player.name} ${getCardNameAr(cardToPlay)}.`;
            }
            addLog(room, logText);
            if (player.cards.length === 0) {
              room.status = "ended";
              room.winnerId = player.id;
              player.points = (player.points || 0) + 1;
              addLog(room, `\u{1F3C6} \u0641\u0627\u0632 \u0627\u0644\u0644\u0627\u0639\u0628 ${player.name} \u0628\u0627\u0644\u0644\u0639\u0628\u0629 \u0628\u0639\u062F \u0627\u0644\u062A\u062E\u0644\u0635 \u0645\u0646 \u062C\u0645\u064A\u0639 \u0643\u0631\u0648\u062A\u0647! \u{1F389} \u0645\u0628\u0631\u0648\u0643!`);
              broadcastToRoom(roomCode);
              return;
            }
            if (player.cards.length === 1 && !player.saidUno) {
              room.unoReportablePlayerId = player.id;
              room.unoReportedAt = Date.now();
            } else {
              room.unoReportablePlayerId = null;
            }
            room.currentTurn = (room.currentTurn + room.turnDirection * skipCount + room.players.length) % room.players.length;
            addLog(room, `\u062F\u0648\u0631 \u0627\u0644\u0644\u0627\u0639\u0628 \u0627\u0644\u062A\u0627\u0644\u064A: ${room.players[room.currentTurn].name}.`);
            broadcastToRoom(roomCode);
            break;
          }
          case "draw_card": {
            if (room.status !== "playing") return;
            const activePlayer = room.players[room.currentTurn];
            if (activePlayer.id !== playerId) {
              ws.send(JSON.stringify({ type: "error", message: "\u0644\u064A\u0633 \u062F\u0648\u0631\u0643 \u062D\u0627\u0644\u064A\u0627\u064B!" }));
              return;
            }
            const drawn = drawCardForPlayer(room, playerId, 1);
            if (drawn.length > 0) {
              const card = drawn[0];
              addLog(room, `\u0633\u062D\u0628 ${player.name} \u0628\u0637\u0627\u0642\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 \u0627\u0644\u0633\u062D\u0628.`);
              room.unoReportablePlayerId = null;
            }
            broadcastToRoom(roomCode);
            break;
          }
          case "pass_turn": {
            if (room.status !== "playing") return;
            const activePlayer = room.players[room.currentTurn];
            if (activePlayer.id !== playerId) {
              ws.send(JSON.stringify({ type: "error", message: "\u0644\u064A\u0633 \u062F\u0648\u0631\u0643 \u062D\u0627\u0644\u064A\u0627\u064B!" }));
              return;
            }
            room.currentTurn = (room.currentTurn + room.turnDirection + room.players.length) % room.players.length;
            addLog(room, `\u0645\u0631\u0631 ${player.name} \u062F\u0648\u0631\u0647. \u062F\u0648\u0631 \u0627\u0644\u0644\u0627\u0639\u0628 \u0627\u0644\u062A\u0627\u0644\u064A: ${room.players[room.currentTurn].name}.`);
            room.unoReportablePlayerId = null;
            broadcastToRoom(roomCode);
            break;
          }
          case "say_uno": {
            if (room.status !== "playing") return;
            if (player.cards.length <= 2) {
              player.saidUno = true;
              addLog(room, `\u{1F4E3} \u0635\u0627\u062D ${player.name}: \u0623\u0648\u0646\u0640\u0648! \u{1F3B4} (\u0645\u062A\u0628\u0642\u064A \u0643\u0631\u062A \u0648\u0627\u062D\u062F)`);
              if (room.unoReportablePlayerId === player.id) {
                room.unoReportablePlayerId = null;
              }
              broadcastToRoom(roomCode);
            } else {
              ws.send(JSON.stringify({ type: "error", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0642\u0648\u0644 \u0623\u0648\u0646\u0648 \u0625\u0644\u0627 \u0625\u0630\u0627 \u0643\u0627\u0646 \u0644\u062F\u064A\u0643 \u0643\u0631\u062A\u064A\u0646 \u0623\u0648 \u0623\u0642\u0644 \u0641\u064A \u064A\u062F\u0643!" }));
            }
            break;
          }
          case "report_no_uno": {
            if (room.status !== "playing") return;
            if (room.unoReportablePlayerId) {
              const targetPlayer = room.players.find((p) => p.id === room.unoReportablePlayerId);
              if (targetPlayer && targetPlayer.cards.length === 1 && !targetPlayer.saidUno) {
                drawCardForPlayer(room, targetPlayer.id, 2);
                targetPlayer.saidUno = true;
                addLog(room, `\u{1F6A8} \u0643\u0634\u0641 ${player.name} \u0627\u0644\u0644\u0627\u0639\u0628 ${targetPlayer.name} \u0627\u0644\u0630\u064A \u0644\u0645 \u064A\u0642\u0644 \u0623\u0648\u0646\u0648! \u0633\u062D\u0628 ${targetPlayer.name} \u0643\u0631\u062A\u064A\u0646 \u0643\u0639\u0642\u0648\u0628\u0629!`);
                room.unoReportablePlayerId = null;
                broadcastToRoom(roomCode);
              } else {
                ws.send(JSON.stringify({ type: "error", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0644\u0627\u0639\u0628 \u064A\u0645\u0643\u0646 \u0627\u0644\u0625\u0628\u0644\u0627\u063A \u0639\u0646\u0647 \u062D\u0627\u0644\u064A\u0627\u064B!" }));
              }
            } else {
              ws.send(JSON.stringify({ type: "error", message: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0644\u0627\u0639\u0628 \u064A\u0645\u0643\u0646 \u0627\u0644\u0625\u0628\u0644\u0627\u063A \u0639\u0646\u0647 \u062D\u0627\u0644\u064A\u0627\u064B!" }));
            }
            break;
          }
          case "return_to_lobby": {
            if (room.status !== "ended") return;
            if (!player.isOwner) {
              ws.send(JSON.stringify({ type: "error", message: "\u0645\u0627\u0644\u0643 \u0627\u0644\u063A\u0631\u0641\u0629 \u0641\u0642\u0637 \u0645\u0646 \u064A\u0633\u062A\u0637\u064A\u0639 \u0625\u0631\u062C\u0627\u0639 \u0627\u0644\u0644\u0627\u0639\u0628\u064A\u0646 \u0644\u0644\u0631\u062F\u0647\u0629!" }));
              return;
            }
            room.status = "lobby";
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
            addLog(room, `\u{1F504} \u0623\u0639\u0627\u062F \u0645\u0627\u0644\u0643 \u0627\u0644\u063A\u0631\u0641\u0629 \u062C\u0645\u064A\u0639 \u0627\u0644\u0644\u0627\u0639\u0628\u064A\u0646 \u0625\u0644\u0649 \u0631\u062F\u0647\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631.`);
            broadcastToRoom(roomCode);
            break;
          }
          case "send_chat": {
            const text = (action.text || "").trim();
            if (!text) return;
            const chatMsg = {
              id: `msg_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
              senderId: player.id,
              senderName: player.name,
              text,
              timestamp: Date.now()
            };
            if (!room.messages) room.messages = [];
            room.messages.push(chatMsg);
            if (room.messages.length > 100) {
              room.messages.shift();
            }
            broadcastToRoom(roomCode);
            break;
          }
          case "leave_room": {
            handleDisconnect(ws);
            ws.send(JSON.stringify({ type: "leave_success" }));
            break;
          }
        }
      } catch (err) {
        console.error("Action error:", err);
      }
    });
    ws.on("close", () => {
      handleDisconnect(ws);
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`UNO Server listening on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
