import { lazy, Suspense } from 'react';

// Lazy load Recharts only when charts are actually rendered
const PieChart = lazy(() => import('recharts').then(module => ({ default: module.PieChart })));
const Pie = lazy(() => import('recharts').then(module => ({ default: module.Pie })));
const Cell = lazy(() => import('recharts').then(module => ({ default: module.Cell })));
const LineChart = lazy(() => import('recharts').then(module => ({ default: module.LineChart })));
const Line = lazy(() => import('recharts').then(module => ({ default: module.Line })));
const AreaChart = lazy(() => import('recharts').then(module => ({ default: module.AreaChart })));
const Area = lazy(() => import('recharts').then(module => ({ default: module.Area })));
const XAxis = lazy(() => import('recharts').then(module => ({ default: module.XAxis })));
const YAxis = lazy(() => import('recharts').then(module => ({ default: module.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(module => ({ default: module.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const ResponsiveContainer = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));

interface LazyPieChartProps {
  data: any[];
  dataKey: string;
  nameKey: string;
  children?: React.ReactNode;
}

// Skeleton loader for charts
const ChartSkeleton = () => (
  <div className="w-full h-full flex items-center justify-center bg-white/5 rounded-xl animate-pulse">
    <div className="text-white/40">Loading chart...</div>
  </div>
);

export function LazyPieChart({ data, dataKey, nameKey, children }: LazyPieChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {children}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </Suspense>
  );
}

interface LazyAreaChartProps {
  data: any[];
  dataKey: string;
  stroke: string;
  fill: string;
  xAxisKey: string;
}

export function LazyAreaChart({ data, dataKey, stroke, fill, xAxisKey }: LazyAreaChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey={xAxisKey} stroke="rgba(255,255,255,0.5)" />
          <YAxis stroke="rgba(255,255,255,0.5)" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
            }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={stroke}
            fill={fill}
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Suspense>
  );
}

interface LazyLineChartProps {
  data: any[];
  lines: Array<{ dataKey: string; stroke: string; name: string }>;
  xAxisKey: string;
}

export function LazyLineChart({ data, lines, xAxisKey }: LazyLineChartProps) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey={xAxisKey} stroke="rgba(255,255,255,0.5)" />
          <YAxis stroke="rgba(255,255,255,0.5)" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
            }}
          />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              name={line.name}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Suspense>
  );
}
