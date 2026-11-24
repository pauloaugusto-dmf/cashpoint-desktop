// src/main/aiReportGenerator.js
// Gera um relatório financeiro completo em Markdown estruturado otimizado para análise por IA.

function formatBRL(cents) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((cents || 0) / 100);
}

function formatNumberBR(value, decimals = 1) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(partCents, totalCents) {
  if (!totalCents || totalCents <= 0) return '—';
  const pct = (partCents / totalCents) * 100;
  return `${formatNumberBR(pct, 1)}%`;
}

function escapeCell(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function escapeYamlString(value) {
  if (!value) return '""';
  const clean = String(value).replace(/\r?\n/g, ' ').replace(/"/g, '\\"').trim();
  return `"${clean}"`;
}

function formatYearMonth(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function parseYearMonth(ym) {
  if (!ym || typeof ym !== 'string' || !ym.includes('-')) return null;
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return { year: y, monthIndex: m - 1 };
}

function getExpenseCompetence(exp, fallbackDate = new Date()) {
  const parsed = parseYearMonth(exp?.competence_month);
  if (parsed) return parsed;
  if (exp?.created_at) {
    const d = new Date(exp.created_at);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), monthIndex: d.getMonth() };
    }
  }
  return { year: fallbackDate.getFullYear(), monthIndex: fallbackDate.getMonth() };
}

function diffMonthsBetween(targetYear, targetMonthIndex, comp) {
  return (targetYear - comp.year) * 12 + (targetMonthIndex - comp.monthIndex);
}

function getExpensesForMonth(expenses, targetYear, targetMonthIndex, referenceYear, referenceMonthIndex) {
  const list = [];
  const isPastRelativeToRef =
    targetYear < referenceYear ||
    (targetYear === referenceYear && targetMonthIndex < referenceMonthIndex);

  for (const exp of expenses) {
    if (exp.is_active === 0) continue;

    const comp = getExpenseCompetence(exp);
    const diff = diffMonthsBetween(targetYear, targetMonthIndex, comp);

    if (exp.frequency_type === 'recurring') {
      if (diff >= 0) {
        list.push({
          ...exp,
          is_paid: diff === 0 ? exp.is_paid : (isPastRelativeToRef ? 1 : 0),
        });
      }
    } else if (exp.frequency_type === 'installment') {
      if (diff >= 0) {
        const total = exp.total_installments || 1;
        const baseInstallment = exp.current_installment || 1;
        const projected = baseInstallment + diff;
        if (projected <= total) {
          list.push({
            ...exp,
            current_installment: projected,
            is_paid: diff === 0 ? exp.is_paid : (isPastRelativeToRef ? 1 : 0),
          });
        }
      }
    } else if (exp.frequency_type === 'one_time') {
      if (diff === 0) {
        list.push({ ...exp });
      }
    }
  }

  return list;
}

function getRemainingFutureInstallments(exp, targetYear, targetMonthIndex) {
  if (exp.frequency_type !== 'installment' || exp.is_active === 0) return 0;
  const comp = getExpenseCompetence(exp);
  const diff = diffMonthsBetween(targetYear, targetMonthIndex, comp);
  const total = exp.total_installments || 1;
  const baseInstallment = exp.current_installment || 1;

  if (diff < 0) {
    return Math.max(0, total - baseInstallment + 1);
  }
  const projectedInTarget = baseInstallment + diff;
  return Math.max(0, total - projectedInTarget);
}

function formatPaymentMethod(exp) {
  if (exp.target_type === 'card') {
    return exp.credit_card_name ? `Cartão ${exp.credit_card_name}` : 'Cartão de Crédito';
  }
  return exp.account_name ? `Conta ${exp.account_name}` : 'Conta';
}

function translateFrequency(freq) {
  switch (freq) {
    case 'recurring':
      return 'recorrente';
    case 'installment':
      return 'parcelada';
    case 'one_time':
      return 'avulsa';
    default:
      return freq || '—';
  }
}

