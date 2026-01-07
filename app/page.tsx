'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './utils/supabase/client'
import { 
  LayoutDashboard, Calculator, CalendarDays, Users, Upload, CheckCircle, Loader2, LogOut 
} from 'lucide-react'

// Imports dos Componentes
import FileUpload from '@/components/FileUpload'
import DashboardOverview from '@/components/DashboardOverview'
import RevenueChart from '@/components/RevenueChart'
import FinancialSimulator from '@/components/FinancialSimulator'
import SellerAnalysis from '@/components/SellerAnalysis'
import AnnualReport from '@/components/AnnualReport'
import ClearDataButton from '@/components/ClearDataButton'
import DateRangeFilter from '@/components/DateRangeFilter'
import MaterialRanking from '@/components/MaterialRanking'

type FilterState = {
    start: string
    end: string
    mode: 'month' | 'range'
}

export default function Home() {
  const router = useRouter()
  const supabase = createClient()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'annual' | 'sellers'>('overview')
  const [dataLoaded, setDataLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [allSalesData, setAllSalesData] = useState<any[]>([]) 
  const [filtersReady, setFiltersReady] = useState(false)
  
  // Estados de Filtro Independentes
  const [overviewFilter, setOverviewFilter] = useState<FilterState>({ start: '', end: '', mode: 'month' })
  const [financialFilter, setFinancialFilter] = useState<FilterState>({ start: '', end: '', mode: 'month' })
  const [sellersFilter, setSellersFilter] = useState<FilterState>({ start: '', end: '', mode: 'month' })

  // 1. Auth & Data Fetch
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Recuperar Aba Ativa
      const savedTab = localStorage.getItem('bi_active_tab')
      if (savedTab) setActiveTab(savedTab as any)
      
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
        
        // Datas padrão
        const defaultStart = new Date(allRows[0].sale_date).toISOString().split('T')[0]
        const defaultEnd = new Date(allRows[allRows.length - 1].sale_date).toISOString().split('T')[0]
        const defaultState: FilterState = { start: defaultStart, end: defaultEnd, mode: 'month' }

        const getInitialFilter = (key: string): FilterState => {
            const saved = localStorage.getItem(key)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed.start && parsed.end) return parsed
            }
            return defaultState
        }

        setOverviewFilter(getInitialFilter('bi_filter_overview'))
        setFinancialFilter(getInitialFilter('bi_filter_financial'))
        setSellersFilter(getInitialFilter('bi_filter_sellers'))

        setAllSalesData(allRows)
        setDataLoaded(true)
        setFiltersReady(true)
      }
      setIsLoading(false)
    }
    init()
  }, [])

  // --- FUNÇÕES DE ATUALIZAÇÃO DE FILTRO ---
  const updateOverview = (start: string, end: string, mode?: 'month'|'range') => {
      const effectiveMode = mode ? mode : 'range'
      const newState = { start, end, mode: effectiveMode }
      setOverviewFilter(newState)
      localStorage.setItem('bi_filter_overview', JSON.stringify(newState))
  }

  const updateFinancial = (start: string, end: string, mode?: 'month'|'range') => {
      const newState = { start, end, mode: 'month' as const }
      setFinancialFilter(newState)
      localStorage.setItem('bi_filter_financial', JSON.stringify(newState))
  }

  const updateSellers = (start: string, end: string, mode?: 'month'|'range') => {
      const effectiveMode = mode ? mode : 'range'
      const newState = { start, end, mode: effectiveMode }
      setSellersFilter(newState)
      localStorage.setItem('bi_filter_sellers', JSON.stringify(newState))
  }

  const changeTab = (tab: any) => {
      setActiveTab(tab)
      localStorage.setItem('bi_active_tab', tab)
  }

  // --- LOGOUT ROBUSTO (CORREÇÃO AQUI) ---
  const handleLogout = async () => { 
      try {
          // 1. Limpa memória do navegador primeiro (mais importante)
          localStorage.clear()
          
          // 2. Tenta desconectar do Supabase
          await supabase.auth.signOut()
      } catch (error) {
          console.error("Erro ao tentar sair:", error)
      } finally {
          // 3. Força o redirecionamento em qualquer caso (sucesso ou erro)
          router.replace('/login') 
          router.refresh()
      }
  }

  // --- FILTRAGEM ---
  const filterData = (data: any[], filter: FilterState) => {
      if (!filter.start || !filter.end) return data
      const start = new Date(filter.start)
      const end = new Date(filter.end)
      end.setHours(23, 59, 59, 999)
      return data.filter(item => {
          const itemDate = new Date(item.sale_date)
          return itemDate >= start && itemDate <= end
      })
  }

  const dataOverview = useMemo(() => filterData(allSalesData, overviewFilter), [allSalesData, overviewFilter])
  const dataFinancial = useMemo(() => filterData(allSalesData, financialFilter), [allSalesData, financialFilter])
  const dataSellers = useMemo(() => filterData(allSalesData, sellersFilter), [allSalesData, sellersFilter])

  const financialMetrics = useMemo(() => {
      return dataFinancial.reduce((acc, item) => ({
          gross: acc.gross + Number(item.revenue || 0),
          costChapa: acc.costChapa + Number(item.cost || 0),     
          costFreight: acc.costFreight + Number(item.freight || 0) 
      }), { gross: 0, costChapa: 0, costFreight: 0 })
  }, [dataFinancial])

  const financialMonthKey = useMemo(() => {
      if (financialFilter.start) return financialFilter.start.substring(0, 7) 
      return ''
  }, [financialFilter.start])

  if (isLoading) return (<div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="w-10 h-10 animate-spin mb-4 text-cyan-600" /><p>Carregando sistema seguro...</p></div>)

  const showContent = dataLoaded && filtersReady

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
                    {/* Botão de Sair com a função corrigida */}
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

        {/* ABA GERAL */}
        <div className={activeTab === 'overview' && showContent ? 'block space-y-6 animate-in fade-in' : 'hidden'}>
            <DateRangeFilter 
                startDate={overviewFilter.start} endDate={overviewFilter.end} 
                onDateChange={(s, e) => updateOverview(s, e)} 
                onFilterModeChange={(m) => updateOverview(overviewFilter.start, overviewFilter.end, m)} 
            />
            <DashboardOverview data={dataOverview} />
            <MaterialRanking data={dataOverview} />
            <RevenueChart data={dataOverview} />
        </div>

        {/* ABA SIMULADOR */}
        <div className={activeTab === 'financial' && showContent ? 'block space-y-6 animate-in fade-in' : 'hidden'}>
            <DateRangeFilter 
                startDate={financialFilter.start} endDate={financialFilter.end} 
                onDateChange={(s, e) => updateFinancial(s, e)} 
                onFilterModeChange={(m) => updateFinancial(financialFilter.start, financialFilter.end, m)} 
                onlyMonthMode={true} 
            />
            <FinancialSimulator 
                grossRevenue={financialMetrics.gross + financialMetrics.costFreight} 
                costChapa={financialMetrics.costChapa}     
                costFreight={financialMetrics.costFreight} 
                monthKey={financialMonthKey}
            />
        </div>

        {/* ABA ANUAL */}
        <div className={activeTab === 'annual' && showContent ? 'block animate-in fade-in' : 'hidden'}>
            <AnnualReport data={allSalesData} />
        </div>

        {/* ABA VENDEDORES */}
        <div className={activeTab === 'sellers' && showContent ? 'block space-y-6 animate-in fade-in' : 'hidden'}>
            <DateRangeFilter 
                startDate={sellersFilter.start} endDate={sellersFilter.end} 
                onDateChange={(s, e) => updateSellers(s, e)} 
                onFilterModeChange={(m) => updateSellers(sellersFilter.start, sellersFilter.end, m)} 
            />
            <SellerAnalysis data={dataSellers} showGoals={sellersFilter.mode === 'month'} />
        </div>

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