import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Trash2, ShieldCheck, Users, LogOut } from 'lucide-react';
import { AuthUser } from '../types';

interface AdminProps {
  user: AuthUser;
  onLogout: () => void;
}

export default function Admin({ user, onLogout }: AdminProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setRooms(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const deleteRoom = async (roomId: string) => {
    if (!window.confirm(`แน่ใจหรือไม่ว่าต้องการลบห้อง ${roomId}?`)) return;
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      fetchRooms();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="bg-slate-900 border-b border-amber-900/30 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3 text-amber-500">
            <ShieldCheck size={28} />
            <h1 className="text-xl font-bold">ระบบจัดการหลังบ้าน (Admin)</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">ยินดีต้อนรับ, {user.displayName}</span>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-colors text-sm font-medium"
            >
              <LogOut size={16} />
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-100">ห้องเล่นเกมที่กำลังทำงาน</h2>
          <button 
            onClick={fetchRooms}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors disabled:opacity-50 text-sm font-medium border border-slate-700"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            รีเฟรช
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 text-slate-500">
            <RefreshCw className="animate-spin mr-2" /> กำลังโหลดข้อมูล...
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
            ไม่มีห้องเล่นเกมที่กำลังทำงานอยู่ในขณะนี้
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map(room => (
              <motion.div 
                key={room.roomId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-amber-500 text-lg">{room.roomId}</h3>
                    <div className="text-xs text-slate-500 mt-1">รหัสเชิญ: {room.inviteCode}</div>
                  </div>
                  <div className="px-2 py-1 rounded text-xs font-bold bg-slate-800 text-slate-300">
                    {room.status}
                  </div>
                </div>
                
                <div className="space-y-3 mb-6 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">เงินกองกลาง:</span>
                    <span className="font-bold text-emerald-400">${room.pot}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">ผู้เล่น:</span>
                    <span className="font-bold flex items-center gap-1">
                      <Users size={14} className="text-slate-500" /> {room.playerCount}/6
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button 
                    onClick={() => deleteRoom(room.roomId)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-colors text-sm"
                  >
                    <Trash2 size={14} />
                    บังคับปิดห้อง
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
