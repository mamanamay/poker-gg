import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Plus, Users, Bot, LogOut, Loader2, Lock, Unlock, RefreshCw } from 'lucide-react';
import { AuthUser, RoomPublicState } from '../types';

interface LobbyProps {
  user: AuthUser;
  onJoinRoom: (roomId: string, playerId: string) => void;
  onLogout: () => void;
}

export default function Lobby({ user, onJoinRoom, onLogout }: LobbyProps) {
  const [rooms, setRooms] = useState<RoomPublicState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createMode, setCreateMode] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [directJoinId, setDirectJoinId] = useState('');
  const [directJoinPassword, setDirectJoinPassword] = useState('');

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms', {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = async (mode: 'friends' | 'bots') => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ roomName: roomName.trim() || undefined, password: roomPassword || undefined, mode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      onJoinRoom(data.roomId, user.id);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการสร้างห้อง');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (roomId: string, password?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ roomId, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      onJoinRoom(data.roomId, user.id);
    } catch (err: any) {
      setError(err.message || 'รหัสผ่านไม่ถูกต้อง หรือเข้าห้องไม่ได้');
      setLoading(false);
      setSelectedRoomId(null);
      setJoinPassword('');
    }
  };
  const handleRequestChips = async () => {
    try {
      const res = await fetch('/api/chips/request', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (res.ok) alert(data.message || 'ส่งคำขอสำเร็จ กรุณารอ Admin อนุมัติ');
      else alert(data.error || 'เกิดข้อผิดพลาด');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งคำขอ');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <span className="text-slate-400 text-sm">ผู้เล่น: <strong className="text-amber-500">{user.displayName}</strong></span>
        <span className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-emerald-400 font-bold font-mono text-xs">
          ${user.chips || 0}
        </span>
        <button 
          onClick={handleRequestChips}
          className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors text-xs font-bold border border-emerald-500/30"
        >
          ขอเพิ่มเครดิต
        </button>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-xs font-medium border border-slate-700"
        >
          <LogOut size={14} />
          ออกจากระบบ
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl grid md:grid-cols-2 gap-8"
      >
        {/* Left Column: Create Room */}
        <div>
          <div className="text-center md:text-left mb-10">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-2 drop-shadow-sm">
              PokerGG
            </h1>
            <p className="text-slate-400">เข้าเล่นเลย หรือสร้างห้องใหม่</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/50 rounded-lg text-rose-400 text-sm">
              {error}
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-emerald-500" /> สร้างห้องใหม่
            </h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">ชื่อห้อง (ปล่อยว่างเพื่อสุ่ม)</label>
                <input
                  type="text"
                  placeholder="เช่น ห้องประจำ หรือปล่อยว่างเป็น room1"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">รหัสผ่าน (ปล่อยว่างได้)</label>
                <input
                  type="password"
                  placeholder="ตั้งรหัสผ่านสำหรับห้องส่วนตัว"
                  value={roomPassword}
                  onChange={e => setRoomPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleCreateRoom('friends')}
                disabled={loading}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl transition-all hover:border-amber-500/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] disabled:opacity-50"
              >
                <Users size={24} className="text-amber-500" />
                <span className="text-sm">เล่นกับเพื่อน</span>
              </button>
              
              <button
                onClick={() => handleCreateRoom('bots')}
                disabled={loading}
                className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl transition-all hover:border-sky-500/50 hover:shadow-[0_0_15px_rgba(14,165,233,0.15)] disabled:opacity-50"
              >
                <Bot size={24} className="text-sky-400" />
                <span className="text-sm">เล่นกับบอท</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Room List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col max-h-[600px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <Users size={20} className="text-sky-500" /> ล็อบบี้รวม
            </h2>
            <button onClick={fetchRooms} className="text-slate-400 hover:text-white transition-colors" title="รีเฟรช">
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {rooms.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                ยังไม่มีห้องเปิดอยู่ขณะนี้ <br/> สร้างห้องของคุณเองเลย!
              </div>
            ) : (
              rooms.map(room => (
                <div key={room.roomId} className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {room.hasPassword ? <Lock size={14} className="text-rose-400" /> : <Unlock size={14} className="text-emerald-400" />}
                      <span className="font-bold text-slate-200">{room.roomName}</span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-3">
                      <span>👤 {(room as any).playerCount || 0}/5</span>
                      <span>💰 ชิปกองกลาง: ${room.pot}</span>
                    </div>
                  </div>
                  
                  {selectedRoomId === room.roomId ? (
                    <div className="flex gap-2 items-center">
                      <input 
                        type="password" 
                        placeholder="รหัสผ่าน..." 
                        autoFocus
                        value={joinPassword}
                        onChange={e => setJoinPassword(e.target.value)}
                        className="w-24 px-2 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                      <button 
                        onClick={() => handleJoinRoom(room.roomId, joinPassword)}
                        disabled={loading}
                        className="p-1.5 bg-amber-500 text-black rounded-lg hover:bg-amber-400 disabled:opacity-50"
                      >
                        <Play size={16} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        if (room.hasPassword) {
                          setSelectedRoomId(room.roomId);
                        } else {
                          handleJoinRoom(room.roomId);
                        }
                      }}
                      disabled={loading || (room as any).playerCount >= 5}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {(room as any).playerCount >= 5 ? 'เต็ม' : 'เข้าร่วม'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-slate-300 mb-2">เข้าร่วมด้วยรหัสเชิญ</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="รหัสห้อง (เช่น abcd-1234)" 
                value={directJoinId}
                onChange={e => setDirectJoinId(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
              <input 
                type="password" 
                placeholder="รหัสผ่าน (ถ้ามี)" 
                value={directJoinPassword}
                onChange={e => setDirectJoinPassword(e.target.value)}
                className="w-24 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white"
              />
              <button 
                onClick={() => {
                  if (directJoinId) handleJoinRoom(directJoinId, directJoinPassword);
                }}
                disabled={loading || !directJoinId}
                className="px-4 py-2 bg-amber-500 text-slate-900 font-bold rounded-lg hover:bg-amber-400 disabled:opacity-50"
              >
                เข้า
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
