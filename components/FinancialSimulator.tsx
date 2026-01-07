'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calculator, RefreshCcw, TrendingUp, TrendingDown, Settings, Save, Loader2, AlertCircle } from 'lucide-react'
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
  
  // --- PARÂMETROS GLOBAIS (Config Fixa) ---
  const [globalTax, setGlobalTax] = useState(6.00)
  const [globalDefault, setGlobalDefault] = useState(1.50)
  const [globalCommission, setGlobalCommission] = useState(0)
  const [isSavingGlobal, setIsSavingGlobal] = useState(false)
  
  // Feedback de salvamento do mês
  const [isSavingMonth, setIsSavingMonth] = useState(false)

  // --- DADOS MENSAIS (Custos Fixos/Var R$) ---
  const [baseFixedCost, setBaseFixedCost] = useState(85000) 
  const [baseOtherVarCost, setBaseOtherVarCost] = useState(0) 

  // --- ESTADOS SIMULADOS ---
  const [simRevenue, setSimRevenue] = useState(grossRevenue)
  const [simCostChapa, setSimCostChapa] = useState(costChapa)
  const [simCostFreight, setSimCostFreight] = useState(costFreight)
  
  const [simTaxRate, setSimTaxRate] = useState(6.00)
  const [simDefaultRate, setSimDefaultRate] = useState(1.50)
  const [simCommissionRate, setSimCommissionRate] = useState(0)
  
  const [simFixedCost, setSimFixedCost] = useState(85000)
  const [simOtherVarCost, setSimOtherVarCost] = useState(0)

  // 1. CARREGAR DADOS (E INICIALIZAR REGISTRO SE NECESSÁRIO)
  useEffect(() => {
    const loadData = async () => {
        if (!monthKey) return
        
        const { data: { user } } = await supabase.auth.getUser()
        if(!user) return

        // A. Carregar Config Global
        let { data: globalConfig } = await supabase.from('financial_global_config').select('*').eq('user_id', user.id).single()
        
        if (!globalConfig) {
            const defaults = { user_id: user.id, tax_rate: 6.0, default_rate: 1.5, commission_rate: 0 }
            await supabase.from('financial_global_config').insert(defaults)
            globalConfig = defaults
        }

        const gTax = Number(globalConfig.tax_rate)
        const gDef = Number(globalConfig.default_rate)
        const gComm = Number(globalConfig.commission_rate)

        setGlobalTax(gTax)
        setGlobalDefault(gDef)
        setGlobalCommission(gComm)

        // B. Carregar Dados do Mês Específico
        const { data: monthData } = await supabase.from('financial_monthly_data').select('*').eq('month_key', monthKey).single()
        
        if (monthData) {
            // Se existir no banco, carrega.
            // Se fixed_cost for nulo no banco, assume 85k.
            const loadedFix = monthData.fixed_cost !== null ? Number(monthData.fixed_cost) : 85000
            
            setBaseFixedCost(loadedFix)
            setBaseOtherVarCost(Number(monthData.variable_cost) || 0)
            
            setSimTaxRate(monthData.sim_tax_rate ?? gTax)
            setSimDefaultRate(monthData.sim_default_rate ?? gDef)
            setSimCommissionRate(monthData.sim_commission_rate ?? gComm)
            
            setSimFixedCost(monthData.sim_fixed_cost ?? loadedFix)
            setSimOtherVarCost(monthData.sim_variable_cost ?? (Number(monthData.variable_cost) || 0))
            
            setSimRevenue(monthData.sim_revenue ?? grossRevenue)
            setSimCostChapa(monthData.sim_cost_chapa ?? costChapa)
            setSimCostFreight(monthData.sim_cost_freight ?? costFreight)
        } else {
            // C. MÊS NOVO (Sem registro no banco)
            // Define os padrões
            const defaultFix = 85000
            
            setBaseFixedCost(defaultFix)
            setBaseOtherVarCost(0)
            
            setSimTaxRate(gTax)
            setSimDefaultRate(gDef)
            setSimCommissionRate(gComm)
            setSimRevenue(grossRevenue)
            setSimCostChapa(costChapa)
            setSimCostFreight(costFreight)
            setSimFixedCost(defaultFix)

            // IMPORTANTE: Criar o registro inicial no banco para garantir consistência com a aba Anual
            // Assim que o mês é carregado, ele já "existe" para o relatório anual
            await supabase.from('financial_monthly_data').insert({
                user_id: user.id,
                month_key: monthKey,
                tax_rate: gTax,
                default_rate: gDef,
                commission_rate: gComm,
                fixed_cost: defaultFix,
                variable_cost: 0,
                // Simulado espelha o real inicialmente
                sim_revenue: grossRevenue,
                sim_cost_chapa: costChapa,
                sim_cost_freight: costFreight,
                sim_tax_rate: gTax,
                sim_default_rate: gDef,
                sim_commission_rate: gComm,
                sim_fixed_cost: defaultFix,
                sim_variable_cost: 0
            })
        }
    }
    loadData()
  }, [monthKey, grossRevenue, costChapa, costFreight])

  // 2. SALVAR PARÂMETROS GLOBAIS
  const saveGlobalParams = async () => {
      setIsSavingGlobal(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('financial_global_config').upsert({
          user_id: user.id,
          tax_rate: globalTax,
          default_rate: globalDefault,
          commission_rate: globalCommission
      })

      // Atualiza também o mês atual para refletir a mudança global (opcional, mas recomendado)
      await supabase.from('financial_monthly_data')
        .update({
            tax_rate: globalTax,
            default_rate: globalDefault,
            commission_rate: globalCommission
        })
        .eq('user_id', user.id)
        .eq('month_key', monthKey)

      // Atualiza simulado local
      setSimTaxRate(globalTax)
      setSimDefaultRate(globalDefault)
      setSimCommissionRate(globalCommission)
      
      setIsSavingGlobal(false)
  }

  // 3. FUNÇÃO DE SALVAMENTO ROBUSTA
  // Usamos useCallback para garantir a referência estável
  const saveMonthData = useCallback(async (
      currentFix: number, 
      currentVar: number, 
      simUpdates: any = {}
  ) => {
      if (!monthKey) return
      setIsSavingMonth(true) // Ativa indicador visual

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
          // Resolvemos os valores simulados: ou o update ou o estado atual
          // Nota: Como o estado pode não ter atualizado ainda dentro do closure,
          // passamos os valores críticos via argumento (simUpdates)
          
          const payload = {
              user_id: user.id,
              month_key: monthKey,
              // Dados Reais
              tax_rate: globalTax, 
              default_rate: globalDefault,
              commission_rate: globalCommission,
              fixed_cost: currentFix,
              variable_cost: currentVar,
              
              // Dados Simulados (Se vier no update usa, senão usa o state atual)
              sim_revenue: simUpdates.revenue !== undefined ? simUpdates.revenue : simRevenue,
              sim_cost_chapa: simUpdates.chapa !== undefined ? simUpdates.chapa : simCostChapa,
              sim_cost_freight: simUpdates.freight !== undefined ? simUpdates.freight : simCostFreight,
              sim_tax_rate: simUpdates.tax !== undefined ? simUpdates.tax : simTaxRate,
              sim_default_rate: simUpdates.def !== undefined ? simUpdates.def : simDefaultRate,
              sim_commission_rate: simUpdates.comm !== undefined ? simUpdates.comm : simCommissionRate,
              sim_fixed_cost: simUpdates.fix !== undefined ? simUpdates.fix : simFixedCost,
              sim_variable_cost: simUpdates.otherVar !== undefined ? simUpdates.otherVar : simOtherVarCost
          }

          await supabase.from('financial_monthly_data').upsert(payload, { onConflict: 'user_id, month_key' })
      }
      
      // Pequeno delay para o usuário ver que salvou
      setTimeout(() => setIsSavingMonth(false), 600)

  }, [monthKey, globalTax, globalDefault, globalCommission, simRevenue, simCostChapa, simCostFreight, simTaxRate, simDefaultRate, simCommissionRate, simFixedCost, simOtherVarCost])

  // --- CÁLCULOS DRE ---
  const calculateDRE = (
      rev: number, chapa: number, freight: number, 
      tax: number, def: number, comm: number, 
      otherVarInfo: number, fix: number
  ) => {
     const safeRev = rev || 0
     
     const valTax = safeRev * (tax / 100)
     const valDef = safeRev * (def / 100)
     const netRevenue = safeRev - valTax - valDef
     
     const valComm = safeRev * (comm / 100)
     
     const grossProfit = netRevenue - (chapa || 0) - (freight || 0)
     const finalContribMargin = grossProfit - valComm - (otherVarInfo || 0)

     const marginPct = safeRev > 0 ? (finalContribMargin / safeRev) * 100 : 0
     const netProfit = finalContribMargin - (fix || 0)
     const profitPct = safeRev > 0 ? (netProfit / safeRev) * 100 : 0

     return { valTax, valDef, valComm, netRevenue, grossProfit, contribMargin: finalContribMargin, marginPct, netProfit, profitPct }
  }

  const real = calculateDRE(grossRevenue, costChapa, costFreight, globalTax, globalDefault, globalCommission, baseOtherVarCost, baseFixedCost)
  const sim = calculateDRE(simRevenue, simCostChapa, simCostFreight, simTaxRate, simDefaultRate, simCommissionRate, simOtherVarCost, simFixedCost)

  const diffProfit = sim.netProfit - real.netProfit

  // --- HANDLERS (Com Salvamento Imediato) ---

  const handleSimVal = (val: number, setter: any, type: 'val'|'pct', field: string) => {
      const finalVal = type === 'val' ? val : simRevenue * (val / 100)
      setter(finalVal)
      
      // Prepara objeto de update
      const updates: any = {}
      if(field === 'revenue') updates.revenue = finalVal
      if(field === 'chapa') updates.chapa = finalVal
      if(field === 'freight') updates.freight = finalVal
      if(field === 'otherVar') updates.otherVar = finalVal
      if(field === 'fix') updates.fix = finalVal
      
      saveMonthData(baseFixedCost, baseOtherVarCost, updates)
  }
  
  const handleSimPct = (val: number, setter: any, field: string) => {
      setter(val)
      const updates: any = {}
      if(field === 'tax') updates.tax = val
      if(field === 'def') updates.def = val
      if(field === 'comm') updates.comm = val
      saveMonthData(baseFixedCost, baseOtherVarCost, updates)
  }

  const handleSimValForRate = (val: number, setterPct: any, field: string) => {
      const newPct = simRevenue > 0 ? (val / simRevenue) * 100 : 0
      setterPct(newPct)
      const updates: any = {}
      if(field === 'tax') updates.tax = newPct
      if(field === 'def') updates.def = newPct
      if(field === 'comm') updates.comm = newPct
      saveMonthData(baseFixedCost, baseOtherVarCost, updates)
  }

  const handleRealMonthUpdate = (val: number, setter: any, field: 'fix'|'var') => {
      setter(val)
      // Atualiza o valor local E salva no banco
      const newFix = field === 'fix' ? val : baseFixedCost
      const newVar = field === 'var' ? val : baseOtherVarCost
      saveMonthData(newFix, newVar)
  }

  const resetValues = () => {
      setSimRevenue(grossRevenue); setSimCostChapa(costChapa); setSimCostFreight(costFreight);
      setSimTaxRate(globalTax); setSimDefaultRate(globalDefault); setSimCommissionRate(globalCommission);
      // Reseta para os valores reais atuais
      setSimFixedCost(baseFixedCost); setSimOtherVarCost(baseOtherVarCost);
      
      saveMonthData(baseFixedCost, baseOtherVarCost, {
          revenue: grossRevenue, chapa: costChapa, freight: costFreight,
          tax: globalTax, def: globalDefault, comm: globalCommission,
          fix: baseFixedCost, otherVar: baseOtherVarCost
      })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      
      {/* SEÇÃO FIXA */}
      <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md border border-slate-700">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                  <Settings className="text-cyan-400" />
                  <div>
                      <h3 className="font-bold text-lg">Parâmetros do Cenário Real</h3>
                      <p className="text-xs text-slate-400">Alterações aqui aplicam-se a <strong>TODOS</strong> os meses (passados e futuros).</p>
                  </div>
              </div>
              <button 
                onClick={saveGlobalParams} 
                disabled={isSavingGlobal}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
              >
                  {isSavingGlobal ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                  Salvar Parâmetros Globais
              </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GlobalInput label="Impostos (%)" value={globalTax} onChange={setGlobalTax} />
              <GlobalInput label="Inadimplência (%)" value={globalDefault} onChange={setGlobalDefault} />
              <GlobalInput label="Comissões (%)" value={globalCommission} onChange={setGlobalCommission} />
          </div>
      </div>

      {/* HEADER DO MÊS */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
         <div className="flex items-center gap-4">
             <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 DRE Mês: {monthKey || 'Selecione'}
             </h2>
             {/* INDICADOR VISUAL DE SALVAMENTO */}
             {isSavingMonth && (
                 <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1 animate-pulse">
                     <Save size={12} /> Salvando...
                 </span>
             )}
         </div>
         <button onClick={resetValues} className="text-sm font-bold text-slate-500 hover:text-cyan-600 flex items-center gap-2">
            <RefreshCcw size={14} /> Resetar Simulação
         </button>
      </div>

      {/* --- TABELA DRE --- */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          
          <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase py-3 px-4">
              <div className="col-span-4">Descrição</div>
              <div className="col-span-4 text-right pr-4 border-r border-slate-200">Cenário Real (Automático)</div>
              <div className="col-span-4 text-right pl-4 text-cyan-600">Cenário Simulado (Editável)</div>
          </div>

          <DRELine 
             label=" (+) Faturamento Bruto" 
             realVal={grossRevenue} realPct={100} 
             simVal={simRevenue} simPct={100}
             onSimValChange={(v: number) => handleSimVal(v, setSimRevenue, 'val', 'revenue')}
             isHeader
          />

          <DRELine 
             label=" (-) Impostos" 
             realVal={real.valTax} realPct={globalTax} 
             simVal={sim.valTax} simPct={simTaxRate}
             onSimPctChange={(v: number) => handleSimPct(v, setSimTaxRate, 'tax')}
             onSimValChange={(v: number) => handleSimValForRate(v, setSimTaxRate, 'tax')}
             isPercentEditable isNegative
          />
          <DRELine 
             label=" (-) Inadimplência" 
             realVal={real.valDef} realPct={globalDefault} 
             simVal={sim.valDef} simPct={simDefaultRate}
             onSimPctChange={(v: number) => handleSimPct(v, setSimDefaultRate, 'def')}
             onSimValChange={(v: number) => handleSimValForRate(v, setSimDefaultRate, 'def')}
             isPercentEditable isNegative
          />

          <DREResult label=" (=) Receita Líquida" realVal={real.netRevenue} simVal={sim.netRevenue} baseRevenueReal={grossRevenue} baseRevenueSim={simRevenue} />

          <DRELine 
             label=" (-) CMV (Custo Chapa)" 
             realVal={costChapa} realPct={grossRevenue > 0 ? costChapa/grossRevenue*100 : 0} 
             simVal={simCostChapa} simPct={simRevenue > 0 ? simCostChapa/simRevenue*100 : 0}
             onSimValChange={(v: number) => handleSimVal(v, setSimCostChapa, 'val', 'chapa')}
             onSimPctChange={(v: number) => handleSimVal(v, setSimCostChapa, 'pct', 'chapa')}
             isNegative
          />
          <DRELine 
             label=" (-) Frete" 
             realVal={costFreight} realPct={grossRevenue > 0 ? costFreight/grossRevenue*100 : 0} 
             simVal={simCostFreight} simPct={simRevenue > 0 ? simCostFreight/simRevenue*100 : 0}
             onSimValChange={(v: number) => handleSimVal(v, setSimCostFreight, 'val', 'freight')}
             onSimPctChange={(v: number) => handleSimVal(v, setSimCostFreight, 'pct', 'freight')}
             isNegative
          />
          
          <DRELine 
             label=" (-) Comissões" 
             realVal={real.valComm} realPct={globalCommission} 
             simVal={sim.valComm} simPct={simCommissionRate}
             onSimPctChange={(v: number) => handleSimPct(v, setSimCommissionRate, 'comm')}
             onSimValChange={(v: number) => handleSimValForRate(v, setSimCommissionRate, 'comm')}
             isPercentEditable isNegative
          />

          <DRELine 
             label=" (-) Outros Custos Variáveis (R$)" 
             realVal={baseOtherVarCost} realPct={grossRevenue > 0 ? baseOtherVarCost/grossRevenue*100 : 0} 
             simVal={simOtherVarCost} simPct={simRevenue > 0 ? simOtherVarCost/simRevenue*100 : 0}
             onRealValChange={(v: number) => handleRealMonthUpdate(v, setBaseOtherVarCost, 'var')}
             onSimValChange={(v: number) => handleSimVal(v, setSimOtherVarCost, 'val', 'otherVar')}
             readOnly={!monthKey} isNegative
          />

          <DREResult label=" (=) Margem de Contribuição" realVal={real.contribMargin} simVal={sim.contribMargin} baseRevenueReal={grossRevenue} baseRevenueSim={simRevenue} isHighlight />

          <DRELine 
             label=" (-) Custos Fixos Mensais" 
             realVal={baseFixedCost} realPct={grossRevenue > 0 ? baseFixedCost/grossRevenue*100 : 0} 
             simVal={simFixedCost} simPct={simRevenue > 0 ? simFixedCost/simRevenue*100 : 0}
             onRealValChange={(v: number) => handleRealMonthUpdate(v, setBaseFixedCost, 'fix')}
             onSimValChange={(v: number) => handleSimVal(v, setSimFixedCost, 'val', 'fix')}
             readOnly={!monthKey} isNegative
          />

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

// --- SUB-COMPONENTES ---

function GlobalInput({ label, value, onChange }: any) {
    return (
        <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
            <label className="text-xs font-bold text-slate-300 uppercase block mb-1">{label}</label>
            <input 
                type="number" 
                step="0.01"
                value={value}
                onChange={e => onChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white font-bold focus:ring-2 focus:ring-cyan-500 outline-none"
            />
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

// CORREÇÃO: Tipagem do evento no handleKeyDown para aceitar o elemento Input
function CurrencyInput({ value, onChange, isPercent = false, className = '', readOnly = false, placeholder }: CurrencyInputProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [tempValue, setTempValue] = useState(value)
    
    useEffect(() => { if (!isEditing) setTempValue(value) }, [value, isEditing])
    
    const handleBlur = () => { setIsEditing(false); onChange(tempValue) }
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { 
        if(e.key === 'Enter') { 
            e.currentTarget.blur() 
        } 
    }

    if (isEditing && !readOnly) {
        return <input type="number" step="0.01" autoFocus value={tempValue} onChange={e => setTempValue(parseFloat(e.target.value) || 0)} onBlur={handleBlur} onKeyDown={handleKeyDown} placeholder={placeholder} className={`rounded p-1 focus:ring-2 focus:ring-cyan-500 outline-none border ${className}`} />
    }
    return (
        <div onClick={() => !readOnly && setIsEditing(true)} className={`rounded p-1 truncate transition-colors border ${readOnly ? 'cursor-default' : 'cursor-text hover:border-cyan-300'} ${className}`} title={readOnly ? "Selecione um mês para editar" : "Clique para editar"}>
            {isPercent ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
        </div>
    )
}