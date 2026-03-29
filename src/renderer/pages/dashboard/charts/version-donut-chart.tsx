import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, type Plugin } from 'chart.js';
import { getVersionLabel, getVersionColor } from '@renderer/lib/version-utils';

ChartJS.register(ArcElement, Tooltip, Legend);

const centerTextPlugin: Plugin<'doughnut'> = {
  id: 'centerText',
  afterDraw(chart) {
    const { ctx, width, height } = chart;
    const meta = chart.getDatasetMeta(0) as { total?: number };
    const total = meta.total ?? 0;

    ctx.save();
    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#e6edf3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(total), width / 2, height / 2 - 6);

    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#8b949e';
    ctx.fillText('repos', width / 2, height / 2 + 14);
    ctx.restore();
  },
};

interface VersionDonutChartProps {
  readonly data: Record<string, number>;
}

export function VersionDonutChart({ data }: VersionDonutChartProps): React.JSX.Element {
  const keys = Object.keys(data);
  const labels = keys.map(getVersionLabel);
  const values = Object.values(data);
  const colors = keys.map(getVersionColor);

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: '#161b22',
        borderWidth: 2,
        hoverBorderColor: '#30363d',
      },
    ],
  };

  return (
    <Doughnut
      data={chartData}
      plugins={[centerTextPlugin]}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#e6edf3',
              padding: 12,
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
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              },
            },
          },
        },
      }}
    />
  );
}
