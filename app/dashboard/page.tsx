'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import { Bar } from 'react-chartjs-2'
// Importar registros do Chart.js...

export default function Dashboard() {
  const [sales, setSales] = useState([])
  const [kpis, setKpis] = useState({ gross: 0, profit: 0 })
  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // Busca dados do Supabase
    const { data } = await supabase.from('sales_records').select('*')
    if (data) {
      setSales(data)
      calculateKPIs(data)
    }
  }

  function calculateKPIs(data: any[]) {
    // Sua lógica de reduce aqui
    const totalRevenue = data.reduce((acc, curr) => acc + curr.revenue, 0)
    setKpis({ gross: totalRevenue, profit: totalRevenue * 0.2 }) // Exemplo simplificado
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Visão Geral</h1>
      
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded shadow border-l-4 border-blue-500">
          <p className="text-gray-500">Faturamento Bruto</p>
          <p className="text-2xl font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.gross)}
          </p>
        </div>
        {/* Outros Cards */}
      </div>

      <div className="h-64 bg-white p-4 rounded shadow">
        {/* Componente do Gráfico Chart.js aqui */}
        <p>Gráfico de Evolução</p>
      </div>
    </div>
  )
}