import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (nickname: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'insta@tal_do_khali' && password === '70721472') {
      if (!nickname.trim()) {
        setError('Por favor, diga como devo te chamar.');
        return;
      }
      onLogin(nickname);
    } else {
      setError('Credenciais inválidas. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0015] p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(179,102,255,0.1),transparent_70%)]"></div>
      <div className="absolute w-[500px] h-[500px] bg-[#b366ff] rounded-full blur-[120px] opacity-10 top-[-200px] left-[-200px]"></div>
      
      <div className="relative z-10 w-full max-w-md bg-[rgba(20,10,30,0.8)] backdrop-blur-xl border border-[rgba(179,102,255,0.3)] rounded-2xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="font-outfit text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#b366ff] to-[#da99ff] tracking-tighter mb-2">
            PRISMA IA
          </h1>
          <p className="text-[#999] text-sm font-outfit uppercase tracking-widest">Acesso Restrito</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[#b366ff] text-xs font-bold uppercase mb-2 ml-1">ID de Acesso</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(179,102,255,0.2)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#b366ff] focus:shadow-[0_0_15px_rgba(179,102,255,0.3)] transition-all font-outfit placeholder-white/20"
              placeholder="Digite seu usuário..."
            />
          </div>

          <div>
            <label className="block text-[#b366ff] text-xs font-bold uppercase mb-2 ml-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(179,102,255,0.2)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#b366ff] focus:shadow-[0_0_15px_rgba(179,102,255,0.3)] transition-all font-outfit placeholder-white/20"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-[#00ff88] text-xs font-bold uppercase mb-2 ml-1">Como devo te chamar?</label>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(0,255,136,0.2)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00ff88] focus:shadow-[0_0_15px_rgba(0,255,136,0.3)] transition-all font-outfit placeholder-white/20"
              placeholder="ex: Chefe, Patroa, Mestre..."
            />
          </div>

          {error && (
            <div className="text-[#ff3366] text-xs font-bold text-center bg-[#ff3366]/10 py-2 rounded border border-[#ff3366]/30">
              {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full py-4 mt-6 bg-gradient-to-r from-[#b366ff] to-[#9933ff] text-white rounded-xl font-outfit text-sm font-black uppercase tracking-wider shadow-[0_0_20px_rgba(179,102,255,0.4)] hover:shadow-[0_0_30px_rgba(179,102,255,0.6)] hover:scale-[1.02] transition-all"
          >
            Entrar no Sistema
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <a 
            href="https://www.instagram.com/ia.prisma/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#da99ff] hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z"/>
            </svg>
            Siga o Prisma no Instagram
          </a>
        </div>
      </div>
    </div>
  );
};