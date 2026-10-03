import { EventBus } from './utils.js';
import { getLast7DaysData, getLast30DaysData, getTagDistribution, getHeatmapData } from './stats.js';

let weeklyChart = null;
let monthlyChart = null;
let tagsChart = null;

/**
 * Initializes the charts
 */
export function initCharts() {
    updateCharts();
    EventBus.on('session:logged', updateCharts);
    EventBus.on('data:imported', updateCharts);
    EventBus.on('data:cleared', updateCharts);
}

/**
 * Updates all charts with new data
 */
export function updateCharts() {
    createWeeklyChart();
    createMonthlyChart();
    createTagsChart();
    renderHeatmap('heatmap-container');
}

/**
 * Creates the weekly bar chart
 */
export function createWeeklyChart() {
    const canvas = document.getElementById('chart-weekly');
    if (!canvas || !window.Chart) return;

    if (weeklyChart) {
        weeklyChart.destroy();
    }

    const data = getLast7DaysData();
    const ctx = canvas.getContext('2d');
    
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#3498db';
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#e0e0e0';

    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: 'Focus Minutes',
                data: data.map(d => d.minutes),
                backgroundColor: primaryColor,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Last 7 Days' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: borderColor }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Creates the monthly line chart
 */
export function createMonthlyChart() {
    const canvas = document.getElementById('chart-monthly');
    if (!canvas || !window.Chart) return;

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    const data = getLast30DaysData();
    const ctx = canvas.getContext('2d');
    
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#3498db';
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#e0e0e0';

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, primaryColor + '80');
    gradient.addColorStop(1, primaryColor + '00');

    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.substring(5)),
            datasets: [{
                label: 'Focus Minutes',
                data: data.map(d => d.minutes),
                borderColor: primaryColor,
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Last 30 Days' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: borderColor }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

/**
 * Creates the tags doughnut chart
 */
export function createTagsChart() {
    const canvas = document.getElementById('chart-tags');
    if (!canvas || !window.Chart) return;

    if (tagsChart) {
        tagsChart.destroy();
    }

    const data = getTagDistribution();
    const ctx = canvas.getContext('2d');
    
    const colors = {
        'Study': '#3498db',
        'Coding': '#9b59b6',
        'Work': '#e67e22',
        'Personal': '#1abc9c',
        'Health': '#2ecc71',
        'Reading': '#e74c3c',
        'No Tag': '#95a5a6'
    };

    const totalMinutes = data.reduce((sum, d) => sum + d.minutes, 0);
    const totalHours = (totalMinutes / 60).toFixed(1) + 'h';

    tagsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.tag),
            datasets: [{
                data: data.map(d => d.minutes),
                backgroundColor: data.map(d => colors[d.tag] || colors['No Tag']),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right' },
                title: { display: true, text: 'Time by Category' }
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw: function(chart) {
                var width = chart.width,
                    height = chart.height,
                    ctx = chart.ctx;
        
                ctx.restore();
                var fontSize = (height / 114).toFixed(2);
                ctx.font = "bold " + fontSize + "em sans-serif";
                ctx.textBaseline = "middle";
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#333';
        
                var text = totalHours,
                    textX = Math.round((width - ctx.measureText(text).width) / 2) - (chart.legend?.width / 2 || 0) + 10,
                    textY = height / 2;
        
                ctx.fillText(text, textX, textY);
                ctx.save();
            }
        }]
    });
}

/**
 * Renders the heatmap in the specified container
 * @param {string} containerId ID of the container element
 */
export function renderHeatmap(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = getHeatmapData(12);
    const cellSize = 14;
    const gap = 2;
    const cols = 12; // weeks
    const rows = 7; // days per week

    let svg = `<svg width="${(cellSize + gap) * cols + 30}" height="${(cellSize + gap) * rows + 20}">`;
    
    // Add day labels
    const dayLabels = ['Mon', 'Wed', 'Fri'];
    dayLabels.forEach((label, i) => {
        svg += `<text x="0" y="${(i * 2 + 1) * (cellSize + gap) + 10}" font-size="10" fill="var(--color-text-secondary)">${label}</text>`;
    });

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#3498db';
    const bgTertiary = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-tertiary').trim() || '#ebedf0';

    const getColor = (count) => {
        if (count === 0) return bgTertiary;
        if (count <= 2) return `${primaryColor}66`; // 40% opacity
        if (count <= 4) return `${primaryColor}b3`; // 70% opacity
        return primaryColor;
    };

    let colData = [];
    for(let i=0; i<cols; i++) {
        colData.push(data.slice(i*7, (i+1)*7));
    }
    // Reverse to have oldest on left, newest on right
    colData.reverse();

    colData.forEach((week, colIndex) => {
        week.forEach((day, rowIndex) => {
            const x = colIndex * (cellSize + gap) + 30;
            const y = rowIndex * (cellSize + gap) + 15;
            const color = getColor(day.count);
            svg += `
                <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" rx="2">
                    <title>${day.date}: ${day.count} sessions</title>
                </rect>
            `;
        });
    });

    svg += '</svg>';
    container.innerHTML = svg;
}

/**
 * Destroys all charts to prevent memory leaks
 */
export function destroyCharts() {
    if (weeklyChart) weeklyChart.destroy();
    if (monthlyChart) monthlyChart.destroy();
    if (tagsChart) tagsChart.destroy();
}
