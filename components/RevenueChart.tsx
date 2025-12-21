'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function RevenueChart({ data }: { data: any[] }) {
  
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null

    const grouped: Record<string, { revenue: number, profit: number, sortDate: number }> = {}

    data.forEach(item => {
      const date = new Date(item.sale_date)
      // Agrupa por "Mês/Ano" (ex: out/2023)
      const monthKey = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      const sortTime = new Date(date.getFullYear(), date.getMonth(), 1).getTime()
      
      if (!grouped[monthKey]) grouped[monthKey] = { revenue: 0, profit: 0, sortDate: sortTime }
      
      const net = (item.revenue || 0) - (item.freight || 0)
      grouped[monthKey].revenue += (item.revenue || 0)
      grouped[monthKey].profit += net - (item.cost || 0)
    })

    // Ordenar cronologicamente
    const sortedKeys = Object.keys(grouped).sort((a, b) => grouped[a].sortDate - grouped[b].sortDate)

    return {
      labels: sortedKeys,
      datasets: [
        {
          label: 'Faturamento',
          data: sortedKeys.map(k => grouped[k].revenue),
          borderColor: '#64748b',
          backgroundColor: 'rgba(100, 116, 139, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Lucro Op.',
          data: sortedKeys.map(k => grouped[k].profit),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    }
  }, [data])

  if (!chartData) return null

  return (
    <div className="w-full max-w-7xl mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      <h3 className="font-bold text-slate-700 mb-4">Evolução Financeira</h3>
      <div className="h-[300px] md:h-[400px]">
        <Line 
          data={chartData} 
          options={{ 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
              x: { grid: { display: false } }
            }
          }} 
        />
      </div>
    </div>
  )
}