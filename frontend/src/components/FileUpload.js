import React, { useState } from 'react';
import { requestWithRetry } from '../api/client';

const FileUpload = ({ onUploadSuccess }) => {
    const [file, setFile]           = useState(null);
    const [columns, setColumns]     = useState([]);
    const [preview, setPreview]     = useState([]);
    const [message, setMessage]     = useState('');
    const [isError, setIsError]     = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress]   = useState(0);

    const handleBackendStatus = (status, meta = {}) => {
        if (status === 'waking') {
            setMessage('Waking up server before upload...');
            setIsError(false);
            return;
        }
        if (status === 'backoff') {
            const sec = Math.max(1, Math.round((meta.delay || 0) / 1000));
            setMessage(`Server is waking up. Retrying in ${sec}s...`);
            setIsError(false);
        }
    };

    const handleFileChange = (e) => {
        const chosen = e.target.files[0];
        setFile(chosen);
        setMessage('');
        setColumns([]);
        setPreview([]);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return;
        setUploading(true);
        setProgress(10);

        const tick = setInterval(() => {
            setProgress((p) => (p >= 85 ? clearInterval(tick) || 85 : p + 15));
        }, 250);

        const form = new FormData();
        form.append('file', file);

        try {
            const res = await requestWithRetry({
                method: 'post',
                path: '/upload',
                data: form,
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000,
                maxRetries: 4,
                wakeBeforeFirstTry: true,
                onStatus: handleBackendStatus,
            });
            clearInterval(tick);
            setProgress(100);
            setTimeout(() => {
                setColumns(res.data.columns || []);
                setPreview(res.data.preview || []);
                setMessage(res.data.message || 'Upload successful.');
                setIsError(false);
                if (onUploadSuccess) onUploadSuccess(res.data.file_path);
                setUploading(false);
                setProgress(0);
            }, 400);
        } catch (err) {
            clearInterval(tick);
            setMessage('Upload failed: ' + (err.response?.data?.error || err.message));
            setIsError(true);
            setUploading(false);
            setProgress(0);
        }
    };

    return (
        <div className="upload-panel">
            <h2>Data File</h2>

            <form onSubmit={handleUpload} className="upload-form">
                <label className="file-input-label">
                    {file ? file.name : 'Choose CSV or Excel file'}
                    <input
                        type="file"
                        accept=".csv,.xls,.xlsx"
                        onChange={handleFileChange}
                        disabled={uploading}
                    />
                </label>
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={uploading || !file}
                    style={{ width: '100%' }}
                >
                    {uploading ? 'Uploading...' : 'Upload'}
                </button>
            </form>

            {uploading && (
                <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
            )}

            {message && (
                <div className={`status-msg ${isError ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            {columns.length > 0 && (
                <>
                    <div className="col-tags">
                        {columns.map((col) => (
                            <span key={col} className="col-tag">{col}</span>
                        ))}
                    </div>

                    {preview.length > 0 && (
                        <div className="preview-wrap">
                            <table className="preview-table">
                                <thead>
                                    <tr>
                                        {columns.map((col) => <th key={col}>{col}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.slice(0, 5).map((row, i) => (
                                        <tr key={i}>
                                            {columns.map((col) => (
                                                <td key={col}>{row[col] ?? ''}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default FileUpload;
