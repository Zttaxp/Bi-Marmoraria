'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '../app/utils/supabase/client'

export default function ClearDataButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleClear = async () => {
    setLoading(true)
    
    // 1. Pega usuário atual para garantir
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 2. Apaga onde user_id é igual ao meu
    const { error } = await supabase
      .from('sales_records')
      .delete()
      .eq('user_id', user.id)

    if (!error) {
       // Recarrega a página para limpar os gráficos
       window.location.reload()
    } else {
       alert('Erro ao apagar: ' + error.message)
       setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
        title="Limpar todos os dados (Reset)"
      >
        <Trash2 size={20} />
      </button>

      {/* MODAL DE CONFIRMAÇÃO */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-red-100 p-3 rounded-full text-red-600 shadow-sm">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Tem certeza absoluta?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Isso apagará <b>todas as suas vendas</b> do sistema. <br/>Essa ação é irreversível.
                </p>
              </div>
              
              <div className="flex gap-3 w-full mt-2">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleClear}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition flex justify-center items-center gap-2 shadow-md hover:shadow-lg"
                >
                  {loading && <Loader2 className="animate-spin" size={16} />}
                  {loading ? 'Apagando...' : 'Sim, Zerar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}