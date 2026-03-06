import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://archcoder-llm-excel-plotter-agent.hf.space';

const MODEL_OPTIONS = [
  { label: 'Qwen 2.5-1.5B (HuggingFace)', value: 'qwen' },
  { label: 'Gemini 2.0 Flash',             value: 'gemini' },
  { label: 'Grok-3 Mini',                  value: 'grok' },
  { label: 'BART (fine-tuned)',             value: 'bart' },
];

const SAMPLE_QUERIES = [
  "plot the sales in the years with a red line",
  "show employee expenses and net profit over the years",
  "display the EBITDA for each year with a blue bar",
  "plot the RoCE over time as a scatter chart",
  "show sales as an area chart",
  "display the net profit in a bar chart",
  "plot EBIT and EBITDA over the years",
  "scatter plot of sales vs net profit",
  "histogram of net profit values",
  "pie chart of total sales by year",
];

const SAMPLE_DATA_CSV = [
  'Year,Sales,Employee expense,EBITDA,EBIT,Net profit,RoCE,interest,WC %',
  'FY12,1000,10,900,800,650,0.27,90,0.1',
  'FY13,1100,30,600,300,150,0.09,87,0.09',
  'FY14,1210,490,800,750,600,0.21,80,0.08',
  'FY15,1331,90,1100,1000,850,0.25,23,0.07',
  'FY16,1464.1,89,1200,1000,850,0.23,4,0.06',
].join('\n');

const InlineChart = ({ chartSpec, chartPath }) => {
  if (chartSpec && chartSpec.data) {
    try {
      const Plot = require('react-plotly.js').default;
      return (
        <div style={{ marginTop: 12, width: '100%' }}>
          <Plot
            data={chartSpec.data}
            layout={{ ...chartSpec.layout, width: undefined, autosize: true }}
            config={{ displayModeBar: true, scrollZoom: true, displaylogo: false }}
            style={{ width: '100%' }}
            useResizeHandler
          />
        </div>
      );
    } catch (_) { /* fall through */ }
  }
  if (chartPath) {
    return (
      <img
        src={`${API_URL}/${chartPath}?t=${Date.now()}`}
        alt="Generated chart"
        style={{ marginTop: 12, width: '100%', borderRadius: 8, border: '1px solid #1e2d3d' }}
      />
    );
  }
  return null;
};

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
      <div style={{
        maxWidth: '85%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        backgroundColor: isUser ? '#1d4ed8' : '#1e2d3d',
        color: '#e2e8f0',
        fontSize: 13,
        lineHeight: 1.6,
        border: `1px solid ${isUser ? '#2563eb' : '#2d3748'}`,
        wordBreak: 'break-word',
      }}>
        {message.error && <span style={{ color: '#f87171', fontWeight: 700 }}>Error: </span>}
        <span>{message.content}</span>
        {(message.chartSpec || message.chartPath) && (
          <InlineChart chartSpec={message.chartSpec} chartPath={message.chartPath} />
        )}
      </div>
    </div>
  );
};


const Chatbot = ({ setChartPath, setChartSpec, uploadedFilePath }) => {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [model, setModel]             = useState('qwen');
  const [loading, setLoading]         = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const bottomRef                     = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const addMessage = (msg) =>
    setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);

  const sendQuery = async (query) => {
    if (!query.trim() || loading) return;
    addMessage({ role: 'user', content: query });
    setInput('');
    setLoading(true);
    try {
      const payload = { query, model };
      if (uploadedFilePath) payload.file_path = uploadedFilePath;
      const res = await axios.post(`${API_URL}/plot`, payload, {
        timeout: 90000,
        headers: { 'Content-Type': 'application/json' },
      });
      const { response, chart_path, chart_spec, plot_args } = res.data;
      addMessage({
        role:      'assistant',
        content:   response || JSON.stringify(plot_args),
        chartPath: chart_path,
        chartSpec: chart_spec,
      });
      if (chart_path) setChartPath(chart_path);
      if (chart_spec && setChartSpec) setChartSpec(chart_spec);
    } catch (err) {
      addMessage({
        role:    'assistant',
        content: err.response?.data?.error || err.message || 'Request failed.',
        error:   true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); sendQuery(input); };

  const handleUseSampleData = async () => {
    setLoading(true);
    try {
      const blob     = new Blob([SAMPLE_DATA_CSV], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'sample_data.csv');
      const uploadRes = await axios.post(`${API_URL}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      addMessage({ role: 'user', content: 'Load sample financial dataset' });
      const cols = uploadRes.data.columns?.join(', ') || '';
      addMessage({
        role:    'assistant',
        content: `Sample data loaded. Columns: ${cols}. Now ask me to visualize it.`,
      });
    } catch (err) {
      addMessage({ role: 'assistant', content: `Failed to load sample data: ${err.message}`, error: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: '#0f1117', borderRadius: 12, border: '1px solid #1e2d3d', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #1e2d3d',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#0d1219',
      }}>
        <div>
          <div style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 600 }}>AI Data Analyst</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Ask anything about your data</div>
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid #2d3748',
            backgroundColor: '#1a2332', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
          }}
        >
          {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 180, maxHeight: 460 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#475569', padding: '40px 16px' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>Visualize Your Data</div>
            <div style={{ fontSize: 13 }}>Upload a CSV or load the sample dataset, then type a query.</div>
          </div>
        )}
        {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 14 }}>
            <div style={{
              padding: '10px 16px', backgroundColor: '#1e2d3d',
              borderRadius: '16px 16px 16px 4px', border: '1px solid #2d3748',
              color: '#64748b', fontSize: 13,
            }}>
              Analyzing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sample queries bar */}
      <div style={{ borderTop: '1px solid #1e2d3d', padding: '8px 20px' }}>
        <button
          onClick={() => setShowSamples(!showSamples)}
          style={{ background: 'none', border: 'none', color: '#4f8cff', cursor: 'pointer', fontSize: 12, padding: '2px 0' }}
        >
          {showSamples ? 'Hide examples' : 'Show example queries'}
        </button>
        {showSamples && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 4 }}>
            {SAMPLE_QUERIES.map((q, i) => (
              <button
                key={i}
                onClick={() => { sendQuery(q); setShowSamples(false); }}
                style={{
                  background: '#1a2332', color: '#94a3b8', border: '1px solid #2d3748',
                  padding: '4px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
                }}
              >
                {q}
              </button>
            ))}
            <button
              onClick={handleUseSampleData}
              disabled={loading}
              style={{
                background: '#14532d', color: '#4ade80', border: '1px solid #166534',
                padding: '4px 12px', borderRadius: 10, fontSize: 11,
                cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
              }}
            >
              Load sample dataset
            </button>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #1e2d3d', backgroundColor: '#0d1219' }}>
        {uploadedFilePath && (
          <div style={{ fontSize: 11, color: '#4f8cff', marginBottom: 6 }}>Using uploaded file</div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. plot sales over years as a line chart..."
            disabled={loading}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8,
              border: '1px solid #2d3748', backgroundColor: '#1a2332',
              color: '#e2e8f0', fontSize: 13, outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              padding: '10px 18px', borderRadius: 8, border: 'none',
              backgroundColor: loading || !input.trim() ? '#1e3a5f' : '#2563eb',
              color: loading || !input.trim() ? '#475569' : 'white',
              fontSize: 13, fontWeight: 600, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;

