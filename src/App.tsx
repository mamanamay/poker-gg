import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, LogOut, Loader2, User, Bot, CircleCheck, Info, Plus, Minus, Play } from 'lucide-react';
import { Card, Player, RoomPublicState, PlayerActionType, AuthUser } from './types';
import Login from './components/Login';
import Admin from './components/Admin';
import Lobby from './components/Lobby';
import ErrorBoundary from './components/ErrorBoundary';
import { evaluate7CardHand } from './poker';

const SUIT_SYMBOLS: Record<string, { symbol: string, color: string }> = {
  H: { symbol: '♥', color: 'text-rose-600' },
  D: { symbol: '♦', color: 'text-rose-600' },
  C: { symbol: '♣', color: 'text-slate-900' },
  S: { symbol: '♠', color: 'text-slate-900' }
};

class ErrorBoundary extends React.Component<any, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 p-10 flex flex-col items-center justify-center">
           <div className="bg-red-500/20 border border-red-500/50 p-6 rounded-2xl w-full max-w-2xl text-left shadow-2xl">
              <h2 className="text-red-400 font-bold text-xl mb-4">🚨 เกิดข้อผิดพลาดในระบบ (React Crash)</h2>
              <pre className="text-red-300 font-mono text-sm whitespace-pre-wrap overflow-auto bg-slate-950 p-4 rounded-xl border border-red-500/20">{this.state.error?.toString()}</pre>
              <pre className="text-slate-500 font-mono text-xs whitespace-pre-wrap mt-4">{this.state.error?.stack}</pre>
              <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-red-500 text-white rounded-lg font-bold">รีเฟรชหน้าต่าง</button>
           </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}

