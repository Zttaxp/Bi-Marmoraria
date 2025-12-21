'use client'

import { useState } from 'react'
import { createClient } from '../utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        throw new Error('Email ou senha incorretos.')
      }
      
      // --- CORREÇÃO AQUI ---
      router.refresh() // Força o Next.js a atualizar a sessão
      router.push('/') // Redireciona para a Home
      // ---------------------

    } catch (err: any) {
      setMsg(err.message)
      setLoading(false) // Para o loading apenas se der erro
    }
    // Não paramos o loading no sucesso para evitar que o botão "pisque" antes de mudar de página
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-slate-100">
        
        {/* LOGO DA EMPRESA */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
             {/* Certifique-se que o arquivo logo.png está na pasta public */}
             <img 
                src="/logo.png" 
                alt="Logo Grupo LD" 
                className="h-20 w-auto object-contain"
                onError={(e) => {
                    // Fallback se a logo não existir: mostra ícone de cadeado
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if(parent) parent.innerHTML = '<div class="bg-cyan-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-cyan-700"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>'
                }} 
             />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">BI Marmoraria</h1>
          <p className="text-slate-400 text-sm">Acesso restrito a usuários autorizados</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Email Corporativo</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-slate-700"
                placeholder="usuario@empresa.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none text-slate-700"
                placeholder="******"
              />
            </div>
          </div>

          {msg && (
            <div className="text-sm text-center p-3 rounded bg-red-50 text-red-600 border border-red-100 flex items-center justify-center gap-2 animate-in fade-in">
              <AlertCircle size={16}/> {msg}
            </div>
          )}

          <button 
            disabled={loading}
            className="w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:bg-slate-900 transition flex justify-center items-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : 'Entrar no Sistema'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Não tem acesso? Solicite ao administrador.
          </p>
        </div>

      </div>
    </div>
  )
}