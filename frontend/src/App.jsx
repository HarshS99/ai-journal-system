import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BookOpen, Sparkles, Activity, Map, Hash, Info } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [userId, setUserId] = useState('user-1');
  const [entries, setEntries] = useState([]);
  const [insights, setInsights] = useState(null);
  
  // Form State
  const [ambience, setAmbience] = useState('forest');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      const [entriesRes, insightsRes] = await Promise.all([
        axios.get(`${API_BASE}/journal/${userId}`),
        axios.get(`${API_BASE}/journal/insights/${userId}`)
      ]);
      setEntries(entriesRes.data);
      setInsights(insightsRes.data);
    } catch (error) {
      console.error('Failed to load data', error);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Journal Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE}/journal`, {
        userId,
        ambience,
        text
      });
      setText('');
      loadData();
    } catch (error) {
      console.error('Submit error', error);
      alert('Failed to save entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Analysis
  const handleAnalyze = async (entryId, entryText) => {
    // Optimistic UI loading state update
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, isAnalyzing: true } : e));
    
    try {
      const res = await axios.post(`${API_BASE}/journal/analyze`, { text: entryText });
      const { emotion, summary, keywords } = res.data;
      
      // Update the specific entry
      setEntries(prev => prev.map(e => {
        if (e.id === entryId) {
          return { ...e, emotion, summary, keywords, isAnalyzing: false };
        }
        return e;
      }));
      
      // Refresh insights since new emotions might be cached
      const insightsRes = await axios.get(`${API_BASE}/journal/insights/${userId}`);
      setInsights(insightsRes.data);
      
    } catch (error) {
      console.error('Analyze error', error);
      alert(error.response?.data?.error || 'Analysis failed. Did you specify GEMINI_API_KEY?');
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, isAnalyzing: false } : e));
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 mt-10">
      
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-slate-800 flex items-center justify-center gap-3">
          <Sparkles className="text-emerald-500" />
          ArvyaX Nature Journal
        </h1>
        <p className="text-slate-500 mt-2">Log your immersive sessions and discover your emotions.</p>
      </header>
      
      {/* Insights Section */}
      <section className="mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <BookOpen className="text-blue-500 mb-2" />
          <p className="text-sm text-slate-500 uppercase tracking-widest font-semibold">Entries</p>
          <p className="text-2xl font-bold text-slate-800">{insights?.totalEntries || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <Activity className="text-rose-500 mb-2" />
          <p className="text-sm text-slate-500 uppercase tracking-widest font-semibold">Top Emotion</p>
          <p className="text-2xl font-bold text-slate-800 capitalize">{insights?.topEmotion || '-'}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <Map className="text-emerald-500 mb-2" />
          <p className="text-sm text-slate-500 uppercase tracking-widest font-semibold">Top Ambience</p>
          <p className="text-2xl font-bold text-slate-800 capitalize">{insights?.mostUsedAmbience || '-'}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <Hash className="text-purple-500 mb-2" />
          <p className="text-sm text-slate-500 uppercase tracking-widest font-semibold">Keywords</p>
          <div className="flex flex-wrap justify-center gap-1 mt-1">
            {insights?.recentKeywords?.length > 0 ? insights.recentKeywords.map(k => (
              <span key={k} className="bg-purple-50 text-purple-600 text-xs px-2 py-1 rounded-full">{k}</span>
            )) : <span className="text-slate-400">-</span>}
          </div>
        </div>
      </section>
      
      {/* Main Grid: Form and History */}
      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left Col: Form */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BookOpen size={20} /> New Entry
            </h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">User ID</label>
                <input 
                  type="text" 
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-400 mt-1">Change to view other users</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Ambience Profile</label>
                <select 
                  value={ambience}
                  onChange={(e) => setAmbience(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="forest">Forest</option>
                  <option value="ocean">Ocean</option>
                  <option value="mountain">Mountain</option>
                  <option value="rain">Rain</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Journal Notes</label>
                <textarea 
                  rows="4"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="How did you feel after the session?"
                  className="w-full border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                ></textarea>
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Journal'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Timeline */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Past Sessions</h2>
          
          {entries.length === 0 && (
            <div className="p-8 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">
              No entries found. Write your first journal entry!
            </div>
          )}

          {entries.map(entry => (
            <div key={entry.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative group transition-all hover:border-emerald-200">
              <span className="absolute top-4 right-4 text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                {entry.ambience}
              </span>
              
              <div className="text-sm text-slate-400 mb-3 block">
                {new Date(entry.createdAt).toLocaleString()}
              </div>
              
              <p className="text-slate-700 text-lg leading-relaxed mb-4">"{entry.text}"</p>
              
              {/* Analysis Section */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600 flex items-center gap-1">
                    <Sparkles size={16} className="text-amber-500"/> AI Analysis
                  </span>
                  
                  {(!entry.emotion || entry.emotion.startsWith('Pending')) && !entry.isAnalyzing ? (
                    <button 
                      onClick={() => handleAnalyze(entry.id, entry.text)}
                      className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 text-sm rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      Analyze Text
                    </button>
                  ) : entry.isAnalyzing ? (
                    <span className="text-indigo-500 text-sm font-medium animate-pulse">Analyzing...</span>
                  ) : (
                    <span className="text-emerald-500 text-sm font-medium">Analyzed & Cached</span>
                  )}
                </div>

                {entry.emotion && !entry.emotion.startsWith('Pending') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Detected Emotion</span>
                      <span className="inline-block px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-sm font-bold capitalize">
                        {entry.emotion}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Keywords</span>
                      <div className="flex gap-1 flex-wrap">
                        {Array.isArray(entry.keywords) && entry.keywords.map(k => (
                          <span key={k} className="bg-white border border-slate-200 text-slate-600 text-xs px-2 py-1 rounded-full">{k}</span>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">AI Summary</span>
                      <p className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-100">
                        {entry.summary}
                      </p>
                    </div>
                  </div>
                )}
                
                {entry.emotion?.startsWith('Pending') && (
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <Info size={16}/> Click analyze to process emotions with LLM.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}

export default App;
