import React, { useState, useRef, useEffect } from 'react';
import { API_URL, requestWithRetry } from '../api/client';

const MODEL_OPTIONS = [
  { label: 'Qwen2.5-Coder-0.5B', value: 'qwen', description: 'Fast, optimized for structured output' },
  { label: 'BART (fine-tuned)', value: 'bart', description: 'Fallback seq2seq model' },
];

const SAMPLE_QUERIES = [
  "plot the sales over the years with a red line",
  "bar chart of employee expenses by year",
  "scatter plot of sales vs net profit",
  "show EBITDA and EBIT over time",
  "pie chart of sales by year",
  "histogram of net profit values",
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
            config={{ displayModeBar: false, scrollZoom: true, displaylogo: false }}
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
        style={{ marginTop: 12, width: '100%', borderRadius: 10, border: '1px solid var(--border)' }}
      />
    );
  }
  return null;
};

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`msg-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`msg-bubble ${isUser ? 'user' : 'assistant'}`}>
        {message.error && <span className="msg-error">Error: </span>}
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
  const [backendNotice, setBackendNotice] = useState('');
  const bottomRef                     = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const addMessage = (msg) =>
    setMessages((prev) => [...prev, { ...msg, id: Date.now() + Math.random() }]);

  const handleBackendStatus = (status, meta = {}) => {
    if (status === 'waking') {
      setBackendNotice('Waking up server... this can take 10-60 seconds on free tier.');
      return;
    }
    if (status === 'backoff') {
      const sec = Math.max(1, Math.round((meta.delay || 0) / 1000));
      setBackendNotice(`Retrying request in ${sec}s...`);
      return;
    }
    if (status === 'retrying') {
      setBackendNotice(`Retry attempt ${meta.attempt || 1} of ${(meta.maxRetries || 0) + 1}...`);
      return;
    }
    if (status === 'ready' || status === 'requesting') {
      setBackendNotice('');
      return;
    }
    if (status === 'failed') {
      setBackendNotice('Server did not wake up in time. Please try again.');
    }
  };

  const sendQuery = async (query) => {
    if (!query.trim() || loading) return;
    addMessage({ role: 'user', content: query });
    setInput('');
    setLoading(true);
    setBackendNotice('');
    try {
      const payload = { query, model };
      if (uploadedFilePath) payload.file_path = uploadedFilePath;
      const res = await requestWithRetry({
        method: 'post',
        path: '/plot',
        data: payload,
        timeout: 120000,
        headers: { 'Content-Type': 'application/json' },
        maxRetries: 5,
        wakeBeforeFirstTry: true,
        onStatus: handleBackendStatus,
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
      setBackendNotice('');
      setLoading(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); sendQuery(input); };

  const handleUseSampleData = async () => {
    setLoading(true);
    setBackendNotice('');
    try {
      const blob     = new Blob([SAMPLE_DATA_CSV], { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', blob, 'sample_data.csv');
      const uploadRes = await requestWithRetry({
        method: 'post',
        path: '/upload',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
        maxRetries: 4,
        wakeBeforeFirstTry: true,
        onStatus: handleBackendStatus,
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
      setBackendNotice('');
      setLoading(false);
    }
  };

  const canSend = !loading && input.trim();

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div>
          <div className="chat-header-title">Chat</div>
          <div className="chat-header-sub">Describe the chart you want</div>
        </div>
        <select
          className="model-select"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {backendNotice && <div className="backend-notice">{backendNotice}</div>}
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-title">Visualize Your Data</div>
            <div className="chat-empty-desc">Upload a CSV or load the sample dataset, then describe the chart you want. AI will generate it instantly.</div>
          </div>
        )}
        {messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
        {loading && (
          <div className="msg-row assistant">
            <div className="msg-bubble assistant">
              <div className="loading-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sample queries bar */}
      <div className="samples-bar">
        <button
          className="samples-toggle"
          onClick={() => setShowSamples(!showSamples)}
        >
          {showSamples ? 'Hide examples' : 'Example queries'}
        </button>
        {showSamples && (
          <div className="samples-grid">
            {SAMPLE_QUERIES.map((q, i) => (
              <button
                key={i}
                className="sample-chip"
                onClick={() => { sendQuery(q); setShowSamples(false); }}
              >
                {q}
              </button>
            ))}
            <button
              className="sample-chip load-data"
              onClick={handleUseSampleData}
              disabled={loading}
            >
              Load sample dataset
            </button>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="chat-input-bar">
        {uploadedFilePath && (
          <div className="chat-input-info">Using uploaded file</div>
        )}
        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            className="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. plot sales over years as a line chart..."
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!canSend}
            className={`chat-send-btn ${canSend ? 'active' : 'disabled'}`}
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;

