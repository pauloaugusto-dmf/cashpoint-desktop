import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  CreditCard,
  TrendingDown,
  Plus,
  Pencil,
  CheckCircle2,
  Circle,
  Trash2,
  Download,
  Upload,
  Minus,
  Square,
  X,
  PieChart,
  Repeat,
  Layers,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  DollarSign,
  PauseCircle,
  PlayCircle
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

// Helper de formatação de moeda em BRL
const formatBRL = (cents) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((cents || 0) / 100);
};

// Helper de conversão de input em BRL para centavos
const parseBRLInputToCents = (val) => {
  if (typeof val === 'number') return Math.round(val * 100);
  if (!val) return 0;
  let str = String(val).trim();
  const isNegative = str.includes('-');
  str = str.replace(/[^0-9,\.]/g, '');
  if (!str) return 0;
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return Math.round((isNegative ? -num : num) * 100);
};

// Formata data para YYYY-MM
const formatYearMonth = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

// Obtém { year, monthIndex } de competência da despesa com fallback
const getExpenseCompetence = (exp) => {
  if (exp?.competence_month && typeof exp.competence_month === 'string' && exp.competence_month.includes('-')) {
    const [y, m] = exp.competence_month.split('-').map(Number);
    return { year: y, monthIndex: m - 1 };
  }
  if (exp?.created_at) {
    const d = new Date(exp.created_at);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), monthIndex: d.getMonth() };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
};

