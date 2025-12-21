'use client'

import { useState, useEffect } from 'react'
import { Calendar, CalendarRange, Lock } from 'lucide-react'

interface DateRangeFilterProps {
  startDate: string
  endDate: string
  onDateChange: (start: string, end: string) => void
  onFilterModeChange: (mode: 'month' | 'range') => void
  onlyMonthMode?: boolean // NOVA PROPRIEDADE
}

export default function DateRangeFilter({ 
  startDate, 
  endDate, 
  onDateChange, 
  onFilterModeChange,
  onlyMonthMode = false 
}: DateRangeFilterProps) {
  
  const [mode, setMode] = useState<'month' | 'range'>('month')
  const [selectedMonth, setSelectedMonth] = useState('')

  // Força o modo 'month' se a prop onlyMonthMode estiver ativa
  useEffect(() => {
    if (onlyMonthMode) {
        setMode('month')
        onFilterModeChange('month')
    }
  }, [onlyMonthMode, onFilterModeChange])

  // Efeito: Quando muda o modo, avisa o pai e reseta datas se necessário
  useEffect(() => {
    onFilterModeChange(mode)
    
    // Se mudou para Mês e não tem mês selecionado, tenta pegar da data atual
    if (mode === 'month' && !selectedMonth && startDate) {
         try {
             const d = new Date(startDate)
             if (!isNaN(d.getTime())) {
                 const yyyy = d.getFullYear()
                 const mm = String(d.getMonth() + 1).padStart(2, '0')
                 const key = `${yyyy}-${mm}`
                 // Só atualiza se for válido
                 if (yyyy > 2000) handleMonthChange(key)
             }
         } catch (e) {
             // Data inválida, ignora
         }
    }
  }, [mode])

  const handleMonthChange = (val: string) => {
    setSelectedMonth(val)
    if (!val) return

    const [year, month] = val.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)

    // Ajuste de fuso horário local
    const startStr = firstDay.toLocaleDateString('en-CA') 
    const endStr = lastDay.toLocaleDateString('en-CA')

    onDateChange(startStr, endStr)
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center gap-6 mb-6 animate-in fade-in slide-in-from-top-2">
      
      {/* SELETOR DE MODO (Escondido se onlyMonthMode for true) */}
      {!onlyMonthMode && (
          <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setMode('month')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all ${mode === 'month' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                 <Calendar size={16}/> Por Mês
              </button>
              <button 
                onClick={() => setMode('range')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-md transition-all ${mode === 'range' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                 <CalendarRange size={16}/> Período Livre
              </button>
          </div>
      )}

      {onlyMonthMode && (
          <div className="flex items-center gap-2 text-slate-500 text-sm font-bold bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <Lock size={14} /> Modo Mensal Obrigatório
          </div>
      )}
      
      {/* INPUTS DINÂMICOS */}
      <div className="flex-1 flex items-center gap-4">
        
        {mode === 'month' ? (
            <div className="flex flex-col gap-1 w-full md:w-auto">
                <label className="text-xs font-bold text-slate-500 uppercase">Selecione o Mês de Referência</label>
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-cyan-500 outline-none bg-white w-full md:w-64"
                />
            </div>
        ) : (
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Início</label>
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => onDateChange(e.target.value, endDate)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none"
                    />
                </div>
                <span className="text-slate-400 mt-5">até</span>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Fim</label>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => onDateChange(startDate, e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none"
                    />
                </div>
            </div>
        )}
      </div>

    </div>
  )
}