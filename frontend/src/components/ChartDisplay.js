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
                        margin: { l: 60, r: 30, t: 60, b: 60 },
                    }}
                    config={{ responsive: true, displaylogo: false }}
                    style={{ width: '100%', minHeight: '420px' }}
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
                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                />
            </div>
        );
    }

    return (
        <div className="chart-display chart-empty">
            <p>No chart generated yet. Ask a question to visualize your data.</p>
        </div>
    );
};

export default ChartDisplay;
