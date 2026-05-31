import React, { useMemo, useState } from 'react';
import axios from 'axios';
import useTraceStore from '@/store/traceStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChartBar, Lightning, TrendUp, Wrench, Warning, CheckCircle } from '@phosphor-icons/react';

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000/api";

const ConfidenceBadge = ({ confidence }) => {
  const pct = Math.round((confidence || 0) * 100);
  let color = 'text-red-400 bg-red-500/10 border-red-500/20';
  let icon = <Warning size={10} weight="fill" />;
  if (pct >= 70) {
    color = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    icon = <CheckCircle size={10} weight="fill" />;
  } else if (pct >= 40) {
    color = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    icon = <Warning size={10} weight="fill" />;
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${color}`}>
      {icon} {pct}% confidence
    </span>
  );
};

const SummaryCard = ({ label, data, gradientClass }) => (
  <div className="rounded-xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900/80 to-zinc-900/40 overflow-hidden">
    <div className="px-4 py-4 text-center">
      <div className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-500">
        {label}
      </div>
      <div className={`text-2xl sm:text-3xl font-mono font-bold bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}>
        {data?.estimated_complexity || 'O(?)'}
      </div>
      <div className="text-[10px] text-zinc-500 font-plex mt-1.5 flex items-center justify-center gap-2">
        <span>Estimated complexity</span>
        <ConfidenceBadge confidence={data?.confidence} />
      </div>
    </div>
  </div>
);

const ReasoningCard = ({ label, data, iconClass }) => (
  <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2.5">
    <div className="flex items-center gap-1.5 mb-1.5">
      <TrendUp size={12} className={iconClass} />
      <span className="text-[10px] font-plex tracking-[0.15em] uppercase text-zinc-500">
        {label}
      </span>
    </div>
    <p className="text-xs text-zinc-300 font-plex leading-relaxed">
      {data?.reasoning || 'Estimate inferred from observed execution.'}
    </p>
  </div>
);

const ListCard = ({ label, Icon, iconClass, items, emptyText, marker, markerClass }) => (
  <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2.5">
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon size={12} className={iconClass} />
      <span className="text-[10px] font-plex tracking-[0.15em] uppercase text-zinc-500">
        {label}
      </span>
    </div>
    <div className="text-xs text-zinc-300 font-plex space-y-1">
      {(items || []).length === 0
        ? <span className="text-zinc-500">{emptyText}</span>
        : (items || []).map((item, i) => (
          <div key={`${label}-${i}`} className="flex items-start gap-1.5">
            <span className={`${markerClass} shrink-0 mt-0.5`}>{marker}</span>
            <span>{item}</span>
          </div>
        ))}
    </div>
  </div>
);

const ComplexityPanel = () => {
  const code = useTraceStore((s) => s.code);
  const language = useTraceStore((s) => s.language);
  const traceSummary = useTraceStore((s) => s.traceSummary);
  const complexity = useTraceStore((s) => s.aiComplexity);
  const setAiComplexity = useTraceStore((s) => s.setAiComplexity);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalized = useMemo(() => {
    if (!complexity) return null;
    if (complexity.time || complexity.space) {
      return complexity;
    }
    return { time: complexity, space: null };
  }, [complexity]);

  const timeData = normalized?.time || null;
  const spaceData = normalized?.space || null;

  const handleEstimate = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API}/ai/complexity`, {
        code,
        language,
        trace_summary: traceSummary,
      }, { timeout: 120000 });
      setAiComplexity(res.data);
    } catch (err) {
      const payload = err.response?.data;
      const errMsg = payload?.reasoning
        || payload?.time?.reasoning
        || payload?.space?.reasoning
        || err.message
        || 'Failed to reach AI service.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div data-testid="complexity-panel" className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartBar size={14} weight="fill" className="text-emerald-400" />
          <span className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-500">
            Complexity
          </span>
        </div>
        <button
          data-testid="complexity-estimate-button"
          type="button"
          onClick={handleEstimate}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-plex uppercase tracking-[0.12em] bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all disabled:opacity-40"
        >
          <Lightning size={10} weight="fill" className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      <ScrollArea className="flex-1">
        {error && (
          <div className="mx-4 mt-3 px-3 py-2 rounded border border-red-500/20 bg-red-500/5 text-[10px] font-plex text-red-400">
            {error}
          </div>
        )}

        {normalized ? (
          <div className="p-4 space-y-4">
            {/* Big-O Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SummaryCard
                label="Time Complexity"
                data={timeData}
                gradientClass="from-emerald-400 to-blue-400"
              />
              <SummaryCard
                label="Space Complexity"
                data={spaceData}
                gradientClass="from-amber-400 to-orange-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-500">
                  Time Details
                </div>
                <ReasoningCard label="Reasoning" data={timeData} iconClass="text-blue-400" />
                <ListCard
                  label="Dominant Operations"
                  Icon={ChartBar}
                  iconClass="text-amber-400"
                  items={timeData?.dominant_operations}
                  emptyText="No dominant operations detected."
                  marker="•"
                  markerClass="text-amber-400"
                />
                <ListCard
                  label="Optimization Ideas"
                  Icon={Wrench}
                  iconClass="text-emerald-400"
                  items={timeData?.possible_optimizations}
                  emptyText="No optimization ideas yet."
                  marker="→"
                  markerClass="text-emerald-400"
                />
              </div>
              <div className="space-y-3">
                <div className="text-[10px] font-plex tracking-[0.2em] uppercase text-zinc-500">
                  Space Details
                </div>
                <ReasoningCard label="Reasoning" data={spaceData} iconClass="text-orange-400" />
                <ListCard
                  label="Dominant Allocations"
                  Icon={ChartBar}
                  iconClass="text-amber-400"
                  items={spaceData?.dominant_operations}
                  emptyText="No dominant allocations detected."
                  marker="•"
                  markerClass="text-amber-400"
                />
                <ListCard
                  label="Optimization Ideas"
                  Icon={Wrench}
                  iconClass="text-emerald-400"
                  items={spaceData?.possible_optimizations}
                  emptyText="No optimization ideas yet."
                  marker="→"
                  markerClass="text-emerald-400"
                />
              </div>
            </div>

            {/* Disclaimer */}
            <div className="text-[10px] text-zinc-600 font-plex text-center px-2 leading-relaxed">
              ⚠ These are AI-inferred estimates based on observed execution patterns.
              Actual complexity may differ with different inputs.
            </div>
          </div>
        ) : (
          <div className="p-4 flex flex-col items-center justify-center h-full gap-3 text-center">
            <ChartBar size={28} className="text-zinc-700" />
            <div>
              <p className="text-sm text-zinc-500 font-plex">
                Analyze time and space complexity with AI
              </p>
              <p className="text-[10px] text-zinc-600 font-plex mt-1">
                {traceSummary
                  ? 'Click Analyze to estimate complexity from the trace.'
                  : 'Run code first to generate trace data.'}
              </p>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ComplexityPanel;
