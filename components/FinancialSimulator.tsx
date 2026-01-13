'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCcw, TrendingUp, TrendingDown, Settings, Save, Loader2 } from 'lucide-react'
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
  
  // --- STATE REF (Proteção contra bugs de edição e Identificação de Linha) ---
  const stateRef = useRef({
      id: null as number | null, // Guarda o ID da linha para referência
      simRevenue: grossRevenue,
      simCostChapa: costChapa,
      simCostFreight: costFreight,
      simFixedCost: 85000,
      simOtherVarCost: 0,
      simTaxRate: 6.0,
      simDefaultRate: 1.5,
      simCommissionRate: 0,
      realRevenue: grossRevenue,
      realChapa: costChapa,
      realFreight: costFreight
  })

  // --- ESTADOS VISUAIS ---
  const [globalTax, setGlobalTax] = useState(6.00)
  const [globalDefault, setGlobalDefault] = useState(1.50)
  const [globalCommission, setGlobalCommission] = useState(0)
  const [isSavingGlobal, setIsSavingGlobal] = useState(false)
  
  const [baseFixedCost, setBaseFixedCost] = useState(85000) 
  const [baseOtherVarCost, setBaseOtherVarCost] = useState(0) 

  const [simRevenue, setSimRevenue] = useState(grossRevenue)
  const [simCostChapa, setSimCostChapa] = useState(costChapa)
  const [simCostFreight, setSimCostFreight] = useState(costFreight)
  
  const [simTaxRate, setSimTaxRate] = useState(6.00)
  const [simDefaultRate, setSimDefaultRate] = useState(1.50)
  const [simCommissionRate, setSimCommissionRate] = useState(0)
  
  const [simFixedCost, setSimFixedCost] = useState(85000)
  const [simOtherVarCost, setSimOtherVarCost] = useState(0)

  const [isSaving, setIsSaving] = useState(false) 
  const [isLoading, setIsLoading] = useState(false)

  // Sincronizações de REF (Mantém a REF atualizada com props/states para leituras passivas)
  useEffect(() => {
    stateRef.current.realRevenue = grossRevenue
    stateRef.current.realChapa = costChapa
    stateRef.current.realFreight = costFreight
  }, [grossRevenue, costChapa, costFreight])

  useEffect(() => {
    stateRef.current.simRevenue = simRevenue
    stateRef.current.simCostChapa = simCostChapa
    stateRef.current.simCostFreight = simCostFreight
    stateRef.current.simFixedCost = simFixedCost
    stateRef.current.simOtherVarCost = simOtherVarCost
    stateRef.current.simTaxRate = simTaxRate
    stateRef.current.simDefaultRate = simDefaultRate
    stateRef.current.simCommissionRate = simCommissionRate
  }, [simRevenue, simCostChapa, simCostFreight, simFixedCost, simOtherVarCost, simTaxRate, simDefaultRate, simCommissionRate])

  // 1. CARREGAR DADOS
  useEffect(() => {
    const loadData = async () => {
        if (!monthKey) return
        setIsLoading(true)
        stateRef.current.id = null // Reset ID ao trocar de mês
        
        const { data: { user } } = await supabase.auth.getUser()
        if(!user) return

        // A. Carregar Config Global
        let { data: globalConfig } = await supabase.from('financial_global_config').select('*').eq('user_id', user.id).maybeSingle()
        if (!globalConfig) {
            const defaults = { user_id: user.id, tax_rate: 6.0, default_rate: 1.5, commission_rate: 0 }
            await supabase.from('financial_global_config').insert(defaults)
            globalConfig = defaults
        }
        const gTax = Number(globalConfig.tax_rate)
        const gDef = Number(globalConfig.default_rate)
        const gComm = Number(globalConfig.commission_rate)
        setGlobalTax(gTax); setGlobalDefault(gDef); setGlobalCommission(gComm)

        // B. Carregar Dados do Mês
        const { data: monthDataList } = await supabase
            .from('financial_monthly_data')
            .select('*')
            .eq('month_key', monthKey)
            .order('id', { ascending: false }) 
            .limit(1) 
        
        const monthData = monthDataList && monthDataList.length > 0 ? monthDataList[0] : null
        
        if (monthData) {
            // === DADO ENCONTRADO ===
            stateRef.current.id = monthData.id // Captura o ID existente

            setBaseFixedCost(monthData.fixed_cost !== null ? Number(monthData.fixed_cost) : 85000)
            setBaseOtherVarCost(Number(monthData.variable_cost) || 0)

            setSimTaxRate(monthData.sim_tax_rate ?? gTax)
            setSimDefaultRate(monthData.sim_default_rate ?? gDef)
            setSimCommissionRate(monthData.sim_commission_rate ?? gComm)

            const sFix = monthData.sim_fixed_cost !== null ? Number(monthData.sim_fixed_cost) : (monthData.fixed_cost !== null ? Number(monthData.fixed_cost) : 85000)
            const sVar = monthData.sim_variable_cost !== null ? Number(monthData.sim_variable_cost) : (Number(monthData.variable_cost) || 0)
            
            const sRev = monthData.sim_revenue !== null ? Number(monthData.sim_revenue) : grossRevenue
            const sChapa = monthData.sim_cost_chapa !== null ? Number(monthData.sim_cost_chapa) : costChapa
            const sFreight = monthData.sim_cost_freight !== null ? Number(monthData.sim_cost_freight) : costFreight

            setSimFixedCost(sFix); setSimOtherVarCost(sVar)
            setSimRevenue(sRev); setSimCostChapa(sChapa); setSimCostFreight(sFreight)

        } else {
            // === MÊS NOVO (Criar imediatamente para garantir integridade) ===
            setBaseFixedCost(85000); setBaseOtherVarCost(0)
            setSimTaxRate(gTax); setSimDefaultRate(gDef); setSimCommissionRate(gComm)
            setSimFixedCost(85000); setSimOtherVarCost(0)
            setSimRevenue(grossRevenue); setSimCostChapa(costChapa); setSimCostFreight(costFreight)

            // Tenta criar, mas se já existir (concorrência), não tem problema pois o upsert depois resolve
            const { data: newData } = await supabase.from('financial_monthly_data').insert({
                user_id: user.id, month_key: monthKey,
                tax_rate: gTax, default_rate: gDef, commission_rate: gComm,
                fixed_cost: 85000, variable_cost: 0,
                sim_revenue: grossRevenue, sim_cost_chapa: costChapa, sim_cost_freight: costFreight,
                sim_tax_rate: gTax, sim_default_rate: gDef, sim_commission_rate: gComm,
                sim_fixed_cost: 85000, sim_variable_cost: 0
            }).select().maybeSingle()
            
            if (newData) stateRef.current.id = newData.id
        }
        setIsLoading(false)
    }
    loadData()
  }, [monthKey]) 

  // 2. FUNÇÃO DE SALVAR ROBUSTA (CORRIGIDA)
  const performSave = useCallback(async (updates: any = {}) => {
      if (!monthKey) return
      setIsSaving(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          const current = stateRef.current
          
          const payload: any = {
              user_id: user.id,
              month_key: monthKey,
              
              // Globais
              tax_rate: globalTax, 
              default_rate: globalDefault, 
              commission_rate: globalCommission,

              // Reais (Prioriza update explícito > state)
              fixed_cost: updates.realFix !== undefined ? updates.realFix : baseFixedCost,
              variable_cost: updates.realVar !== undefined ? updates.realVar : baseOtherVarCost,
              
              // Simulados (Prioriza update explícito > ref atual)
              sim_revenue: updates.revenue !== undefined ? updates.revenue : current.simRevenue,
              sim_cost_chapa: updates.chapa !== undefined ? updates.chapa : current.simCostChapa,
              sim_cost_freight: updates.freight !== undefined ? updates.freight : current.simCostFreight,
              sim_fixed_cost: updates.fix !== undefined ? updates.fix : current.simFixedCost,
              sim_variable_cost: updates.otherVar !== undefined ? updates.otherVar : current.simOtherVarCost,
              
              sim_tax_rate: updates.tax !== undefined ? updates.tax : current.simTaxRate,
              sim_default_rate: updates.def !== undefined ? updates.def : current.simDefaultRate,
              sim_commission_rate: updates.comm !== undefined ? updates.comm : current.simCommissionRate
          }

          if (current.id) {
              payload.id = current.id
          }

          // FIX CRÍTICO: Usar 'user_id, month_key' como chave de conflito
          // Isso garante que se o registro já existir, ele será ATUALIZADO, não duplicado.
          const { data, error } = await supabase
              .from('financial_monthly_data')
              .upsert(payload, { onConflict: 'user_id, month_key' }) 
              .select()
              .single()

          if (error) {
              console.error("ERRO AO SALVAR:", error)
          } else if (data && !current.id) {
              stateRef.current.id = data.id
          }
      }
      setTimeout(() => setIsSaving(false), 500)
  }, [monthKey, globalTax, globalDefault, globalCommission, baseFixedCost, baseOtherVarCost])

  // 3. SALVAR GLOBAIS
  const saveGlobalParams = async () => {
      setIsSavingGlobal(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('financial_global_config').upsert({ user_id: user.id, tax_rate: globalTax, default_rate: globalDefault, commission_rate: globalCommission })
      await performSave({ tax: globalTax, def: globalDefault, comm: globalCommission }) 
      setSimTaxRate(globalTax); setSimDefaultRate(globalDefault); setSimCommissionRate(globalCommission)
      setIsSavingGlobal(false)
  }

  // --- HANDLERS (Com atualização direta da Ref + Updates Explícitos) ---
  
  const updateSimVal = (val: number, setter: any, field: string) => {
      setter(val)
      
      // Atualiza Ref imediatamente
      if(field === 'revenue') stateRef.current.simRevenue = val
      if(field === 'chapa') stateRef.current.simCostChapa = val
      if(field === 'freight') stateRef.current.simCostFreight = val
      if(field === 'fix') stateRef.current.simFixedCost = val
      if(field === 'otherVar') stateRef.current.simOtherVarCost = val

      const updates: any = {}
      if(field === 'revenue') updates.revenue = val
      if(field === 'chapa') updates.chapa = val
      if(field === 'freight') updates.freight = val
      if(field === 'fix') updates.fix = val
      if(field === 'otherVar') updates.otherVar = val
      
      performSave(updates)
  }

  const updateSimPct = (val: number, setter: any, field: string) => {
      setter(val)

      if(field === 'tax') stateRef.current.simTaxRate = val
      if(field === 'def') stateRef.current.simDefaultRate = val
      if(field === 'comm') stateRef.current.simCommissionRate = val

      const updates: any = {}
      if(field === 'tax') updates.tax = val
      if(field === 'def') updates.def = val
      if(field === 'comm') updates.comm = val
      performSave(updates)
  }
  
  const updateSimValFromPct = (val: number, setterPct: any, field: string) => {
      const rev = stateRef.current.simRevenue
      const newPct = rev > 0 ? (val / rev) * 100 : 0
      
      setterPct(newPct)

      if(field === 'tax') stateRef.current.simTaxRate = newPct
      if(field === 'def') stateRef.current.simDefaultRate = newPct
      if(field === 'comm') stateRef.current.simCommissionRate = newPct

      const updates: any = {}
      if(field === 'tax') updates.tax = newPct
      if(field === 'def') updates.def = newPct
      if(field === 'comm') updates.comm = newPct
      performSave(updates)
  }

  const handleRealUpdate = (val: number, setter: any, field: 'fix'|'var') => {
      setter(val)
      if(field === 'fix') setBaseFixedCost(val) 
      if(field === 'var') setBaseOtherVarCost(val)
      
      const updates: any = {}
      if(field === 'fix') updates.realFix = val
      if(field === 'var') updates.realVar = val
      
      performSave(updates)
  }

  const resetValues = () => {
      const { realRevenue, realChapa, realFreight } = stateRef.current
      setSimRevenue(realRevenue); setSimCostChapa(realChapa); setSimCostFreight(realFreight)
      setSimTaxRate(globalTax); setSimDefaultRate(globalDefault); setSimCommissionRate(globalCommission)
      setSimFixedCost(baseFixedCost); setSimOtherVarCost(baseOtherVarCost)
      performSave({
          revenue: realRevenue, chapa: realChapa, freight: realFreight,
          tax: globalTax, def: globalDefault, comm: globalCommission,
          fix: baseFixedCost, otherVar: baseOtherVarCost
      })
  }

  // CÁLCULOS DRE
  const calc = (rev: number, chapa: number, freight: number, tax: number, def: number, comm: number, otherVar: number, fix: number) => {
     const safeRev = rev || 0
     const valTax = safeRev * (tax / 100); const valDef = safeRev * (def / 100); const valComm = safeRev * (comm / 100)
     const netRevenue = safeRev - valTax - valDef
     const grossProfit = netRevenue - (chapa || 0) - (freight || 0)
     const contribMargin = grossProfit - valComm - (otherVar || 0)
     const netProfit = contribMargin - (fix || 0)
     const profitPct = safeRev > 0 ? (netProfit / safeRev) * 100 : 0
     return { valTax, valDef, valComm, netRevenue, grossProfit, contribMargin, netProfit, profitPct }
  }

  const real = calc(grossRevenue, costChapa, costFreight, globalTax, globalDefault, globalCommission, baseOtherVarCost, baseFixedCost)
  const sim = calc(simRevenue, simCostChapa, simCostFreight, simTaxRate, simDefaultRate, simCommissionRate, simOtherVarCost, simFixedCost)
  const diffProfit = sim.netProfit - real.netProfit

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md border border-slate-700">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
              <div className="flex items-center gap-2"><Settings className="text-cyan-400" /><div><h3 className="font-bold text-lg">Parâmetros do Cenário Real</h3><p className="text-xs text-slate-400">Alterações aqui aplicam-se a <strong>TODOS</strong> os meses.</p></div></div>
              <button onClick={saveGlobalParams} disabled={isSavingGlobal} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition disabled:opacity-50">{isSavingGlobal ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Salvar Parâmetros Globais</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GlobalInput label="Impostos (%)" value={globalTax} onChange={setGlobalTax} />
              <GlobalInput label="Inadimplência (%)" value={globalDefault} onChange={setGlobalDefault} />
              <GlobalInput label="Comissões (%)" value={globalCommission} onChange={setGlobalCommission} />
          </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
         <div className="flex items-center gap-4"><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">DRE Mês: {monthKey || 'Selecione'}</h2>{isLoading && <Loader2 className="animate-spin text-cyan-600" size={16} />}{isSaving && (<span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1 animate-pulse"><Save size={12} /> Salvando...</span>)}</div>
         <button onClick={resetValues} className="text-sm font-bold text-slate-500 hover:text-cyan-600 flex items-center gap-2"><RefreshCcw size={14} /> Resetar Simulação</button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase py-3 px-4">
              <div className="col-span-4">Descrição</div>
              <div className="col-span-4 text-right pr-4 border-r border-slate-200">Cenário Real (Automático)</div>
              <div className="col-span-4 text-right pl-4 text-cyan-600">Cenário Simulado (Editável)</div>
          </div>

          <DRELine label=" (+) Faturamento Bruto" realVal={grossRevenue} realPct={100} simVal={simRevenue} simPct={100} onSimValChange={(v: number) => updateSimVal(v, setSimRevenue, 'revenue')} isHeader />
          <DRELine label=" (-) Impostos" realVal={real.valTax} realPct={globalTax} simVal={sim.valTax} simPct={simTaxRate} onSimPctChange={(v: number) => updateSimPct(v, setSimTaxRate, 'tax')} onSimValChange={(v: number) => updateSimValFromPct(v, setSimTaxRate, 'tax')} isPercentEditable isNegative />
          <DRELine label=" (-) Inadimplência" realVal={real.valDef} realPct={globalDefault} simVal={sim.valDef} simPct={simDefaultRate} onSimPctChange={(v: number) => updateSimPct(v, setSimDefaultRate, 'def')} onSimValChange={(v: number) => updateSimValFromPct(v, setSimDefaultRate, 'def')} isPercentEditable isNegative />
          <DREResult label=" (=) Receita Líquida" realVal={real.netRevenue} simVal={sim.netRevenue} baseRevenueReal={grossRevenue} baseRevenueSim={simRevenue} />
          <DRELine label=" (-) CMV (Custo Chapa)" realVal={costChapa} realPct={grossRevenue > 0 ? costChapa/grossRevenue*100 : 0} simVal={simCostChapa} simPct={simRevenue > 0 ? simCostChapa/simRevenue*100 : 0} onSimValChange={(v: number) => updateSimVal(v, setSimCostChapa, 'chapa')} onSimPctChange={(v: number) => updateSimVal(v, setSimCostChapa, 'chapa')} isNegative />
          <DRELine label=" (-) Frete" realVal={costFreight} realPct={grossRevenue > 0 ? costFreight/grossRevenue*100 : 0} simVal={simCostFreight} simPct={simRevenue > 0 ? simCostFreight/simRevenue*100 : 0} onSimValChange={(v: number) => updateSimVal(v, setSimCostFreight, 'freight')} onSimPctChange={(v: number) => updateSimVal(v, setSimCostFreight, 'freight')} isNegative />
          <DRELine label=" (-) Comissões" realVal={real.valComm} realPct={globalCommission} simVal={sim.valComm} simPct={simCommissionRate} onSimPctChange={(v: number) => updateSimPct(v, setSimCommissionRate, 'comm')} onSimValChange={(v: number) => updateSimValFromPct(v, setSimCommissionRate, 'comm')} isPercentEditable isNegative />
          <DRELine label=" (-) Outros Custos Variáveis (R$)" realVal={baseOtherVarCost} realPct={grossRevenue > 0 ? baseOtherVarCost/grossRevenue*100 : 0} simVal={simOtherVarCost} simPct={simRevenue > 0 ? simOtherVarCost/simRevenue*100 : 0} onRealValChange={(v: number) => handleRealUpdate(v, setBaseOtherVarCost, 'var')} onSimValChange={(v: number) => updateSimVal(v, setSimOtherVarCost, 'otherVar')} readOnly={!monthKey} isNegative />
          <DREResult label=" (=) Margem de Contribuição" realVal={real.contribMargin} simVal={sim.contribMargin} baseRevenueReal={grossRevenue} baseRevenueSim={simRevenue} isHighlight />
          <DRELine label=" (-) Custos Fixos Mensais" realVal={baseFixedCost} realPct={grossRevenue > 0 ? baseFixedCost/grossRevenue*100 : 0} simVal={simFixedCost} simPct={simRevenue > 0 ? simFixedCost/simRevenue*100 : 0} onRealValChange={(v: number) => handleRealUpdate(v, setBaseFixedCost, 'fix')} onSimValChange={(v: number) => updateSimVal(v, setSimFixedCost, 'fix')} readOnly={!monthKey} isNegative />

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
          <div className={`px-6 py-2 rounded-full font-bold text-sm shadow-sm flex items-center gap-2 ${diffProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Impacto da Simulação: {diffProfit > 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/>} {diffProfit > 0 ? '+' : ''}{diffProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
      </div>
    </div>
  )
}

function GlobalInput({ label, value, onChange }: any) {
    return (
        <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">{label}</label>
            <input type="number" step="0.01" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white font-bold focus:ring-2 focus:ring-cyan-500 outline-none" />
        </div>
    )
}

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

function DRELine({ label, realVal, realPct, simVal, simPct, onRealValChange, onRealPctChange, onSimValChange, onSimPctChange, isHeader, isNegative, readOnly, isPercentEditable }: any) {
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
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if(e.key === 'Enter') { e.currentTarget.blur() } }

    if (isEditing && !readOnly) {
        return <input type="number" step="0.01" autoFocus value={tempValue} onChange={e => setTempValue(parseFloat(e.target.value) || 0)} onBlur={handleBlur} onKeyDown={handleKeyDown} placeholder={placeholder} className={`rounded p-1 focus:ring-2 focus:ring-cyan-500 outline-none border ${className}`} />
    }
    return (
        <div onClick={() => !readOnly && setIsEditing(true)} className={`rounded p-1 truncate transition-colors border ${readOnly ? 'cursor-default' : 'cursor-text hover:border-cyan-300'} ${className}`} title={readOnly ? "Selecione um mês para editar" : "Clique para editar"}>
            {isPercent ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
        </div>
    )
}