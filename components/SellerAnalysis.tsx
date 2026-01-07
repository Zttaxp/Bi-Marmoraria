'use client'

import { useState, useMemo, useEffect } from 'react'
import { Users, Briefcase, Crown, Layers, AlertCircle, Filter, Target, X } from 'lucide-react'
import { createClient } from '../app/utils/supabase/client'

export default function SellerAnalysis({ data, showGoals }: { data: any[], showGoals: boolean }) {
  const supabase = createClient()
  
  // --- HOOKS ---
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [modalType, setModalType] = useState<'SELLER' | 'CLIENT' | null>(null)
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('')
  
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false)
  const [goals, setGoals] = useState<Record<string, number>>({})

  // 1. BUSCAR METAS DO BANCO
  useEffect(() => {
    const fetchGoals = async () => {
        const { data: goalsData } = await supabase.from('seller_goals').select('seller_name, goal_value')
        if (goalsData) {
            const goalsMap: Record<string, number> = {}
            goalsData.forEach((g: any) => {
                goalsMap[g.seller_name] = Number(g.goal_value)
            })
            setGoals(goalsMap)
        }
    }
    fetchGoals()
  }, [])

  // 2. EXTRAIR LISTA DE VENDEDORES
  const sellersList = useMemo(() => {
      const safeData = data || []
      const sellers = new Set(safeData.map(item => item.seller_name || 'INDEFINIDO'))
      return Array.from(sellers).sort()
  }, [data])

  // 3. FILTRAGEM GLOBAL
  const filteredData = useMemo(() => {
      const safeData = data || []
      if (!selectedSellerFilter) return safeData
      return safeData.filter(item => (item.seller_name || 'INDEFINIDO') === selectedSellerFilter)
  }, [data, selectedSellerFilter])

  // 4. PROCESSAMENTO DOS DADOS (Rankings)
  const { rankingSellers, rankingClientsTotal, rankingClientsHigh, rankingClientsLow } = useMemo(() => {
      const sellersMap: Record<string, any> = {}
      const clientsMap: Record<string, any> = {}

      filteredData.forEach(item => {
        const seller = item.seller_name || 'INDEFINIDO'
        const client = item.client_name || 'CONSUMIDOR FINAL'
        const material = item.material_name || 'MATERIAL INDEFINIDO'
        const rev = item.revenue || 0
        const cost = item.cost || 0
        const freight = item.freight || 0
        const isHigh = item.sale_type === 'HIGH'
        
        const saleDetail = {
            material,
            revenue: rev,
            m2: item.m2_total || 0,
            isHigh
        }

        // Agrupa Vendedores
        if (!sellersMap[seller]) {
          sellersMap[seller] = { 
            name: seller, revenue: 0, cost: 0, freight: 0, 
            count: 0, countHigh: 0, countLow: 0, items: [] 
          }
        }
        sellersMap[seller].revenue += rev
        sellersMap[seller].cost += cost
        sellersMap[seller].freight += freight
        sellersMap[seller].count += 1
        if (isHigh) sellersMap[seller].countHigh += 1
        else sellersMap[seller].countLow += 1
        sellersMap[seller].items.push(saleDetail)

        // Agrupa Clientes
        if (!clientsMap[client]) {
          clientsMap[client] = { 
            name: client, revenue: 0, cost: 0, freight: 0, 
            revenueHigh: 0, costHigh: 0, freightHigh: 0,
            revenueLow: 0, costLow: 0, freightLow: 0,
            count: 0, items: []
          }
        }
        clientsMap[client].revenue += rev
        clientsMap[client].cost += cost
        clientsMap[client].freight += freight
        clientsMap[client].count += 1
        clientsMap[client].items.push(saleDetail)
        
        if (isHigh) {
            clientsMap[client].revenueHigh += rev
            clientsMap[client].costHigh += cost
            clientsMap[client].freightHigh += freight
        } else {
            clientsMap[client].revenueLow += rev
            clientsMap[client].costLow += cost
            clientsMap[client].freightLow += freight
        }
      })

      const calcMargin = (rev: number, cost: number, freight: number) => {
        if (cost === 0) return 0
        const profit = rev - freight - cost
        return (profit / cost) * 100
      }

      // Ranking Vendedores
      const rSellers = Object.values(sellersMap)
        .map((s: any) => {
            const goal = goals[s.name] || 0
            const progress = (showGoals && goal > 0) ? (s.revenue / goal) * 100 : 0
            return { 
                ...s, 
                margin: calcMargin(s.revenue, s.cost, s.freight),
                goal,
                progress
            }
        })
        .sort((a: any, b: any) => b.revenue - a.revenue)

      // Ranking Clientes GERAL
      const rClientsTotal = Object.values(clientsMap)
        .map((c: any) => ({ ...c, margin: calcMargin(c.revenue, c.cost, c.freight), filterType: 'ALL' }))
        .sort((a: any, b: any) => b.revenue - a.revenue)

      // Ranking Clientes ALTO VALOR
      const rClientsHigh = Object.values(clientsMap)
        .filter((c: any) => c.revenueHigh > 0)
        .map((c: any) => ({ 
            ...c, 
            revenue: c.revenueHigh, 
            margin: calcMargin(c.revenueHigh, c.costHigh, c.freightHigh),
            filterType: 'HIGH'
        }))
        .sort((a: any, b: any) => b.revenue - a.revenue)

      // Ranking Clientes COMBATE
      const rClientsLow = Object.values(clientsMap)
        .filter((c: any) => c.revenueLow > 0)
        .map((c: any) => ({ 
            ...c, 
            revenue: c.revenueLow, 
            margin: calcMargin(c.revenueLow, c.costLow, c.freightLow),
            filterType: 'LOW'
        }))
        .sort((a: any, b: any) => b.revenue - a.revenue)

      return { rankingSellers: rSellers, rankingClientsTotal: rClientsTotal, rankingClientsHigh: rClientsHigh, rankingClientsLow: rClientsLow }

  }, [filteredData, goals, showGoals]) 

  // --- FUNÇÕES AUXILIARES ---
  const handleSaveGoal = async (sellerName: string, value: string) => {
      const numValue = parseFloat(value) || 0
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setGoals(prev => ({ ...prev, [sellerName]: numValue }))
      await supabase.from('seller_goals').upsert({
          user_id: user.id, seller_name: sellerName, goal_value: numValue
      }, { onConflict: 'user_id, seller_name' })
  }

  const getModalContent = () => {
      if(!selectedItem) return null
      
      const groupedMaterials: Record<string, any> = {}
      selectedItem.items.forEach((sale: any) => {
          if (modalType === 'CLIENT') {
              if (selectedItem.filterType === 'HIGH' && !sale.isHigh) return; 
              if (selectedItem.filterType === 'LOW' && sale.isHigh) return;   
          }

          const key = `${sale.material}|${sale.isHigh ? 'H' : 'L'}`
          if(!groupedMaterials[key]) {
              groupedMaterials[key] = { name: sale.material, qty: 0, m2: 0, revenue: 0, isHigh: sale.isHigh }
          }
          groupedMaterials[key].qty += 1
          groupedMaterials[key].m2 += sale.m2
          groupedMaterials[key].revenue += sale.revenue
      })
      const materials = Object.values(groupedMaterials).sort((a:any, b:any) => b.revenue - a.revenue)
      return { high: materials.filter((m:any) => m.isHigh), low: materials.filter((m:any) => !m.isHigh) }
  }
  const modalData = getModalContent()

  if (!data || data.length === 0) {
     return (<div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl"><AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20"/><p>Nenhum dado encontrado para o período selecionado.</p></div>)
  }

  return (
    <div className="space-y-6">
      
      {/* FILTROS E METAS */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
         <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4 flex-1 w-full md:w-auto">
             <div className="flex items-center gap-2 text-slate-700"><Filter className="text-cyan-600" size={20} /><span className="font-bold text-sm hidden md:inline">Vendedor:</span></div>
             <select value={selectedSellerFilter} onChange={(e) => setSelectedSellerFilter(e.target.value)} className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm font-medium focus:ring-2 focus:ring-cyan-500 outline-none cursor-pointer">
                <option value="">Mostrar Todos</option>
                {sellersList.map(seller => <option key={seller} value={seller}>{seller}</option>)}
             </select>
         </div>
         
         {/* BOTÃO AGORA É CONDICIONAL: Só aparece se estiver no modo Mês (showGoals = true) */}
         {showGoals && (
             <button onClick={() => setIsGoalsModalOpen(true)} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-slate-700 transition shadow-sm w-full md:w-auto justify-center">
                 <Target size={18} /> Definir Metas
             </button>
         )}
      </div>

      {/* RANKING VENDEDORES */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2"><Briefcase className="text-slate-600" size={20} /><h3 className="font-bold text-slate-700">Performance & Metas</h3></div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                        <th className="p-4 w-10">#</th>
                        <th className="p-4 min-w-[150px]">Vendedor</th>
                        {/* COLUNA CONDICIONAL */}
                        {showGoals && <th className="p-4 min-w-[200px]">Meta Mensal</th>}
                        <th className="p-4 text-center text-purple-600 font-extrabold" title="Chapas de Alto Valor">Qtd. Alta</th>
                        <th className="p-4 text-center text-orange-600 font-extrabold" title="Chapas de Combate">Qtd. Combate</th>
                        <th className="p-4 text-right">Faturamento</th>
                        <th className="p-4 text-right">Margem %</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {rankingSellers.map((seller: any, idx: number) => (
                        <tr key={idx} onClick={() => { setSelectedItem(seller); setModalType('SELLER'); }} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                            <td className="p-4 text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-4 font-bold text-slate-700 group-hover:text-cyan-600 underline decoration-dotted decoration-slate-300 underline-offset-4">{seller.name}</td>
                            
                            {/* CÉLULA CONDICIONAL */}
                            {showGoals && (
                                <td className="p-4">
                                    {seller.goal > 0 ? (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between text-xs font-bold text-slate-600"><span>{seller.progress.toFixed(0)}%</span><span className="text-slate-400">Meta: {seller.goal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</span></div>
                                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${seller.progress >= 100 ? 'bg-green-500' : seller.progress >= 70 ? 'bg-cyan-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(seller.progress, 100)}%` }} /></div>
                                        </div>
                                    ) : <span className="text-xs text-slate-400 italic">Sem meta</span>}
                                </td>
                            )}

                            <td className="p-4 text-center text-slate-600 font-bold bg-purple-50/50">{seller.countHigh}</td>
                            <td className="p-4 text-center text-slate-600 font-bold bg-orange-50/50">{seller.countLow}</td>
                            <td className="p-4 text-right font-bold text-cyan-700">{seller.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-4 text-right"><BadgeMargin value={seller.margin} /></td>
                        </tr>
                    ))}
                    {rankingSellers.length === 0 && <tr><td colSpan={showGoals ? 7 : 6} className="p-8 text-center text-slate-400">Nenhum dado encontrado para este filtro.</td></tr>}
                </tbody>
            </table>
        </div>
    </div>

      {/* SEÇÃO 2: RANKINGS DE CLIENTES (3 COLUNAS) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* GERAL */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-4 bg-blue-50 border-b border-blue-100 flex justify-between"><h3 className="font-bold text-blue-800 flex items-center gap-2"><Users size={18} /> Clientes (Geral)</h3></div>
            <ClientTable items={rankingClientsTotal} color="blue" onClick={(item) => { setSelectedItem(item); setModalType('CLIENT'); }} />
        </div>
        {/* ALTO VALOR */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-4 bg-purple-50 border-b border-purple-100"><h3 className="font-bold text-purple-800 flex items-center gap-2"><Crown size={18} /> Clientes (Alto Valor)</h3></div>
            <ClientTable items={rankingClientsHigh} color="purple" onClick={(item) => { setSelectedItem(item); setModalType('CLIENT'); }} />
        </div>
        {/* COMBATE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-4 bg-orange-50 border-b border-orange-100"><h3 className="font-bold text-orange-800 flex items-center gap-2"><Layers size={18} /> Clientes (Combate)</h3></div>
            <ClientTable items={rankingClientsLow} color="orange" onClick={(item) => { setSelectedItem(item); setModalType('CLIENT'); }} />
        </div>
      </div>

      {/* MODAL METAS */}
      {isGoalsModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 max-h-[80vh]">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Target size={20}/> Definir Metas Mensais</h2>
                    <button onClick={() => setIsGoalsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={20}/></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <p className="text-xs text-slate-500 mb-4 bg-yellow-50 p-2 rounded border border-yellow-100">Insira a <b>Meta Mensal Padrão</b>. Ela será comparada quando o filtro for "Por Mês".</p>
                    {sellersList.map((seller) => (
                        <div key={seller} className="flex flex-col gap-1">
                            <label className="text-xs font-bold text-slate-600">{seller}</label>
                            <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400 text-sm">R$</span><input type="number" defaultValue={goals[seller] || ''} onBlur={(e) => handleSaveGoal(seller, e.target.value)} placeholder="0,00" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded focus:ring-2 focus:ring-cyan-500 outline-none"/></div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl text-right"><button onClick={() => setIsGoalsModalOpen(false)} className="px-4 py-2 bg-cyan-600 text-white font-bold rounded hover:bg-cyan-700">Concluir</button></div>
            </div>
        </div>
      )}

      {/* MODAL DETALHES */}
      {selectedItem && modalData && !isGoalsModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{modalType === 'SELLER' ? 'Vendedor' : 'Cliente'}</span>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">{modalType === 'SELLER' ? <Briefcase size={20}/> : <Users size={20}/>} {selectedItem.name}</h2>
                    </div>
                    <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition"><X size={24} /></button>
                </div>
                <div className="overflow-y-auto p-6 flex-1 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(modalType === 'SELLER' || selectedItem.filterType !== 'LOW') && (
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-purple-50 p-3 border-b border-purple-100 flex items-center gap-2"><Crown size={16} className="text-purple-600"/><h3 className="font-bold text-purple-800 text-sm">Alto Valor</h3><span className="ml-auto bg-white text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full border border-purple-100">{modalData.high.reduce((acc:number, i:any) => acc + i.qty, 0)} pçs</span></div>
                                <DetailList items={modalData.high} />
                            </div>
                        )}
                        {(modalType === 'SELLER' || selectedItem.filterType !== 'HIGH') && (
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                <div className="bg-orange-50 p-3 border-b border-orange-100 flex items-center gap-2"><Layers size={16} className="text-orange-600"/><h3 className="font-bold text-orange-800 text-sm">Combate</h3><span className="ml-auto bg-white text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full border border-orange-100">{modalData.low.reduce((acc:number, i:any) => acc + i.qty, 0)} pçs</span></div>
                                <DetailList items={modalData.low} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}

// -- SUB-COMPONENTES --
function BadgeMargin({ value }: { value: number }) {
    let colorClass = "bg-green-100 text-green-700"
    if (value < 20) colorClass = "bg-red-100 text-red-700"
    else if (value < 40) colorClass = "bg-yellow-100 text-yellow-700"
    return <span className={`px-2 py-1 rounded-full text-xs font-bold ${colorClass}`}>{value.toFixed(1)}%</span>
}

function ClientTable({ items, color, onClick }: { items: any[], color: string, onClick: (item: any) => void }) {
    const textColors: any = { blue: "text-blue-700", purple: "text-purple-700", orange: "text-orange-700" }
    return (
        <div className="overflow-x-auto flex-1 max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 sticky top-0">
                    <tr><th className="p-3 w-8">#</th><th className="p-3">Cliente</th><th className="p-3 text-right">Valor</th><th className="p-3 text-right">Mg. %</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {items.map((item, idx) => (
                        <tr key={idx} onClick={() => onClick(item)} className="hover:bg-slate-50 cursor-pointer group transition-colors">
                            <td className="p-3 text-slate-400 text-xs font-bold">{idx + 1}</td>
                            <td className="p-3 font-medium text-slate-700 truncate max-w-[150px] group-hover:underline group-hover:text-cyan-600" title={item.name}>{item.name}</td>
                            <td className={`p-3 text-right font-bold ${textColors[color]}`}>{item.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-3 text-right text-xs">{item.margin.toFixed(1)}%</td>
                        </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">Sem dados.</td></tr>}
                </tbody>
            </table>
        </div>
    )
}

function DetailList({ items }: { items: any[] }) {
    if (items.length === 0) return <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2"><AlertCircle size={24} className="opacity-20"/>Nenhum item nesta categoria.</div>
    return (
        <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-100">
                    <tr><th className="p-2 pl-3">Material</th><th className="p-2 text-right">Qtd</th><th className="p-2 text-right">M²</th><th className="p-2 pr-3 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {items.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 pl-3 font-medium text-slate-700 truncate max-w-[180px]" title={item.name}>{item.name}</td>
                            <td className="p-2 text-right text-slate-600 font-bold">{item.qty}</td>
                            <td className="p-2 text-right text-slate-500">{item.m2.toFixed(1)}</td>
                            <td className="p-2 pr-3 text-right font-bold text-slate-700">{item.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}