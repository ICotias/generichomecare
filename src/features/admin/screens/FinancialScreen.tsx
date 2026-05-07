import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as financialService from '../../../core/services/financialService';

/* eslint-disable @typescript-eslint/no-explicit-any */
let RNHTMLtoPDF: any = null;
let Share: any = null;
try { RNHTMLtoPDF = require('react-native-html-to-pdf'); } catch { /* not installed */ }
try { Share = require('react-native-share'); } catch { /* not installed */ }
/* eslint-enable @typescript-eslint/no-explicit-any */

// ════════════════════════════════════════════
// Types & mock data
// ════════════════════════════════════════════

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface FinancialEntry {
  id: string;
  descricao: string;
  tipo: 'receita' | 'despesa';
  valor: number;
  data: Date;
  categoria: string;
}

const MOCK_ENTRIES: FinancialEntry[] = [
  { id: '1', descricao: 'Mensalidade — Maria Souza', tipo: 'receita', valor: 8500, data: new Date(2026, 3, 1), categoria: 'Mensalidade' },
  { id: '2', descricao: 'Mensalidade — João Silva', tipo: 'receita', valor: 7200, data: new Date(2026, 3, 1), categoria: 'Mensalidade' },
  { id: '3', descricao: 'Mensalidade — Antônia Ferreira', tipo: 'receita', valor: 6800, data: new Date(2026, 3, 5), categoria: 'Mensalidade' },
  { id: '4', descricao: 'Salário — Ana Paula Costa', tipo: 'despesa', valor: 4500, data: new Date(2026, 3, 5), categoria: 'Folha' },
  { id: '5', descricao: 'Salário — Bruno Santos', tipo: 'despesa', valor: 4200, data: new Date(2026, 3, 5), categoria: 'Folha' },
  { id: '6', descricao: 'Salário — Carla Oliveira', tipo: 'despesa', valor: 4000, data: new Date(2026, 3, 5), categoria: 'Folha' },
  { id: '7', descricao: 'Materiais de enfermagem', tipo: 'despesa', valor: 1200, data: new Date(2026, 3, 10), categoria: 'Materiais' },
  { id: '8', descricao: 'Transporte equipe', tipo: 'despesa', valor: 800, data: new Date(2026, 3, 12), categoria: 'Transporte' },
];

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

