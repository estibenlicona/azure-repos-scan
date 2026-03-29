import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const VERSION_COLORS: Record<string, string> = {
  'net3.1': '#f85149',
  'net5.0': '#f0883e',
  'net6.0': '#d29922',
  'net7.0': '#9f7aea',
  'net8.0': '#00d4aa',
  'net9.0': '#58a6ff',
  'net10.0': '#3fb950',
};

const FALLBACK_COLOR = '#8b949e';

interface MonthlySnapshot {
  month: string;
  reposByVersion: Record<string, number>;
}

interface EvolutionChartProps {
  readonly data: MonthlySnapshot[];
}

export function EvolutionChart({ data }: EvolutionChartProps): React.JSX.Element {
  const labels = data.map((s) => s.month);

  const allVersions = [...new Set(data.flatMap((s) => Object.keys(s.reposByVersion)))];

  const datasets = allVersions.map((version) => {
    const color = VERSION_COLORS[version] ?? FALLBACK_COLOR;
    return {
      label: version,
      data: data.map((s) => s.reposByVersion[version] ?? 0),
      borderColor: color,
      backgroundColor: `${color}33`,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    };
  });

  return (
    <Line
      data={{ labels, datasets }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { color: '#30363d40' },
            ticks: { color: '#8b949e', font: { size: 11 } },
          },
          y: {
            stacked: true,
            grid: { color: '#30363d40' },
            ticks: { color: '#8b949e', font: { size: 11 }, precision: 0 },
            beginAtZero: true,
          },
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#e6edf3',
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 10,
              font: { size: 11 },
            },
          },
          tooltip: {
            backgroundColor: '#21262d',
            titleColor: '#e6edf3',
            bodyColor: '#e6edf3',
            borderColor: '#30363d',
            borderWidth: 1,
          },
        },
      }}
    />
  );
}
