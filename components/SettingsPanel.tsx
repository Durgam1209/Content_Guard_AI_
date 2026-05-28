import React, { useState, useEffect } from 'react';
import { Sliders, Key, ShieldCheck, RefreshCw, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { getGeminiConfig, setGeminiConfig } from '../services/geminiService';
import { GoogleGenAI } from '@google/genai';

export const SettingsPanel = () => {
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
    const [showKey, setShowKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        const config = getGeminiConfig();
        setApiKey(config.apiKey);
        setSelectedModel(config.model);
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            setGeminiConfig(apiKey, selectedModel);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!apiKey.trim()) {
            setTestStatus('error');
            setTestMessage('Please enter an API Key first.');
            return;
        }

        setTestStatus('testing');
        setTestMessage('');

        try {
            const ai = new GoogleGenAI({ apiKey });
            // Run a minimal test prompt
            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: "Respond with the word 'SUCCESS' in uppercase and nothing else.",
            });

            if (response.text && response.text.includes('SUCCESS')) {
                setTestStatus('success');
                setTestMessage('Successfully connected to Gemini API!');
            } else {
                setTestStatus('error');
                setTestMessage('Unexpected response. Check model permissions.');
            }
        } catch (error: any) {
            console.error(error);
            setTestStatus('error');
            setTestMessage(error.message || 'Connection failed. Please verify your API Key.');
        }
    };

    return (
        <div className="p-12 max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
            <div className="border-l-8 border-cinema-gold pl-8">
                <h2 className="text-4xl font-black text-text-primary uppercase tracking-tighter mb-2">Engine Settings</h2>
                <p className="text-text-secondary font-serif italic text-lg">Configure your Gemini models, key authorizations, and security settings.</p>
            </div>

            <div className="bg-panel-bg border border-border-color p-10 cinematic-glow space-y-10">
                {/* API Key Section */}
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-cinema-gold flex items-center gap-2">
                        <Key className="w-4 h-4" /> Gemini API Key
                    </label>
                    <p className="text-xs text-text-secondary font-medium leading-relaxed">
                        To run video frames and audio analysis, you must provide your Gemini API key. Keys are saved securely in your browser's local storage and are never sent to any third-party servers.
                    </p>
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <input 
                                type={showKey ? "text" : "password"} 
                                className="w-full bg-studio-bg border border-border-color px-5 py-4 text-text-primary placeholder-text-muted focus:outline-none focus:border-cinema-gold font-mono text-sm leading-relaxed"
                                placeholder="AIzaSy..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <button 
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-4 top-4 text-text-secondary hover:text-white transition-colors"
                            >
                                {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <button 
                            onClick={handleTestConnection}
                            disabled={testStatus === 'testing'}
                            className="px-6 py-4 bg-studio-bg hover:bg-panel-bg text-text-primary border border-border-color text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {testStatus === 'testing' ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="w-4 h-4 text-cinema-gold" />
                                    Test API
                                </>
                            )}
                        </button>
                    </div>

                    {/* Test Results Message */}
                    {testStatus === 'success' && (
                        <div className="bg-emerald-950/20 border border-emerald-900 text-emerald-400 p-4 text-xs font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in">
                            <Check className="w-5 h-5" />
                            <span>{testMessage}</span>
                        </div>
                    )}
                    {testStatus === 'error' && (
                        <div className="bg-rose-950/20 border border-rose-900 text-rose-400 p-4 text-xs font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in">
                            <AlertCircle className="w-5 h-5" />
                            <span>{testMessage}</span>
                        </div>
                    )}
                </div>

                {/* Model Selection */}
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-cinema-gold flex items-center gap-2">
                        <Sliders className="w-4 h-4" /> Gemini Model Configuration
                    </label>
                    <p className="text-xs text-text-secondary font-medium leading-relaxed">
                        Select which model parameter size you want to use for the visual frame scanning and regulatory rating writeups.
                    </p>
                    <select 
                        className="w-full bg-studio-bg border border-border-color px-5 py-4 text-text-primary focus:outline-none focus:border-cinema-gold cursor-pointer font-black text-xs uppercase tracking-widest"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                    >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast, Cost-efficient - Recommended)</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Multimodal Understanding)</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                </div>

                {/* Submit Controls */}
                <div className="flex items-center gap-6 pt-6 border-t border-border-color">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="cinematic-button flex items-center gap-2"
                    >
                        Save Configurations
                    </button>
                    {saveStatus === 'success' && (
                        <span className="text-emerald-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 animate-in fade-in">
                            <Check className="w-4 h-4" /> Config Saved
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
