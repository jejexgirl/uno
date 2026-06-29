export type CardColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';
export type CardType = 'number' | 'skip' | 'reverse' | 'draw_2' | 'wild' | 'draw_4';

export interface Card {
  id: string;
  color: CardColor;
  type: CardType;
  value?: number; // 0-9 for 'number' cards
}

export interface Player {
  id: string;
  name: string;
  isReady: boolean;
  isOwner: boolean;
  cardsCount: number; // Safe count for other players
  cards?: Card[]; // Only populated for the self player (for security/no cheating)
  saidUno: boolean;
  points: number;
}

export interface GameLog {
  id: string;
  text: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface GameState {
  code: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'ended';
  currentTurn: number; // index in players array
  turnDirection: 1 | -1; // 1 = clockwise, -1 = counter-clockwise
  topCard: Card | null;
  selectedColor: CardColor | null; // Chosen color for active wild
  winnerId: string | null;
  logs: GameLog[];
  messages: ChatMessage[];
  unoReportablePlayerId: string | null; // Player who has 1 card but didn't say UNO and can be reported
  unoReportedAt: number | null;
}

export interface ClientSyncPayload {
  type: 'sync';
  state: GameState;
  yourId: string;
  yourCards: Card[];
}

export type ClientAction =
  | { type: 'join'; name: string; roomCode?: string }
  | { type: 'ready'; isReady: boolean }
  | { type: 'start_game' }
  | { type: 'play_card'; cardId: string; wildColor?: CardColor }
  | { type: 'draw_card' }
  | { type: 'pass_turn' }
  | { type: 'say_uno' }
  | { type: 'report_no_uno' }
  | { type: 'leave_room' }
  | { type: 'return_to_lobby' }
  | { type: 'send_chat'; text: string };
