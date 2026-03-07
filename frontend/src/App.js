import React, { useState } from 'react';
import Chatbot from './components/Chatbot';
import ChartDisplay from './components/ChartDisplay';
import FileUpload from './components/FileUpload';
import './main.css';

const App = () => {
    const [chartPath, setChartPath]           = useState('');
    const [chartSpec, setChartSpec]           = useState(null);
    const [uploadedFilePath, setUploadedFilePath] = useState('');

    return (
        <div className="app-root">
            <header className="app-header">
                <h1>AI Data Analyst</h1>
                <p className="app-subtitle">Upload a CSV, describe your chart, and let Qwen visualize it</p>
            </header>

            <main className="app-body">
                <aside className="sidebar">
                    <FileUpload onUploadSuccess={setUploadedFilePath} />
                </aside>

                <section className="chat-panel">
                    <Chatbot
                        setChartPath={setChartPath}
                        setChartSpec={setChartSpec}
                        uploadedFilePath={uploadedFilePath}
                    />
                </section>

                <section className="chart-panel">
                    <ChartDisplay chartPath={chartPath} chartSpec={chartSpec} />
                </section>
            </main>
        </div>
    );
};

export default App;