export const FinancialScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const currentYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadEntries = useCallback(
    async (month: number) => {
      if (!user?.empresaId) {
        setEntries(MOCK_ENTRIES.filter((e) => e.data.getMonth() === month));
        setUsingMock(true);
        setIsLoading(false);
        return;
      }

      try {
        const records = await financialService.listEntries(
          user.empresaId,
          currentYear,
          month
        );

        if (records.length > 0) {
          setEntries(
            records.map((r) => ({
              id: r.id,
              descricao: r.descricao,
              tipo: r.tipo,
              valor: r.valor,
              data: r.data,
              categoria: r.categoria,
            }))
          );
          setUsingMock(false);
        } else {
          // Fallback to mock for the selected month
          setEntries(MOCK_ENTRIES.filter((e) => e.data.getMonth() === month));
          setUsingMock(true);
        }
      } catch {
        setEntries(MOCK_ENTRIES.filter((e) => e.data.getMonth() === month));
        setUsingMock(true);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.empresaId, currentYear]
  );

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadEntries(selectedMonth);
    }, [loadEntries, selectedMonth])
  );

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    setIsLoading(true);
    loadEntries(month);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEntries(selectedMonth);
    setIsRefreshing(false);
  };

  const totalReceita = entries.filter((e) => e.tipo === 'receita').reduce((s, e) => s + e.valor, 0);
  const totalDespesa = entries.filter((e) => e.tipo === 'despesa').reduce((s, e) => s + e.valor, 0);
  const saldo = totalReceita - totalDespesa;

  const fmtCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleExportPDF = async () => {
    if (!RNHTMLtoPDF) {
      Alert.alert('Pacote não instalado', 'Instale react-native-html-to-pdf:\n\nyarn add react-native-html-to-pdf\nnpx pod-install');
      return;
    }
    setIsExporting(true);
    try {
      const monthLabel = MONTHS[selectedMonth];
      const year = currentYear;
      const rows = entries
        .map(
          (e) =>
            `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;">${e.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;">${e.descricao}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;">${e.categoria}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:${e.tipo === 'receita' ? '#16A34A' : '#DC2626'};font-weight:600;text-align:right">
                ${e.tipo === 'receita' ? '+' : '-'} ${fmtCurrency(e.valor)}
              </td>
            </tr>`
        )
        .join('');

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
        *{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#1F2937;padding:32px}
        .hdr{display:flex;justify-content:space-between;border-bottom:2px solid #F97316;padding-bottom:16px;margin-bottom:24px}
        .hdr h1{font-size:20px;color:#F97316}.hdr p{font-size:12px;color:#6B7280}
        .sum{display:flex;gap:16px;margin-bottom:24px}.sum div{flex:1;border-radius:8px;padding:16px;text-align:center}
        .sr{background:#F0FDF4;border:1px solid #BBF7D0}.sd{background:#FEF2F2;border:1px solid #FECACA}
        .ss{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;margin-bottom:24px;display:flex;justify-content:space-between}
        table{width:100%;border-collapse:collapse}th{text-align:left;padding:10px 12px;background:#F3F4F6;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;border-bottom:2px solid #E5E7EB}
        .ft{margin-top:32px;border-top:1px solid #E5E7EB;padding-top:12px;font-size:11px;color:#9CA3AF;text-align:center}
      </style></head><body>
        <div class="hdr"><div><h1>HomeCare</h1><p>Relatório Financeiro</p></div><div style="text-align:right;font-size:12px;color:#6B7280"><div>${monthLabel}/${year}</div><div>Gerado: ${new Date().toLocaleDateString('pt-BR')}</div></div></div>
        <div class="sum">
          <div class="sr"><div style="font-size:11px;color:#6B7280">Receita</div><div style="font-size:22px;font-weight:800;color:#16A34A">${fmtCurrency(totalReceita)}</div></div>
          <div class="sd"><div style="font-size:11px;color:#6B7280">Despesa</div><div style="font-size:22px;font-weight:800;color:#DC2626">${fmtCurrency(totalDespesa)}</div></div>
        </div>
        <div class="ss"><span style="font-weight:600">Saldo</span><span style="font-weight:800;color:${saldo >= 0 ? '#16A34A' : '#DC2626'}">${fmtCurrency(saldo)}</span></div>
        ${entries.length > 0 ? `<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th style="text-align:right">Valor</th></tr></thead><tbody>${rows}</tbody></table>` : '<p style="text-align:center;color:#6B7280;padding:40px">Sem lançamentos.</p>'}
        <div class="ft">HomeCare App · Relatório gerado automaticamente</div>
      </body></html>`;

      const result = await RNHTMLtoPDF.default.convert({
        html,
        fileName: `Financeiro_${monthLabel}_${year}`,
        directory: 'Documents',
        base64: false,
      });

      if (!result?.filePath) { Alert.alert('Erro', 'Não foi possível gerar o PDF.'); return; }

      if (Share) {
        await Share.default.open({
          url: Platform.OS === 'android' ? `file://${result.filePath}` : result.filePath,
          type: 'application/pdf',
          title: `Financeiro — ${monthLabel}/${year}`,
        });
      } else {
        Alert.alert('PDF gerado', `Salvo em: ${result.filePath}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      if (!msg.includes('User did not share')) Alert.alert('Erro', msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backBtn}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Financeiro</Text>
        <View style={styles.separator} />
      </View>

      {/* Month selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
        <View style={styles.monthRow}>
          {MONTHS.map((label, idx) => {
            const active = selectedMonth === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.monthChip, active && styles.monthChipActive]}
                onPress={() => handleMonthChange(idx)}
                activeOpacity={0.7}
              >
                <Text style={[styles.monthText, active && styles.monthTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {usingMock && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockBannerText}>Dados de exemplo — lançamentos reais serão configuráveis.</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.admin} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.admin}
            />
          }
        >
          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.summaryReceita]}>
              <Text style={styles.summaryLabel}>Receita</Text>
              <Text style={styles.summaryValueGreen}>{fmtCurrency(totalReceita)}</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryDespesa]}>
              <Text style={styles.summaryLabel}>Despesa</Text>
              <Text style={styles.summaryValueRed}>{fmtCurrency(totalDespesa)}</Text>
            </View>
          </View>

          {/* Saldo */}
          <View style={[styles.saldoCard, saldo < 0 && styles.saldoCardNeg]}>
            <Text style={styles.saldoLabel}>Saldo do mês</Text>
            <Text style={[styles.saldoValue, saldo < 0 && styles.saldoValueNeg]}>
              {fmtCurrency(saldo)}
            </Text>
          </View>

          {/* Entries list */}
          <Text style={styles.sectionTitle}>LANÇAMENTOS</Text>
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum lançamento neste mês.</Text>
          ) : (
            entries.map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryLeft}>
                  <View style={[styles.entryDot, entry.tipo === 'receita' ? styles.dotGreen : styles.dotRed]} />
                  <View>
                    <Text style={styles.entryDesc}>{entry.descricao}</Text>
                    <Text style={styles.entryCat}>
                      {entry.categoria} · {entry.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.entryValue, entry.tipo === 'receita' ? styles.entryValueGreen : styles.entryValueRed]}>
                  {entry.tipo === 'receita' ? '+' : '-'} {fmtCurrency(entry.valor)}
                </Text>
              </View>
            ))
          )}

          {/* Export button */}
          <TouchableOpacity
            style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
            onPress={handleExportPDF}
            activeOpacity={0.8}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.exportBtnText}>Exportar PDF</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  backBtn: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: spacing.md },

  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Month
  monthScroll: { maxHeight: 50, paddingLeft: spacing.lg, marginVertical: spacing.sm },
  monthRow: { flexDirection: 'row', gap: spacing.xs },
  monthChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthChipActive: { backgroundColor: colors.admin, borderColor: colors.admin },
  monthText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textPrimary },
  monthTextActive: { color: colors.white },

  mockBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  mockBannerText: { fontSize: fontSize.xs, color: '#92400E', fontWeight: '500' },

  scrollContent: { paddingHorizontal: spacing.lg },

  // Summary
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  summaryCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  summaryReceita: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  summaryDespesa: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  summaryLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5 },
  summaryValueGreen: { fontSize: fontSize.xl, fontWeight: '800', color: '#16A34A', marginTop: spacing.xs },
  summaryValueRed: { fontSize: fontSize.xl, fontWeight: '800', color: '#DC2626', marginTop: spacing.xs },

  // Saldo
  saldoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saldoCardNeg: { borderColor: '#FECACA' },
  saldoLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  saldoValue: { fontSize: fontSize.xl, fontWeight: '800', color: '#16A34A' },
  saldoValueNeg: { color: '#DC2626' },

  // Section
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emptyText: { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },

  // Entry
  entryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  entryDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#16A34A' },
  dotRed: { backgroundColor: '#DC2626' },
  entryDesc: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  entryCat: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  entryValue: { fontSize: fontSize.sm, fontWeight: '700' },
  entryValueGreen: { color: '#16A34A' },
  entryValueRed: { color: '#DC2626' },

  // Export
  exportBtn: {
    backgroundColor: colors.admin,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    height: 52,
    justifyContent: 'center',
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { fontSize: fontSize.md, fontWeight: '700', color: colors.white },
});