function GameApp() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [roomPublic, setRoomPublic] = useState<RoomPublicState | null>(null);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [myHoleCards, setMyHoleCards] = useState<Card[]>([]);
  const [showdownHoleCards, setShowdownHoleCards] = useState<Record<string, Card[]>>({});
  const [actionAmount, setActionAmount] = useState<number>(40);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [actionLogs, setActionLogs] = useState<string[]>(['ระบบ: ห้องพร้อมแล้ว รอผู้เล่นหรือเริ่มเกมได้เลย']);
  
  const pollIntervalRef = useRef<any>(null);

  // Check localStorage for token on load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const parsedUser = JSON.parse(userStr);
        setAuthUser({ ...parsedUser, token });
        
        fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : Promise.reject())
          .then(data => {
            const updatedUser = { ...data.user, token };
            setAuthUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(data.user));
          })
          .catch(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setAuthUser(null);
          })
          .finally(() => setIsAppLoading(false));
      } catch(e) {
        setIsAppLoading(false);
      }
    } else {
      setIsAppLoading(false);
    }
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    localStorage.setItem('token', user.token!);
    localStorage.setItem('user', JSON.stringify(user));
    setAuthUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthUser(null);
    setCurrentRoomId(null);
  };

  const fetchRoomState = async (roomId: string, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}?playerId=${authUser?.id}`, {
        headers: authUser?.token ? { 'Authorization': `Bearer ${authUser.token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to retrieve room details.');
      const data = await res.json();
      
      setRoomPublic(data.public);
      setPlayers(data.players || {});
      setMyHoleCards(data.private?.holeCards || []);
      setShowdownHoleCards(data.private?.showdownHoleCards || {});
    } catch (err: any) {
      console.error(err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authUser && authUser.role === 'player' && currentRoomId) {
      fetchRoomState(currentRoomId);
      pollIntervalRef.current = setInterval(() => {
        fetchRoomState(currentRoomId, true);
      }, 1500);
      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      };
    }
  }, [currentRoomId, authUser]);

  // Bot Action Poller
  useEffect(() => {
    if (!roomPublic || !currentRoomId) return;
    const activePlayer = players[roomPublic.activePlayerId || ''];
    if (activePlayer && activePlayer.isBot && roomPublic.status !== 'SHOWDOWN' && roomPublic.status !== 'LOBBY') {
      const timer = setTimeout(() => {
        triggerBotAction();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [roomPublic?.activePlayerId, roomPublic?.status]);

  const handleLeaveRoom = async () => {
    if (!currentRoomId) return;
    try {
      await fetch(`/api/rooms/${currentRoomId}/leave`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authUser?.token ? { 'Authorization': `Bearer ${authUser.token}` } : {})
        },
        body: JSON.stringify({ playerId: authUser?.id })
      });
      setCurrentRoomId(null);
      setRoomPublic(null);
    } catch (e) {
      console.error('Failed leave execution', e);
    }
  };

  const triggerDeal = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/rooms/${currentRoomId}/deal`, { 
        method: 'POST',
        headers: authUser?.token ? { 'Authorization': `Bearer ${authUser.token}` } : {}
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to deal hand');
      }
      setActionLogs(prev => [`--- เริ่มเกมตาใหม่ ---`, ...prev]);
      await fetchRoomState(currentRoomId!);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitAction = async (action: PlayerActionType, amount = 0) => {
    try {
      const res = await fetch(`/api/rooms/${currentRoomId}/action`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authUser?.token ? { 'Authorization': `Bearer ${authUser.token}` } : {})
        },
        body: JSON.stringify({
          playerId: authUser?.id,
          action,
          amount
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Invalid action');
      }
      await fetchRoomState(currentRoomId!);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const triggerBotAction = async () => {
    try {
      await fetch(`/api/rooms/${currentRoomId}/bot-action`, { 
        method: 'POST',
        headers: authUser?.token ? { 'Authorization': `Bearer ${authUser.token}` } : {}
      });
      await fetchRoomState(currentRoomId!);
    } catch (err: any) {
      console.error(err);
    }
  };

  if (isAppLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={48} /></div>;
  }

  if (!authUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (authUser.role === 'admin') {
    return <Admin user={authUser} onLogout={handleLogout} />;
  }

  if (!currentRoomId) {
    return <Lobby user={authUser} onJoinRoom={(roomId) => setCurrentRoomId(roomId)} onLogout={handleLogout} />;
  }

  // --- GAME RENDERING LOGIC ---
  const playerList = Object.values(players).sort((a, b) => a.seatIndex - b.seatIndex);
  const heroIndex = playerList.findIndex(p => p.id === authUser.id);
  const heroPlayer = players[authUser.id];

  const getHandOdds = () => {
    if (myHoleCards.length === 0) return null;
    if (roomPublic?.status === 'LOBBY' || roomPublic?.status === 'SHOWDOWN') return null;
    
    const evaluation = evaluate7CardHand(myHoleCards, roomPublic?.communityCards || []);
    
    // Simplistic win probability heuristic
    const cardsMerged = [...myHoleCards, ...(roomPublic?.communityCards || [])];
    const suitCounts: Record<string, number> = {};
    cardsMerged.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
    const maxSuitCount = Math.max(...Object.values(suitCounts), 0);
    const hasFlushDraw = maxSuitCount === 4 && (roomPublic?.communityCards?.length || 0) < 5;

    let winProbability = 0;
    if (evaluation.rankValue === 0) winProbability = 15;
    else if (evaluation.rankValue === 1) winProbability = 45;
    else if (evaluation.rankValue === 2) winProbability = 70;
    else if (evaluation.rankValue === 3) winProbability = 85;
    else winProbability = 95;

    if (hasFlushDraw) winProbability += 15;

    let helperText = '';
    if (hasFlushDraw) helperText = 'รอไพ่ทำ Flush (สีเดียวกัน)!';
    else if (evaluation.rankValue >= 2) helperText = 'ไพ่คุณแข็งแกร่งมาก!';
    else if (evaluation.rankValue === 1) helperText = 'คุณมี 1 คู่ ลุ้นตองหรือสองคู่!';
    else helperText = 'รอไพ่เข้าคู่';

    return { handName: evaluation.handName, winProbability: Math.min(99, winProbability), helperText };
  };
  const oddsData = getHandOdds();

  // Render a specific card
  const renderCard = (card: Card | null | undefined, key: number | string) => {
    if (!card || !card.suit || !card.rank) return null;
    const det = SUIT_SYMBOLS[card.suit];
    if (!det) return null;
    
    // เปลี่ยน T เป็น 10
    const displayRank = card.rank === 'T' ? '10' : card.rank;
    
    return (
      <div key={key} className={`w-10 h-14 bg-white rounded-lg border border-slate-200 font-extrabold flex flex-col justify-between p-1 text-xs shadow ${det.color}`}>
        <div className="leading-none">{displayRank}</div>
        <div className="text-center text-lg leading-none">{det.symbol}</div>
        <div className="leading-none text-right flex justify-end">{displayRank}</div>
      </div>
    );
  };

  const renderHiddenCard = (key: number | string) => (
    <div key={key} className="w-10 h-14 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-lg border border-slate-700 flex items-center justify-center text-[10px] text-amber-400/80 shadow-md">
      <ShieldCheck className="h-4 w-4 opacity-60" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/20 antialiased flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-amber-900/30 p-4 shadow-xl flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-xl shadow-lg">
            <ShieldCheck className="h-5 w-5 text-slate-950" />
          </div>
          <h1 className="text-xl font-bold text-amber-500 hidden sm:block">PokerGG</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-slate-200">{roomPublic?.roomName || `ห้อง ${currentRoomId}`}</div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider">ID: {currentRoomId} {roomPublic?.hasPassword && '🔒'}</div>
          </div>
          <button 
            onClick={handleLeaveRoom}
            className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-colors text-xs font-medium border border-rose-500/30"
          >
            <LogOut size={14} />
            ออกจากห้อง
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col lg:flex-row relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
        
        {/* Left/Top: Poker Table */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative min-h-[70vh]">
          {/* Table Surface */}
          <div className="absolute inset-4 sm:inset-12 bg-gradient-to-b from-emerald-900 to-emerald-950 rounded-[100px] border-[12px] border-slate-800 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] opacity-90"></div>

          {/* Top/Side Players (Opponents) */}
          <div className="w-full max-w-4xl flex flex-wrap justify-center gap-6 sm:gap-16 z-10 absolute top-8 sm:top-16">
            {playerList.map((p) => {
              if (p.id === authUser.id) return null; // Don't render hero here
              const isActive = roomPublic?.activePlayerId === p.id;
              const isDealer = roomPublic?.dealerIndex === p.seatIndex;

              return (
                <div key={p.id} className={`relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all ${isActive ? 'bg-slate-800/90 border-amber-500 ring-2 ring-amber-500/30 shadow-xl scale-105' : 'bg-slate-950/70 border-slate-800'}`}>
                  {/* Status Badge */}
                  <span className="absolute -top-3 bg-slate-800 text-[10px] py-0.5 px-2.5 rounded-full border border-slate-700 flex items-center gap-1.5 font-bold">
                    {p.isBot ? <Bot size={12} className="text-sky-400" /> : <User size={12} className="text-emerald-400" />}
                    {p.name}
                  </span>

                  {p.lastAction && (
                    <span className="absolute -bottom-3 bg-slate-900 border border-slate-700 text-[9px] px-2 py-0.5 rounded-full text-slate-300 font-bold tracking-widest z-20">
                      {p.lastAction}
                    </span>
                  )}

                  <div className="text-xs font-bold font-mono text-emerald-400 mt-2 text-center bg-slate-950/50 px-2 py-1 rounded-lg w-full">
                    ${p.chips}
                  </div>

                  {p.isFolded && (
                    <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-500 z-30">
                      หมอบ
                    </div>
                  )}

                  {/* Opponent Cards */}
                  <div className="flex gap-1.5 mt-2">
                    {roomPublic?.status === 'SHOWDOWN' && showdownHoleCards[p.id] ? (
                      showdownHoleCards[p.id].map((c, i) => renderCard(c, i))
                    ) : roomPublic?.status !== 'LOBBY' ? (
                      <>
                        {renderHiddenCard(1)}
                        {renderHiddenCard(2)}
                      </>
                    ) : null}
                  </div>

                  {isDealer && (
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 rounded-full w-6 h-6 bg-amber-500 border-2 border-slate-950 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg">
                      D
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Center Community Board */}
          <div className="z-10 bg-slate-900/60 backdrop-blur-sm border border-emerald-500/20 rounded-3xl p-4 sm:p-6 shadow-2xl min-w-[280px] sm:min-w-[400px] flex flex-col items-center absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="text-center mb-3">
              <div className="text-[10px] text-emerald-400/80 font-mono uppercase tracking-widest mb-1">เงินกองกลาง (Pot)</div>
              <div className="text-3xl font-black text-amber-400 drop-shadow-md font-mono">${roomPublic?.pot || 0}</div>
            </div>

            <div className="flex gap-2 justify-center h-16 sm:h-20 items-center bg-slate-950/50 p-3 rounded-2xl border border-slate-800 w-full">
              {roomPublic?.communityCards?.length === 0 && roomPublic?.status !== 'LOBBY' && (
                 <div className="text-xs text-slate-500 uppercase tracking-widest">รอเปิดไพ่กองกลาง...</div>
              )}
              {roomPublic?.status === 'LOBBY' && (
                 <div className="text-xs text-slate-500 uppercase tracking-widest">รอเริ่มเกม...</div>
              )}
              {roomPublic?.communityCards?.map((c, i) => (
                <div key={i} className="transform transition-all hover:-translate-y-2">
                  {renderCard(c, i)}
                </div>
              ))}
            </div>

            {roomPublic?.winDesc && (
              <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/50 rounded-xl text-center w-full animate-pulse">
                <div className="text-amber-400 font-bold text-sm">🎉 ผู้ชนะ: {roomPublic.winnerIds?.map(id => players[id]?.name).join(', ')}</div>
                <div className="text-amber-200/80 text-xs mt-1">{roomPublic.winDesc}</div>
              </div>
            )}
          </div>

          {/* Hero Player (Bottom) */}
          {heroPlayer && (
            <div className="absolute bottom-4 sm:bottom-8 z-20">
              <div className={`relative flex flex-col items-center p-4 sm:p-6 rounded-2xl border-2 transition-all ${
                  roomPublic?.activePlayerId === heroPlayer.id 
                    ? 'bg-slate-800 border-amber-500 ring-4 ring-amber-500/20 shadow-2xl scale-105' 
                    : 'bg-slate-900 border-slate-700 shadow-xl'
                }`}>
                
                <span className="absolute -top-4 bg-emerald-600 text-[11px] py-1 px-4 rounded-full border-2 border-slate-900 text-white font-bold shadow-md">
                  {heroPlayer.name} (คุณ)
                </span>

                {roomPublic?.dealerIndex === heroPlayer.seatIndex && (
                  <div className="absolute -left-4 top-1/2 -translate-y-1/2 rounded-full w-8 h-8 bg-amber-500 border-2 border-slate-950 text-slate-950 font-black text-xs flex items-center justify-center shadow-lg">
                    D
                  </div>
                )}

                <div className="flex items-center gap-6 mt-2">
                  <div className="text-center">
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest">ชิปของคุณ</div>
                    <div className="text-xl font-bold font-mono text-emerald-400">${heroPlayer.chips}</div>
                  </div>

                  <div className="flex gap-2">
                    {myHoleCards.length > 0 ? (
                      myHoleCards.map((c, i) => (
                        <div key={i} className="transform scale-125 mx-2 origin-bottom">
                          {renderCard(c, i)}
                        </div>
                      ))
                    ) : roomPublic?.status !== 'LOBBY' ? (
                       <div className="flex gap-2 transform scale-125 mx-2 origin-bottom">
                         {renderHiddenCard('h1')}
                         {renderHiddenCard('h2')}
                       </div>
                    ) : (
                      <div className="w-16 text-center text-xs text-slate-600">ยังไม่ได้รับไพ่</div>
                    )}
                  </div>
                </div>

                {oddsData && !heroPlayer.isFolded && (
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[300px] bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 shadow-lg backdrop-blur text-center">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">{oddsData.handName}</span>
                      <span className="text-xs font-black text-amber-400">โอกาสชนะ {oddsData.winProbability}%</span>
                    </div>
                    <div className="text-xs text-slate-300 bg-slate-950/50 py-1 rounded border border-slate-800">
                      💡 {oddsData.helperText}
                    </div>
                  </div>
                )}

                {heroPlayer.isFolded && (
                   <div className="absolute inset-0 bg-slate-950/80 rounded-2xl flex items-center justify-center text-lg font-black uppercase tracking-widest text-slate-400 z-30">
                     หมอบแล้ว
                   </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Controls & Logs */}
        <div className="w-full lg:w-80 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-20">
          
          {/* Action Panel */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/30">
            {roomPublic?.status === 'LOBBY' ? (
              <div className="text-center">
                <div className="text-xs text-slate-400 mb-3">ห้องอยู่ในสถานะ LOBBY รอเริ่มเกม</div>
                <button 
                  onClick={triggerDeal}
                  disabled={isLoading || playerList.length < 2}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                  เริ่มเกม / แจกไพ่
                </button>
                <div className="flex gap-2 w-full mt-2">
                  <button
                    onClick={async () => {
                       setIsLoading(true);
                       try {
                         await fetch(`/api/rooms/${currentRoomId}/add-bot`, { method: 'POST', headers: { Authorization: `Bearer ${authUser?.token}` } });
                         await fetchRoomState(currentRoomId!);
                       } finally { setIsLoading(false); }
                    }}
                    disabled={isLoading || playerList.length >= 5}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1 text-xs"
                  >
                    + เพิ่มบอท 🤖
                  </button>
                  <button
                    onClick={async () => {
                       setIsLoading(true);
                       try {
                         await fetch(`/api/rooms/${currentRoomId}/remove-bot`, { method: 'POST', headers: { Authorization: `Bearer ${authUser?.token}` } });
                         await fetchRoomState(currentRoomId!);
                       } finally { setIsLoading(false); }
                    }}
                    disabled={isLoading || !playerList.some(p => p.isBot)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1 text-xs"
                  >
                    - ลดบอท
                  </button>
                </div>
                {playerList.length < 2 && (
                  <div className="text-[10px] text-rose-400 mt-2">ต้องการผู้เล่นอย่างน้อย 2 คนเพื่อเริ่มเกม</div>
                )}
              </div>
            ) : roomPublic?.status === 'SHOWDOWN' ? (
              <div className="text-center">
                <div className="text-xs text-emerald-400 mb-3 font-bold">สรุปผลแล้ว!</div>
                <button 
                  onClick={triggerDeal}
                  disabled={isLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  เริ่มเกมตาต่อไป
                </button>
              </div>
            ) : (roomPublic?.activePlayerId && roomPublic.activePlayerId === heroPlayer?.id) ? (
              <div className="space-y-3 animate-in slide-in-from-right duration-300">
                <div className="text-xs font-bold text-amber-400 text-center animate-pulse border border-amber-500/20 bg-amber-500/5 rounded-lg py-1">ตาของคุณแล้ว! เลือกลงเงิน</div>
                
                <div className="flex justify-between items-center bg-slate-900 rounded-lg p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-400">ต้องจ่ายเพิ่มเพื่อสู้:</span>
                  <strong className="text-emerald-400 font-mono">${Math.max(0, roomPublic.currentBet - (heroPlayer?.currentBet || 0))}</strong>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {Math.max(0, roomPublic.currentBet - (heroPlayer?.currentBet || 0)) === 0 ? (
                    <button 
                      onClick={() => submitAction('CHECK')} 
                      disabled={isLoading} 
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg text-sm transition-colors border border-slate-700"
                    >
                      ผ่าน (Check)
                    </button>
                  ) : (
                    <button onClick={() => submitAction('FOLD')} disabled={isLoading} className="bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold py-2 rounded-lg text-sm transition-colors border border-slate-700">หมอบ (Fold)</button>
                  )}
                </div>
                
                <button 
                  onClick={() => submitAction('CALL')} 
                  disabled={isLoading} 
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl text-sm shadow-lg transition-all border border-sky-400/30"
                >
                  สู้ (Call)
                </button>

                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  <input 
                    type="number" 
                    value={actionAmount}
                    onChange={e => setActionAmount(Math.max(roomPublic.currentBet + roomPublic.minRaise, Number(e.target.value)))}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg text-center font-mono text-amber-400 font-bold text-sm focus:outline-none focus:border-amber-500"
                  />
                  <button 
                    onClick={() => submitAction('RAISE', actionAmount)} 
                    disabled={isLoading}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg text-sm transition-all shadow-lg border border-amber-400/30"
                  >
                    เกทับ
                  </button>
                  <button 
                    onClick={() => submitAction('RAISE', (heroPlayer?.chips || 0) + (heroPlayer?.currentBet || 0))} 
                    disabled={isLoading}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black tracking-widest py-2 rounded-lg text-sm transition-all shadow-[0_0_15px_rgba(225,29,72,0.5)] border border-rose-400/50"
                  >
                    ALL IN
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center opacity-50">
                <Loader2 className="animate-spin text-slate-500 mb-2" size={24} />
                <div className="text-xs font-bold text-slate-400">กำลังรอผู้เล่นคนอื่น...</div>
              </div>
            )}
          </div>

          {/* Action Logs / History */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-950/50 flex flex-col gap-2">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">ประวัติการแข่ง (Hand History)</h3>
            {(roomPublic?.handHistory && roomPublic.handHistory.length > 0) ? (
              roomPublic.handHistory.map((h: any, i: number) => (
                <div key={i} className="text-xs p-3 rounded-xl border bg-slate-800/80 border-slate-700 shadow-sm flex flex-col gap-1">
                  <span className="text-amber-400 font-bold tracking-wide">🏆 เงินกองกลาง: ${h.pot}</span>
                  <span className="text-slate-300">{h.winDesc}</span>
                  <span className="text-[9px] text-slate-500 text-right">{new Date(h.time).toLocaleTimeString()}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic">ยังไม่มีประวัติการแข่งในห้องนี้</div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
