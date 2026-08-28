import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { 
    Mail, Send, Inbox, Shield, Briefcase, 
    PieChart, Settings, LogOut, Search, 
    Plus, X, ChevronRight, User, Filter,
    Star, AlertCircle, ShoppingBag, GraduationCap,
    Clock, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const Dashboard = () => {
    const { user, logout } = useAuth();
    const [emails, setEmails] = useState([]);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [activeCategory, setActiveCategory] = useState('All');
    const [stats, setStats] = useState({ total: 0, primary: 0, social: 0, promotions: 0, updates: 0, spam: 0 });
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
    const [loading, setLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Categories config
    const categories = [
        { name: 'All', icon: Inbox, color: 'text-blue-400' },
        { name: 'Personal', icon: User, color: 'text-green-400' },
        { name: 'Business', icon: Briefcase, color: 'text-indigo-400' },
        { name: 'Finance', icon: PieChart, color: 'text-amber-400' },
        { name: 'Security', icon: Shield, color: 'text-red-400' },
        { name: 'Work', icon: Briefcase, color: 'text-purple-400' },
        { name: 'College/School', icon: GraduationCap, color: 'text-cyan-400' },
        { name: 'Promotion', icon: ShoppingBag, color: 'text-pink-400' },
        { name: 'Uncategorized', icon: AlertCircle, color: 'text-gray-400' }
    ];

    // Normalize email category to match sidebar tab names
    const normalizeCategory = (cat) => {
        if (!cat) return 'Uncategorized';
        const text = cat.toString().trim().toLowerCase();
        if (text.includes('personal') || text.includes('friend') || text.includes('family') || text.includes('social')) return 'Personal';
        if (text.includes('business') || text.includes('corporate') || text.includes('client')) return 'Business';
        if (text.includes('finance') || text.includes('bank') || text.includes('payment') || text.includes('invoice') || text.includes('bill') || text.includes('transaction')) return 'Finance';
        if (text.includes('security') || text.includes('password') || text.includes('verif') || text.includes('otp') || text.includes('spam') || text.includes('suspicious')) return 'Security';
        if (text.includes('work') || text.includes('office') || text.includes('project') || text.includes('meeting') || text.includes('task') || text.includes('team')) return 'Work';
        if (text.includes('college') || text.includes('school') || text.includes('university') || text.includes('academic') || text.includes('course') || text.includes('assignment') || text.includes('education')) return 'College/School';
        if (text.includes('promotion') || text.includes('promo') || text.includes('offer') || text.includes('discount') || text.includes('sale') || text.includes('newsletter') || text.includes('marketing') || text.includes('update')) return 'Promotion';
        // Check for exact match (case-insensitive) against valid categories
        const exactMatch = ['Personal', 'Business', 'Finance', 'Security', 'Work', 'College/School', 'Promotion', 'Uncategorized']
            .find(c => c.toLowerCase() === text);
        if (exactMatch) return exactMatch;
        return 'Uncategorized';
    };

    const fetchEmails = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${SOCKET_URL}/api/emails`, { withCredentials: true });
            const emailList = Array.isArray(response.data) ? response.data : (response.data?.emails || response.data?.data || []);
            setEmails(emailList);
            
            const statsResponse = await axios.get(`${SOCKET_URL}/api/emails/stats`, { withCredentials: true });
            if (statsResponse.data.success) {
                setStats(statsResponse.data.stats?.categories || statsResponse.data.data?.categories || { total: 0, primary: 0, social: 0, promotions: 0, updates: 0, spam: 0 });
            }
        } catch (error) {
            console.error('Error fetching emails:', error);
            setEmails([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEmails();

        const socket = io(SOCKET_URL, {
            transports: ['polling', 'websocket'],
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            setIsConnected(true);
            if (user?.email) {
                socket.emit('join-room', user.email);
            }
        });

        socket.on('disconnect', () => setIsConnected(false));

        socket.on('new-email', (email) => {
            setEmails(prev => [email, ...prev]);
        });

        return () => {
            if (socket.connected) {
                socket.disconnect();
            } else {
                socket.close();
            }
        };
    }, [user?.email, fetchEmails]);

    const handleSendEmail = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${SOCKET_URL}/api/emails/send`, composeData, { withCredentials: true });
            if (response.data.success) {
                setIsComposeOpen(false);
                setComposeData({ to: '', subject: '', body: '' });
            }
        } catch (error) {
            console.error('Error sending email:', error);
        }
    };

    // Filter emails by active category using normalized matching
    const filteredEmails = activeCategory === 'All'
        ? emails
        : emails.filter(e => normalizeCategory(e.category) === activeCategory);

    // Calculate live counts per category for sidebar badges
    const categoryCounts = emails.reduce((acc, email) => {
        const cat = normalizeCategory(email.category);
        acc[cat] = (acc[cat] || 0) + 1;
        acc['All'] = (acc['All'] || 0) + 1;
        return acc;
    }, { All: 0, Personal: 0, Business: 0, Finance: 0, Security: 0, Work: 0, 'College/School': 0, Promotion: 0, Uncategorized: 0 });

    return (
        <div className="flex h-screen bg-black overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-950/50 backdrop-blur-xl border-r border-white/5 flex flex-col">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <Mail size={20} className="text-white" />
                        </div>
                        <h1 className="font-bold text-xl tracking-tight">LiveMail</h1>
                    </div>

                    <button 
                        onClick={() => setIsComposeOpen(true)}
                        className="w-full bg-white text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 mb-8 hover:bg-gray-200 transition-colors"
                    >
                        <Plus size={20} />
                        Compose
                    </button>

                    <nav className="space-y-1">
                        {categories.map((cat) => (
                            <button
                                key={cat.name}
                                onClick={() => setActiveCategory(cat.name)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                                    activeCategory === cat.name 
                                    ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-lg shadow-blue-600/5' 
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <cat.icon size={18} className={activeCategory === cat.name ? 'text-blue-400' : 'text-gray-500'} />
                                    <span className="font-medium text-sm">{cat.name}</span>
                                </div>
                                {(categoryCounts[cat.name] || 0) > 0 && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        activeCategory === cat.name ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
                                    }`}>
                                        {categoryCounts[cat.name]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="mt-auto p-6 border-t border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <img src={user.profilePicture} alt="" className="w-10 h-10 rounded-full border border-white/10" />
                        <div className="overflow-hidden">
                            <p className="font-semibold text-sm truncate">{user.displayName}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                    </div>
                    <button 
                        onClick={logout}
                        className="w-full flex items-center gap-3 text-gray-500 hover:text-red-400 transition-colors text-sm font-medium"
                    >
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative min-w-0">
                {/* Header */}
                <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4 flex-1 max-w-xl">
                        <div className="relative w-full group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search emails..." 
                                className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-4 focus:outline-none focus:border-blue-600/50 focus:bg-white/[0.07] transition-all text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {isConnected ? 'Live' : 'Offline'}
                            </span>
                        </div>
                        <button 
                            onClick={() => {
                                setIsRefreshing(true);
                                fetchEmails().then(() => setIsRefreshing(false));
                            }}
                            className={`p-2 rounded-full hover:bg-white/5 transition-colors ${isRefreshing ? 'animate-spin text-blue-400' : 'text-gray-400'}`}
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </header>

                {/* Email List */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">{activeCategory}</h2>
                            <p className="text-sm text-gray-500">{filteredEmails?.length || 0} messages</p>
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                                <p className="text-gray-500 animate-pulse">Loading your inbox...</p>
                            </div>
                        ) : (filteredEmails?.length || 0) === 0 ? (
                            <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-white/5 rounded-3xl">
                                <div className="bg-gray-900/50 p-6 rounded-full mb-4">
                                    <Inbox size={48} className="text-gray-700" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Clean inbox!</h3>
                                <p className="text-gray-500">No emails found in this category.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <AnimatePresence mode="popLayout">
                                    {filteredEmails.map((email, idx) => (
                                        <motion.div
                                            layout
                                            key={email._id || email.gmailId}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: idx * 0.03 }}
                                            onClick={() => setSelectedEmail(email)}
                                            className="group bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-blue-600/30 p-4 rounded-2xl cursor-pointer transition-all glowing-card relative overflow-hidden"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                                                    categories.find(c => c.name === email.category)?.color.replace('text-', 'bg-') || 'bg-gray-500'
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-sm truncate pr-4 text-gray-200 group-hover:text-white">
                                                            {email.from.split('<')[0].trim() || email.from}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                                            {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-semibold mb-1 truncate group-hover:text-blue-400 transition-colors">
                                                        {email.subject}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 line-clamp-1">
                                                        {email.snippet}
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                {/* Email Detail View Modal */}
                <AnimatePresence>
                    {selectedEmail && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
                        >
                            <motion.div 
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                className="bg-gray-900 border border-white/10 w-full max-w-4xl h-full max-h-[85vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl"
                            >
                                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setSelectedEmail(null)}
                                            className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                            categories.find(c => c.name === selectedEmail.category)?.color.replace('text-', 'bg-').replace('-400', '-600') || 'bg-gray-700'
                                        } text-white`}>
                                            {selectedEmail.category}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 hover:bg-white/10 rounded-full text-gray-400"><Star size={20} /></button>
                                        <button 
                                            onClick={() => {
                                                setComposeData({ 
                                                    to: selectedEmail.from, 
                                                    subject: `Re: ${selectedEmail.subject}`, 
                                                    body: `\n\n--- On ${new Date(selectedEmail.receivedAt).toLocaleString()}, ${selectedEmail.from} wrote ---\n\n` 
                                                });
                                                setIsComposeOpen(true);
                                            }}
                                            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-6 py-2 rounded-full transition-colors"
                                        >
                                            Reply
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-8 bg-gradient-to-b from-black/20 to-transparent">
                                    <h1 className="text-3xl font-bold mb-6 leading-tight">{selectedEmail.subject}</h1>
                                    <div className="flex items-center gap-4 mb-8 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                        <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-xl">
                                            {selectedEmail.from[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-200">{selectedEmail.from}</p>
                                            <p className="text-xs text-gray-500">To: {selectedEmail.to || 'me'}</p>
                                        </div>
                                        <div className="ml-auto text-xs text-gray-500 font-medium">
                                            {new Date(selectedEmail.receivedAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {selectedEmail.text || selectedEmail.content}
                                    </div>
                                    {selectedEmail.html && (
                                        <div className="mt-8 pt-8 border-t border-white/5">
                                            <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-4 font-bold">HTML Version</p>
                                            <div 
                                                className="bg-white rounded-xl p-4 overflow-hidden" 
                                                dangerouslySetInnerHTML={{ __html: selectedEmail.html }} 
                                            />
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Compose Modal */}
                <AnimatePresence>
                    {isComposeOpen && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
                        >
                            <motion.div 
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                className="bg-gray-900 border border-white/10 w-full max-w-2xl rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
                            >
                                <form onSubmit={handleSendEmail}>
                                    <div className="p-6 border-b border-white/10 flex items-center justify-between">
                                        <h3 className="font-bold text-lg">New Message</h3>
                                        <button 
                                            type="button"
                                            onClick={() => setIsComposeOpen(false)}
                                            className="p-2 hover:bg-white/10 rounded-full text-gray-400"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div>
                                            <input 
                                                type="email" 
                                                placeholder="Recipient"
                                                required
                                                value={composeData.to}
                                                onChange={(e) => setComposeData({...composeData, to: e.target.value})}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-600/50"
                                            />
                                        </div>
                                        <div>
                                            <input 
                                                type="text" 
                                                placeholder="Subject"
                                                required
                                                value={composeData.subject}
                                                onChange={(e) => setComposeData({...composeData, subject: e.target.value})}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-600/50"
                                            />
                                        </div>
                                        <div>
                                            <textarea 
                                                placeholder="Write your message..."
                                                required
                                                rows={12}
                                                value={composeData.body}
                                                onChange={(e) => setComposeData({...composeData, body: e.target.value})}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-600/50 resize-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white/[0.02] flex justify-end gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => setIsComposeOpen(false)}
                                            className="px-6 py-2.5 rounded-full font-bold text-gray-400 hover:text-white transition-colors"
                                        >
                                            Discard
                                        </button>
                                        <button 
                                            type="submit"
                                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-2.5 rounded-full flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                                        >
                                            <Send size={18} />
                                            Send
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

export default Dashboard;