// Formata YYYY-MM para "Novembro de 2026"
const formatCompetenceLabel = (yearMonthStr) => {
  if (!yearMonthStr || !yearMonthStr.includes('-')) return '';
  const [y, m] = yearMonthStr.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const name = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

// Paleta de cores padrão para categorias
const PRESET_CATEGORY_COLORS = [
  '#f97316', // Laranja
  '#fb923c', // Laranja Claro
  '#eab308', // Amarelo
  '#84cc16', // Lima
  '#10b981', // Esmeralda
  '#14b8a6', // Teal
  '#06b6d4', // Ciano
  '#3b82f6', // Azul
  '#6366f1', // Índigo
  '#8b5cf6', // Violeta
  '#a855f7', // Roxo
  '#d946ef', // Fúcsia
  '#ec4899', // Rosa
  '#f43f5e', // Rose
  '#64748b', // Ardósia
  '#6b7280'  // Cinza
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [expenseFilter, setExpenseFilter] = useState('all'); // 'all' | 'recurring' | 'installment' | 'one_time'
  const [monthOffset, setMonthOffset] = useState(0); // 0 = Mês atual, 1 = Próximo mês, -1 = Mês passado
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({
    accounts: [],
    creditCards: [],
    categories: [],
    expenses: []
  });

  // Modais
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Estados de Edição
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryModalReturnToExpense, setCategoryModalReturnToExpense] = useState(false);

  // Forms
  const [accountForm, setAccountForm] = useState({ name: '', balance_reais: '' });
  const [cardForm, setCardForm] = useState({ name: '', limit_reais: '', closing_day: 1, due_day: 10 });
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '#10b981' });
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount_reais: '',
    amount_mode: 'installment', // 'installment' ou 'total'
    target_type: 'card', // 'card' ou 'account'
    account_id: '',
    credit_card_id: '',
    category_id: '',
    frequency_type: 'one_time', // 'one_time' | 'installment' | 'recurring'
    current_installment: 1,
    total_installments: 12,
    due_day: 10,
    is_paid: false,
    competence_month: ''
  });

  // Carregar dados
  const loadData = async () => {
    try {
      if (window.api?.getOverview) {
        const data = await window.api.getOverview();
        setOverview(data);
      } else {
        // Fallback mockup
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        setOverview({
          accounts: [
            { id: 1, name: 'Nubank Principal', balance_cents: 350050 },
            { id: 2, name: 'Inter Reserva', balance_cents: 1200000 }
          ],
          creditCards: [
            { id: 1, name: 'Nubank Ultravioleta', limit_cents: 1500000, closing_day: 25, due_day: 2 }
          ],
          categories: [
            { id: 1, name: 'Alimentação', color: '#f97316' },
            { id: 2, name: 'Supermercado', color: '#fb923c' },
            { id: 3, name: 'Moradia & Contas', color: '#3b82f6' },
            { id: 4, name: 'Transporte & Combustível', color: '#eab308' },
            { id: 5, name: 'Saúde & Farmácia', color: '#10b981' },
            { id: 6, name: 'Educação & Cursos', color: '#06b6d4' },
            { id: 7, name: 'Lazer & Viagens', color: '#8b5cf6' },
            { id: 8, name: 'Assinaturas & Streaming', color: '#a855f7' },
            { id: 9, name: 'Compras & Eletrônicos', color: '#6366f1' },
            { id: 10, name: 'Vestuário & Cuidados', color: '#ec4899' },
            { id: 11, name: 'Pets', color: '#14b8a6' },
            { id: 12, name: 'Investimentos & Reserva', color: '#22c55e' },
            { id: 13, name: 'Trabalho & Negócios', color: '#84cc16' },
            { id: 14, name: 'Presentes & Doações', color: '#d946ef' },
            { id: 15, name: 'Serviços Financeiros', color: '#64748b' },
            { id: 16, name: 'Outros', color: '#6b7280' }
          ],
          expenses: [
            { id: 1, description: 'Internet Fibra', amount_cents: 11990, frequency_type: 'recurring', due_day: 15, is_active: 1, target_type: 'account', account_name: 'Nubank Principal', category_name: 'Moradia / Serviços', category_color: '#3b82f6', is_paid: 1, competence_month: formatYearMonth(now), created_at: dateStr },
            { id: 2, description: 'Netflix 4K', amount_cents: 5590, frequency_type: 'recurring', due_day: 22, is_active: 1, target_type: 'card', credit_card_name: 'Nubank Ultravioleta', category_name: 'Assinaturas & Lazer', category_color: '#8b5cf6', is_paid: 0, competence_month: formatYearMonth(now), created_at: dateStr },
            { id: 3, description: 'Notebook Dell', amount_cents: 45000, frequency_type: 'installment', current_installment: 3, total_installments: 10, is_active: 1, target_type: 'card', credit_card_name: 'Nubank Ultravioleta', category_name: 'Eletrônicos', category_color: '#10b981', is_paid: 0, competence_month: formatYearMonth(now), created_at: dateStr },
            { id: 4, description: 'Supermercado Mensal', amount_cents: 65000, frequency_type: 'one_time', is_active: 1, target_type: 'card', credit_card_name: 'Nubank Ultravioleta', category_name: 'Alimentação', category_color: '#f97316', is_paid: 0, competence_month: formatYearMonth(now), created_at: dateStr }
          ]
        });
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Datas de Navegação do Mês
  const targetDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const monthLabel = useMemo(() => {
    const name = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [targetDate]);

  // Lista de pílulas rápidas de meses (de -2 meses até +5 meses)
  const quickMonths = useMemo(() => {
    const now = new Date();
    const list = [];
    for (let i = -2; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const shortMonth = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      const yearShort = d.getFullYear().toString().slice(-2);
      const label = `${shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1)}/${yearShort}`;
      list.push({ offset: i, label });
    }
    return list;
  }, []);

  // Despesas ativas e projetadas para o mês selecionado
  const monthExpenses = useMemo(() => {
    const list = [];
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    for (const exp of overview.expenses) {
      // Ignora despesas canceladas/pausadas
      if (exp.is_active === 0) continue;

      const comp = getExpenseCompetence(exp);
      const diffMonths = (targetYear - comp.year) * 12 + (targetMonth - comp.monthIndex);

      if (exp.frequency_type === 'recurring') {
        // Despesa contínua se repete a partir do mês de competência
        if (diffMonths >= 0) {
          list.push({
            ...exp,
            is_paid: diffMonths === 0 ? exp.is_paid : (monthOffset < 0 ? 1 : 0),
            is_projected: monthOffset !== 0
          });
        }
      } else if (exp.frequency_type === 'installment') {
        // Compra parcelada: projeta a parcela a partir do mês de competência
        // A parcela 'current_installment' cadastrada compete ao mês 'competence_month' (diffMonths === 0).
        // Antes do mês de competência (diffMonths < 0), a compra não vigora nesta fatura/mês.
        if (diffMonths >= 0) {
          const total = exp.total_installments || 1;
          const baseInstallment = exp.current_installment || 1;
          const projected = baseInstallment + diffMonths;

          if (projected <= total) {
            list.push({
              ...exp,
              current_installment: projected,
              is_paid: diffMonths === 0 ? exp.is_paid : (monthOffset < 0 ? 1 : 0),
              is_projected: monthOffset !== 0
            });
          }
        }
      } else if (exp.frequency_type === 'one_time') {
        // Despesa única: cai exatamente no mês de competência
        if (diffMonths === 0) {
          list.push({
            ...exp,
            is_projected: monthOffset !== 0
          });
        }
      }
    }
    return list;
  }, [overview.expenses, targetDate, monthOffset]);

  // Totais calculados para o Mês Selecionado
  const totalBalanceCents = useMemo(() => {
    return overview.accounts.reduce((acc, curr) => acc + (curr.balance_cents || 0), 0);
  }, [overview.accounts]);

  const monthTotalCents = useMemo(() => {
    return monthExpenses.reduce((acc, curr) => acc + (curr.amount_cents || 0), 0);
  }, [monthExpenses]);

  const monthPendingCents = useMemo(() => {
    return monthExpenses
      .filter(e => !e.is_paid)
      .reduce((acc, curr) => acc + (curr.amount_cents || 0), 0);
  }, [monthExpenses]);

  const recurringMonthlyCents = useMemo(() => {
    return overview.expenses
      .filter(e => e.frequency_type === 'recurring' && e.is_active !== 0)
      .reduce((acc, curr) => acc + (curr.amount_cents || 0), 0);
  }, [overview.expenses]);

  const totalInstallmentDebtCents = useMemo(() => {
    return overview.expenses
      .filter(e => e.frequency_type === 'installment' && e.is_active !== 0)
      .reduce((acc, exp) => {
        const total = exp.total_installments || 1;
        const current = exp.current_installment || 1;
        const remaining = Math.max(0, total - current + (exp.is_paid ? 0 : 1));
        return acc + (remaining * exp.amount_cents);
      }, 0);
  }, [overview.expenses]);

  // Despesas filtradas para exibição na tabela
  const displayedExpenses = useMemo(() => {
    if (expenseFilter === 'all') return monthExpenses;
    return monthExpenses.filter(e => e.frequency_type === expenseFilter);
  }, [monthExpenses, expenseFilter]);

  // Ações de Contas
  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    setAccountForm({ name: '', balance_reais: '' });
    setShowAccountModal(true);
  };

  const handleOpenEditAccount = (acc) => {
    setEditingAccount(acc);
    const reais = ((acc.balance_cents || 0) / 100).toFixed(2).replace('.', ',');
    setAccountForm({
      name: acc.name,
      balance_reais: reais
    });
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.name?.trim()) return;
    const balance_cents = parseBRLInputToCents(accountForm.balance_reais);
    try {
      if (editingAccount) {
        if (window.api?.updateAccount) {
          await window.api.updateAccount(editingAccount.id, {
            name: accountForm.name.trim(),
            balance_cents
          });
        } else {
          setOverview(prev => ({
            ...prev,
            accounts: prev.accounts.map(a => a.id === editingAccount.id ? { ...a, name: accountForm.name.trim(), balance_cents } : a)
          }));
        }
        toast.success('Conta atualizada com sucesso');
      } else {
        if (window.api?.addAccount) {
          await window.api.addAccount({
            name: accountForm.name.trim(),
            balance_cents
          });
        } else {
          setOverview(prev => ({
            ...prev,
            accounts: [...prev.accounts, { id: Date.now(), name: accountForm.name.trim(), balance_cents }]
          }));
        }
        toast.success('Conta criada com sucesso');
      }
      setShowAccountModal(false);
      setEditingAccount(null);
      setAccountForm({ name: '', balance_reais: '' });
      loadData();
    } catch (err) {
      toast.error('Erro ao salvar conta');
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!confirm('Deseja realmente remover esta conta?')) return;
    try {
      if (window.api?.deleteAccount) {
        await window.api.deleteAccount(id);
      } else {
        setOverview(prev => ({
          ...prev,
          accounts: prev.accounts.filter(a => a.id !== id)
        }));
      }
      toast.success('Conta removida');
      loadData();
    } catch (err) {
      toast.error('Erro ao remover conta');
    }
  };

  // Ações de Cartões
  const handleOpenAddCard = () => {
    setEditingCard(null);
    setCardForm({ name: '', limit_reais: '', closing_day: 1, due_day: 10 });
    setShowCardModal(true);
  };

  const handleOpenEditCard = (card) => {
    setEditingCard(card);
    const reais = ((card.limit_cents || 0) / 100).toFixed(2).replace('.', ',');
    setCardForm({
      name: card.name,
      limit_reais: reais,
      closing_day: card.closing_day,
      due_day: card.due_day
    });
    setShowCardModal(true);
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    if (!cardForm.name?.trim()) return;
    const limit_cents = parseBRLInputToCents(cardForm.limit_reais);
    try {
      if (editingCard) {
        if (window.api?.updateCreditCard) {
          await window.api.updateCreditCard(editingCard.id, {
            name: cardForm.name.trim(),
            limit_cents,
            closing_day: parseInt(cardForm.closing_day, 10),
            due_day: parseInt(cardForm.due_day, 10)
          });
        } else {
          setOverview(prev => ({
            ...prev,
            creditCards: prev.creditCards.map(c => c.id === editingCard.id ? {
              ...c,
              name: cardForm.name.trim(),
              limit_cents,
              closing_day: parseInt(cardForm.closing_day, 10),
              due_day: parseInt(cardForm.due_day, 10)
            } : c)
          }));
        }
        toast.success('Cartão atualizado com sucesso');
      } else {
        if (window.api?.addCreditCard) {
          await window.api.addCreditCard({
            name: cardForm.name.trim(),
            limit_cents,
            closing_day: parseInt(cardForm.closing_day, 10),
            due_day: parseInt(cardForm.due_day, 10)
          });
        } else {
          setOverview(prev => ({
            ...prev,
            creditCards: [...prev.creditCards, {
              id: Date.now(),
              name: cardForm.name.trim(),
              limit_cents,
              closing_day: parseInt(cardForm.closing_day, 10),
              due_day: parseInt(cardForm.due_day, 10)
            }]
          }));
        }
        toast.success('Cartão cadastrado');
      }
      setShowCardModal(false);
      setEditingCard(null);
      setCardForm({ name: '', limit_reais: '', closing_day: 1, due_day: 10 });
      loadData();
    } catch (err) {
      toast.error('Erro ao cadastrar cartão');
    }
  };

  const handleDeleteCard = async (id) => {
    if (!confirm('Deseja realmente remover este cartão?')) return;
    try {
      if (window.api?.deleteCreditCard) {
        await window.api.deleteCreditCard(id);
      } else {
        setOverview(prev => ({
          ...prev,
          creditCards: prev.creditCards.filter(c => c.id !== id)
        }));
      }
      toast.success('Cartão removido');
      loadData();
    } catch (err) {
      toast.error('Erro ao remover cartão');
    }
  };

  // Ações de Categorias
  const handleOpenAddCategory = (fromExpense = false) => {
    setEditingCategory(null);
    setCategoryForm({ name: '', color: '#10b981' });
    setCategoryModalReturnToExpense(fromExpense);
    setShowCategoryModal(true);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, color: cat.color || '#6b7280' });
    setCategoryModalReturnToExpense(false);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name?.trim()) return;

    const payload = {
      name: categoryForm.name.trim(),
      color: categoryForm.color || '#6b7280'
    };

    try {
      if (editingCategory) {
        if (window.api?.updateCategory) {
          await window.api.updateCategory(editingCategory.id, payload);
        } else {
          setOverview(prev => ({
            ...prev,
            categories: prev.categories.map(c => c.id === editingCategory.id ? { ...c, ...payload } : c)
          }));
        }
        toast.success('Categoria atualizada');
      } else {
        let createdId = null;
        if (window.api?.addCategory) {
          createdId = await window.api.addCategory(payload);
        } else {
          createdId = Date.now();
          setOverview(prev => ({
            ...prev,
            categories: [...prev.categories, { id: createdId, ...payload }].sort((a, b) => a.name.localeCompare(b.name))
          }));
        }
        toast.success('Categoria criada com sucesso');

        if (categoryModalReturnToExpense && createdId) {
          setExpenseForm(prev => ({ ...prev, category_id: String(createdId) }));
        }
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', color: '#10b981' });
      await loadData();
    } catch (err) {
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!confirm(`Deseja realmente remover a categoria "${cat.name}"? As despesas associadas a ela passarão a ficar sem categoria.`)) return;
    try {
      if (window.api?.deleteCategory) {
        await window.api.deleteCategory(cat.id);
      } else {
        setOverview(prev => ({
          ...prev,
          categories: prev.categories.filter(c => c.id !== cat.id)
        }));
      }
      toast.success('Categoria removida');
      await loadData();
    } catch (err) {
      toast.error('Erro ao remover categoria');
    }
  };

  // Ações de Despesas
  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      description: '',
      amount_reais: '',
      amount_mode: 'installment',
      target_type: 'card',
      account_id: '',
      credit_card_id: '',
      category_id: '',
      frequency_type: 'one_time',
      current_installment: 1,
      total_installments: 12,
      due_day: 10,
      is_paid: false,
      competence_month: formatYearMonth(targetDate)
    });
    setShowExpenseModal(true);
  };

  const handleOpenEditExpense = (exp) => {
    setEditingExpense(exp);
    const comp = getExpenseCompetence(exp);
    const compStr = exp.competence_month || `${comp.year}-${String(comp.monthIndex + 1).padStart(2, '0')}`;
    const reais = ((exp.amount_cents || 0) / 100).toFixed(2).replace('.', ',');
    setExpenseForm({
      description: exp.description || '',
      amount_reais: reais,
      amount_mode: 'installment',
      target_type: exp.target_type || 'card',
      account_id: exp.account_id ? String(exp.account_id) : '',
      credit_card_id: exp.credit_card_id ? String(exp.credit_card_id) : '',
      category_id: exp.category_id ? String(exp.category_id) : '',
      frequency_type: exp.frequency_type || 'one_time',
      current_installment: exp.current_installment || 1,
      total_installments: exp.total_installments || 1,
      due_day: exp.due_day || 10,
      is_paid: !!exp.is_paid,
      competence_month: compStr
    });
    setShowExpenseModal(true);
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount_reais) return;

    let amount_cents = parseBRLInputToCents(expenseForm.amount_reais);
    const isInstallment = expenseForm.frequency_type === 'installment';
    const isRecurring = expenseForm.frequency_type === 'recurring';

    const totalInst = isInstallment ? Math.max(1, parseInt(expenseForm.total_installments, 10) || 1) : null;
    const currInst = isInstallment ? Math.max(1, parseInt(expenseForm.current_installment, 10) || 1) : null;

    if (isInstallment && expenseForm.amount_mode === 'total' && totalInst > 0) {
      amount_cents = Math.round(amount_cents / totalInst);
    }

    const competence_month = expenseForm.competence_month || formatYearMonth(targetDate);

    const payload = {
      description: expenseForm.description.trim(),
      amount_cents,
      target_type: expenseForm.target_type,
      account_id: expenseForm.target_type === 'account' ? (expenseForm.account_id || null) : null,
      credit_card_id: expenseForm.target_type === 'card' ? (expenseForm.credit_card_id || null) : null,
      category_id: expenseForm.category_id || null,
      frequency_type: expenseForm.frequency_type,
      current_installment: currInst,
      total_installments: totalInst,
      due_day: expenseForm.due_day ? parseInt(expenseForm.due_day, 10) : null,
      is_paid: expenseForm.is_paid ? 1 : 0,
      is_active: 1,
      competence_month
    };

    try {
      if (editingExpense) {
        if (window.api?.updateExpense) {
          await window.api.updateExpense(editingExpense.id, payload);
        } else {
          setOverview(prev => ({
            ...prev,
            expenses: prev.expenses.map(exp => exp.id === editingExpense.id ? { ...exp, ...payload } : exp)
          }));
        }
        toast.success('Despesa atualizada com sucesso');
      } else {
        if (window.api?.addExpense) {
          await window.api.addExpense(payload);
        } else {
          setOverview(prev => ({
            ...prev,
            expenses: [
              {
                id: Date.now(),
                ...payload,
                created_at: new Date().toISOString()
              },
              ...prev.expenses
            ]
          }));
        }
        toast.success(
          isRecurring
            ? 'Despesa contínua cadastrada'
            : isInstallment
            ? 'Compra parcelada registrada'
            : 'Despesa registrada'
        );
      }
      setShowExpenseModal(false);
      setEditingExpense(null);
      setExpenseForm({
        description: '',
        amount_reais: '',
        amount_mode: 'installment',
        target_type: 'card',
        account_id: '',
        credit_card_id: '',
        category_id: '',
        frequency_type: 'one_time',
        current_installment: 1,
        total_installments: 12,
        due_day: 10,
        is_paid: false,
        competence_month: ''
      });
      loadData();
    } catch (err) {
      toast.error('Erro ao salvar despesa');
    }
  };

  const handleTogglePaid = async (expense) => {
    const comp = getExpenseCompetence(expense);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();
    const diffMonths = (targetYear - comp.year) * 12 + (targetMonth - comp.monthIndex);

    // Se estiver visualizando uma projeção futura
    if (diffMonths > 0) {
      toast.info('Esta parcela é uma projeção futura. O pagamento é controlado no mês de competência.');
      return;
    }

    try {
      const nextStatus = !expense.is_paid;
      if (window.api?.toggleExpensePaid) {
        await window.api.toggleExpensePaid(expense.id, nextStatus);
      } else {
        setOverview(prev => ({
          ...prev,
          expenses: prev.expenses.map(e => e.id === expense.id ? { ...e, is_paid: nextStatus ? 1 : 0 } : e)
        }));
      }
      toast.success(nextStatus ? 'Marcada como paga' : 'Marcada como pendente');
      loadData();
    } catch (err) {
      toast.error('Erro ao alternar status');
    }
  };

  const handleToggleActive = async (expense) => {
    const nextActive = expense.is_active === 0 ? 1 : 0;
    try {
      if (window.api?.toggleExpenseActive) {
        await window.api.toggleExpenseActive(expense.id, nextActive);
      }
      toast.success(nextActive ? 'Assinatura reativada' : 'Assinatura pausada/cancelada');
      loadData();
    } catch (err) {
      toast.error('Erro ao alternar status da assinatura');
    }
  };

  const handleAdvanceInstallment = async (expense) => {
    if (expense.frequency_type !== 'installment') return;
    const current = expense.current_installment || 1;
    const total = expense.total_installments || 1;
    if (current >= total) {
      toast.info('Esta compra já está na última parcela');
      return;
    }
    const comp = getExpenseCompetence(expense);
    const nextDate = new Date(comp.year, comp.monthIndex + 1, 1);
    const nextCompMonth = formatYearMonth(nextDate);

    try {
      if (window.api?.updateExpense) {
        await window.api.updateExpense(expense.id, {
          ...expense,
          current_installment: current + 1,
          competence_month: nextCompMonth,
          is_paid: 0
        });
      } else {
        setOverview(prev => ({
          ...prev,
          expenses: prev.expenses.map(e => e.id === expense.id ? {
            ...e,
            current_installment: current + 1,
            competence_month: nextCompMonth,
            is_paid: 0
          } : e)
        }));
      }
      toast.success(`Avançado para a parcela ${current + 1} de ${total}`);
      loadData();
    } catch (err) {
      toast.error('Erro ao avançar parcela');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Deseja excluir esta despesa do banco?')) return;
    try {
      if (window.api?.deleteExpense) {
        await window.api.deleteExpense(id);
      }
      toast.success('Despesa excluída');
      loadData();
    } catch (err) {
      toast.error('Erro ao excluir despesa');
    }
  };

  // Backup
  const handleExportBackup = async () => {
    try {
      if (window.api?.exportData) {
        const ok = await window.api.exportData();
        if (ok) toast.success('Backup exportado com sucesso');
      }
    } catch (err) {
      toast.error('Erro ao exportar backup');
    }
  };

  const handleImportBackup = async () => {
    try {
      if (window.api?.importData) {
        const ok = await window.api.importData();
        if (ok) {
          toast.success('Backup restaurado com sucesso');
          loadData();
        }
      }
    } catch (err) {
      toast.error('Erro ao importar backup');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen select-none bg-dark-900 text-gray-100 overflow-hidden">
      <Toaster position="top-right" richColors />

      {/* Titlebar Customizada */}
      <header className="h-10 bg-dark-800/90 border-b border-white/5 flex items-center justify-between px-3 titlebar-drag shrink-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <DollarSign size={13} className="stroke-[2.5]" />
          </div>
          <span className="text-xs font-semibold tracking-wide text-gray-200">Cashpoint</span>
          <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">v1.3.0</span>
        </div>

        {/* Controles de Janela */}
        <div className="flex items-center gap-1 titlebar-no-drag">
          <button
            onClick={() => window.windowControls?.minimize()}
            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-gray-200 transition-colors"
            title="Minimizar"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => window.windowControls?.maximize()}
            className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-gray-200 transition-colors"
            title="Maximizar"
          >
            <Square size={12} />
          </button>
          <button
            onClick={() => window.windowControls?.close()}
            className="p-1.5 hover:bg-rose-500 hover:text-white rounded text-gray-400 transition-colors"
            title="Fechar"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-dark-800/40 border-r border-white/5 flex flex-col justify-between p-3 shrink-0">
          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              <PieChart size={17} />
              <span>Visão Geral</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'expenses'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              <TrendingDown size={17} />
              <span>Despesas do Mês</span>
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'accounts'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}
            >
              <Wallet size={17} />
              <span>Contas & Categorias</span>
            </button>
          </div>

          {/* Backup e Ações Rápidas */}
          <div className="pt-3 border-t border-white/5 space-y-1">
            <button
              onClick={handleExportBackup}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-md transition-colors"
            >
              <Download size={14} />
              <span>Exportar Backup</span>
            </button>
            <button
              onClick={handleImportBackup}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-md transition-colors"
            >
              <Upload size={14} />
              <span>Importar Backup</span>
            </button>
          </div>
        </aside>

        {/* View Principal */}
        <main className="flex-1 overflow-y-auto p-6 bg-dark-900/60">
          {/* Header Superior com Título e Botão de Ação */}
          <div className="flex items-center justify-between pb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                {activeTab === 'overview' && 'Painel Financeiro'}
                {activeTab === 'expenses' && 'Despesas & Faturas'}
                {activeTab === 'accounts' && 'Minhas Contas, Cartões & Categorias'}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeTab === 'overview' && `Projeções e fechamento de contas para ${monthLabel}.`}
                {activeTab === 'expenses' && `Lançamentos, assinaturas e parcelas vigentes em ${monthLabel}.`}
                {activeTab === 'accounts' && 'Gerencie limites, dias de vencimento, saldos e categorias personalizadas.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenAddExpense}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-lg shadow-emerald-950/40"
              >
                <Plus size={15} />
                <span>Nova Despesa</span>
              </button>
            </div>
          </div>

          {/* --- NAVEGADOR DE MÊS ESTILO AXIES --- */}
          <div className="p-3.5 mb-6 rounded-xl bg-dark-800/50 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Controles Principais de Mês */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMonthOffset(prev => prev - 1)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                title="Mês Anterior"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-2.5">
                <Calendar size={16} className="text-emerald-400" />
                <span className="text-sm font-bold text-white tracking-wide">
                  {monthLabel}
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    monthOffset === 0
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-primary-500/15 text-sky-400 border-sky-500/30'
                  }`}
                >
                  {monthOffset === 0
                    ? 'MÊS ATUAL'
                    : monthOffset > 0
                    ? `+${monthOffset} MÊS${monthOffset > 1 ? 'ES' : ''}`
                    : `${monthOffset} MÊS${monthOffset < -1 ? 'ES' : ''}`}
                </span>

                {monthOffset !== 0 && (
                  <button
                    onClick={() => setMonthOffset(0)}
                    className="p-1 text-gray-400 hover:text-emerald-400 transition-colors"
                    title="Voltar ao Mês Atual"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setMonthOffset(prev => prev + 1)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                title="Próximo Mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Pílulas Rápidas de Navegação */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {quickMonths.map(m => (
                <button
                  key={m.offset}
                  onClick={() => setMonthOffset(m.offset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                    monthOffset === m.offset
                      ? 'bg-emerald-500 text-dark-900 border-emerald-500 shadow-md font-bold'
                      : 'bg-white/5 text-gray-400 hover:text-gray-200 border-transparent hover:bg-white/10'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* VIEW: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Cards de Métricas para o Mês Selecionado */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-dark-800/60 border border-white/5">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Saldo em Contas</span>
                    <Wallet size={16} className="text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white tracking-tight">
                    {formatBRL(totalBalanceCents)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Disponível nas contas bancárias
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-dark-800/60 border border-white/5">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Total do Mês</span>
                    <TrendingDown size={16} className="text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold text-rose-400 tracking-tight">
                    {formatBRL(monthTotalCents)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {monthExpenses.length} compromisso(s) em {monthLabel.split(' ')[0]}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-dark-800/60 border border-white/5">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Pendente no Mês</span>
                    <TrendingDown size={16} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-amber-400 tracking-tight">
                    {formatBRL(monthPendingCents)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Aguardando liquidação
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-dark-800/60 border border-white/5">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-xs font-medium uppercase tracking-wider">Dívida Futura Parcelada</span>
                    <Layers size={16} className="text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-purple-400 tracking-tight">
                    {formatBRL(totalInstallmentDebtCents)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Total a pagar nos próximos ciclos
                  </div>
                </div>
              </div>

              {/* Grid 2 Colunas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contas & Cartões Resumo */}
                <div className="p-4 rounded-xl bg-dark-800/40 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-200">Contas Ativas</h2>
                    <button
                      onClick={handleOpenAddAccount}
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Plus size={13} /> Adicionar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {overview.accounts.length === 0 ? (
                      <p className="text-xs text-gray-500 py-3 text-center">Nenhuma conta cadastrada.</p>
                    ) : (
                      overview.accounts.map(acc => (
                        <div key={acc.id} className="group flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/[0.07] transition-colors">
                          <div className="flex items-center gap-2.5">
                            <Wallet size={15} className="text-gray-400" />
                            <span className="text-xs font-medium text-gray-200">{acc.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-400">
                              {formatBRL(acc.balance_cents)}
                            </span>
                            <button
                              onClick={() => handleOpenEditAccount(acc)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-emerald-400 p-1 rounded hover:bg-white/10 transition-all"
                              title="Editar conta e saldo"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-5 mb-3 pt-4 border-t border-white/5">
                    <h2 className="text-sm font-semibold text-gray-200">Cartões de Crédito</h2>
                    <button
                      onClick={handleOpenAddCard}
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Plus size={13} /> Adicionar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {overview.creditCards.length === 0 ? (
                      <p className="text-xs text-gray-500 py-3 text-center">Nenhum cartão cadastrado.</p>
                    ) : (
                      overview.creditCards.map(c => {
                        // Calcula o total que cai neste cartão no mês selecionado
                        const cardMonthlyTotal = monthExpenses
                          .filter(e => e.credit_card_id === c.id)
                          .reduce((sum, e) => sum + e.amount_cents, 0);

                        return (
                          <div key={c.id} className="group flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/[0.07] transition-colors">
                            <div className="flex items-center gap-2.5">
                              <CreditCard size={15} className="text-gray-400" />
                              <div>
                                <div className="text-xs font-medium text-gray-200">{c.name}</div>
                                <div className="text-[10px] text-gray-500">Fecha dia {c.closing_day} • Vence dia {c.due_day}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="text-xs font-semibold text-rose-400">
                                  Fatura: {formatBRL(cardMonthlyTotal)}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  Limite: {formatBRL(c.limit_cents)}
                                </div>
                              </div>
                              <button
                                onClick={() => handleOpenEditCard(c)}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-emerald-400 p-1 rounded hover:bg-white/10 transition-all"
                                title="Editar cartão"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Despesas deste Mês */}
                <div className="p-4 rounded-xl bg-dark-800/40 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-200">
                      Despesas de {monthLabel}
                    </h2>
                    <button
                      onClick={() => setActiveTab('expenses')}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-0.5"
                    >
                      Ver todas ({monthExpenses.length}) <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {monthExpenses.length === 0 ? (
                      <p className="text-xs text-gray-500 py-6 text-center">
                        Nenhuma despesa ou parcela projetada para {monthLabel}.
                      </p>
                    ) : (
                      monthExpenses.slice(0, 6).map(exp => (
                        <div key={exp.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/[0.07] transition-colors">
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => handleTogglePaid(exp)}
                              className="text-gray-500 hover:text-emerald-400 transition-colors"
                            >
                              {exp.is_paid ? (
                                <CheckCircle2 size={16} className="text-emerald-400" />
                              ) : (
                                <Circle size={16} />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-200">{exp.description}</span>
                                {exp.frequency_type === 'recurring' && (
                                  <span className="text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                    <Repeat size={10} /> Contínua {exp.due_day ? `(Dia ${exp.due_day})` : ''}
                                  </span>
                                )}
                                {exp.frequency_type === 'installment' && (
                                  <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded">
                                    Parcela {exp.current_installment || 1}/{exp.total_installments || 1}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: exp.category_color || '#6b7280' }} />
                                <span>{exp.category_name || 'Sem Categoria'}</span>
                                <span>•</span>
                                <span>{exp.target_type === 'card' ? (exp.credit_card_name || 'Cartão') : (exp.account_name || 'Conta')}</span>
                              </div>
                            </div>
                          </div>
                          <span className={`text-xs font-semibold ${exp.is_paid ? 'text-gray-400 line-through' : 'text-rose-400'}`}>
                            {formatBRL(exp.amount_cents)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: DESPESAS */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              {/* Filtros por frequência */}
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <button
                  onClick={() => setExpenseFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    expenseFilter === 'all'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Todas ({monthExpenses.length})
                </button>
                <button
                  onClick={() => setExpenseFilter('recurring')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    expenseFilter === 'recurring'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Repeat size={12} />
                  Contínuas & Assinaturas ({monthExpenses.filter(e => e.frequency_type === 'recurring').length})
                </button>
                <button
                  onClick={() => setExpenseFilter('installment')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    expenseFilter === 'installment'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Layers size={12} />
                  Parceladas ({monthExpenses.filter(e => e.frequency_type === 'installment').length})
                </button>
                <button
                  onClick={() => setExpenseFilter('one_time')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    expenseFilter === 'one_time'
                      ? 'bg-white/10 text-white font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  À Vista / Únicas ({monthExpenses.filter(e => e.frequency_type === 'one_time').length})
                </button>
              </div>

              {/* Tabela de Despesas */}
              <div className="overflow-hidden rounded-xl bg-dark-800/40 border border-white/5">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 uppercase tracking-wider text-[10px]">
                      <th className="p-3 w-10 text-center">Status</th>
                      <th className="p-3">Descrição</th>
                      <th className="p-3">Frequência / Parcela em {monthLabel.split(' ')[0]}</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Origem</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 w-28 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {displayedExpenses.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-6 text-center text-gray-500">
                          Nenhuma despesa para exibir em {monthLabel}.
                        </td>
                      </tr>
                    ) : (
                      displayedExpenses.map(exp => (
                        <tr
                          key={exp.id}
                          className={`hover:bg-white/[0.03] transition-colors ${
                            exp.is_active === 0 ? 'opacity-40' : ''
                          }`}
                        >
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleTogglePaid(exp)}
                              disabled={exp.is_active === 0}
                              className="text-gray-500 hover:text-emerald-400 transition-colors disabled:cursor-not-allowed"
                              title={
                                monthOffset !== 0
                                  ? 'Navegação de projeção (marcação feita no Mês Atual)'
                                  : exp.is_paid
                                  ? 'Marcar como pendente'
                                  : 'Marcar como paga'
                              }
                            >
                              {exp.is_paid ? (
                                <CheckCircle2 size={16} className="text-emerald-400" />
                              ) : (
                                <Circle size={16} />
                              )}
                            </button>
                          </td>
                          <td className="p-3 font-medium text-gray-200">
                            <div>
                              <span>{exp.description}</span>
                              {exp.is_active === 0 && (
                                <span className="ml-2 text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                                  Pausada / Cancelada
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            {exp.frequency_type === 'recurring' && (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                                  <Repeat size={10} /> Contínua {exp.due_day ? `• Dia ${exp.due_day}` : ''}
                                </span>
                              </div>
                            )}
                            {exp.frequency_type === 'installment' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Parcela {exp.current_installment || 1} de {exp.total_installments || 1}
                              </span>
                            )}
                            {exp.frequency_type === 'one_time' && (
                              <span className="text-[11px] text-gray-400">À vista / Única</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-medium"
                              style={{
                                backgroundColor: (exp.category_color || '#6b7280') + '22',
                                color: exp.category_color || '#d1d5db',
                                border: `1px solid ${(exp.category_color || '#6b7280')}44`
                              }}
                            >
                              {exp.category_name || 'Sem categoria'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-300">
                            {exp.target_type === 'card' ? (
                              <span className="flex items-center gap-1.5 text-purple-400">
                                <CreditCard size={13} /> {exp.credit_card_name || 'Cartão'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-blue-400">
                                <Wallet size={13} /> {exp.account_name || 'Conta'}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-semibold text-rose-400">
                            {formatBRL(exp.amount_cents)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Avançar parcela */}
                              {exp.frequency_type === 'installment' && (
                                <button
                                  onClick={() => handleAdvanceInstallment(exp)}
                                  className="p-1 hover:bg-amber-500/20 text-gray-400 hover:text-amber-300 rounded transition-colors"
                                  title="Avançar 1 parcela"
                                >
                                  +1x
                                </button>
                              )}

                              {/* Pausar/Reativar assinatura */}
                              {exp.frequency_type === 'recurring' && (
                                <button
                                  onClick={() => handleToggleActive(exp)}
                                  className={`p-1 rounded transition-colors ${
                                    exp.is_active === 0
                                      ? 'hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-300'
                                      : 'hover:bg-sky-500/20 text-gray-400 hover:text-sky-300'
                                  }`}
                                  title={exp.is_active === 0 ? 'Reativar assinatura' : 'Pausar / Cancelar assinatura'}
                                >
                                  {exp.is_active === 0 ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenEditExpense(exp)}
                                className="p-1 hover:bg-white/10 text-gray-400 hover:text-emerald-400 rounded transition-colors"
                                title="Editar despesa"
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="p-1 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded transition-colors"
                                title="Excluir do histórico"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: CONTAS & CARTÕES */}
          {activeTab === 'accounts' && (
            <div className="space-y-8">
              {/* Seção Contas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-200">Contas Bancárias / Carteiras</h2>
                  <button
                    onClick={handleOpenAddAccount}
                    className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-md text-emerald-400 transition-colors"
                  >
                    <Plus size={13} /> Nova Conta
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {overview.accounts.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-xs text-gray-500 bg-dark-800/20 border border-white/5 rounded-xl">
                      Nenhuma conta cadastrada no momento.
                    </div>
                  ) : (
                    overview.accounts.map(acc => (
                      <div key={acc.id} className="p-4 rounded-xl bg-dark-800/60 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-semibold text-gray-200">{acc.name}</span>
                            <div className="text-lg font-bold text-emerald-400 mt-1">
                              {formatBRL(acc.balance_cents)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditAccount(acc)}
                              className="text-gray-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                              title="Editar conta e saldo"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc.id)}
                              className="text-gray-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                              title="Excluir conta"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Seção Cartões */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-200">Cartões de Crédito</h2>
                  <button
                    onClick={handleOpenAddCard}
                    className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-md text-emerald-400 transition-colors"
                  >
                    <Plus size={13} /> Novo Cartão
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {overview.creditCards.length === 0 ? (
                    <div className="col-span-full py-8 text-center text-xs text-gray-500 bg-dark-800/20 border border-white/5 rounded-xl">
                      Nenhum cartão cadastrado no momento.
                    </div>
                  ) : (
                    overview.creditCards.map(c => {
                      const cardMonthlyTotal = monthExpenses
                        .filter(e => e.credit_card_id === c.id)
                        .reduce((sum, e) => sum + e.amount_cents, 0);

                      return (
                        <div key={c.id} className="p-4 rounded-xl bg-dark-800/60 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs font-semibold text-gray-200">{c.name}</span>
                              <div className="text-xs text-rose-400 font-semibold mt-1">
                                Fatura em {monthLabel.split(' ')[0]}: {formatBRL(cardMonthlyTotal)}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                Limite: <strong className="text-white">{formatBRL(c.limit_cents)}</strong>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                Fecha dia {c.closing_day} • Vence dia {c.due_day}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditCard(c)}
                                className="text-gray-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                title="Editar cartão"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteCard(c.id)}
                                className="text-gray-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                title="Excluir cartão"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Seção Categorias */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-200">Categorias de Despesas</h2>
                    <p className="text-[11px] text-gray-500">
                      Personalize as categorias para organizar despesas e faturas ({overview.categories.length} cadastradas).
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenAddCategory(false)}
                    className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-md text-emerald-400 transition-colors"
                  >
                    <Plus size={13} /> Nova Categoria
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                  {overview.categories.length === 0 ? (
                    <div className="col-span-full py-6 text-center text-xs text-gray-500 bg-dark-800/20 border border-white/5 rounded-xl">
                      Nenhuma categoria cadastrada.
                    </div>
                  ) : (
                    overview.categories.map(cat => (
                      <div
                        key={cat.id}
                        className="group p-2.5 rounded-xl bg-dark-800/60 border border-white/5 hover:border-white/10 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: cat.color || '#6b7280' }}
                          />
                          <span className="text-xs font-medium text-gray-200 truncate" title={cat.name}>
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => handleOpenEditCategory(cat)}
                            className="text-gray-400 hover:text-emerald-400 p-1 rounded hover:bg-white/10 transition-colors"
                            title="Editar categoria"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-gray-500 hover:text-rose-400 p-1 rounded hover:bg-white/10 transition-colors"
                            title="Excluir categoria"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: CONTA (NOVA OU EDITAR) */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveAccount} className="bg-dark-800 border border-white/10 rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="text-sm font-semibold text-white">
                {editingAccount ? 'Editar Conta' : 'Adicionar Nova Conta'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAccountModal(false);
                  setEditingAccount(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Nome da Conta / Banco</label>
              <input
                type="text"
                required
                placeholder="Ex: Nubank, Carteira, Itaú"
                value={accountForm.name}
                onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">
                {editingAccount ? 'Saldo Atual (R$)' : 'Saldo Inicial (R$)'}
              </label>
              <input
                type="text"
                placeholder="0,00"
                value={accountForm.balance_reais}
                onChange={e => setAccountForm({ ...accountForm, balance_reais: e.target.value })}
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                {editingAccount ? 'Altere o saldo conforme extrato ou conciliação.' : 'Saldo que servirá como base das despesas.'}
              </span>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setShowAccountModal(false);
                  setEditingAccount(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-950/30 transition-colors"
              >
                {editingAccount ? 'Atualizar Conta' : 'Salvar Conta'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CARTÃO (NOVO OU EDITAR) */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveCard} className="bg-dark-800 border border-white/10 rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="text-sm font-semibold text-white">
                {editingCard ? 'Editar Cartão de Crédito' : 'Adicionar Cartão de Crédito'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCardModal(false);
                  setEditingCard(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Nome do Cartão</label>
              <input
                type="text"
                required
                placeholder="Ex: Nubank Ultravioleta, XP Visa"
                value={cardForm.name}
                onChange={e => setCardForm({ ...cardForm, name: e.target.value })}
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Limite Total (R$)</label>
              <input
                type="text"
                placeholder="0,00"
                value={cardForm.limit_reais}
                onChange={e => setCardForm({ ...cardForm, limit_reais: e.target.value })}
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Dia de Fechamento</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={cardForm.closing_day}
                  onChange={e => setCardForm({ ...cardForm, closing_day: e.target.value })}
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Dia de Vencimento</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={cardForm.due_day}
                  onChange={e => setCardForm({ ...cardForm, due_day: e.target.value })}
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setShowCardModal(false);
                  setEditingCard(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-950/30 transition-colors"
              >
                {editingCard ? 'Atualizar Cartão' : 'Salvar Cartão'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: NOVA OU EDITAR DESPESA */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateExpense} className="bg-dark-800 border border-white/10 rounded-xl p-5 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-semibold text-white">
                {editingExpense ? 'Editar Despesa' : 'Registrar Nova Despesa'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowExpenseModal(false);
                  setEditingExpense(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Descrição */}
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Descrição</label>
              <input
                type="text"
                required
                placeholder="Ex: Internet Fibra, Netflix, Tablet Samsung, Mercado"
                value={expenseForm.description}
                onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Frequência / Tipo */}
            <div>
              <label className="text-[11px] text-gray-400 block mb-1.5">Frequência da Despesa</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setExpenseForm({ ...expenseForm, frequency_type: 'recurring' })}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition-colors flex flex-col items-center justify-center gap-1 ${
                    expenseForm.frequency_type === 'recurring'
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                      : 'bg-dark-900 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="font-semibold flex items-center gap-1">
                    <Repeat size={12} /> Contínua
                  </span>
                  <span className="text-[10px] text-gray-500 leading-none">Internet, Streaming</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExpenseForm({ ...expenseForm, frequency_type: 'installment', target_type: 'card' })}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition-colors flex flex-col items-center justify-center gap-1 ${
                    expenseForm.frequency_type === 'installment'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-dark-900 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="font-semibold flex items-center gap-1">
                    <Layers size={12} /> Parcelada
                  </span>
                  <span className="text-[10px] text-gray-500 leading-none">Ex: 6x de R$ 150</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExpenseForm({ ...expenseForm, frequency_type: 'one_time' })}
                  className={`py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition-colors flex flex-col items-center justify-center gap-1 ${
                    expenseForm.frequency_type === 'one_time'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-dark-900 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="font-semibold">À Vista</span>
                  <span className="text-[10px] text-gray-500 leading-none">Compra pontual</span>
                </button>
              </div>
            </div>

            {/* Mês de Competência */}
            <div className="p-3 rounded-lg bg-dark-900/80 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-gray-300 font-medium flex items-center gap-1.5">
                  <Calendar size={13} className="text-emerald-400" />
                  <span>Mês de Competência</span>
                </label>
                <span className="text-[11px] font-semibold text-emerald-400">
                  {formatCompetenceLabel(expenseForm.competence_month)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="month"
                  required
                  value={expenseForm.competence_month}
                  onChange={e => setExpenseForm({ ...expenseForm, competence_month: e.target.value })}
                  style={{ colorScheme: 'dark' }}
                  className="sm:col-span-2 bg-dark-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setExpenseForm({ ...expenseForm, competence_month: formatYearMonth(new Date()) })}
                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-medium border transition-colors ${
                      expenseForm.competence_month === formatYearMonth(new Date())
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    Mês Atual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                      setExpenseForm({ ...expenseForm, competence_month: formatYearMonth(next) });
                    }}
                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-medium border transition-colors ${
                      (() => {
                        const now = new Date();
                        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                        return expenseForm.competence_month === formatYearMonth(next);
                      })()
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    Próximo Mês
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-gray-500">
                {expenseForm.frequency_type === 'installment'
                  ? 'Mês em que a parcela cadastrada abaixo entrará em vigor.'
                  : expenseForm.frequency_type === 'recurring'
                  ? 'Mês a partir do qual esta assinatura começará a ser cobrada.'
                  : 'Mês em que esta despesa pontual será contabilizada.'}
              </p>
            </div>

            {/* Caixa Informativa para Contínuas / Assinaturas */}
            {expenseForm.frequency_type === 'recurring' && (
              <div className="p-3 rounded-lg bg-sky-500/5 border border-sky-500/20 flex items-start gap-2.5">
                <Repeat size={15} className="text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs text-sky-200">
                  <span className="font-semibold">Despesa Mensal Fixa / Assinatura:</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Essa cobrança se repetirá todo mês a partir da competência selecionada até você pausar ou cancelar.
                  </p>
                </div>
              </div>
            )}

            {/* Campos Específicos para Parcelamento */}
            {expenseForm.frequency_type === 'installment' && (
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-amber-300/90 block mb-1">Total de Parcelas</label>
                    <input
                      type="number"
                      min="2"
                      max="99"
                      required
                      value={expenseForm.total_installments}
                      onChange={e => setExpenseForm({ ...expenseForm, total_installments: e.target.value })}
                      className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-amber-300/90 block mb-1">
                      Parcela Atual (na Competência)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={expenseForm.total_installments || 99}
                      required
                      value={expenseForm.current_installment}
                      onChange={e => setExpenseForm({ ...expenseForm, current_installment: e.target.value })}
                      className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Resumo do parcelamento com competência */}
                {(() => {
                  const total = parseInt(expenseForm.total_installments, 10) || 1;
                  const curr = parseInt(expenseForm.current_installment, 10) || 1;
                  if (expenseForm.competence_month && expenseForm.competence_month.includes('-')) {
                    const [y, m] = expenseForm.competence_month.split('-').map(Number);
                    const startLabel = formatCompetenceLabel(expenseForm.competence_month);
                    const remainingMonths = Math.max(0, total - curr);
                    const endDate = new Date(y, m - 1 + remainingMonths, 1);
                    const endLabel = endDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    const endCap = endLabel.charAt(0).toUpperCase() + endLabel.slice(1);

                    return (
                      <div className="text-[11px] text-amber-200/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 leading-relaxed">
                        A parcela <strong>{curr} de {total}</strong> será lançada em <strong>{startLabel}</strong>.
                        {remainingMonths > 0 ? (
                          <span> As próximas parcelas irão até <strong>{endCap}</strong> (parcela {total} de {total}).</span>
                        ) : (
                          <span> Esta é a última parcela da compra.</span>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="flex items-center gap-4 text-xs text-gray-300 pt-1">
                  <span className="text-[11px] text-gray-400">O valor digitado é:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="amount_mode"
                      checked={expenseForm.amount_mode === 'installment'}
                      onChange={() => setExpenseForm({ ...expenseForm, amount_mode: 'installment' })}
                      className="text-emerald-500"
                    />
                    <span>De cada parcela</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="amount_mode"
                      checked={expenseForm.amount_mode === 'total'}
                      onChange={() => setExpenseForm({ ...expenseForm, amount_mode: 'total' })}
                      className="text-emerald-500"
                    />
                    <span>Total da compra</span>
                  </label>
                </div>
              </div>
            )}

            {/* Valor e Dia de Vencimento */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] text-gray-400 block mb-1">
                  {expenseForm.frequency_type === 'installment' && expenseForm.amount_mode === 'total'
                    ? 'Valor Total da Compra (R$)'
                    : expenseForm.frequency_type === 'recurring'
                    ? 'Valor Mensal (R$)'
                    : 'Valor (R$)'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={expenseForm.amount_reais}
                  onChange={e => setExpenseForm({ ...expenseForm, amount_reais: e.target.value })}
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Dia do Vencimento</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="Ex: 15"
                  value={expenseForm.due_day}
                  onChange={e => setExpenseForm({ ...expenseForm, due_day: e.target.value })}
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Categoria e Forma de Pagamento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-gray-400">Categoria</label>
                  <button
                    type="button"
                    onClick={() => handleOpenAddCategory(true)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 hover:underline"
                  >
                    <Plus size={11} /> Nova Categoria
                  </button>
                </div>
                <select
                  value={expenseForm.category_id}
                  onChange={e => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione...</option>
                  {overview.categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Forma de Pagamento</label>
                <select
                  value={expenseForm.target_type}
                  onChange={e => setExpenseForm({ ...expenseForm, target_type: e.target.value })}
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="card">Cartão de Crédito</option>
                  <option value="account">Conta Corrente / Carteira</option>
                </select>
              </div>
            </div>

            {/* Seleção do Cartão ou Conta */}
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">
                {expenseForm.target_type === 'card' ? 'Qual Cartão de Crédito?' : 'Qual Conta Bancária / Débito?'}
              </label>
              {expenseForm.target_type === 'card' ? (
                <select
                  value={expenseForm.credit_card_id}
                  onChange={e => setExpenseForm({ ...expenseForm, credit_card_id: e.target.value })}
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione o cartão...</option>
                  {overview.creditCards.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={expenseForm.account_id}
                  onChange={e => setExpenseForm({ ...expenseForm, account_id: e.target.value })}
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione a conta...</option>
                  {overview.accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Checkbox de pago */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_paid_cb"
                checked={expenseForm.is_paid}
                onChange={e => setExpenseForm({ ...expenseForm, is_paid: e.target.checked })}
                className="rounded bg-dark-900 border-white/10 text-emerald-500 focus:ring-0"
              />
              <label htmlFor="is_paid_cb" className="text-xs text-gray-300 cursor-pointer">
                Esta despesa/parcela já está paga na competência?
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setShowExpenseModal(false);
                  setEditingExpense(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                {editingExpense ? 'Salvar Alterações' : 'Salvar Despesa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CATEGORIA (NOVA OU EDITAR) */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveCategory} className="bg-dark-800 border border-white/10 rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="text-sm font-semibold text-white">
                {editingCategory ? 'Editar Categoria' : 'Adicionar Nova Categoria'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Nome da Categoria</label>
              <input
                type="text"
                required
                placeholder="Ex: Pets, Farmácia, Cursos, Restaurante"
                value={categoryForm.name}
                onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-400 block mb-1.5">Cor de Identificação</label>
              
              {/* Paleta rápida de cores */}
              <div className="grid grid-cols-8 gap-1.5 mb-2.5">
                {PRESET_CATEGORY_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategoryForm({ ...categoryForm, color: c })}
                    className={`w-7 h-7 rounded-lg transition-transform flex items-center justify-center ${
                      categoryForm.color?.toLowerCase() === c.toLowerCase()
                        ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-dark-800'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Seletor de cor personalizada */}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={e => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-dark-900 border border-white/10 p-0.5"
                />
                <input
                  type="text"
                  value={categoryForm.color}
                  onChange={e => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="w-24 bg-dark-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-center focus:outline-none focus:border-emerald-500"
                  placeholder="#10b981"
                />
                <span className="text-[11px] text-gray-400">Personalizada</span>
              </div>
            </div>

            {/* Preview da Categoria */}
            <div className="pt-1">
              <span className="text-[10px] text-gray-400 block mb-1">Pré-visualização:</span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: (categoryForm.color || '#6b7280') + '22',
                  color: categoryForm.color || '#d1d5db',
                  border: `1px solid ${(categoryForm.color || '#6b7280')}44`
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryForm.color || '#6b7280' }} />
                <span>{categoryForm.name || 'Nome da Categoria'}</span>
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                {editingCategory ? 'Salvar Categoria' : 'Criar Categoria'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
