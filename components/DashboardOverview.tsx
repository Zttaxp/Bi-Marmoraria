'use client'

import { DollarSign, TrendingUp, Package, Truck } from 'lucide-react'

// Agora aceita 'data' como propriedade vinda do pai
export default function DashboardOverview({ data }: { data: any[] }) {
  
  // Se não tiver dados ainda, não quebra
  if (!data || data.length === 0) {
    return <div className="text-center text-slate-400 py-10">Carregando indicadores...</div>
  }

  // Cálculos feitos com TODOS os 16.000 registros
  const totalRevenue = data.reduce((acc, curr) => acc + (curr.revenue || 0), 0)
  const totalCost = data.reduce((acc, curr) => acc + (curr.cost || 0), 0)
  const totalFreight = data.reduce((acc, curr) => acc + (curr.freight || 0), 0)
  
  // Lucro Bruto Estimado (Sem descontar taxas do simulador ainda)
  const estimatedProfit = totalRevenue - totalCost - totalFreight
  
  // Ticket Médio Real
  const ticket = data.length > 0 ? totalRevenue / data.length : 0

  const fmt = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card title="Faturamento Bruto" value={fmt(totalRevenue)} icon={<DollarSign size={20}/>} color="blue" />
      <Card title="Fretes (Repasse)" value={fmt(totalFreight)} icon={<Truck size={20}/>} color="orange" />
      <Card title="Lucro Operacional" value={fmt(estimatedProfit)} icon={<TrendingUp size={20}/>} color="green" />
      <Card title="Ticket Médio" value={fmt(ticket)} icon={<Package size={20}/>} color="purple" />
    </div>
  )
}

function Card({ title, value, icon, color }: any) {
  const colors: any = {
    blue: "border-blue-500 text-blue-600 bg-blue-50",
    orange: "border-orange-400 text-orange-600 bg-orange-50",
    green: "border-green-500 text-green-600 bg-green-50",
    purple: "border-purple-500 text-purple-600 bg-purple-50"
  }
  
  return (
    <div className={`bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 ${colors[color].split(' ')[0]}`}>
      <div className="flex justify-between items-start">
          <div>
              <p className="text-xs font-bold text-slate-400 uppercase">{title}</p>
              <p className="text-xl md:text-2xl font-bold text-slate-800 mt-1 truncate" title={value}>{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${colors[color].split(' ').slice(1).join(' ')}`}>{icon}</div>
      </div>
    </div>
  )
}