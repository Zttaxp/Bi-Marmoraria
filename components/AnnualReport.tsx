'use client'

import { useState, useEffect, useMemo } from 'react'
import { CalendarDays, TrendingUp, TrendingDown, DollarSign, ArrowRightLeft, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '../app/utils/supabase/client'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

export default function AnnualReport({ data }: { data: any[] }) {
  const supabase = createClient()
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [viewMode, setViewMode] = useState<'REAL' | 'SIM'>('REAL')
  const [financialData, setFinancialData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  // 1. Extrair anos disponíveis nos dados
  const availableYears = useMemo(() => {
      const years = new Set(data.map(d => new Date(d.sale_date).getFullYear()))
      if (years.size === 0) years.add(new Date().getFullYear())
      return Array.from(years).sort((a, b) => b - a)
  }, [data])

  // 2. Carregar dados financeiros do Banco (Impostos, Fixos, Simulados)
  useEffect(() => {
      const fetchFinancials = async () => {
          setLoading(true)
          const { data: dbData } = await supabase.from('financial_monthly_data').select('*')
          
          const map: Record<string, any> = {}
          if (dbData) {
              dbData.forEach((row: any) => {
                  map[row.month_key] = row
              })
          }
          setFinancialData(map)
          setLoading(false)
      }
      fetchFinancials()
  }, [])

  // 3. Processar DRE Mês a Mês
  const monthlyDRE = useMemo(() => {
      const months = Array.from({ length: 12 }, (_, i) => i + 1)
      
      return months.map(month => {
          const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`
          const dbRow = financialData[monthKey] || {}

          // A. DADOS DO CSV (Agregados)
          const salesInMonth = data.filter(d => {
              const date = new Date(d.sale_date)
              return date.getFullYear() === selectedYear && (date.getMonth() + 1) === month
          })

          const csvRevenue = salesInMonth.reduce((acc, item) => acc + (item.revenue || 0), 0)
          const csvCostChapa = salesInMonth.reduce((acc, item) => acc + (item.cost || 0), 0)
          const csvCostFreight = salesInMonth.reduce((acc, item) => acc + (item.freight || 0), 0)

          // B. DEFINIR VALORES BASE (REAL vs SIMULADO)
          let revenue, costChapa, costFreight, taxRate, defRate, otherVar, fixedCost

          if (viewMode === 'REAL') {
              revenue = csvRevenue
              costChapa = csvCostChapa
              costFreight = csvCostFreight
              taxRate = Number(dbRow.tax_rate) || 6.0
              defRate = Number(dbRow.default_rate) || 1.5
              otherVar = Number(dbRow.variable_cost) || 0
              fixedCost = Number(dbRow.fixed_cost) || 0
          } else {
              // Lógica Simulado: Se tiver valor salvo no banco, usa. Se não, usa o Real como base.
              revenue = dbRow.sim_revenue !== undefined ? Number(dbRow.sim_revenue) : csvRevenue
              costChapa = dbRow.sim_cost_chapa !== undefined ? Number(dbRow.sim_cost_chapa) : csvCostChapa
              costFreight = dbRow.sim_cost_freight !== undefined ? Number(dbRow.sim_cost_freight) : csvCostFreight
              taxRate = dbRow.sim_tax_rate !== undefined ? Number(dbRow.sim_tax_rate) : (Number(dbRow.tax_rate) || 6.0)
              defRate = dbRow.sim_default_rate !== undefined ? Number(dbRow.sim_default_rate) : (Number(dbRow.default_rate) || 1.5)
              otherVar = dbRow.sim_variable_cost !== undefined ? Number(dbRow.sim_variable_cost) : (Number(dbRow.variable_cost) || 0)
              fixedCost = dbRow.sim_fixed_cost !== undefined ? Number(dbRow.sim_fixed_cost) : (Number(dbRow.fixed_cost) || 0)
          }

          // C. CÁLCULO DO DRE
          const valTax = revenue * (taxRate / 100)
          const valDef = revenue * (defRate / 100)
          const netRevenue = revenue - valTax - valDef
          
          const totalDirectCost = costChapa + costFreight + otherVar
          const contribMargin = netRevenue - totalDirectCost
          const netProfit = contribMargin - fixedCost
          const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

          return {
              monthName: new Date(selectedYear, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
              revenue,
              taxes: valTax + valDef, // Soma impostos + inadimplência para visualização compacta
              netRevenue,
              directCosts: totalDirectCost, // Chapa + Frete + Var
              contribMargin,
              fixedCost,
              netProfit,
              profitMargin
          }
      })
  }, [data, financialData, selectedYear, viewMode])

  // Totais do Ano
  const yearTotals = useMemo(() => {
      return monthlyDRE.reduce((acc, curr) => ({
          revenue: acc.revenue + curr.revenue,
          netProfit: acc.netProfit + curr.netProfit,
          fixedCost: acc.fixedCost + curr.fixedCost
      }), { revenue: 0, netProfit: 0, fixedCost: 0 })
  }, [monthlyDRE])

  const yearMargin = yearTotals.revenue > 0 ? (yearTotals.netProfit / yearTotals.revenue) * 100 : 0

  // Configuração do Gráfico
  const chartData = {
    labels: monthlyDRE.map(d => d.monthName),
    datasets: [
      {
        label: 'Faturamento',
        data: monthlyDRE.map(d => d.revenue),
        backgroundColor: 'rgba(203, 213, 225, 0.5)', // Slate 300
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        label: 'Lucro Líquido',
        data: monthlyDRE.map(d => d.netProfit),
        backgroundColor: (ctx: any) => {
            const val = ctx.raw
            return val >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)' // Green or Red
        },
        borderRadius: 4,
        yAxisID: 'y',
      }
    ],
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  if (loading && Object.keys(financialData).length === 0) return <div className="p-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto"/> Carregando dados financeiros...</div>

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      
      {/* HEADER DE CONTROLE */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
         <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                 <button onClick={() => setViewMode('REAL')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === 'REAL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    <CalendarDays size={16}/> Cenário Real
                 </button>
                 <button onClick={() => setViewMode('SIM')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === 'SIM' ? 'bg-cyan-50 text-cyan-700 shadow-sm border border-cyan-100' : 'text-slate-400 hover:text-slate-600'}`}>
                    <ArrowRightLeft size={16}/> Cenário Simulado
                 </button>
             </div>
             
             <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-cyan-500"
             >
                 {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
         </div>

         {/* RESUMO DO ANO */}
         <div className="flex gap-6 text-right">
             <div>
                 <span className="text-xs font-bold text-slate-400 uppercase">Lucro Anual</span>
                 <div className={`text-xl font-bold ${yearTotals.netProfit >= 0 ? 'text-slate-800' : 'text-red-500'}`}>{fmt(yearTotals.netProfit)}</div>
             </div>
             <div>
                 <span className="text-xs font-bold text-slate-400 uppercase">Margem Média</span>
                 <div className={`text-xl font-bold ${yearMargin > 0 ? 'text-green-600' : 'text-red-500'}`}>{yearMargin.toFixed(1)}%</div>
             </div>
         </div>
      </div>

      {/* GRÁFICO */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
          <Bar 
            data={chartData} 
            options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' as const } },
                scales: { y: { grid: { display: true, color: '#f1f5f9' } }, x: { grid: { display: false } } }
            }} 
          />
      </div>

      {/* TABELA DRE MENSAL */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className={`text-xs font-bold uppercase border-b border-slate-200 ${viewMode === 'SIM' ? 'bg-cyan-50 text-cyan-800' : 'bg-slate-50 text-slate-500'}`}>
                      <tr>
                          <th className="p-4">Mês</th>
                          <th className="p-4 text-right">Faturamento</th>
                          <th className="p-4 text-right text-red-400" title="Impostos + Inadimplência">(-) Deduções</th>
                          <th className="p-4 text-right font-semibold text-slate-600">Rec. Líquida</th>
                          <th className="p-4 text-right text-red-400" title="Chapa + Frete + Var. Mensal">(-) Custos Var.</th>
                          <th className="p-4 text-right font-semibold text-blue-600">Mg. Contrib.</th>
                          <th className="p-4 text-right text-red-400">(-) Fixos</th>
                          <th className="p-4 text-right font-bold text-slate-800">(=) Lucro Líquido</th>
                          <th className="p-4 text-center">Mg. %</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {monthlyDRE.map((m, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-bold text-slate-700">{m.monthName}</td>
                              <td className="p-4 text-right font-medium text-slate-600">{m.revenue > 0 ? fmt(m.revenue) : '-'}</td>
                              <td className="p-4 text-right text-red-400 text-xs">{m.taxes > 0 ? `(${fmt(m.taxes)})` : '-'}</td>
                              <td className="p-4 text-right font-medium text-slate-700 bg-slate-50/50">{m.netRevenue > 0 ? fmt(m.netRevenue) : '-'}</td>
                              <td className="p-4 text-right text-red-400 text-xs">{m.directCosts > 0 ? `(${fmt(m.directCosts)})` : '-'}</td>
                              <td className="p-4 text-right font-medium text-blue-700">{m.contribMargin > 0 ? fmt(m.contribMargin) : '-'}</td>
                              <td className="p-4 text-right text-red-400 text-xs">{m.fixedCost > 0 ? `(${fmt(m.fixedCost)})` : '-'}</td>
                              <td className={`p-4 text-right font-bold ${m.netProfit >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
                                  {m.revenue > 0 ? fmt(m.netProfit) : '-'}
                              </td>
                              <td className="p-4 text-center">
                                  {m.revenue > 0 && (
                                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${m.profitMargin >= 10 ? 'bg-green-100 text-green-700' : m.profitMargin > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                          {m.profitMargin.toFixed(1)}%
                                      </span>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
                  {/* RODAPÉ TOTAIS */}
                  <tfoot className="bg-slate-100 border-t border-slate-200 font-bold text-slate-800">
                      <tr>
                          <td className="p-4">TOTAL {selectedYear}</td>
                          <td className="p-4 text-right">{fmt(yearTotals.revenue)}</td>
                          <td className="p-4 text-right opacity-50">-</td>
                          <td className="p-4 text-right opacity-50">-</td>
                          <td className="p-4 text-right opacity-50">-</td>
                          <td className="p-4 text-right opacity-50">-</td>
                          <td className="p-4 text-right text-red-500">({fmt(yearTotals.fixedCost)})</td>
                          <td className={`p-4 text-right ${yearTotals.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(yearTotals.netProfit)}</td>
                          <td className="p-4 text-center">{yearMargin.toFixed(1)}%</td>
                      </tr>
                  </tfoot>
              </table>
          </div>
      </div>
    </div>
  )
}