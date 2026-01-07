'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './utils/supabase/client'
import { 
  LayoutDashboard, Calculator, CalendarDays, Users, Upload, CheckCircle, Loader2, LogOut 
} from 'lucide-react'

import FileUpload from '@/components/FileUpload'
import DashboardOverview from '@/components/DashboardOverview'
import RevenueChart from '@/components/RevenueChart'
import FinancialSimulator from '@/components/FinancialSimulator'
import SellerAnalysis from '@/components/SellerAnalysis'
import AnnualReport from '@/components/AnnualReport'
import ClearDataButton from '@/components/ClearDataButton'
import DateRangeFilter from '@/components/DateRangeFilter'
import MaterialRanking from '@/components/MaterialRanking'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'annual' | 'sellers'>('overview')
  const [dataLoaded, setDataLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [allSalesData, setAllSalesData] = useState<any[]>([]) 
  
  // Estados de Filtro
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month')

  // 1. Auth & Data Fetch & Recuperação de Estado
  useEffect(() => {
    const init = async () => {
      // A. Recuperar dados salvos no navegador (Aba, Datas, Modo)
      const savedTab = localStorage.getItem('bi_active_tab')
      const savedFilter = localStorage.getItem('bi_filters')
      
      if (savedTab) setActiveTab(savedTab as any)
      
      let initialStart = ''
      let initialEnd = ''
      let initialMode: any = 'month'

      if (savedFilter) {
          const parsed = JSON.parse(savedFilter)
          initialStart = parsed.start
          initialEnd = parsed.end
          initialMode = parsed.mode
          setFilterMode(parsed.mode)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      
      let allRows: any[] = []
      let from = 0
      const step = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase.from('sales_records').select('*').range(from, from + step - 1)
        if (error || !data || data.length === 0) { hasMore = false } 
        else { allRows = [...allRows, ...data]; from += step; if (data.length < step) hasMore = false }
      }

      if (allRows.length > 0) {
        allRows.sort((a, b) => new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime())
        
        // Se não tiver data salva no storage, usa a do banco
        if (!initialStart) {
            initialStart = new Date(allRows[0].sale_date).toISOString().split('T')[0]
            initialEnd = new Date(allRows[allRows.length - 1].sale_date).toISOString().split('T')[0]
        }

        setStartDate(initialStart)
        setEndDate(initialEnd)
        setAllSalesData(allRows)
        setDataLoaded(true)
      }
      setIsLoading(false)
    }
    init()
  }, [])

  // Função Centralizada para mudar filtros e salvar na memória
  const handleFilterChange = (start: string, end: string, mode: 'month'|'range') => {
      setStartDate(start)
      setEndDate(end)
      // Se mode vier undefined (ex: só mudou data), mantém o atual
      if(mode) setFilterMode(mode)
      
      // Salva no navegador
      localStorage.setItem('bi_filters', JSON.stringify({
          start, 
          end, 
          mode: mode || filterMode
      }))
  }

  const changeTab = (tab: any) => {
      setActiveTab(tab)
      localStorage.setItem('bi_active_tab', tab)
  }

  const handleLogout = async () => { 
      localStorage.removeItem('bi_active_tab')
      localStorage.removeItem('bi_filters')
      await supabase.auth.signOut()
      router.push('/login') 
  }

  const getFilteredData = () => {
      if (!startDate || !endDate) return allSalesData
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      return allSalesData.filter(item => {
          const itemDate = new Date(item.sale_date)
          return itemDate >= start && itemDate <= end
      })
  }

  const filteredData = getFilteredData()

  const currentFinancials = useMemo(() => {
      return filteredData.reduce((acc, item) => ({
          gross: acc.gross + Number(item.revenue || 0),
          costChapa: acc.costChapa + Number(item.cost || 0),     
          costFreight: acc.costFreight + Number(item.freight || 0) 
      }), { gross: 0, costChapa: 0, costFreight: 0 })
  }, [filteredData])

  const currentMonthKey = useMemo(() => {
      if (filterMode === 'month' && startDate) {
          return startDate.substring(0, 7) 
      }
      return ''
  }, [startDate, filterMode])

  if (isLoading) return (<div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="w-10 h-10 animate-spin mb-4 text-cyan-600" /><p>Carregando sistema seguro...</p></div>)

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center">
      <div className="w-full bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10 sticky top-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="bg-cyan-600 text-white px-2 py-1 rounded text-sm">BI</span> Marmoraria
            </h1>
          </div>
          {!dataLoaded && (<div className="w-full md:w-auto"><FileUpload /></div>)}
          {dataLoaded && (
             <div className="flex gap-4 items-center flex-wrap justify-center">
                <span className="hidden lg:flex text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100 items-center gap-1"><CheckCircle size={12} /> {allSalesData.length.toLocaleString()} Reg.</span>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <TabButton active={activeTab === 'overview'} onClick={() => changeTab('overview')} icon={<LayoutDashboard size={16}/>} label="Geral" />
                    <TabButton active={activeTab === 'financial'} onClick={() => changeTab('financial')} icon={<Calculator size={16}/>} label="Simulador" />
                    <TabButton active={activeTab === 'annual'} onClick={() => changeTab('annual')} icon={<CalendarDays size={16}/>} label="Anual" />
                    <TabButton active={activeTab === 'sellers'} onClick={() => changeTab('sellers')} icon={<Users size={16}/>} label="Vendedores" />
                </div>
                <div className="flex items-center gap-1 border-l border-slate-200 pl-4 ml-2">
                    <ClearDataButton />
                    <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title="Sair"><LogOut size={20} /></button>
                </div>
             </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-7xl p-6 mb-12 min-h-[500px]">
        {!dataLoaded && !isLoading && (
            <div className="text-center mt-20 text-slate-400"><Upload className="w-12 h-12 mx-auto mb-4 opacity-20" /><p>Nenhum dado encontrado. Faça upload da planilha acima.</p></div>
        )}

        {/* GERAL */}
        {dataLoaded && activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <DateRangeFilter 
                    startDate={startDate} endDate={endDate} 
                    onDateChange={(s, e) => handleFilterChange(s, e, filterMode)} 
                    onFilterModeChange={(m) => handleFilterChange(startDate, endDate, m)} 
                />
                <DashboardOverview data={filteredData} />
                <MaterialRanking data={filteredData} />
                <RevenueChart data={filteredData} />
            </div>
        )}

        {/* SIMULADOR */}
        {dataLoaded && activeTab === 'financial' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <DateRangeFilter 
                    startDate={startDate} endDate={endDate} 
                    onDateChange={(s, e) => handleFilterChange(s, e, filterMode)} 
                    onFilterModeChange={(m) => handleFilterChange(startDate, endDate, m)} 
                    onlyMonthMode={true} 
                />
                <FinancialSimulator 
                    grossRevenue={currentFinancials.gross + currentFinancials.costFreight} 
                    costChapa={currentFinancials.costChapa}     
                    costFreight={currentFinancials.costFreight} 
                    monthKey={currentMonthKey}
                />
             </div>
        )}

        {/* ANUAL */}
        {dataLoaded && activeTab === 'annual' && (<div className="animate-in fade-in slide-in-from-bottom-2"><AnnualReport data={allSalesData} /></div>)}

        {/* VENDEDORES */}
        {dataLoaded && activeTab === 'sellers' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <DateRangeFilter 
                    startDate={startDate} endDate={endDate} 
                    onDateChange={(s, e) => handleFilterChange(s, e, filterMode)} 
                    onFilterModeChange={(m) => handleFilterChange(startDate, endDate, m)} 
                />
                <SellerAnalysis data={filteredData} showGoals={filterMode === 'month'} />
             </div>
        )}
      </div>
    </main>
  )
}

function TabButton({ active, onClick, icon, label }: any) {
    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${active ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {icon} <span className="hidden md:inline">{label}</span>
        </button>
    )
}