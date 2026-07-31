/**
 * Analytics Hook
 *
 * Aggregates data from multiple sources for analytics dashboards
 */

import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { useYieldVault } from '@/hooks/use-yield-vault-v2';
import { useActiveInvoices, useTotalInvoices, useInvoice } from '@/features/invoices';
import { useVaultDeposit, useAccruedYield } from '@/features/vault';

export interface PortfolioAllocationData {
  strategy: string;
  value: number;
  percentage: number;
  apy: number;
  color: string;
  [key: string]: string | number;
}

export interface RiskDistributionData {
  range: string;
  count: number;
  color: string;
}

export interface YieldDataPoint {
  date: string;
  timestamp: number;
  yield: number;
  cumulative: number;
}

export interface PerformanceMetrics {
  totalYield: string;
  averageAPY: number;
  totalDeposited: string;
  activeInvoices: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_BASE_TIMESTAMP = Date.UTC(2026, 6, 31);
const getDemoDailyYield = (index: number) => 75 + ((index * 37) % 58);
const getDemoCumulativeYield = (index: number) =>
  Array.from({ length: index + 1 }, (_, itemIndex) => getDemoDailyYield(itemIndex))
    .reduce((total, dailyYield) => total + dailyYield, 0);

export function useAnalytics() {
  const { tvl, conservativeAPY, aggressiveAPY, isLoading: isLoadingVault } = useYieldVault();
  const { data: activeInvoiceIds, isLoading: isLoadingActive } = useActiveInvoices();
  const { isLoading: isLoadingTotal } = useTotalInvoices();

  const allocationData = useMemo((): PortfolioAllocationData[] => {
    const total = Number(tvl);

    return [
      {
        strategy: 'Hold',
        value: total * 0.2,
        percentage: 20,
        apy: 0,
        color: 'hsl(var(--chart-1))',
      },
      {
        strategy: 'Conservative',
        value: total * 0.5,
        percentage: 50,
        apy: conservativeAPY,
        color: 'hsl(var(--chart-2))',
      },
      {
        strategy: 'Aggressive',
        value: total * 0.3,
        percentage: 30,
        apy: aggressiveAPY,
        color: 'hsl(var(--chart-3))',
      },
    ].filter(item => item.value > 0);
  }, [tvl, conservativeAPY, aggressiveAPY]);

  const riskDistribution = useMemo((): RiskDistributionData[] => [
    { range: '0-20', count: 2, color: 'hsl(0 84.2% 60.2%)' },
    { range: '21-40', count: 5, color: 'hsl(25 95% 53%)' },
    { range: '41-60', count: 8, color: 'hsl(48 96% 53%)' },
    { range: '61-80', count: 12, color: 'hsl(142.1 76.2% 36.3%)' },
    { range: '81-100', count: 18, color: 'hsl(142.1 70.6% 45.3%)' },
  ], []);

  const yieldHistory = useMemo((): YieldDataPoint[] => Array.from({ length: 31 }, (_, index) => {
    const dayOffset = 30 - index;
    const date = new Date(DEMO_BASE_TIMESTAMP - dayOffset * DAY_MS);
    const dailyYield = getDemoDailyYield(index);

    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      timestamp: date.getTime(),
      yield: dailyYield,
      cumulative: getDemoCumulativeYield(index),
    };
  }), []);

  const performanceMetrics = useMemo((): PerformanceMetrics => ({
    totalYield: '0',
    averageAPY: (conservativeAPY + aggressiveAPY) / 2,
    totalDeposited: tvl,
    activeInvoices: activeInvoiceIds?.length || 0,
  }), [tvl, conservativeAPY, aggressiveAPY, activeInvoiceIds]);

  return {
    allocationData,
    riskDistribution,
    yieldHistory,
    performanceMetrics,
    isLoading: isLoadingVault || isLoadingActive || isLoadingTotal,
  };
}

export function useInvoiceAnalytics(tokenId?: bigint) {
  const { data: invoice } = useInvoice(tokenId);
  const { data: deposit } = useVaultDeposit(tokenId);
  const { data: accruedYield } = useAccruedYield(tokenId);

  return useMemo(() => {
    if (!invoice || !deposit) return null;

    const principal = formatUnits(deposit.principal || BigInt(0), 18);
    const yield_ = formatUnits(accruedYield || BigInt(0), 18);
    const daysActive = deposit.depositTime
      ? Math.floor((DEMO_BASE_TIMESTAMP / 1000 - Number(deposit.depositTime)) / 86400)
      : 0;

    return {
      invoice,
      deposit,
      principal,
      accruedYield: yield_,
      daysActive,
      dailyYield: daysActive > 0 ? Number(yield_) / daysActive : 0,
    };
  }, [invoice, deposit, accruedYield]);
}