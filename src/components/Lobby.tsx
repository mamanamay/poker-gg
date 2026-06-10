import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Plus, Users, Bot, LogOut, Loader2 } from 'lucide-react';
import { AuthUser } from '../types';

interface LobbyProps {
  user: AuthUser;
  onJoinRoom: (roomId: string, playerId: string) => void;
  onLogout: () => void;
}

export default function Lobby({ user, onJoinRoom, onLogout }: LobbyProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        body: JSON.stringify({ roomName: `ห้องของ ${user.displayName}`, mode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      onJoinRoom(data.roomId, user.id);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการสร้างห้อง');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ inviteCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      onJoinRoom(data.roomId, user.id);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเข้าร่วมห้อง');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <span className="text-slate-400 text-sm">ผู้เล่น: <strong className="text-amber-500">{user.displayName}</strong></span>
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
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600 mb-2 drop-shadow-sm">
            โป๊กเกอร์ รอยัล
          </h1>
          <p className="text-slate-400">สร้างห้องเล่นกับเพื่อน เข้าร่วมห้อง หรือเล่นกับบอท</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/50 rounded-lg text-rose-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Users size={20} className="text-amber-500" /> เข้าร่วมห้องเล่นกับเพื่อน
            </h2>
            <form onSubmit={handleJoinRoom} className="flex gap-2">
              <input
                type="text"
                placeholder="กรอกรหัสเชิญ 6 หลัก"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase font-mono tracking-wider"
                maxLength={6}
              />
              <button
                type="submit"
                disabled={loading || inviteCode.length < 6}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                เข้าร่วม
              </button>
            </form>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-medium">หรือสร้างห้องใหม่</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleCreateRoom('friends')}
              disabled={loading}
              className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-2xl transition-all hover:border-amber-500/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] disabled:opacity-50"
            >
              <Users size={32} className="text-amber-500" />
              <span>เล่นกับเพื่อน</span>
            </button>
            
            <button
              onClick={() => handleCreateRoom('bots')}
              disabled={loading}
              className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-2xl transition-all hover:border-sky-500/50 hover:shadow-[0_0_15px_rgba(14,165,233,0.15)] disabled:opacity-50"
            >
              <Bot size={32} className="text-sky-400" />
              <span>เล่นกับบอท (ออฟไลน์)</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
