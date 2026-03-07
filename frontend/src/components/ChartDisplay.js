import React from 'react';
import Plot from 'react-plotly.js';

const API_URL =
    (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) ||
    'https://archcoder-llm-excel-plotter-agent.hf.space';

const ChartDisplay = ({ chartPath, chartSpec }) => {
    if (chartSpec && chartSpec.data) {
        return (
            <div className="chart-display">
                <Plot
                    data={chartSpec.data}
                    layout={{
                        ...chartSpec.layout,
                        autosize: true,
                        margin: { l: 50, r: 20, t: 50, b: 50 },
                    }}
                    config={{ responsive: true, displaylogo: false, displayModeBar: false }}
                    style={{ width: '100%', minHeight: '380px' }}
                />
            </div>
        );
    }

    if (chartPath) {
        return (
            <div className="chart-display">
                <img
                    src={`${API_URL}/${chartPath}`}
                    alt="Generated chart"
                />
            </div>
        );
    }

    return (
        <div className="chart-display chart-empty">
            <div className="chart-empty-icon">📊</div>
            <p>Your chart will appear here</p>
        </div>
    );
};

export default ChartDisplay;
