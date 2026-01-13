'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { CalendarDays, ArrowRightLeft, Loader2, Download, RefreshCw } from 'lucide-react'
import { createClient } from '../app/utils/supabase/client'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js'
import * as XLSX from 'xlsx'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function AnnualReport({ data, isVisible }: { data: any[], isVisible: boolean }) {
  const supabase = createClient()
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [viewMode, setViewMode] = useState<'REAL' | 'SIM'>('REAL')
  const [financialData, setFinancialData] = useState<Record<string, any>>({})
  const [globalConfig, setGlobalConfig] = useState<any>(null)
  const [loading, setLoading] = useState(false) // Começa false pois o fetch inicial será no useEffect

  // Calcula anos disponíveis baseando-se na planilha E no ano atual
  const availableYears = useMemo(() => {
      const years = new Set(data.map(d => new Date(d.sale_date).getFullYear()))
      years.add(new Date().getFullYear()) // Garante que o ano atual sempre apareça
      if (financialData) {
          // Adiciona anos que tenham dados salvos no banco também
          Object.keys(financialData).forEach(key => {
              const y = parseInt(key.split('-')[0])
              if (!isNaN(y)) years.add(y)
          })
      }
      return Array.from(years).sort((a, b) => b - a)
  }, [data, financialData])

  // Busca dados do banco
  const fetchFinancials = useCallback(async () => {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
         const { data: gConfig } = await supabase.from('financial_global_config').select('*').eq('user_id', user.id).maybeSingle()
         setGlobalConfig(gConfig || { tax_rate: 6, default_rate: 1.5, commission_rate: 0 })
      }

      const { data: dbData } = await supabase.from('financial_monthly_data').select('*')
      
      const map: Record<string, any> = {}
      if (dbData) {
          dbData.forEach((row: any) => { 
              // Garante formato YYYY-MM
              map[row.month_key] = row 
          })
      }
      setFinancialData(map)
      setLoading(false)
  }, [])

  // Atualiza sempre que a aba fica visível
  useEffect(() => {
      if (isVisible) {
          fetchFinancials()
      }
  }, [isVisible, fetchFinancials])

  const monthlyDRE = useMemo(() => {
      const months = Array.from({ length: 12 }, (_, i) => i + 1)
      
      return months.map(month => {
          // Gera chave YYYY-MM (ex: 2025-02)
          const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`
          const dbRow = financialData[monthKey] || {}
          
          const defTax = globalConfig?.tax_rate ?? 6.0
          const defDef = globalConfig?.default_rate ?? 1.5
          const defComm = globalConfig?.commission_rate ?? 0

          // Vendas da Planilha (CSV)
          const salesInMonth = data.filter(d => {
              const date = new Date(d.sale_date)
              return date.getFullYear() === selectedYear && (date.getMonth() + 1) === month
          })

          const csvRevenue = salesInMonth.reduce((acc, item) => acc + (item.revenue || 0), 0)
          const csvCostChapa = salesInMonth.reduce((acc, item) => acc + (item.cost || 0), 0)
          const csvCostFreight = salesInMonth.reduce((acc, item) => acc + (item.freight || 0), 0)
          const csvRevenueGross = csvRevenue + csvCostFreight

          let revenue, costChapa, costFreight, taxRate, defRate, commRate, otherVar, fixedCost

          const dbFixed = dbRow.fixed_cost !== undefined && dbRow.fixed_cost !== null ? Number(dbRow.fixed_cost) : 85000
          
          if (viewMode === 'REAL') {
              // Modo Real: Prioriza CSV, mas usa DB para custos fixos/variáveis extras
              revenue = csvRevenueGross
              costChapa = csvCostChapa
              costFreight = csvCostFreight
              taxRate = dbRow.tax_rate !== undefined ? Number(dbRow.tax_rate) : defTax
              defRate = dbRow.default_rate !== undefined ? Number(dbRow.default_rate) : defDef
              commRate = dbRow.commission_rate !== undefined ? Number(dbRow.commission_rate) : defComm
              otherVar = Number(dbRow.variable_cost) || 0
              fixedCost = dbFixed
          } else {
              // Modo Simulado: Prioriza TOTALMENTE o banco de dados (sim_...) se existir
              revenue = dbRow.sim_revenue !== undefined && dbRow.sim_revenue !== null ? Number(dbRow.sim_revenue) : csvRevenueGross
              costChapa = dbRow.sim_cost_chapa !== undefined && dbRow.sim_cost_chapa !== null ? Number(dbRow.sim_cost_chapa) : csvCostChapa
              costFreight = dbRow.sim_cost_freight !== undefined && dbRow.sim_cost_freight !== null ? Number(dbRow.sim_cost_freight) : csvCostFreight
              
              taxRate = dbRow.sim_tax_rate !== undefined ? Number(dbRow.sim_tax_rate) : (dbRow.tax_rate !== undefined ? Number(dbRow.tax_rate) : defTax)
              defRate = dbRow.sim_default_rate !== undefined ? Number(dbRow.sim_default_rate) : (dbRow.default_rate !== undefined ? Number(dbRow.default_rate) : defDef)
              commRate = dbRow.sim_commission_rate !== undefined ? Number(dbRow.sim_commission_rate) : (dbRow.commission_rate !== undefined ? Number(dbRow.commission_rate) : defComm)
              
              otherVar = dbRow.sim_variable_cost !== undefined ? Number(dbRow.sim_variable_cost) : (Number(dbRow.variable_cost) || 0)
              
              const simFixDB = dbRow.sim_fixed_cost !== undefined && dbRow.sim_fixed_cost !== null ? Number(dbRow.sim_fixed_cost) : null
              fixedCost = simFixDB !== null ? simFixDB : dbFixed
          }

          const valTax = revenue * (taxRate / 100)
          const valDef = revenue * (defRate / 100)
          const netRevenue = revenue - valTax - valDef
          const valComm = revenue * (commRate / 100)
          const contribMargin = netRevenue - costChapa - costFreight - valComm - otherVar
          const netProfit = contribMargin - fixedCost
          const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

          return {
              monthName: new Date(selectedYear, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
              revenue, valTax, valDef, netRevenue, costChapa, costFreight, valComm, otherVar, contribMargin, fixedCost, netProfit, profitMargin
          }
      })
  }, [data, financialData, selectedYear, viewMode, globalConfig])

  const yearTotals = useMemo(() => {
      const t = { revenue: 0, valTax: 0, valDef: 0, netRevenue: 0, costChapa: 0, costFreight: 0, valComm: 0, otherVar: 0, contribMargin: 0, fixedCost: 0, netProfit: 0 }
      monthlyDRE.forEach(m => {
          t.revenue += m.revenue; t.valTax += m.valTax; t.valDef += m.valDef; t.netRevenue += m.netRevenue; t.costChapa += m.costChapa; t.costFreight += m.costFreight; t.valComm += m.valComm; t.otherVar += m.otherVar; t.contribMargin += m.contribMargin; t.fixedCost += m.fixedCost; t.netProfit += m.netProfit
      })
      return t
  }, [monthlyDRE])
  const yearMargin = yearTotals.revenue > 0 ? (yearTotals.netProfit / yearTotals.revenue) * 100 : 0
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  
  const handleExport = () => {
      const ws = XLSX.utils.json_to_sheet(monthlyDRE.map(m => ({
          Mês: m.monthName, 'Faturamento': m.revenue, 'Impostos': m.valTax, 'Comissões': m.valComm, 'Fixos': m.fixedCost, 'Lucro': m.netProfit
      })))
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "DRE Anual"); XLSX.writeFile(wb, `DRE_${selectedYear}.xlsx`)
  }

  const chartData = {
    labels: monthlyDRE.map(d => d.monthName),
    datasets: [
      { label: 'Faturamento', data: monthlyDRE.map(d => d.revenue), backgroundColor: 'rgba(203, 213, 225, 0.5)', borderRadius: 4, yAxisID: 'y' },
      { label: 'Lucro Líquido', data: monthlyDRE.map(d => d.netProfit), backgroundColor: (ctx: any) => ctx.raw >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)', borderRadius: 4, yAxisID: 'y' }
    ],
  }

  if (loading && Object.keys(financialData).length === 0) return <div className="p-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto"/> Carregando dados financeiros...</div>

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
         <div className="flex items-center gap-4 flex-wrap">
             <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                 <button onClick={() => setViewMode('REAL')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === 'REAL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><CalendarDays size={16}/> Cenário Real</button>
                 <button onClick={() => setViewMode('SIM')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === 'SIM' ? 'bg-cyan-50 text-cyan-700 shadow-sm border border-cyan-100' : 'text-slate-400 hover:text-slate-600'}`}><ArrowRightLeft size={16}/> Cenário Simulado</button>
             </div>
             
             <div className="flex gap-2">
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-cyan-500">
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={fetchFinancials} className="p-2.5 bg-slate-50 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 border border-slate-200 rounded-lg transition-colors" title="Atualizar Dados">
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
             </div>
         </div>
         <div className="flex gap-4 items-center">
             <div className="text-right"><span className="text-xs font-bold text-slate-400 uppercase">Lucro Anual</span><div className={`text-xl font-bold ${yearTotals.netProfit >= 0 ? 'text-slate-800' : 'text-red-500'}`}>{fmt(yearTotals.netProfit)}</div></div>
             <button onClick={handleExport} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors"><Download size={20} /></button>
         </div>
      </div>
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-72">
          <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' as const } }, scales: { y: { grid: { display: true, color: '#f1f5f9' } }, x: { grid: { display: false } } } }} />
      </div>
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className={`font-bold uppercase border-b border-slate-200 ${viewMode === 'SIM' ? 'bg-cyan-50 text-cyan-800' : 'bg-slate-50 text-slate-500'}`}>
                      <tr>
                          <th className="p-3 sticky left-0 z-10 bg-inherit border-r border-slate-200 shadow-sm">Mês</th>
                          <th className="p-3 text-right text-slate-700 min-w-[100px]">(+) Fat. Bruto</th>
                          <th className="p-3 text-right text-red-400 min-w-[90px]">(-) Impostos</th>
                          <th className="p-3 text-right text-red-400 min-w-[90px]">(-) Inadimp.</th>
                          <th className="p-3 text-right font-semibold text-slate-600 bg-slate-50 min-w-[100px]">(=) Rec. Líquida</th>
                          <th className="p-3 text-right text-red-400 min-w-[90px]">(-) CMV</th>
                          <th className="p-3 text-right text-red-400 min-w-[90px]">(-) Frete</th>
                          <th className="p-3 text-right text-red-400 min-w-[90px]">(-) Comissões</th>
                          <th className="p-3 text-right text-red-400 min-w-[90px]">(-) Outros Var.</th>
                          <th className="p-3 text-right font-semibold text-blue-600 bg-blue-50/30 min-w-[100px]">(=) Mg. Contrib.</th>
                          <th className="p-3 text-right text-red-400 min-w-[90px]">(-) Fixos</th>
                          <th className="p-3 text-right font-bold text-slate-800 bg-slate-100 min-w-[110px]">(=) Lucro Líquido</th>
                          <th className="p-3 text-center min-w-[70px]">Mg. %</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {monthlyDRE.map((m, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-bold text-slate-700 sticky left-0 bg-white border-r border-slate-100 shadow-sm">{m.monthName}</td>
                              <td className="p-3 text-right font-medium text-slate-600">{fmt(m.revenue)}</td>
                              <td className="p-3 text-right text-red-400 text-[10px]">{m.valTax > 0 ? `(${fmt(m.valTax)})` : '-'}</td>
                              <td className="p-3 text-right text-red-400 text-[10px]">{m.valDef > 0 ? `(${fmt(m.valDef)})` : '-'}</td>
                              <td className="p-3 text-right font-bold text-slate-700 bg-slate-50">{fmt(m.netRevenue)}</td>
                              <td className="p-3 text-right text-red-400 text-[10px]">{m.costChapa > 0 ? `(${fmt(m.costChapa)})` : '-'}</td>
                              <td className="p-3 text-right text-red-400 text-[10px]">{m.costFreight > 0 ? `(${fmt(m.costFreight)})` : '-'}</td>
                              <td className="p-3 text-right text-red-400 text-[10px]">{m.valComm > 0 ? `(${fmt(m.valComm)})` : '-'}</td>
                              <td className="p-3 text-right text-red-400 text-[10px]">{m.otherVar > 0 ? `(${fmt(m.otherVar)})` : '-'}</td>
                              <td className="p-3 text-right font-bold text-blue-700 bg-blue-50/30">{fmt(m.contribMargin)}</td>
                              <td className="p-3 text-right text-red-400 text-[10px]">{m.fixedCost > 0 ? `(${fmt(m.fixedCost)})` : '-'}</td>
                              <td className={`p-3 text-right font-bold bg-slate-50 ${m.netProfit >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{fmt(m.netProfit)}</td>
                              <td className="p-3 text-center">{m.revenue > 0 && (<span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${m.profitMargin >= 10 ? 'bg-green-100 text-green-700' : m.profitMargin > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{m.profitMargin.toFixed(1)}%</span>)}</td>
                          </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-slate-800 text-white font-bold text-xs sticky bottom-0">
                      <tr>
                          <td className="p-3 sticky left-0 bg-slate-800 border-r border-slate-700">TOTAL</td>
                          <td className="p-3 text-right text-slate-300">{fmt(yearTotals.revenue)}</td>
                          <td className="p-3 text-right text-red-300">({fmt(yearTotals.valTax)})</td>
                          <td className="p-3 text-right text-red-300">({fmt(yearTotals.valDef)})</td>
                          <td className="p-3 text-right bg-slate-700 text-white">{fmt(yearTotals.netRevenue)}</td>
                          <td className="p-3 text-right text-red-300">({fmt(yearTotals.costChapa)})</td>
                          <td className="p-3 text-right text-red-300">({fmt(yearTotals.costFreight)})</td>
                          <td className="p-3 text-right text-red-300">({fmt(yearTotals.valComm)})</td>
                          <td className="p-3 text-right text-red-300">({fmt(yearTotals.otherVar)})</td>
                          <td className="p-3 text-right text-cyan-300 bg-slate-700">{fmt(yearTotals.contribMargin)}</td>
                          <td className="p-3 text-right text-red-300">({fmt(yearTotals.fixedCost)})</td>
                          <td className={`p-3 text-right text-lg ${yearTotals.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(yearTotals.netProfit)}</td>
                          <td className="p-3 text-center text-slate-300">{yearMargin.toFixed(1)}%</td>
                      </tr>
                  </tfoot>
              </table>
          </div>
      </div>
    </div>
  )
}