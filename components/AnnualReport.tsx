'use client'

import { useState, useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { Printer } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function AnnualReport({ data }: { data: any[] }) {
  // 1. Identificar anos disponíveis nos dados
  const years = useMemo(() => {
    const uniqueYears = new Set(data.map(d => new Date(d.sale_date).getFullYear()))
    return Array.from(uniqueYears).sort((a, b) => b - a) // Decrescente (2025, 2024...)
  }, [data])

  const [selectedYear, setSelectedYear] = useState(years[0] || new Date().getFullYear())

  // 2. Processar dados Mês a Mês para o ano selecionado
  const reportData = useMemo(() => {
    const monthlyData = Array(12).fill(null).map(() => ({
      gross: 0, freight: 0, cost: 0, count: 0
    }))

    data.forEach(item => {
      const date = new Date(item.sale_date)
      if (date.getFullYear() === selectedYear) {
        const monthIdx = date.getMonth() // 0 = Jan, 11 = Dez
        monthlyData[monthIdx].gross += (item.revenue || 0)
        monthlyData[monthIdx].freight += (item.freight || 0)
        monthlyData[monthIdx].cost += (item.cost || 0)
        monthlyData[monthIdx].count++
      }
    })

    // Calcular DRE para cada mês
    return monthlyData.map(m => {
      const netRev = m.gross - m.freight
      // Estimativa padrão de impostos/comissões (podemos conectar ao simulador futuramente)
      const taxes = netRev * 0.06 // 6%
      const comm = netRev * 0.03  // 3%
      const variableExpenses = taxes + comm
      
      const margin = netRev - m.cost - variableExpenses
      const profit = margin // - Despesas Fixas (se tiver)
      
      return { ...m, netRev, variableExpenses, profit, hasData: m.count > 0 }
    })
  }, [data, selectedYear])

  // 3. Configurar Gráfico
  const chartConfig = {
    labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    datasets: [{
      label: 'Resultado Líquido (R$)',
      data: reportData.map(d => d.profit),
      backgroundColor: reportData.map(d => d.profit >= 0 ? '#22c55e' : '#ef4444'), // Verde ou Vermelho
      borderRadius: 4,
    }]
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* Filtro de Ano */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            Análise Anual Detalhada
        </h2>
        <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-slate-500">Ano:</label>
            <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-100 border-transparent rounded-lg text-sm font-bold text-slate-700 p-2 cursor-pointer hover:bg-slate-200 transition"
            >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
      </div>

      {/* Gráfico de Barras (Saldo) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wide">Saldo Líquido Mensal (Lucro vs Prejuízo)</h3>
        <div className="h-64">
             <Bar 
                data={chartConfig} 
                options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }
                }} 
             />
        </div>
      </div>

      {/* Tabela DRE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 text-sm">Demonstrativo (DRE) - {selectedYear}</h3>
            <button onClick={() => window.print()} className="p-2 text-slate-400 hover:text-slate-700 transition">
                <Printer size={18} />
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-xs text-right whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                        <th className="p-3 text-left sticky left-0 bg-slate-100">Mês</th>
                        <th className="p-3 text-slate-800 bg-blue-50">Faturamento</th>
                        <th className="p-3 text-red-500">(-) Fretes</th>
                        <th className="p-3 text-indigo-700">Rec. Líquida</th>
                        <th className="p-3 text-red-500">(-) Custos</th>
                        <th className="p-3 text-red-500">(-) Imp/Com</th>
                        <th className="p-3 text-slate-800 bg-slate-50 border-l border-slate-200 font-bold">Lucro Líq.</th>
                        <th className="p-3 text-slate-500">% Margem</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                    {reportData.map((row, i) => {
                        if (!row.hasData) return null // Pula meses vazios
                        const monthName = new Date(selectedYear, i, 1).toLocaleDateString('pt-BR', { month: 'long' })
                        const marginPct = row.netRev > 0 ? (row.profit / row.netRev) * 100 : 0

                        return (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 text-left font-bold text-slate-700 capitalize sticky left-0 bg-white border-r border-slate-100">
                                    {monthName}
                                </td>
                                <td className="p-3 text-slate-800 bg-blue-50/30">{fmt(row.gross)}</td>
                                <td className="p-3 text-red-400">{row.freight > 0 ? `(${fmt(row.freight)})` : '-'}</td>
                                <td className="p-3 font-medium text-indigo-700">{fmt(row.netRev)}</td>
                                <td className="p-3 text-red-400">({fmt(row.cost)})</td>
                                <td className="p-3 text-red-400 text-[10px]">({fmt(row.variableExpenses)})</td>
                                <td className={`p-3 font-bold border-l border-slate-200 text-sm ${row.profit >= 0 ? 'text-green-600 bg-green-50/30' : 'text-red-600 bg-red-50/30'}`}>
                                    {fmt(row.profit)}
                                </td>
                                <td className={`p-3 font-bold ${marginPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {marginPct.toFixed(1)}%
                                </td>
                            </tr>
                        )
                    })}
                    {/* Linha de Totais */}
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-200 text-slate-800">
                        <td className="p-3 text-left sticky left-0 bg-slate-100">TOTAL</td>
                        <td className="p-3">{fmt(reportData.reduce((a, b) => a + b.gross, 0))}</td>
                        <td className="p-3 text-red-500">({fmt(reportData.reduce((a, b) => a + b.freight, 0))})</td>
                        <td className="p-3 text-indigo-800">{fmt(reportData.reduce((a, b) => a + b.netRev, 0))}</td>
                        <td className="p-3 text-red-500">({fmt(reportData.reduce((a, b) => a + b.cost, 0))})</td>
                        <td className="p-3 text-red-500">({fmt(reportData.reduce((a, b) => a + b.variableExpenses, 0))})</td>
                        <td className="p-3 text-green-700 border-l border-slate-300 text-sm">
                            {fmt(reportData.reduce((a, b) => a + b.profit, 0))}
                        </td>
                        <td className="p-3">-</td>
                    </tr>
                </tbody>
            </table>
        </div>
      </div>
    </div>
  )
}