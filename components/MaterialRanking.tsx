'use client'

import { Crown, Layers } from 'lucide-react'

export default function MaterialRanking({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null

  // 1. Agrupamento e Cálculos
  const materialStats: Record<string, { revenue: number, m2: number, count: number, category: 'HIGH' | 'LOW' }> = {}

  data.forEach(item => {
    const name = item.material_name || 'Indefinido'
    const rev = item.revenue || 0
    const m2 = item.m2_total || 0
    
    // Cálculo de segurança
    const pricePerM2 = m2 > 0 ? rev / m2 : 0
    // Classificação (>= 300 é Alto Valor)
    const type = pricePerM2 >= 300 ? 'HIGH' : 'LOW'

    if (!materialStats[name]) {
      materialStats[name] = { revenue: 0, m2: 0, count: 0, category: type }
    }
    
    materialStats[name].revenue += rev
    materialStats[name].m2 += m2
    materialStats[name].count += 1
  })

  // 2. Transformar em Lista e Separar
  const allMaterials = Object.entries(materialStats).map(([name, stat]) => ({
    name,
    ...stat
  }))

  const highValue = allMaterials.filter(m => m.category === 'HIGH').sort((a, b) => b.revenue - a.revenue)
  const lowValue = allMaterials.filter(m => m.category === 'LOW').sort((a, b) => b.revenue - a.revenue)

  // 3. Totais Gerais dos Grupos
  const totalM2High = highValue.reduce((acc, curr) => acc + curr.m2, 0)
  const totalCountHigh = highValue.reduce((acc, curr) => acc + curr.count, 0)

  const totalM2Low = lowValue.reduce((acc, curr) => acc + curr.m2, 0)
  const totalCountLow = lowValue.reduce((acc, curr) => acc + curr.count, 0)

  const fmtNum = (val: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(val)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      
      {/* CARD ALTO VALOR */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-purple-800 flex items-center gap-2">
                    <Crown size={18} /> Alto Valor Agregado
                </h3>
                <p className="text-xs text-purple-600 mt-1">Acima de R$ 300/m²</p>
            </div>
            <div className="text-right">
                <span className="block text-xs font-bold text-purple-400 uppercase">Volume Total</span>
                <div className="text-lg font-bold text-purple-700 leading-tight">
                    {totalCountHigh} <span className="text-sm font-normal">pçs</span> <span className="text-purple-300 mx-1">|</span> {fmtNum(totalM2High)} <span className="text-sm font-normal">m²</span>
                </div>
            </div>
        </div>
        <div className="p-0 overflow-x-auto">
            <RankingTable items={highValue} color="purple" />
        </div>
      </div>

      {/* CARD COMBATE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-orange-800 flex items-center gap-2">
                    <Layers size={18} /> Linha de Combate
                </h3>
                <p className="text-xs text-orange-600 mt-1">Abaixo de R$ 300/m²</p>
            </div>
            <div className="text-right">
                <span className="block text-xs font-bold text-orange-400 uppercase">Volume Total</span>
                <div className="text-lg font-bold text-orange-700 leading-tight">
                    {totalCountLow} <span className="text-sm font-normal">pçs</span> <span className="text-orange-300 mx-1">|</span> {fmtNum(totalM2Low)} <span className="text-sm font-normal">m²</span>
                </div>
            </div>
        </div>
        <div className="p-0 overflow-x-auto">
            <RankingTable items={lowValue} color="orange" />
        </div>
      </div>

    </div>
  )
}

// Sub-componente corrigido (sem comentários dentro da TR)
function RankingTable({ items, color }: { items: any[], color: string }) {
    const styles: any = {
        purple: "text-purple-700",
        orange: "text-orange-700"
    }

    return (
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <tr>
                    <th className="p-3 w-10">#</th>
                    <th className="p-3">Material</th>
                    <th className="p-3 text-right">Qtd</th>
                    <th className="p-3 text-right">M²</th>
                    <th className="p-3 text-right">Faturamento</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {items.slice(0, 10).map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-400 text-xs font-bold">{index + 1}</td>
                        <td className="p-3 font-medium text-slate-700 truncate max-w-[150px]" title={item.name}>
                            {item.name}
                        </td>
                        <td className="p-3 text-right text-slate-600 font-bold">
                            {item.count}
                        </td>
                        <td className="p-3 text-right text-slate-500">
                            {item.m2.toFixed(1)}
                        </td>
                        <td className={`p-3 text-right font-bold ${styles[color]}`}>
                            {item.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                    </tr>
                ))}
                {items.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400">Nenhum material nesta categoria.</td></tr>
                )}
            </tbody>
        </table>
    )
}