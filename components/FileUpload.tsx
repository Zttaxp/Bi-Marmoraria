'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '../app/utils/supabase/client'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function FileUpload() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const supabase = createClient()

  // Função auxiliar para encontrar colunas (insensível a maiúsculas/minúsculas)
  const getKey = (row: any, candidates: string[]): string | undefined => {
    const rowKeys = Object.keys(row)
    // Busca exata primeiro
    const exact = rowKeys.find(k => k.trim().toLowerCase() === candidates.find(c => c.toLowerCase() === k.trim().toLowerCase())?.toLowerCase())
    if (exact) return exact

    // Busca parcial
    for (const candidate of candidates) {
      const match = rowKeys.find(k => k.trim().toLowerCase().includes(candidate.toLowerCase()))
      if (match) return match
    }
    return undefined
  }

  // Função para limpar números (R$ 1.200,50 -> 1200.50)
  const cleanNum = (val: any) => {
    if (typeof val === 'number') return val
    if (!val) return 0
    // Remove tudo que não é número, ponto, vírgula ou traço
    let str = String(val).replace(/[^\d.,-]/g, '')
    // Se tiver vírgula, substitui por ponto para o JS entender
    str = str.replace(',', '.')
    return parseFloat(str) || 0
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setStatus('idle')
    setMsg('Autenticando...')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Sessão expirada. Faça login novamente.")

      setMsg('Lendo planilha...')
      const buffer = await file.arrayBuffer()
      
      // Lê o arquivo (CSV ou Excel)
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) throw new Error("A planilha está vazia.")

      const formattedData = jsonData.map((row: any) => {
        // 1. Mapeamento das Colunas (Baseado no seu CSV)
        const keyDate = getKey(row, ['DataVenda', 'Data', 'Emissao'])
        const keySeller = getKey(row, ['Vendedor', 'VendedorNome'])
        const keyClient = getKey(row, ['Cliente', 'ClienteNome'])
        const keyMaterial = getKey(row, ['Material', 'Produto', 'Descricao'])
        
        const keyM2 = getKey(row, ['Total_M2_Venda', 'M2', 'Qtd'])
        const keyCusto = getKey(row, ['CustoTotalM2', 'Custo', 'CMV'])
        
        // COLUNAS CRÍTICAS PARA A REGRA DE NEGÓCIO
        const keyBruto = getKey(row, ['PrecoTotalBruto', 'ValorBruto'])
        const keyUnit = getKey(row, ['PrecoUnit', 'ValorUnit', 'ValorLiquido']) 

        // Se não tiver data, ignora a linha
        if (!keyDate) return null

        // 2. Extração dos Valores Brutos
        const valBruto = cleanNum(keyBruto ? row[keyBruto] : 0)
        // Se não achar a coluna PrecoUnit, tenta usar o Bruto como fallback para evitar zero
        const valUnit = cleanNum(keyUnit ? row[keyUnit] : valBruto) 
        
        // 3. APLICAÇÃO DA REGRA DE NEGÓCIO (Sua solicitação)
        let finalRevenue = 0
        let finalFreight = 0
        
        if (valBruto > valUnit) {
            // Caso 1: Diferença é FRETE. Valor da chapa é o PrecoUnit.
            finalFreight = valBruto - valUnit
            finalRevenue = valUnit
        } else {
            // Caso 2: Diferença é DESCONTO (Bruto < Unit) ou são iguais.
            // Valor da chapa é o PrecoTotalBruto. Frete é zero.
            finalFreight = 0
            finalRevenue = valBruto
        }

        // Tratamento de Data
        const rawDate = row[keyDate]
        // Tenta converter formatos de data do Excel ou Texto
        let date
        if (rawDate instanceof Date) {
            date = rawDate
        } else {
            // Tenta forçar formato brasileiro se for string
            const dateStr = String(rawDate)
            if(dateStr.includes('/')) {
                const parts = dateStr.split('/') // dia/mes/ano
                if(parts.length === 3) date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                else date = new Date(dateStr)
            } else {
                date = new Date(dateStr)
            }
        }
        
        if (isNaN(date.getTime())) date = new Date() // Fallback para hoje se falhar

        // Cálculo de métricas secundárias
        const m2Total = cleanNum(keyM2 ? row[keyM2] : 0)
        const totalCost = cleanNum(keyCusto ? row[keyCusto] : 0) // CMV Total da linha
        const pricePerM2 = m2Total > 0 ? finalRevenue / m2Total : 0

        return {
          user_id: user.id,
          sale_date: date,
          seller_name: String((keySeller ? row[keySeller] : '') || 'Desconhecido').trim().toUpperCase(),
          client_name: String((keyClient ? row[keyClient] : '') || 'Consumidor').trim(),
          material_name: String((keyMaterial ? row[keyMaterial] : '') || 'Indefinido').trim(),
          
          revenue: finalRevenue,  // Faturamento Real (Já descontado frete ou desconto)
          cost: totalCost,        // CMV
          freight: finalFreight,  // Valor do Frete (se houver)
          m2_total: m2Total,
          
          // Classificação Automática
          sale_type: pricePerM2 >= 300 ? 'HIGH' : 'LOW'
        }
      }).filter(item => item !== null)

      setMsg(`Salvando ${formattedData.length} vendas na nuvem...`)
      
      const BATCH_SIZE = 1000
      for (let i = 0; i < formattedData.length; i += BATCH_SIZE) {
        const batch = formattedData.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('sales_records').insert(batch)
        if (error) throw error
        setMsg(`Processando... ${(i/formattedData.length * 100).toFixed(0)}%`)
      }

      setStatus('success')
      setMsg(`${formattedData.length} vendas importadas com sucesso!`)

      setTimeout(() => {
         window.location.reload()
      }, 1500)

    } catch (err: any) {
      console.error(err)
      setStatus('error')
      setMsg(err.message || "Erro desconhecido")
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className={`
        relative border border-dashed rounded-lg p-4 text-center transition-all
        ${status === 'error' ? 'border-red-300 bg-red-50' : 'border-slate-300 hover:border-cyan-500 bg-white'}
      `}>
        <input 
          type="file" 
          accept=".xlsx, .csv, .xls" 
          onChange={handleFileUpload}
          disabled={loading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        
        <div className="flex flex-col items-center justify-center space-y-2">
          {loading ? (
            <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : status === 'error' ? (
            <AlertCircle className="w-6 h-6 text-red-500" />
          ) : (
            <Upload className="w-6 h-6 text-slate-400" />
          )}

          <div className="text-xs font-bold text-slate-600">
            {loading ? 'Processando...' : 'Carregar Planilha CSV'}
          </div>
          
          {msg && (
            <p className={`text-[10px] ${status === 'error' ? 'text-red-600' : status === 'success' ? 'text-green-600' : 'text-slate-400'}`}>
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}