function translatePriority(priority) {
  switch (priority) {
    case 'urgent':
      return 'urgente';
    case 'high':
      return 'alta';
    case 'medium':
      return 'média';
    case 'low':
      return 'baixa';
    default:
      return priority || 'média';
  }
}

function generateAiFinancialReport(overview, options = {}) {
  const now = new Date();
  const refParsed = parseYearMonth(options.referenceMonth) || {
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  };
  const refYear = refParsed.year;
  const refMonthIndex = refParsed.monthIndex;
  const refMonthStr = formatYearMonth(refYear, refMonthIndex);

  const accounts = overview?.accounts || [];
  const creditCards = overview?.creditCards || [];
  const expenses = overview?.expenses || [];
  const plannedItems = overview?.plannedItems || [];

  const monthlyIncomeCents =
    typeof options.monthlyIncomeCents === 'number' && options.monthlyIncomeCents > 0
      ? Math.round(options.monthlyIncomeCents)
      : null;
  const mainGoal = (options.mainGoal || '').trim();
  const notes = (options.notes || '').trim();

  // Despesas ativas no mês de referência
  const currentMonthExpenses = getExpensesForMonth(expenses, refYear, refMonthIndex, refYear, refMonthIndex);

  // KPIs principais
  const totalBalanceCents = accounts.reduce((sum, a) => sum + (a.balance_cents || 0), 0);
  const monthTotalCents = currentMonthExpenses.reduce((sum, e) => sum + (e.amount_cents || 0), 0);
  const monthPaidCents = currentMonthExpenses
    .filter((e) => e.is_paid === 1)
    .reduce((sum, e) => sum + (e.amount_cents || 0), 0);
  const monthPendingCents = currentMonthExpenses
    .filter((e) => !e.is_paid)
    .reduce((sum, e) => sum + (e.amount_cents || 0), 0);

  const projectedEndOfMonthBalanceCents = totalBalanceCents - monthPendingCents;
  const estimatedMonthlySurplusCents =
    monthlyIncomeCents !== null ? monthlyIncomeCents - monthTotalCents : null;

  const fixedCommitmentCents = currentMonthExpenses
    .filter((e) => e.frequency_type === 'recurring' || e.frequency_type === 'installment')
    .reduce((sum, e) => sum + (e.amount_cents || 0), 0);

  const totalFutureInstallmentDebtCents = expenses
    .filter((e) => e.frequency_type === 'installment' && e.is_active !== 0)
    .reduce((sum, exp) => {
      const rem = getRemainingFutureInstallments(exp, refYear, refMonthIndex);
      return sum + rem * (exp.amount_cents || 0);
    }, 0);

  const totalPlannedCents = plannedItems.reduce((sum, p) => sum + (p.estimated_amount_cents || 0), 0);

  // Descobre o intervalo histórico de meses (do menor competence_month até refMonthStr)
  let earliestComp = { year: refYear, monthIndex: refMonthIndex };
  for (const exp of expenses) {
    const comp = getExpenseCompetence(exp, now);
    if (
      comp.year < earliestComp.year ||
      (comp.year === earliestComp.year && comp.monthIndex < earliestComp.monthIndex)
    ) {
      earliestComp = comp;
    }
  }

  const historicalMonths = [];
  {
    let y = earliestComp.year;
    let m = earliestComp.monthIndex;
    let guard = 0;
    while ((y < refYear || (y === refYear && m <= refMonthIndex)) && guard < 120) {
      historicalMonths.push({ year: y, monthIndex: m, label: formatYearMonth(y, m) });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      guard += 1;
    }
  }

  const scopeRangeStr =
    historicalMonths.length > 1
      ? `${historicalMonths[0].label} a ${refMonthStr}`
      : refMonthStr;

  // Evolução mensal consolidada + acumulador histórico por categoria
  const monthlyEvolution = [];
  const categoryHistoryTotals = new Map();
  let monthsWithExpensesCount = 0;

  for (const hm of historicalMonths) {
    const mExps = getExpensesForMonth(expenses, hm.year, hm.monthIndex, refYear, refMonthIndex);
    const total = mExps.reduce((s, e) => s + (e.amount_cents || 0), 0);
    const rec = mExps
      .filter((e) => e.frequency_type === 'recurring')
      .reduce((s, e) => s + (e.amount_cents || 0), 0);
    const inst = mExps
      .filter((e) => e.frequency_type === 'installment')
      .reduce((s, e) => s + (e.amount_cents || 0), 0);
    const oneTime = mExps
      .filter((e) => e.frequency_type === 'one_time')
      .reduce((s, e) => s + (e.amount_cents || 0), 0);

    if (mExps.length > 0) {
      monthsWithExpensesCount += 1;
      for (const exp of mExps) {
        const catName = exp.category_name || 'Sem Categoria';
        categoryHistoryTotals.set(catName, (categoryHistoryTotals.get(catName) || 0) + (exp.amount_cents || 0));
      }
    }

    monthlyEvolution.push({
      label: hm.label,
      totalCents: total,
      recurringCents: rec,
      installmentCents: inst,
      oneTimeCents: oneTime,
      count: mExps.length,
    });
  }

  // Gastos por categoria no mês atual vs média histórica
  const currentCatTotals = new Map();
  for (const exp of currentMonthExpenses) {
    const catName = exp.category_name || 'Sem Categoria';
    currentCatTotals.set(catName, (currentCatTotals.get(catName) || 0) + (exp.amount_cents || 0));
  }

  const allCategoryNames = new Set([
    ...currentCatTotals.keys(),
    ...categoryHistoryTotals.keys(),
  ]);
  const avgDivisor = Math.max(1, monthsWithExpensesCount);

  const categoryRows = Array.from(allCategoryNames)
    .map((name) => {
      const currentCents = currentCatTotals.get(name) || 0;
      const histTotalCents = categoryHistoryTotals.get(name) || 0;
      const avgCents = Math.round(histTotalCents / avgDivisor);
      let variationStr = '—';
      if (avgCents > 0) {
        const diffPct = ((currentCents - avgCents) / avgCents) * 100;
        const sign = diffPct > 0 ? '+' : '';
        variationStr = `${sign}${formatNumberBR(diffPct, 1)}%`;
      }
      return { name, currentCents, avgCents, variationStr };
    })
    .filter((r) => r.currentCents > 0 || r.avgCents > 0)
    .sort((a, b) => b.currentCents - a.currentCents || b.avgCents - a.avgCents);

  // Cartões de crédito (fatura atual + parcelas futuras comprometidas)
  const cardRows = creditCards.map((card) => {
    const cardCurrentExps = currentMonthExpenses.filter(
      (e) => e.target_type === 'card' && e.credit_card_id === card.id
    );
    const currentInvoiceCents = cardCurrentExps.reduce((s, e) => s + (e.amount_cents || 0), 0);

    const futureInstallmentsCents = expenses
      .filter(
        (e) =>
          e.target_type === 'card' &&
          e.credit_card_id === card.id &&
          e.frequency_type === 'installment' &&
          e.is_active !== 0
      )
      .reduce((s, exp) => {
        const rem = getRemainingFutureInstallments(exp, refYear, refMonthIndex);
        return s + rem * (exp.amount_cents || 0);
      }, 0);

    const totalCommittedCents = currentInvoiceCents + futureInstallmentsCents;
    const limitCents = card.limit_cents || 0;
    const freeLimitCents = Math.max(0, limitCents - totalCommittedCents);
    const usageStr = limitCents > 0 ? formatPercent(totalCommittedCents, limitCents) : '—';

    return {
      name: card.name,
      limitCents,
      currentInvoiceCents,
      futureInstallmentsCents,
      freeLimitCents,
      usageStr,
      closingDay: card.closing_day,
      dueDay: card.due_day,
    };
  });

  // Projeção dos próximos 12 meses (a partir do mês seguinte ao de referência)
  const projectionRows = [];
  for (let offset = 1; offset <= 12; offset++) {
    const d = new Date(refYear, refMonthIndex + offset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const label = formatYearMonth(y, m);
    const mExps = getExpensesForMonth(expenses, y, m, refYear, refMonthIndex);

    const recCents = mExps
      .filter((e) => e.frequency_type === 'recurring')
      .reduce((s, e) => s + (e.amount_cents || 0), 0);
    const instExps = mExps.filter((e) => e.frequency_type === 'installment');
    const instCents = instExps.reduce((s, e) => s + (e.amount_cents || 0), 0);
    const totalCommitted = recCents + instCents;
    const surplusCents = monthlyIncomeCents !== null ? monthlyIncomeCents - totalCommitted : null;

    const endingThisMonth = instExps
      .filter((e) => e.current_installment === (e.total_installments || 1))
      .map((e) => `${escapeCell(e.description)} (${e.current_installment}/${e.total_installments})`);

    projectionRows.push({
      label,
      recCents,
      instCents,
      totalCommitted,
      surplusCents,
      endingStr: endingThisMonth.length > 0 ? endingThisMonth.join(', ') : '—',
    });
  }

  // Compromissos ativos (Recorrentes e Parcelamentos vigentes no mês atual ou futuros)
  const activeCommitments = expenses
    .filter((e) => e.is_active !== 0 && (e.frequency_type === 'recurring' || e.frequency_type === 'installment'))
    .map((exp) => {
      const comp = getExpenseCompetence(exp, now);
      const diff = diffMonthsBetween(refYear, refMonthIndex, comp);
      const total = exp.total_installments || 1;
      const baseInstallment = exp.current_installment || 1;

      if (exp.frequency_type === 'installment') {
        const projected = diff >= 0 ? baseInstallment + diff : baseInstallment;
        if (diff >= 0 && projected > total) {
          return null; // Parcelamento já encerrado antes do mês de referência
        }
        const remainingAfterCurrent = getRemainingFutureInstallments(exp, refYear, refMonthIndex);
        const remainingBalanceCents = remainingAfterCurrent * (exp.amount_cents || 0);
        const inCurrentMonth = currentMonthExpenses.find((ce) => ce.id === exp.id);

        return {
          description: exp.description,
          category: exp.category_name || 'Sem Categoria',
          type: 'parcelada',
          parcelLabel: diff < 0 ? `inicia ${formatYearMonth(comp.year, comp.monthIndex)} (${baseInstallment}/${total})` : `${projected}/${total}`,
          remainingCount: remainingAfterCurrent,
          amountCents: exp.amount_cents || 0,
          remainingBalanceCents,
          method: formatPaymentMethod(exp),
          dueDay: exp.due_day || '—',
          paidInMonth: inCurrentMonth ? (inCurrentMonth.is_paid ? 'sim' : 'não') : 'futuro',
        };
      }

      const inCurrentMonth = currentMonthExpenses.find((ce) => ce.id === exp.id);
      return {
        description: exp.description,
        category: exp.category_name || 'Sem Categoria',
        type: 'recorrente',
        parcelLabel: '—',
        remainingCount: null,
        amountCents: exp.amount_cents || 0,
        remainingBalanceCents: null,
        method: formatPaymentMethod(exp),
        dueDay: exp.due_day || '—',
        paidInMonth: inCurrentMonth ? (inCurrentMonth.is_paid ? 'sim' : 'não') : 'futuro',
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.amountCents - a.amountCents);

  // Histórico completo de lançamentos ordenado por competência DESC e valor DESC
  const sortedAllExpenses = [...expenses].sort((a, b) => {
    const compA = a.competence_month || '';
    const compB = b.competence_month || '';
    if (compA !== compB) return compB.localeCompare(compA);
    return (b.amount_cents || 0) - (a.amount_cents || 0);
  });

  // Montagem do Markdown
  const lines = [];

  // Frontmatter YAML
  lines.push('---');
  lines.push('formato: cashpoint-ai-report/v1');
  lines.push(`gerado_em: ${now.toISOString()}`);
  lines.push(`mes_referencia: ${refMonthStr}`);
  lines.push('moeda: BRL');
  lines.push(`escopo_historico: ${scopeRangeStr}`);
  lines.push(`total_lancamentos: ${expenses.length}`);
  lines.push(
    `renda_mensal_informada: ${monthlyIncomeCents !== null ? (monthlyIncomeCents / 100).toFixed(2) : 'null'}`
  );
  lines.push(`objetivo_principal: ${escapeYamlString(mainGoal || 'Não informado')}`);
  lines.push('---');
  lines.push('');

  lines.push(`# Relatório Financeiro Pessoal — ${refMonthStr}`);
  lines.push('');
  lines.push('> **Guia de leitura para a IA (regras de negócio do Cashpoint):**');
  lines.push('> - Todos os valores estão em **BRL (R$)** (já convertidos de centavos).');
  lines.push('> - Em despesas **parceladas**, o valor exibido é o **valor da parcela mensal**, não o total da compra.');
  lines.push('> - Despesas com `ativa = não` são compromissos pausados/encerrados e **não** entram nos totais do mês nem na projeção futura.');
  lines.push('> - Todos os totais, percentuais e projeções das seções 2 a 8 foram **pré-calculados pelo sistema**; use-os como fonte de verdade numérica.');
  lines.push('');

  // Seção 1: Contexto Pessoal
  lines.push('## 1. Contexto Pessoal');
  lines.push(`- **Renda mensal líquida:** ${monthlyIncomeCents !== null ? formatBRL(monthlyIncomeCents) : 'Não informada'}`);
  lines.push(`- **Objetivo principal:** ${mainGoal || 'Não informado'}`);
  if (notes) {
    lines.push(`- **Observações adicionais:** ${notes.replace(/\r?\n/g, ' ')}`);
  }
  lines.push('');

  // Seção 2: Resumo Executivo
  lines.push(`## 2. Resumo Executivo (${refMonthStr})`);
  lines.push('| Indicador | Valor | % da Renda |');
  lines.push('|---|---:|---:|');
  lines.push(`| Saldo total em contas | ${formatBRL(totalBalanceCents)} | — |`);
  lines.push(`| Total de despesas do mês (ativas) | ${formatBRL(monthTotalCents)} | ${formatPercent(monthTotalCents, monthlyIncomeCents)} |`);
  lines.push(`| — Já pago no mês | ${formatBRL(monthPaidCents)} | ${formatPercent(monthPaidCents, monthlyIncomeCents)} |`);
  lines.push(`| — Pendente no mês | ${formatBRL(monthPendingCents)} | ${formatPercent(monthPendingCents, monthlyIncomeCents)} |`);
  lines.push(`| Saldo projetado ao fim do mês (Saldo - Pendente) | ${formatBRL(projectedEndOfMonthBalanceCents)} | — |`);
  if (estimatedMonthlySurplusCents !== null) {
    lines.push(`| Sobra mensal estimada (Renda - Despesas do mês) | ${formatBRL(estimatedMonthlySurplusCents)} | ${formatPercent(estimatedMonthlySurplusCents, monthlyIncomeCents)} |`);
  }
  lines.push(`| Comprometimento fixo (Recorrentes + Parcelas do mês) | ${formatBRL(fixedCommitmentCents)} | ${formatPercent(fixedCommitmentCents, monthlyIncomeCents)} |`);
  lines.push(`| Dívida futura em parcelas (a partir do próximo mês) | ${formatBRL(totalFutureInstallmentDebtCents)} | — |`);
  lines.push(`| Total de Desejos & Planos cadastrados | ${formatBRL(totalPlannedCents)} | — |`);
  lines.push('');

  // Seção 3: Contas e Liquidez
  lines.push('## 3. Contas e Liquidez');
  if (accounts.length === 0) {
    lines.push('_Nenhuma conta cadastrada._');
  } else {
    lines.push('| Conta | Saldo Atual | Despesas no Mês | Pendente no Mês |');
    lines.push('|---|---:|---:|---:|');
    for (const acc of accounts) {
      const accExps = currentMonthExpenses.filter(
        (e) => e.target_type === 'account' && e.account_id === acc.id
      );
      const accTotal = accExps.reduce((s, e) => s + (e.amount_cents || 0), 0);
      const accPending = accExps.filter((e) => !e.is_paid).reduce((s, e) => s + (e.amount_cents || 0), 0);
      lines.push(
        `| ${escapeCell(acc.name)} | ${formatBRL(acc.balance_cents)} | ${formatBRL(accTotal)} | ${formatBRL(accPending)} |`
      );
    }
  }
  lines.push('');

  // Seção 4: Cartões de Crédito
  lines.push('## 4. Cartões de Crédito (Uso e Limites)');
  if (cardRows.length === 0) {
    lines.push('_Nenhum cartão de crédito cadastrado._');
  } else {
    lines.push('| Cartão | Limite | Fatura Atual | Parcelas Futuras | Limite Livre Est. | Uso (%) | Fecha / Vence |');
    lines.push('|---|---:|---:|---:|---:|---:|---|');
    for (const c of cardRows) {
      lines.push(
        `| ${escapeCell(c.name)} | ${formatBRL(c.limitCents)} | ${formatBRL(c.currentInvoiceCents)} | ${formatBRL(c.futureInstallmentsCents)} | ${formatBRL(c.freeLimitCents)} | ${c.usageStr} | Dia ${c.closingDay} / Dia ${c.dueDay} |`
      );
    }
  }
  lines.push('');

  // Seção 5: Gastos por Categoria
  lines.push('## 5. Gastos por Categoria (Mês Atual vs. Média Histórica)');
  if (categoryRows.length === 0) {
    lines.push('_Sem despesas categorizadas para exibir._');
  } else {
    lines.push('| Categoria | Mês Atual | % do Mês | Média Mensal (Histórico) | Variação |');
    lines.push('|---|---:|---:|---:|---:|');
    for (const r of categoryRows) {
      lines.push(
        `| ${escapeCell(r.name)} | ${formatBRL(r.currentCents)} | ${formatPercent(r.currentCents, monthTotalCents)} | ${formatBRL(r.avgCents)} | ${r.variationStr} |`
      );
    }
  }
  lines.push('');

  // Seção 6: Projeção Futura (12 meses)
  lines.push('## 6. Projeção de Fluxo Futuro (Próximos 12 Meses)');
  lines.push('_Considera apenas despesas recorrentes ativas e parcelas restantes já cadastradas (não inclui futuras compras avulsas)._');
  lines.push('');
  lines.push('| Mês | Recorrentes | Parcelas | Total Comprometido | Sobra Est. (vs. Renda) | Parcelas que Encerram |');
  lines.push('|---|---:|---:|---:|---:|---|');
  for (const p of projectionRows) {
    lines.push(
      `| ${p.label} | ${formatBRL(p.recCents)} | ${formatBRL(p.instCents)} | ${formatBRL(p.totalCommitted)} | ${p.surplusCents !== null ? formatBRL(p.surplusCents) : '—'} | ${p.endingStr} |`
    );
  }
  lines.push('');

  // Seção 7: Evolução Mensal
  lines.push('## 7. Evolução Mensal (Histórico Consolidado)');
  lines.push('| Competência | Total Despesas | Recorrentes | Parcelas | Avulsas | Qtd. Itens |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const m of monthlyEvolution) {
    lines.push(
      `| ${m.label} | ${formatBRL(m.totalCents)} | ${formatBRL(m.recurringCents)} | ${formatBRL(m.installmentCents)} | ${formatBRL(m.oneTimeCents)} | ${m.count} |`
    );
  }
  lines.push('');

  // Seção 8: Desejos & Planos
  lines.push('## 8. Desejos & Planos');
  if (plannedItems.length === 0) {
    lines.push('_Nenhum desejo ou plano cadastrado._');
  } else {
    lines.push('| Prioridade | Item | Categoria | Valor Estimado | Meses de Sobra Est. | Notas |');
    lines.push('|---|---|---|---:|---:|---|');
    for (const p of plannedItems) {
      let monthsToSave = '—';
      if (estimatedMonthlySurplusCents !== null && estimatedMonthlySurplusCents > 0 && p.estimated_amount_cents > 0) {
        monthsToSave = formatNumberBR(p.estimated_amount_cents / estimatedMonthlySurplusCents, 1);
      }
      lines.push(
        `| ${translatePriority(p.priority)} | ${escapeCell(p.name)} | ${escapeCell(p.category_name || 'Sem Categoria')} | ${formatBRL(p.estimated_amount_cents)} | ${monthsToSave} | ${escapeCell(p.notes)} |`
      );
    }
  }
  lines.push('');

  // Seção 9: Compromissos Ativos (Recorrentes e Parcelamentos)
  lines.push('## 9. Compromissos Ativos (Recorrentes e Parcelamentos)');
  if (activeCommitments.length === 0) {
    lines.push('_Nenhum compromisso recorrente ou parcelado ativo._');
  } else {
    lines.push('| Descrição | Categoria | Tipo | Parcela | Restam | Valor Mensal | Saldo Restante | Meio | Venc. | Pago no Mês |');
    lines.push('|---|---|---|---|---:|---:|---:|---|---:|---|');
    for (const c of activeCommitments) {
      lines.push(
        `| ${escapeCell(c.description)} | ${escapeCell(c.category)} | ${c.type} | ${c.parcelLabel} | ${c.remainingCount !== null ? c.remainingCount : '—'} | ${formatBRL(c.amountCents)} | ${c.remainingBalanceCents !== null ? formatBRL(c.remainingBalanceCents) : '—'} | ${escapeCell(c.method)} | ${c.dueDay} | ${c.paidInMonth} |`
      );
    }
  }
  lines.push('');

  // Seção 10: Histórico Completo de Lançamentos
  lines.push('## 10. Histórico Completo de Lançamentos');
  if (sortedAllExpenses.length === 0) {
    lines.push('_Nenhum lançamento cadastrado._');
  } else {
    lines.push('| Competência | Descrição | Categoria | Tipo | Parcela | Valor | Meio | Status | Ativa |');
    lines.push('|---|---|---|---|---|---:|---|---|---|');
    for (const exp of sortedAllExpenses) {
      const compStr = exp.competence_month || formatYearMonth(getExpenseCompetence(exp, now).year, getExpenseCompetence(exp, now).monthIndex);
      const parcelStr =
        exp.frequency_type === 'installment'
          ? `${exp.current_installment || 1}/${exp.total_installments || 1}`
          : '—';
      lines.push(
        `| ${compStr} | ${escapeCell(exp.description)} | ${escapeCell(exp.category_name || 'Sem Categoria')} | ${translateFrequency(exp.frequency_type)} | ${parcelStr} | ${formatBRL(exp.amount_cents)} | ${escapeCell(formatPaymentMethod(exp))} | ${exp.is_paid ? 'pago' : 'pendente'} | ${exp.is_active !== 0 ? 'sim' : 'não'} |`
      );
    }
  }
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  generateAiFinancialReport,
};
