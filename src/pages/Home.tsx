import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, GraduationCap, Users, LogIn, LogOut, BookOpen } from 'lucide-react';
import { signInWithGoogle, logOut } from '../services/firebase';
import { useAuth } from '../App';

export default function Home() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleAdminClick = async () => {
    if (user) {
      navigate('/admin');
      return;
    }

    setIsSigningIn(true);
    try {
      const loggedInUser = await signInWithGoogle();
      if (loggedInUser) {
        // Wait a bit for onAuthStateChanged to fire and update context
        setTimeout(() => {
          navigate('/admin');
        }, 500);
      }
    } catch (error: any) {
      console.error("Login Error:", error);
      alert(`Đăng nhập thất bại: ${error.message || 'Lỗi không xác định'}. Vui lòng thử lại.`);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 flex flex-col items-center justify-center p-4">
      {user && (
        <div className="absolute top-4 right-4 flex items-center gap-3 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white">
          <img src={user.photoURL || ''} alt="Avatar" className="w-8 h-8 rounded-full" />
          <span className="font-medium hidden sm:inline">{user.displayName}</span>
          <button onClick={logOut} className="hover:text-amber-200 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      )}

      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-8 text-center bg-gradient-to-b from-amber-100 to-white">
          <div className="w-24 h-24 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30 animate-bounce">
            <GraduationCap size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">Chinh Phục Tri Thức</h1>
          <p className="text-gray-500 font-medium">Phiên bản Online</p>
        </div>

        <div className="p-8 space-y-4">
          <button 
            onClick={() => navigate('/player')}
            className="w-full group relative flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/30 transition-all hover:-translate-y-1"
          >
            <Users size={24} className="group-hover:scale-110 transition-transform" />
            Vào thi ngay (Học sinh)
          </button>

          <button 
            onClick={handleAdminClick}
            disabled={loading || isSigningIn}
            className="w-full group flex items-center justify-center gap-3 py-4 bg-white border-2 border-gray-200 hover:border-amber-500 hover:bg-amber-50 text-gray-700 rounded-2xl font-bold text-lg transition-all"
          >
            {isSigningIn ? (
              <span className="animate-pulse">Đang đăng nhập...</span>
            ) : (
              <>
                <GraduationCap size={24} className="text-gray-400 group-hover:text-amber-500 transition-colors" />
                Quản lý (Giáo viên)
              </>
            )}
          </button>

          <button 
            onClick={() => navigate('/guide')}
            className="w-full group flex items-center justify-center gap-3 py-4 bg-gray-50 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-gray-700 rounded-2xl font-bold text-lg transition-all"
          >
            <BookOpen size={24} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            Hướng dẫn sử dụng
          </button>
        </div>
      </div>
      
      <p className="mt-8 text-white/80 text-sm font-medium">
        Powered by Firebase & Gemini AI
      </p>
    </div>
  );
}
