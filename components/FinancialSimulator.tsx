'use client'

import { useState, useEffect, useRef } from 'react'
import { Calculator, RefreshCcw, TrendingUp, TrendingDown, DollarSign, Lock, Unlock, MinusCircle, Equal, Save, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '../app/utils/supabase/client'

interface FinancialSimulatorProps {
  grossRevenue?: number
  costChapa?: number
  costFreight?: number
  monthKey: string
}

interface CurrencyInputProps {
  value: number
  onChange: (val: number) => void
  isPercent?: boolean
  className?: string
  readOnly?: boolean
  placeholder?: string
}

export default function FinancialSimulator({ 
  grossRevenue = 0, 
  costChapa = 0, 
  costFreight = 0, 
  monthKey 
}: FinancialSimulatorProps) {
  
  const supabase = createClient()
  
  // --- ESTADOS REAIS (BASE) ---
  const [baseTaxRate, setBaseTaxRate] = useState(6.00) 
  const [baseDefaultRate, setBaseDefaultRate] = useState(1.50) 
  const [baseFixedCost, setBaseFixedCost] = useState(0) 
  const [baseOtherVarCost, setBaseOtherVarCost] = useState(0)

  // --- ESTADOS SIMULADOS ---
  const [simRevenue, setSimRevenue] = useState(grossRevenue)
  const [simCostChapa, setSimCostChapa] = useState(costChapa)
  const [simCostFreight, setSimCostFreight] = useState(costFreight)
  const [simTaxRate, setSimTaxRate] = useState(6.00)
  const [simDefaultRate, setSimDefaultRate] = useState(1.50)
  const [simFixedCost, setSimFixedCost] = useState(0)
  const [simOtherVarCost, setSimOtherVarCost] = useState(0)

  const [isSaving, setIsSaving] = useState(false)
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  // 1. CARREGAR DADOS (REAL E SIMULADO)
  useEffect(() => {
    const loadData = async () => {
        setIsDataLoaded(false)
        if (!monthKey) return
        
        const { data } = await supabase.from('financial_monthly_data').select('*').eq('month_key', monthKey).single()
        
        if (data) {
            // Carrega Real
            setBaseTaxRate(Number(data.tax_rate) || 0)
            setBaseDefaultRate(Number(data.default_rate) || 0)
            setBaseFixedCost(Number(data.fixed_cost) || 0)
            setBaseOtherVarCost(Number(data.variable_cost) || 0)
            
            // Carrega Simulado (Se existir salvo, usa. Se não, espelha o real/csv)
            setSimRevenue(data.sim_revenue !== null ? Number(data.sim_revenue) : grossRevenue)
            setSimCostChapa(data.sim_cost_chapa !== null ? Number(data.sim_cost_chapa) : costChapa)
            setSimCostFreight(data.sim_cost_freight !== null ? Number(data.sim_cost_freight) : costFreight)
            setSimTaxRate(data.sim_tax_rate !== null ? Number(data.sim_tax_rate) : (Number(data.tax_rate) || 0))
            setSimDefaultRate(data.sim_default_rate !== null ? Number(data.sim_default_rate) : (Number(data.default_rate) || 0))
            setSimFixedCost(data.sim_fixed_cost !== null ? Number(data.sim_fixed_cost) : (Number(data.fixed_cost) || 0))
            setSimOtherVarCost(data.sim_variable_cost !== null ? Number(data.sim_variable_cost) : (Number(data.variable_cost) || 0))
        } else {
            // Defaults se mês novo
            setBaseTaxRate(6.0); setBaseDefaultRate(1.5); setBaseFixedCost(0); setBaseOtherVarCost(0);
            setSimRevenue(grossRevenue); setSimCostChapa(costChapa); setSimCostFreight(costFreight);
            setSimTaxRate(6.0); setSimDefaultRate(1.5); setSimFixedCost(0); setSimOtherVarCost(0);
        }
        setIsDataLoaded(true)
    }
    loadData()
  }, [monthKey]) // Removemos as deps de props aqui para evitar overwrite ao navegar, mas atenção abaixo

  // 2. ATUALIZAR QUANDO CSV MUDA (Apenas se não tiver carregado dados customizados ainda)
  // Isso garante que se você mudar de mês, ele obedece o DB. Se mudar o CSV, ele obedece o CSV.
  useEffect(() => {
    if (!isDataLoaded) {
        setSimRevenue(grossRevenue)
        setSimCostChapa(costChapa)
        setSimCostFreight(costFreight)
    }
  }, [grossRevenue, costChapa, costFreight, isDataLoaded])

  // 3. SALVAR TUDO (REAL + SIMULADO)
  // Função centralizada que pega o estado atual + o valor novo que está sendo editado
  const saveAll = async (updates: any) => {
      if (!monthKey) return
      setIsSaving(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      
      // Mescla os valores atuais com as atualizações recebidas
      const payload = {
          user_id: user?.id,
          month_key: monthKey,
          // Real
          tax_rate: updates.baseTaxRate ?? baseTaxRate,
          default_rate: updates.baseDefaultRate ?? baseDefaultRate,
          fixed_cost: updates.baseFixedCost ?? baseFixedCost,
          variable_cost: updates.baseOtherVarCost ?? baseOtherVarCost,
          // Simulado
          sim_revenue: updates.simRevenue ?? simRevenue,
          sim_cost_chapa: updates.simCostChapa ?? simCostChapa,
          sim_cost_freight: updates.simCostFreight ?? simCostFreight,
          sim_tax_rate: updates.simTaxRate ?? simTaxRate,
          sim_default_rate: updates.simDefaultRate ?? simDefaultRate,
          sim_variable_cost: updates.simOtherVarCost ?? simOtherVarCost,
          sim_fixed_cost: updates.simFixedCost ?? simFixedCost
      }

      if (user) {
          await supabase.from('financial_monthly_data').upsert(payload, { onConflict: 'user_id, month_key' })
      }
      setIsSaving(false)
  }

  // --- WRAPPERS DE ATUALIZAÇÃO ---
  
  // Atualiza Real
  const updateBase = (setter: any, val: number, field: string) => {
      setter(val)
      saveAll({ [field]: val })
  }

  // Atualiza Simulado (Valor direto)
  const updateSim = (setter: any, val: number, field: string) => {
      setter(val)
      saveAll({ [field]: val })
  }

  // Atualiza Simulado (Cálculo R$ <-> %)
  // Se mudar %, calcula R$. Se mudar R$, salva R$. O banco guarda R$.
  const handleSimVal = (val: number, setter: any, fieldName: string, type: 'val'|'pct') => {
      let finalVal = 0
      if(type === 'val') {
          finalVal = val
      } else {
          finalVal = simRevenue * (val / 100)
      }
      setter(finalVal)
      
      // Se alterou a RECEITA, precisamos salvar a receita nova
      if (fieldName === 'simRevenue') {
          saveAll({ simRevenue: finalVal })
      } else {
          // Se alterou um custo (ex: chapa), salva o custo
          saveAll({ [fieldName]: finalVal })
      }
  }

  // --- CÁLCULOS ---
  const calculateDRE = (rev: number, chapa: number, freight: number, otherVar: number, tax: number, def: number, fix: number) => {
     const safeRev = rev || 0
     const valTax = safeRev * (tax / 100)
     const valDef = safeRev * (def / 100)
     const netRevenue = safeRev - valTax - valDef
     const totalDirect = (chapa || 0) + (freight || 0)
     const grossProfit = netRevenue - totalDirect
     const contribMargin = grossProfit - (otherVar || 0)
     const marginPct = safeRev > 0 ? (contribMargin / safeRev) * 100 : 0
     const netProfit = contribMargin - (fix || 0)
     const profitPct = safeRev > 0 ? (netProfit / safeRev) * 100 : 0
     return { valTax, valDef, netRevenue, totalDirect, grossProfit, contribMargin, marginPct, netProfit, profitPct }
  }

  const real = calculateDRE(grossRevenue, costChapa, costFreight, baseOtherVarCost, baseTaxRate, baseDefaultRate, baseFixedCost)
  const sim = calculateDRE(simRevenue, simCostChapa, simCostFreight, simOtherVarCost, simTaxRate, simDefaultRate, simFixedCost)

  const diffProfit = sim.netProfit - real.netProfit

  const resetValues = () => {
    // Volta para o estado inicial (Real) e Salva
    setSimRevenue(grossRevenue); 
    setSimCostChapa(costChapa); 
    setSimCostFreight(costFreight);
    setSimOtherVarCost(baseOtherVarCost); 
    setSimTaxRate(baseTaxRate); 
    setSimDefaultRate(baseDefaultRate); 
    setSimFixedCost(baseFixedCost);
    
    saveAll({
        simRevenue: grossRevenue,
        simCostChapa: costChapa,
        simCostFreight: costFreight,
        simOtherVarCost: baseOtherVarCost,
        simTaxRate: baseTaxRate,
        simDefaultRate: baseDefaultRate,
        simFixedCost: baseFixedCost
    })
  }

  const showWarning = (costChapa === 0 && costFreight === 0 && grossRevenue > 0)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
         <div className="flex items-center gap-3">
            <div className="bg-cyan-100 p-2 rounded-lg text-cyan-700"><Calculator size={24} /></div>
            <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    DRE Gerencial Interativo
                    {monthKey && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded border border-green-200">Mês: {monthKey}</span>}
                </h2>
                <p className="text-sm text-slate-500">
                    {monthKey ? 'Todas as alterações (Real e Simulado) são salvas automaticamente.' : 'Selecione um mês no filtro para habilitar o salvamento.'}
                </p>
            </div>
         </div>
         <div className="flex items-center gap-2">
             {isSaving && <span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded"><Loader2 size={12} className="animate-spin"/> Salvando...</span>}
             <button onClick={resetValues} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-cyan-600 px-4 py-2 rounded-lg border hover:border-slate-200 transition">
                <RefreshCcw size={16} /> Resetar Simulação
             </button>
         </div>
      </div>

      {showWarning && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-center gap-2 text-yellow-800 text-sm">
              <AlertCircle size={16}/>
              <span>Atenção: Os custos de Chapa e Frete parecem estar zerados. Limpe o banco (Lixeira) e reenvie a planilha para corrigir.</span>
          </div>
      )}

      {/* --- TABELA DRE --- */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          
          <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase py-3 px-4">
              <div className="col-span-4">Descrição</div>
              <div className="col-span-4 text-right pr-4 border-r border-slate-200">Cenário Real (Base)</div>
              <div className="col-span-4 text-right pl-4 text-cyan-600">Cenário Simulado (Editável)</div>
          </div>

          {/* Faturamento */}
          <DRELine 
             label=" (+) Faturamento Bruto" 
             realVal={grossRevenue} realPct={100} 
             simVal={simRevenue} simPct={100}
             // Ao mudar Receita Simulada, chama handleSimVal passando 'simRevenue' como chave
             onSimValChange={(v) => handleSimVal(v, setSimRevenue, 'simRevenue', 'val')}
             isHeader
          />

          {/* DEDUÇÕES */}
          <DRELine 
             label=" (-) Impostos" 
             realVal={real.valTax} realPct={baseTaxRate} 
             simVal={sim.valTax} simPct={simTaxRate}
             onRealPctChange={(v) => updateBase(setBaseTaxRate, v, 'baseTaxRate')}
             onSimPctChange={(v) => updateSim(setSimTaxRate, v, 'simTaxRate')}
             isPercentEditable readOnly={!monthKey} isNegative
          />
          <DRELine 
             label=" (-) Inadimplência / Devoluções" 
             realVal={real.valDef} realPct={baseDefaultRate} 
             simVal={sim.valDef} simPct={simDefaultRate}
             onRealPctChange={(v) => updateBase(setBaseDefaultRate, v, 'baseDefaultRate')}
             onSimPctChange={(v) => updateSim(setSimDefaultRate, v, 'simDefaultRate')}
             isPercentEditable readOnly={!monthKey} isNegative
          />

          <DREResult label=" (=) Receita Líquida" realVal={real.netRevenue} simVal={sim.netRevenue} baseRevenueReal={grossRevenue} baseRevenueSim={simRevenue} />

          {/* Custos Diretos */}
          <DRELine 
             label=" (-) CMV (Custo Chapa)" 
             realVal={costChapa} realPct={grossRevenue > 0 ? costChapa/grossRevenue*100 : 0} 
             simVal={simCostChapa} simPct={simRevenue > 0 ? simCostChapa/simRevenue*100 : 0}
             onSimValChange={(v) => handleSimVal(v, setSimCostChapa, 'simCostChapa', 'val')}
             onSimPctChange={(v) => handleSimVal(v, setSimCostChapa, 'simCostChapa', 'pct')}
             isNegative
          />
          <DRELine 
             label=" (-) Frete sobre Vendas" 
             realVal={costFreight} realPct={grossRevenue > 0 ? costFreight/grossRevenue*100 : 0} 
             simVal={simCostFreight} simPct={simRevenue > 0 ? simCostFreight/simRevenue*100 : 0}
             onSimValChange={(v) => handleSimVal(v, setSimCostFreight, 'simCostFreight', 'val')}
             onSimPctChange={(v) => handleSimVal(v, setSimCostFreight, 'simCostFreight', 'pct')}
             isNegative
          />

          {/* Variáveis Mensais */}
          <DRELine 
             label=" (-) Outros Custos Variáveis" 
             realVal={baseOtherVarCost} realPct={grossRevenue > 0 ? baseOtherVarCost/grossRevenue*100 : 0} 
             simVal={simOtherVarCost} simPct={simRevenue > 0 ? simOtherVarCost/simRevenue*100 : 0}
             onRealValChange={(v) => updateBase(setBaseOtherVarCost, v, 'baseOtherVarCost')}
             onSimValChange={(v) => handleSimVal(v, setSimOtherVarCost, 'simOtherVarCost', 'val')}
             onSimPctChange={(v) => handleSimVal(v, setSimOtherVarCost, 'simOtherVarCost', 'pct')}
             readOnly={!monthKey} isNegative
          />

          <DREResult label=" (=) Margem de Contribuição" realVal={real.contribMargin} simVal={sim.contribMargin} baseRevenueReal={grossRevenue} baseRevenueSim={simRevenue} isHighlight />

          {/* Fixos Mensais */}
          <DRELine 
             label=" (-) Custos Fixos Mensais" 
             realVal={baseFixedCost} realPct={grossRevenue > 0 ? baseFixedCost/grossRevenue*100 : 0} 
             simVal={simFixedCost} simPct={simRevenue > 0 ? simFixedCost/simRevenue*100 : 0}
             onRealValChange={(v) => updateBase(setBaseFixedCost, v, 'baseFixedCost')}
             onSimValChange={(v) => updateSim(setSimFixedCost, v, 'simFixedCost')}
             readOnly={!monthKey} isNegative
          />

          {/* Lucro Líquido */}
          <div className="grid grid-cols-12 bg-slate-800 text-white py-4 px-4 items-center">
              <div className="col-span-4 font-bold text-sm uppercase">(=) Lucro Líquido</div>
              <div className="col-span-4 flex justify-end gap-3 items-center pr-4 border-r border-slate-600">
                  <span className="text-lg font-bold">{real.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${real.profitPct > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>{real.profitPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
              </div>
              <div className="col-span-4 flex justify-end gap-3 items-center pl-4">
                  <span className="text-lg font-bold text-cyan-300">{sim.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${sim.profitPct > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>{sim.profitPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
              </div>
          </div>
      </div>

      <div className="flex justify-center mt-4">
          <div className={`px-6 py-2 rounded-full font-bold text-sm shadow-sm flex items-center gap-2 ${diffProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              Impacto da Simulação: {diffProfit > 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>} {diffProfit > 0 ? '+' : ''}{diffProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
      </div>
    </div>
  )
}

// --- COMPONENTES AUXILIARES ---

function DREResult({ label, realVal, simVal, baseRevenueReal, baseRevenueSim, isHighlight }: any) {
    const realPct = baseRevenueReal > 0 ? (realVal / baseRevenueReal * 100) : 0
    const simPct = baseRevenueSim > 0 ? (simVal / baseRevenueSim * 100) : 0
    return (
        <div className={`grid grid-cols-12 py-2 px-4 border-b border-slate-100 text-sm ${isHighlight ? 'bg-blue-50 font-bold text-blue-800' : 'bg-slate-50 font-semibold text-slate-600'}`}>
            <div className="col-span-4">{label}</div>
            <div className="col-span-4 text-right pr-4 border-r border-slate-200 flex justify-end gap-4"><span>{realVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><span className="text-xs opacity-70 w-12 text-right">{realPct.toFixed(1)}%</span></div>
            <div className="col-span-4 text-right pl-4 flex justify-end gap-4 text-cyan-700"><span>{simVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><span className="text-xs opacity-70 w-12 text-right">{simPct.toFixed(1)}%</span></div>
        </div>
    )
}

interface DRELineProps {
    label: string
    realVal: number
    realPct: number
    simVal: number
    simPct: number
    onRealValChange?: (val: number) => void
    onRealPctChange?: (val: number) => void
    onSimValChange?: (val: number) => void
    onSimPctChange?: (val: number) => void
    isHeader?: boolean
    isNegative?: boolean
    readOnly?: boolean
    isPercentEditable?: boolean
}

function DRELine({ label, realVal, realPct, simVal, simPct, onRealValChange, onRealPctChange, onSimValChange, onSimPctChange, isHeader, isNegative, readOnly, isPercentEditable }: DRELineProps) {
    const textColor = isHeader ? 'text-slate-800 font-bold' : isNegative ? 'text-red-500' : 'text-slate-600'
    return (
        <div className={`grid grid-cols-12 py-2 px-4 border-b border-slate-100 items-center hover:bg-slate-50 transition-colors`}>
            <div className={`col-span-4 text-sm ${textColor} flex items-center gap-2`}>{label}</div>
            <div className="col-span-4 flex justify-end gap-2 items-center pr-4 border-r border-slate-200">
                {onRealValChange ? <CurrencyInput value={realVal} onChange={onRealValChange} readOnly={readOnly} className={`text-right w-28 text-sm ${readOnly ? 'bg-transparent border-transparent' : 'border-dashed border-slate-300'}`} /> : <span className={`text-sm w-28 text-right ${textColor}`}>{realVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                {onRealPctChange && isPercentEditable ? <CurrencyInput value={realPct} onChange={onRealPctChange} isPercent readOnly={readOnly} className={`text-right w-16 text-xs text-slate-400 ${readOnly ? 'bg-transparent border-transparent' : 'border-dashed border-slate-300'}`} /> : <span className="text-xs text-slate-400 w-16 text-right">{realPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>}
            </div>
            <div className="col-span-4 flex justify-end gap-2 items-center pl-4">
                {onSimValChange ? <CurrencyInput value={simVal} onChange={onSimValChange} className="text-right w-28 text-sm border-cyan-200 bg-cyan-50/20 text-cyan-700 font-medium" /> : <span className="text-sm w-28 text-right text-cyan-700">{simVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                {onSimPctChange ? <CurrencyInput value={simPct} onChange={onSimPctChange} isPercent className="text-right w-16 text-xs text-cyan-600/70 border-cyan-100 bg-cyan-50/20" /> : <span className="text-xs text-cyan-600/70 w-16 text-right">{simPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>}
            </div>
        </div>
    )
}

function CurrencyInput({ value, onChange, isPercent = false, className = '', readOnly = false, placeholder }: CurrencyInputProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [tempValue, setTempValue] = useState(value)
    useEffect(() => { if (!isEditing) setTempValue(value) }, [value, isEditing])
    const handleBlur = () => { setIsEditing(false); onChange(tempValue) }
    
    if (isEditing && !readOnly) {
        return <input type="number" step="0.01" autoFocus value={tempValue} onChange={e => setTempValue(parseFloat(e.target.value) || 0)} onBlur={handleBlur} placeholder={placeholder} className={`rounded p-1 focus:ring-2 focus:ring-cyan-500 outline-none border ${className}`} />
    }
    return (
        <div onClick={() => !readOnly && setIsEditing(true)} className={`rounded p-1 truncate transition-colors border ${readOnly ? 'cursor-default' : 'cursor-text hover:border-cyan-300'} ${className}`} title={readOnly ? "Selecione um mês para editar" : "Clique para editar"}>
            {isPercent ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
        </div>
    )
}